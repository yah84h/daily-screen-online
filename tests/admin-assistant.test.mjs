import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createChatGPTConnection } from '../local-test/chatgpt-connection.mjs';
import { completedChatGPTMessage } from '../local-test/chatgpt-stream.mjs';
import { validateProposal } from '../local-test/assistant-tools.mjs';

test('proposals cannot publish, execute arbitrary code or edit design without permission', () => {
  assert.deepEqual(validateProposal({ summary: 'test', content: { title: 'Hello' } }), {
    summary: 'test',
    content: { title: 'Hello' },
  });
  for (const proposal of [
    { summary: 'test', publish: true },
    { summary: 'test', content: { toString: 'bad' } },
    { summary: 'test', content: { image: 'https://example.org' } },
    { summary: 'test', refreshSeconds: 60 },
    { summary: 'test', content: { title: 'x'.repeat(101) } },
  ])
    assert.throws(() => validateProposal(proposal));
  assert.equal(validateProposal({ summary: 'test', refreshSeconds: 60 }, true).refreshSeconds, 60);
  assert.throws(() =>
    validateProposal({ summary: 'test', periods: Array(7).fill(['07:00', '08:00']) }, true),
  );
  assert.throws(() => validateProposal({ summary: 'test', clockTextScale: 100 }, true));
});

test('OAuth checks state and signed identity, isolates staff, encrypts credentials and persists registration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'school-chatgpt-'));
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' };
  let nonce,
    tokenCalls = 0;
  const jwt = (claims) => {
    const segments = [{ alg: 'RS256', kid: 'test' }, claims].map((value) =>
      Buffer.from(JSON.stringify(value)).toString('base64url'),
    );
    return (
      segments.join('.') +
      '.' +
      sign('RSA-SHA256', Buffer.from(segments.join('.')), privateKey).toString('base64url')
    );
  };
  const fakeFetch = async (url, options) => {
    if (url.endsWith('/jwks.json')) return Response.json({ keys: [jwk] });
    if (url.endsWith('/oauth/token')) {
      tokenCalls++;
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('client_id'), 'issued-test');
      assert.equal(form.get('resource'), 'https://api.openai.com/v1');
      return Response.json({
        access_token: 'sensitive-access',
        refresh_token: 'sensitive-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid chatgpt.tokens.use.direct',
        id_token: jwt({
          iss: 'https://auth.openai.com',
          aud: 'issued-test',
          sub: 'test-sub',
          email: 'test@example.org',
          exp: Date.now() / 1000 + 3600,
          nonce,
        }),
      });
    }
    if (url.endsWith('/models'))
      return Response.json({
        models: [
          { slug: 'test-model', display_name: 'Test model', visibility: 'list' },
          { slug: 'hidden', visibility: 'hidden' },
        ],
      });
    if (url.endsWith('/oauth/revoke')) return new Response(null, { status: 200 });
    throw Error('Unexpected network URL');
  };
  const client = createChatGPTConnection(dir, 'staff-one', fakeFetch);
  let restored;
  try {
    const start = await client.start();
    const url = new URL(start.url);
    nonce = url.searchParams.get('nonce');
    assert.equal(url.searchParams.get('client_id'), 'dynamic_agent_client');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    const callback = new URL(url.searchParams.get('redirect_uri'));
    callback.search = new URLSearchParams({
      state: 'wrong',
      code: 'abc',
      client_id: 'issued-test',
    });
    assert.equal((await fetch(callback)).status, 400);
    assert.equal(tokenCalls, 0);
    callback.search = new URLSearchParams({
      state: url.searchParams.get('state'),
      code: 'abc',
      client_id: 'issued-test',
    });
    assert.equal((await fetch(callback)).status, 200);
    assert.equal(client.status().sharing, true);
    assert(!JSON.stringify(client.status()).includes('sensitive-'));
    assert.deepEqual(await client.models(), [{ id: 'test-model', name: 'Test model' }]);
    for (const file of (await readdir(dir)).filter((name) => name.endsWith('.enc')))
      assert(!(await readFile(join(dir, file))).includes(Buffer.from('sensitive-access')));
    const other = createChatGPTConnection(dir, 'staff-two', fakeFetch);
    assert.equal(other.status().connected, false);
    restored = createChatGPTConnection(dir, 'staff-one', fakeFetch);
    const next = await restored.start();
    const nextURL = new URL(next.url);
    assert.equal(nextURL.searchParams.get('client_id'), 'issued-test');
    assert.equal(
      nextURL.searchParams.get('ext_agent_host_id'),
      url.searchParams.get('ext_agent_host_id'),
    );
    restored.cancel();
    await assert.rejects(() =>
      client.verifyIdentity(
        jwt({
          iss: 'https://evil.test',
          aud: 'issued-test',
          sub: 'x',
          exp: Date.now() / 1000 + 60,
        }),
        'issued-test',
      ),
    );
    await client.disconnect();
    assert.equal(client.status().connected, false);
  } finally {
    client.cancel();
    restored?.cancel();
    await rm(dir, { recursive: true, force: true });
  }
});

