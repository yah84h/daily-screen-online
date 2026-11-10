import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDriveLink, driveVideoResponse, DRIVE_CHUNK } from '../local-test/drive-video.mjs';
const id = 'drive_video_test_123456789',
  request = (range, method = 'GET') =>
    new Request('http://localhost/api/drive-video?id=' + id, {
      method,
      headers: range ? { Range: range } : {},
    });
test('Drive share links normalize IDs/resource keys and reject untrusted URLs', () => {
  assert.equal(
    parseDriveLink('https://drive.google.com/file/d/' + id + '/view?usp=sharing').id,
    id,
  );
  assert.equal(
    parseDriveLink('https://drive.google.com/open?id=' + id + '&resourcekey=key_123').resourcekey,
    'key_123',
  );
  for (const url of [
    'http://drive.google.com/file/d/' + id,
    'https://evil.test/file/d/' + id,
    'https://drive.google.com.evil.test/open?id=' + id,
    'https://drive.google.com/drive/folders/' + id,
    'https://name:pass@drive.google.com/open?id=' + id,
    'javascript:alert(1)',
  ])
    assert.equal(parseDriveLink(url), null);
});
test('streaming responses clamp open ranges to a serverless-safe chunk', async () => {
  let range;
  const r = await driveVideoResponse(request('bytes=0-'), {
    fetcher: async (u, o) => {
      range = o.headers.Range;
      return new Response(new Uint8Array(DRIVE_CHUNK), {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes 0-${DRIVE_CHUNK - 1}/${DRIVE_CHUNK * 2}`,
        },
      });
    },
  });
  assert.equal(range, `bytes=0-${DRIVE_CHUNK - 1}`);
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, DRIVE_CHUNK);
});
test('seek ranges and HEAD preserve media headers', async () => {
  const r = await driveVideoResponse(request('bytes=10-19', 'HEAD'), {
    fetcher: async () =>
      new Response(new Uint8Array(10), {
        status: 206,
        headers: { 'Content-Type': 'video/webm', 'Content-Range': 'bytes 10-19/100' },
      }),
  });
  assert.equal(r.headers.get('Content-Length'), '10');
  assert.equal(r.headers.get('Content-Range'), 'bytes 10-19/100');
  assert.equal((await r.arrayBuffer()).byteLength, 0);
});
test('rejects login pages, ignored ranges and malformed or oversized responses', async () => {
  await assert.rejects(
    driveVideoResponse(request(), {
      fetcher: async () =>
        new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }),
    }),
    (e) => e.code === 'DRIVE_NOT_PUBLIC',
  );
  await assert.rejects(
    driveVideoResponse(request(), {
      fetcher: async () =>
        new Response(new Uint8Array(3), { headers: { 'Content-Type': 'video/mp4' } }),
    }),
    (e) => e.code === 'DRIVE_RANGE_UNAVAILABLE',
  );
  const r = await driveVideoResponse(request('bytes=0-2'), {
    fetcher: async () =>
      new Response(new Uint8Array(4), {
        status: 206,
        headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-2/100' },
      }),
  });
  await assert.rejects(r.arrayBuffer(), /LENGTH_MISMATCH/);
});
test('only follows Google download redirects, without credentials', async () => {
  let count = 0;
  await assert.rejects(
    driveVideoResponse(request(), {
      fetcher: async () => {
        count++;
        return new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1/private' },
        });
      },
    }),
    (e) => e.code === 'DRIVE_REDIRECT_REJECTED',
  );
  assert.equal(count, 1);
});
test('rejects multiple/invalid ranges and preserves unsatisfiable-range status', async () => {
  for (const range of ['bytes=0-2,4-6', 'bytes=9-1', 'bytes=-100', 'bytes=9007199254740992-'])
    await assert.rejects(
      driveVideoResponse(request(range), {
        fetcher: () => {
          throw Error('must not fetch');
        },
      }),
      (e) => e.code === 'INVALID_RANGE',
    );
  const r = await driveVideoResponse(request('bytes=100-'), {
    fetcher: async () =>
      new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */100' } }),
  });
  assert.equal(r.status, 416);
  assert.equal(r.headers.get('Content-Range'), 'bytes */100');
});

test('audio links accept audio MIME only with explicit audio mode', async () => {
  const options = {
    fetcher: async () =>
      new Response(new Uint8Array(4), {
        status: 206,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 0-3/4' },
      }),
  };
  await assert.rejects(
    driveVideoResponse(request('bytes=0-3'), options),
    (e) => e.code === 'DRIVE_NOT_PUBLIC',
  );
  const r = await driveVideoResponse(
    new Request('http://local/api/drive-video?id=' + id + '&audio=1'),
    options,
  );
  assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal((await r.arrayBuffer()).byteLength, 4);
});
