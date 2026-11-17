import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTurnHandler } from '../netlify/lib/turn.mjs';

const clients =
  ({ paired = true, staff = { active: true, permissions: { daily: true } } } = {}) =>
  () => ({
    anon: {
      rpc: async () => ({
        data: paired ? { status: 'paired' } : { status: 'pending' },
        error: null,
      }),
    },
    admin: {
      auth: {
        getUser: async (token) =>
          token === 'good'
            ? { data: { user: { id: 'u1' } }, error: null }
            : { data: {}, error: Error('no') },
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: staff, error: null }) }) }),
      }),
    },
  });
const call = (handler, body, auth) =>
  handler({
    httpMethod: 'POST',
    headers: auth ? { authorization: 'Bearer ' + auth } : {},
    body: JSON.stringify(body),
  });
const env = { TURN_KEY_ID: 'key-id', TURN_KEY_API_TOKEN: 'secret' };

test('paired TVs and signed-in staff get Cloudflare TURN servers; the API token never leaks', async () => {
  let called;
  const fetcher = async (url, init) => {
    called = { url, init };
    return Response.json({
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478'] },
        { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' },
      ],
    });
  };
  for (const [body, auth] of [
    [{ token: 'tv-token' }, null],
    [{}, 'good'],
  ]) {
    const r = await call(createTurnHandler(clients(), { fetcher, env }), body, auth);
    assert.equal(r.statusCode, 200);
    const data = JSON.parse(r.body);
    assert.equal(data.relay, true);
    assert.equal(data.iceServers[1].username, 'u');
    assert(!r.body.includes('secret'));
  }
  assert.equal(
    called.url,
    'https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers',
  );
  assert.equal(called.init.headers.Authorization, 'Bearer secret');
});

test('strangers, unpaired TVs and inactive staff are refused', async () => {
  const fetcher = async () => assert.fail('must not call Cloudflare');
  assert.equal((await call(createTurnHandler(clients(), { fetcher, env }), {})).statusCode, 401);
  assert.equal(
    (await call(createTurnHandler(clients({ paired: false }), { fetcher, env }), { token: 'x' }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        createTurnHandler(clients({ staff: { active: false, permissions: { admin: true } } }), {
          fetcher,
          env,
        }),
        {},
        'good',
      )
    ).statusCode,
    403,
  );
});

test('without TURN keys (or if Cloudflare fails) it falls back to STUN so Wi-Fi sending still works', async () => {
  const noKeys = await call(createTurnHandler(clients(), { env: {} }), { token: 't' });
  assert.equal(JSON.parse(noKeys.body).relay, false);
  const down = await call(
    createTurnHandler(clients(), { env, fetcher: async () => new Response('x', { status: 500 }) }),
    { token: 't' },
  );
  assert.equal(JSON.parse(down.body).relay, false);
  assert(JSON.parse(down.body).iceServers.length > 0);
});