test('stream accepts completed response only, including errors after streamed text', async () => {
  const response = (events) =>
    new Response(events.map((event) => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join(''));
  const valid = {
    type: 'response.completed',
    response: {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hello' }] }],
    },
  };
  assert.equal((await completedChatGPTMessage(response([valid]))).content, 'Hello');
  await assert.rejects(
    () =>
      completedChatGPTMessage(response([{ type: 'response.output_text.delta', delta: 'partial' }])),
    /before completion/,
  );
  await assert.rejects(
    () =>
      completedChatGPTMessage(
        response([
          {
            type: 'response.failed',
            response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } },
          },
        ]),
      ),
    /limit/,
  );
});

test('completed envelope can omit the text and proposal items delivered earlier in the stream', async () => {
  const response = (events) =>
    new Response(events.map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''));
  const text = { type: 'message', id: 'msg-1', content: [{ type: 'output_text', text: 'مرحبا' }] };
  const call = {
    type: 'function_call',
    id: 'fc-1',
    call_id: 'call-1',
    name: 'propose_changes',
    arguments: JSON.stringify({ summary: 'Update', content: { title: 'Hello' } }),
  };
  const completed = { type: 'response.completed', response: { status: 'completed', output: [] } };
  const events = [
    { type: 'response.output_item.done', output_index: 0, item: text },
    { type: 'response.output_item.done', output_index: 1, item: call },
  ];
  const result = await completedChatGPTMessage(response([...events, completed]));
  assert.equal(result.content, 'مرحبا');
  assert.equal(result.tool_calls.length, 1);
  assert.equal(result.tool_calls[0].function.arguments, call.arguments);
  // A normal full terminal envelope must not duplicate earlier items.
  const full = await completedChatGPTMessage(
    response([
      ...events,
      { ...completed, response: { status: 'completed', output: [text, call] } },
    ]),
  );
  assert.deepEqual(full, result);
  await assert.rejects(() => completedChatGPTMessage(response(events)), /before completion/);
});

test('text deltas are retained only after successful completion', async () => {
  const response = (events) =>
    new Response(events.map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''));
  const events = [
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'Hello ' },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'world' },
    { type: 'response.output_text.done', output_index: 0, content_index: 0, text: 'Hello world' },
  ];
  assert.equal(
    (
      await completedChatGPTMessage(
        response([...events, { type: 'response.completed', response: { status: 'completed' } }]),
      )
    ).content,
    'Hello world',
  );
  await assert.rejects(
    () => completedChatGPTMessage(response([...events, { type: 'response.incomplete' }])),
    /did not complete/,
  );
  await assert.rejects(
    () =>
      completedChatGPTMessage(
        response([
          {
            type: 'response.completed',
            response: { status: 'completed', output: [{ type: 'reasoning' }] },
          },
        ]),
      ),
    /empty completed/,
  );
});

