import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeLeaderboard,
  leaderboardOptions,
  leaderboardPages,
} from '../local-test/qudrat-data.mjs';
import { fetchQudratLeaderboard, leaderboardURL } from '../local-test/qudrat-pro.mjs';
const data = {
  week: 45,
  updated_at: '2026-11-09T15:47:02.941579+00:00',
  exams: [
    {
      kind: 'weekly',
      title: 'اختبار الأسبوع 11',
      kind_label: 'قدرات عربي',
      leaders: Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        name: 'طالب تجريبي ' + (i + 1),
        score: 100 - i * 4,
      })),
    },
    {
      kind: 'gat',
      title: 'GAT Week 11',
      kind_label: 'قدرات إنجليزي',
      leaders: Array.from({ length: 3 }, (_, i) => ({
        rank: i + 1,
        name: 'طالب GAT ' + (i + 1),
        score: 90 - i * 10,
      })),
    },
  ],
};
const endpoint = (name) =>
  'https://fixture.supabase.co/functions/v1/public-leaderboard?key=' + name;
test('top three remain above paginated ranks four through ten', () => {
  const normalized = normalizeLeaderboard(data),
    pages = leaderboardPages(normalized, { layout: 'podium', exam: 'weekly', pageSize: 3 });
  assert.equal(pages.length, 3);
  for (const page of pages)
    assert.deepEqual(
      page.top.map((x) => x.rank),
      [1, 2, 3],
    );
  assert.deepEqual(
    pages.map((p) => p.rows.map((x) => x.rank)),
    [[4, 5, 6], [7, 8, 9], [10]],
  );
  assert.equal(pages[2].pageCount, 3);
});
test('English-only three-person board, all-exam rotation, list layout and empty results', () => {
  const normalized = normalizeLeaderboard(data);
  assert.equal(leaderboardPages(normalized, { exam: 'gat' })[0].rows.length, 0);
  assert.equal(leaderboardPages(normalized, { exam: 'all' }).length, 4);
  const list = leaderboardPages(normalized, { exam: 'weekly', layout: 'list', pageSize: 4 });
  assert.equal(list[0].top.length, 0);
  assert.deepEqual(
    list.flatMap((p) => p.rows.map((x) => x.rank)),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(leaderboardPages({ week: 45, updated_at: null, exams: [] }), []);
  assert.equal(
    leaderboardPages({
      week: 45,
      updated_at: null,
      exams: [{ ...normalized.exams[0], leaders: [] }],
    })[0].rows.length,
    0,
  );
});
test('untrusted settings and malformed scores/names are normalized without invented ranks', () => {
  assert.deepEqual(leaderboardOptions({ pageSize: 100, exam: 'bad', layout: 'bad' }), {
    refreshSeconds: 30,
    pageSize: 3,
    exam: 'weekly',
    layout: 'podium',
  });
  const sample = structuredClone(data);
  sample.exams[0].leaders = [
    { rank: 2, name: '  اسم\nطالب  ', score: 80 },
    { rank: 1, name: 'أول', score: 95 },
    { rank: -1, name: 'bad', score: 100 },
    { rank: 3, name: '', score: 60 },
    { rank: 4, name: 'bad score', score: null },
  ];
  const rows = normalizeLeaderboard(sample).exams[0].leaders;
  assert.deepEqual(
    rows.map((x) => x.rank),
    [1, 2],
  );
  assert.equal(rows[1].name, 'اسم طالب');
  assert.throws(() => normalizeLeaderboard({ exams: 'bad' }));
  assert.throws(() =>
    normalizeLeaderboard({
      exams: [{ kind: 'weekly', leaders: [{ name: 'x', rank: 1, score: 'bad' }] }],
    }),
  );
});
test('only the configured Supabase leaderboard endpoint is fetched, with redirects disabled', async () => {
  for (const value of [
    'http://fixture.supabase.co/functions/v1/public-leaderboard?key=x',
    'https://evil.example/functions/v1/public-leaderboard?key=x',
    'https://fixture.supabase.co/wrong?key=x',
    'https://fixture.supabase.co/functions/v1/public-leaderboard',
  ])
    assert.throws(() => leaderboardURL(value));
  let calls = 0;
  const url = endpoint('private-unit-key');
  const result = await fetchQudratLeaderboard({
    url,
    now: 1000,
    fetcher: async (request, options) => {
      calls++;
      assert.equal(request, url);
      assert.equal(options.redirect, 'error');
      return Response.json(data);
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.stale, false);
  assert(!JSON.stringify(result).includes('private-unit-key'));
});
test('25-second cache, persisted fallback and stale marking retain last valid results', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qudrat-cache-')),
    cacheFile = path.join(dir, 'cache.json'),
    url = endpoint('cache-test');
  let calls = 0;
  try {
    const fetcher = async () => {
      calls++;
      return Response.json(data);
    };
    await fetchQudratLeaderboard({ url, cacheFile, fetcher, now: 1000 });
    await fetchQudratLeaderboard({ url, cacheFile, fetcher, now: 2000 });
    assert.equal(calls, 1);
    await fetchQudratLeaderboard({ url, cacheFile, fetcher, now: 27000 });
    assert.equal(calls, 2);
    const stale = await fetchQudratLeaderboard({
      url,
      cacheFile,
      now: 400000,
      fetcher: async () => {
        throw Error('offline');
      },
    });
    assert.equal(stale.stale, true);
    assert.equal(stale.exams[0].leaders.length, 10);
    assert.equal(stale.fetchedAt, 27000);
    assert(!fs.readFileSync(cacheFile, 'utf8').includes('cache-test'));
    await fetchQudratLeaderboard({ url: endpoint('other'), fetcher, now: 1000 });
    const restored = await fetchQudratLeaderboard({
      url,
      cacheFile,
      now: 400000,
      fetcher: async () => {
        throw Error('offline');
      },
    });
    assert.equal(restored.stale, true);
    assert.equal(restored.exams[0].leaders.length, 10);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('a valid empty new week replaces the old results rather than presenting them as current', async () => {
  const url = endpoint('empty-new-week');
  await fetchQudratLeaderboard({ url, now: 1000, fetcher: async () => Response.json(data) });
  const empty = await fetchQudratLeaderboard({
    url,
    now: 400000,
    fetcher: async () => Response.json({ week: 46, exams: [], updated_at: '2026-11-16T08:00:00Z' }),
  });
  assert.equal(empty.stale, false);
  assert.equal(empty.week, 46);
  assert.deepEqual(empty.exams, []);
});
test('oversized responses fail safely and Netlify reports missing configuration without leaking it', async () => {
  await assert.rejects(() =>
    fetchQudratLeaderboard({
      url: endpoint('large'),
      fetcher: async () =>
        new Response('{}', { headers: { 'Content-Length': String(2 * 1024 * 1024) } }),
    }),
  );
  const { handler } = await import('../netlify/functions/qudrat-pro.mjs');
  const previous = process.env.QUDRAT_PRO_LEADERBOARD_URL;
  delete process.env.QUDRAT_PRO_LEADERBOARD_URL;
  try {
    assert.equal((await handler({ httpMethod: 'POST' })).statusCode, 405);
    const result = await handler({ httpMethod: 'GET' });
    assert.equal(result.statusCode, 503);
    assert.equal(JSON.parse(result.body).error, 'NOT_CONFIGURED');
  } finally {
    if (previous !== undefined) process.env.QUDRAT_PRO_LEADERBOARD_URL = previous;
  }
});
