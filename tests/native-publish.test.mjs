import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishFromIphone } from '../local-test/native-publish.mjs';
const id = '00000000-0000-0000-0000-000000000123';
const args = {
  p_screen_id: 'screen',
  p_content: { title: 'Hello', future: { keep: true } },
  p_mode: 'daily',
  p_request_id: id,
};
const staff = { id: 'owner', active: true, permissions: { admin: true, daily: true } };
const fixture = () => ({
  screens: [
    {
      id: 'screen',
      draft: { title: 'draft' },
      template: { displayMode: 'loop', news: { items: [] }, future: 7 },
    },
  ],
  posts: [],
});
test('native local publication preserves settings and retries without duplicates', () => {
  const db = fixture();
  let commits = 0;
  const first = publishFromIphone(db, args, staff, () => commits++),
    again = publishFromIphone(db, args, staff, () => commits++);
  assert.deepEqual(first, again);
  assert.equal(commits, 1);
  assert.equal(db.posts.length, 1);
  assert.equal(db.screens[0].draft, null);
  assert.equal(db.screens[0].template.future, 7);
  assert.deepEqual(db.screens[0].template.news, { items: [] });
  assert.throws(
    () => publishFromIphone(db, { ...args, p_content: { title: 'Other' } }, staff, () => {}),
    /محتوى آخر/,
  );
});
test('native local publication rolls back memory when persistence fails', () => {
  const db = fixture(),
    before = structuredClone(db);
  assert.throws(
    () =>
      publishFromIphone(db, args, staff, () => {
        throw Error('disk failure');
      }),
    /disk failure/,
  );
  assert.deepEqual(db, before);
});
test('native local publication enforces daily permission and admin-only mode changes', () => {
  for (const user of [
    null,
    { id: 'news', active: true, permissions: { news: true } },
    { ...staff, active: false },
  ]) {
    assert.throws(() => publishFromIphone(fixture(), args, user, () => {}), /صلاحية/);
  }
  const daily = { id: 'teacher', active: true, permissions: { daily: true } };
  assert.throws(() => publishFromIphone(fixture(), args, daily, () => {}), /المسؤول/);
  const db = fixture();
  db.screens[0].template.displayMode = 'daily';
  publishFromIphone(db, args, daily, () => {});
  assert.equal(db.posts[0].created_by, 'teacher');
});
test('native local publication rejects invalid identifiers, empty media and oversized content', () => {
  for (const patch of [
    { p_request_id: 'bad' },
    { p_content: {} },
    { p_mode: 'media' },
    { p_content: { title: 'x'.repeat(200001) } },
  ]) {
    assert.throws(() => publishFromIphone(fixture(), { ...args, ...patch }, staff, () => {}));
  }
});

test('template patches preserve unrelated nested fields and school news', async () => {
  const { saveTemplatePatch } = await import('../local-test/template-patch.mjs');
  const db = fixture();
  db.screens[0].template.loopAppearance = { background: '#ffffff', futureSetting: 42 };
  saveTemplatePatch(
    db,
    {
      p_screen_id: 'screen',
      p_patch: {
        background: '#123456',
        loopAppearance: { background: '#123456' },
        news: { items: [{ text: 'Do not overwrite' }] },
      },
    },
    staff,
    () => {},
  );
  assert.equal(db.screens[0].template.loopAppearance.futureSetting, 42);
  assert.deepEqual(db.screens[0].template.news, { items: [] });
  assert.throws(
    () =>
      saveTemplatePatch(
        db,
        { p_screen_id: 'screen', p_patch: {} },
        { active: true, permissions: { daily: true } },
        () => {},
      ),
    /المسؤول/,
  );
});
test('template save rolls back on disk error and rejects prototype keys', async () => {
  const { saveTemplatePatch, mergeTemplatePatch } =
    await import('../local-test/template-patch.mjs');
  const db = fixture(),
    before = structuredClone(db);
  assert.throws(
    () =>
      saveTemplatePatch(
        db,
        { p_screen_id: 'screen', p_patch: { background: '#123456' } },
        staff,
        () => {
          throw Error('disk failure');
        },
      ),
    /disk failure/,
  );
  assert.deepEqual(db, before);
  assert.throws(
    () => mergeTemplatePatch({}, JSON.parse('{"__proto__":{"polluted":true}}')),
    /غير مسموح/,
  );
  assert.equal({}.polluted, undefined);
});
test('scheduling is retry-safe and does not switch mode or clear a draft', async () => {
  const { scheduleFromIphone } = await import('../local-test/native-publish.mjs');
  const db = fixture();
  const before = structuredClone(db.screens[0]);
  const date = '2099-11-09';
  const first = scheduleFromIphone(db, { ...args, p_date: date }, staff, () => {});
  const again = scheduleFromIphone(db, { ...args, p_date: date }, staff, () => {});
  assert.deepEqual(first, again);
  assert.equal(db.posts.length, 1);
  assert.deepEqual(db.screens[0], before);
  assert.throws(() => scheduleFromIphone(db, { ...args, p_date: '2020-02-31' }, staff, () => {}));
});