test('weekly broadcast plans validate dates and commit all days with conflict and retry protection', async () => {
  const { applyAssistantSchedule, scheduleVersion } =
    await import('../local-test/assistant-schedule.mjs');
  const date = (offset) =>
    new Date(Date.now() + offset * 86400000).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Riyadh',
    });
  const schedule = [
    { date: date(2), content: { title: 'الأمان الرقمي', body: 'إذاعة الصف الأول' } },
    { date: date(3), content: { title: 'التعاون' } },
  ];
  const db = {
    screens: [{ id: 's' }],
    posts: [
      {
        id: 'existing',
        screen_id: 's',
        publish_at: date(2),
        created_at: new Date().toISOString(),
        content: { title: 'Old', image: '/keep.webp' },
      },
      {
        id: 'other',
        screen_id: 's',
        publish_at: date(5),
        created_at: new Date().toISOString(),
        content: { title: 'Untouched' },
      },
    ],
  };
  const user = { id: 'u', permissions: { daily: true } },
    input = {
      screenId: 's',
      schedule,
      scheduleVersion: scheduleVersion(db.posts, 's'),
      requestId: '12345678-1234-1234-1234-123456789012',
    };
  let commits = 0;
  assert.deepEqual(
    applyAssistantSchedule(db, input, user, () => commits++),
    { saved: schedule.map((entry) => entry.date) },
  );
  assert.equal(db.posts.length, 3);
  assert.equal(db.posts.find((post) => post.id === 'existing').content.title, 'الأمان الرقمي');
  assert.equal(db.posts.find((post) => post.id === 'existing').content.image, '/keep.webp');
  assert.equal(db.posts.find((post) => post.id === 'other').content.title, 'Untouched');
  applyAssistantSchedule(db, input, user, () => commits++);
  assert.equal(commits, 1);
  assert.equal(db.posts.length, 3);
  assert.throws(
    () =>
      applyAssistantSchedule(
        db,
        { ...input, requestId: '22345678-1234-1234-1234-123456789012' },
        user,
        () => {},
      ),
    /تغيرت الجدولة/,
  );
  assert.throws(
    () => applyAssistantSchedule(db, input, { id: 'u', permissions: {} }, () => {}),
    /صلاحية/,
  );
  assert.throws(
    () => validateProposal({ summary: 'Weekly', schedule: [...schedule, schedule[0]] }),
    /غير مكررة/,
  );
  assert.throws(
    () =>
      validateProposal({
        summary: 'Weekly',
        schedule: [{ date: date(0), content: { title: 'Today' } }],
      }),
    /مستقبلية/,
  );
  const before = JSON.stringify(db);
  assert.throws(
    () =>
      applyAssistantSchedule(
        db,
        {
          ...input,
          requestId: '32345678-1234-1234-1234-123456789012',
          scheduleVersion: scheduleVersion(db.posts, 's'),
          schedule: [{ date: date(2), content: { title: 'Rollback' } }],
        },
        user,
        () => {
          throw Error('disk full');
        },
      ),
    /disk full/,
  );
  assert.equal(JSON.stringify(db), before);
});

test('website appearance tools allow only known, permission-checked fields', () => {
  assert.deepEqual(
    validateProposal(
      {
        summary: 'Appearance',
        design: { background: '#112233', displayMode: 'loop', loopHidePhoto: true },
      },
      true,
    ).design,
    { background: '#112233', displayMode: 'loop', loopHidePhoto: true },
  );
  assert.throws(
    () => validateProposal({ summary: 'Appearance', design: { schoolName: 'School' } }, false),
    /administrator/,
  );
  for (const design of [
    { background: 'url(https://example.org)' },
    { displayMode: 'script' },
    { permissions: { admin: true } },
    { fontSize: 999 },
  ])
    assert.throws(() => validateProposal({ summary: 'Appearance', design }, true));
});
