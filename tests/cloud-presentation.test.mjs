import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationHandler } from '../netlify/lib/presentation-control.mjs';
function fixture({
  profile = { active: true, permissions: { daily: true } },
  deviceScreen = 'screen-1',
  race = false,
} = {}) {
  const db = {
      screens: { id: 'screen-1', template: { displayMode: 'presentation' } },
      posts: {
        id: 'post-1',
        content: {
          title: 'Original title',
          presentation: { id: 'deck-1', slides: ['a.jpg', 'b.jpg', 'c.jpg'] },
          backgroundAudio: { url: 'music.mp3' },
        },
      },
    },
    writes = [];
  let raceOnce = race;
  function from(table) {
    let patch,
      filters = [];
    const q = {
      select() {
        if (patch) return finish();
        return q;
      },
      eq(k, v) {
        filters.push([k, v]);
        return q;
      },
      is(k, v) {
        filters.push([k, v]);
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
        data: structuredClone(table === 'staff_profiles' ? profile : db[table]),
        error: null,
      };
    }
    async function finish() {
      if (raceOnce) {
        raceOnce = false;
        db.posts.content.presentationPlayback = {
          deck: 'deck-1',
          slide: 1,
          black: false,
          revision: 1,
        };
        return { data: [], error: null };
      }
      for (const [k, v] of filters)
        if (k.includes('revision')) {
          const actual = db.posts.content.presentationPlayback?.revision ?? null;
          if ((actual === null ? null : String(actual)) !== v) return { data: [], error: null };
        }
      db.posts.content = patch.content;
      writes.push(structuredClone(patch));
      return { data: [{ id: 'post-1' }], error: null };
    }
    return q;
  }
  const admin = {
    auth: {
      getUser: async (bearer) => ({
        data: { user: bearer === 'valid' ? { id: 'teacher' } : null },
      }),
    },
    from,
  };
  const anon = { rpc: async () => ({ data: { status: 'paired', screen: { id: deviceScreen } } }) };
  const handler = createPresentationHandler(() => ({ admin, anon }));
  const call = (body = {}, auth = true) =>
    handler({
      httpMethod: 'POST',
      headers: auth ? { authorization: 'Bearer valid' } : {},
      body: JSON.stringify({ screen: 'screen-1', deck: 'deck-1', action: 'state', ...body }),
    });
  return { call, db, writes };
}
test('cloud control authenticates staff and scopes device tokens to one screen', async () => {
  assert.equal((await fixture().call({}, false)).statusCode, 401);
  assert.equal(
    (await fixture({ profile: { active: true, permissions: { news: true } } }).call()).statusCode,
    403,
  );
  assert.equal(
    (await fixture({ deviceScreen: 'another-screen' }).call({ token: 'device-token' }, false))
      .statusCode,
    403,
  );
  assert.equal((await fixture().call({ token: 'device-token' }, false)).statusCode, 200);
});
test('cloud slide commands preserve published content and reject unpublished decks', async () => {
  const f = fixture();
  assert.equal((await f.call({ deck: 'unpublished', action: 'next' })).statusCode, 409);
  let r = await f.call({ action: 'next' });
  assert.equal(JSON.parse(r.body).slide, 1);
  r = await f.call({ action: 'black' });
  assert.equal(JSON.parse(r.body).black, true);
  assert.equal(f.db.posts.content.title, 'Original title');
  assert.equal(f.db.posts.content.backgroundAudio.url, 'music.mp3');
  assert.equal((await f.call({ action: 'goto', index: 999 })).statusCode, 400);
});
test('cloud optimistic revision check retries simultaneous presenter commands', async () => {
  const f = fixture({ race: true });
  const result = await f.call({ action: 'next' });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).slide, 2);
  assert.equal(f.db.posts.content.presentationPlayback.revision, 2);
});
