import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaControlStep, playbackState } from '../local-test/media-control-state.mjs';
import { createMediaControlHandler } from '../netlify/lib/media-control.mjs';
test('desired playback is validated and device tokens cannot issue staff commands', () => {
  const state = mediaControlStep(
    null,
    { action: 'set', patch: { paused: true, volume: 0.25, downloadsPaused: true } },
    null,
    1000,
  );
  assert.equal(state.command.action, 'pause');
  assert.equal(state.volume, 0.25);
  assert.equal(state.paused, true);
  assert.throws(
    () => mediaControlStep(state, { action: 'set', patch: { volume: 2 } }, null),
    (error) => error.status === 400,
  );
  assert.throws(
    () => mediaControlStep(state, { action: 'set', patch: { paused: false } }, { id: 'device' }),
    (error) => error.status === 403,
  );
  assert.throws(
    () => mediaControlStep(state, { action: 'seek', mode: 'absolute', seconds: -1 }, null),
    (error) => error.status === 400,
  );
  const seek = mediaControlStep(
    state,
    { action: 'seek', mode: 'absolute', seconds: 12, target: 'audio' },
    null,
    2000,
  );
  assert.equal(seek.command.target, 'audio');
  assert.notEqual(seek.command.id, state.command.id);
});
test('reports retain desired controls and sanitize bounded device feedback', () => {
  const initial = { ...playbackState(null), paused: true, volume: 0.6 };
  const state = mediaControlStep(
    initial,
    {
      action: 'report',
      report: {
        label: 'spoofed',
        duration: Infinity,
        position: -3,
        audio: { position: 8, duration: 20 },
        tasks: Array.from({ length: 20 }, () => ({
          label: 'x'.repeat(400),
          total: Infinity,
          loaded: -2,
        })),
      },
    },
    { id: 'paired-device', label: 'TV' },
    1000,
  );
  assert.equal(state.paused, true);
  assert.equal(state.volume, 0.6);
  assert.equal(state.reports['paired-device'].label, 'TV');
  assert.equal(state.reports['paired-device'].tasks.length, 8);
  assert.equal(state.reports['paired-device'].tasks[0].label.length, 160);
  assert.equal(state.reports['paired-device'].position, 0);
  assert.equal(state.reports['paired-device'].audio.position, 8);
  assert.throws(
    () => mediaControlStep(state, { action: 'report', report: {} }, null),
    (error) => error.status === 403,
  );
});
function fixture({
  profile = { active: true, permissions: { daily: true } },
  deviceScreen = 'screen-1',
  race = false,
  previous = null,
} = {}) {
  const post = {
    id: 'post-1',
    content: { title: 'Keep this title', backgroundAudio: { url: 'audio.mp3' } },
  };
  let raced = false;
  const writes = [];
  const from = (table) => {
    let patch,
      filters = [],
      history = false;
    const q = {
      select() {
        return patch ? finish() : q;
      },
      eq(key, value) {
        filters.push([key, value]);
        return q;
      },
      is(key, value) {
        filters.push([key, value]);
        return q;
      },
      not() {
        history = true;
        return q;
      },
      lte() {
        return q;
      },
      order() {
        return q;
      },
      limit() {
        return q;
      },
      update(value) {
        patch = value;
        return q;
      },
      single: () => read(),
      maybeSingle: () => read(),
    };
    async function read() {
      return {
        data: structuredClone(
          table === 'staff_profiles'
            ? profile
            : table === 'screen_devices'
              ? { id: 'device-1', label: 'TV' }
              : history
                ? previous
                  ? { content: { mediaPlayback: previous } }
                  : null
                : post,
        ),
        error: null,
      };
    }
    async function finish() {
      if (race && !raced) {
        raced = true;
        post.content.mediaPlayback = { ...playbackState(null), paused: true, revision: 3 };
        return { data: [], error: null };
      }
      for (const [key, value] of filters)
        if (key.includes('revision')) {
          const actual = post.content.mediaPlayback?.revision ?? null;
          if ((actual === null ? null : String(actual)) !== value) return { data: [], error: null };
        }
      post.content = patch.content;
      writes.push(structuredClone(patch));
      return { data: [{ id: post.id }], error: null };
    }
    return q;
  };
  const admin = {
    from,
    auth: {
      getUser: async (bearer) => ({
        data: { user: bearer === 'valid' ? { id: 'teacher' } : null },
      }),
    },
  };
  const anon = { rpc: async () => ({ data: { status: 'paired', screen: { id: deviceScreen } } }) };
  const handler = createMediaControlHandler(() => ({ admin, anon }));
  const call = (input = {}, authenticated = true) =>
    handler({
      httpMethod: 'POST',
      headers: authenticated ? { authorization: 'Bearer valid' } : {},
      body: JSON.stringify({ screen: 'screen-1', action: 'state', ...input }),
    });
  return { call, post, writes };
}
test('cloud controls require staff authentication or a token paired to that screen', async () => {
  assert.equal((await fixture().call({}, false)).statusCode, 401);
  assert.equal(
    (await fixture({ profile: { active: true, permissions: { news: true } } }).call()).statusCode,
    403,
  );
  assert.equal(
    (await fixture({ deviceScreen: 'other-screen' }).call({ token: 'paired' }, false)).statusCode,
    403,
  );
  const f = fixture();
  assert.equal((await f.call({ token: 'paired' }, false)).statusCode, 200);
  assert.equal(
    (await f.call({ token: 'paired', action: 'set', patch: { paused: true } }, false)).statusCode,
    403,
  );
  assert.equal(f.writes.length, 0);
});
test('cloud compare-and-swap preserves concurrent controls and published content', async () => {
  const f = fixture({ race: true });
  const result = await f.call({ action: 'set', patch: { volume: 0.3 } });
  assert.equal(result.statusCode, 200);
  const state = JSON.parse(result.body);
  assert.equal(state.paused, true);
  assert.equal(state.volume, 0.3);
  assert.equal(state.revision, 4);
  assert.equal(f.post.content.title, 'Keep this title');
  assert.equal(f.post.content.backgroundAudio.url, 'audio.mp3');
});
test('new publications inherit the preceding screen control state', async () => {
  const f = fixture({
    previous: { ...playbackState(null), paused: true, volume: 0.2, revision: 7 },
  });
  assert.equal(JSON.parse((await f.call()).body).paused, true);
  const saved = await f.call({ action: 'set', patch: { volume: 0.7 } });
  assert.equal(saved.statusCode, 200);
  assert.equal(f.post.content.mediaPlayback.paused, true);
  assert.equal(f.post.content.mediaPlayback.revision, 8);
});
test('only the paired device can report telemetry; reports do not reset playback', async () => {
  const f = fixture();
  await f.call({ action: 'set', patch: { paused: true } });
  assert.equal((await f.call({ action: 'report', report: {} })).statusCode, 403);
  const response = await f.call(
    { token: 'paired', action: 'report', report: { position: 5, duration: 20, paused: true } },
    false,
  );
  assert.equal(response.statusCode, 200);
  assert.equal(f.post.content.mediaPlayback.paused, true);
  assert.equal(f.post.content.mediaPlayback.reports['device-1'].position, 5);
});
