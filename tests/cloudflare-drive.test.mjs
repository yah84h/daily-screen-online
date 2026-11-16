import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/drive-video.js';
test('Cloudflare Pages Drive route returns JSON errors rather than the SPA HTML', async () => {
  const response = await onRequest({
    request: new Request('https://school.pages.dev/api/drive-video?id=bad'),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_DRIVE_LINK');
});
test('Cloudflare Pages Drive route preserves video/audio ranges and HEAD semantics', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert(String(url).startsWith('https://drive.usercontent.google.com/'));
    assert.equal(options.headers.Range, 'bytes=0-3');
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 206,
      headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-3/4' },
    });
  };
  try {
    for (const method of ['GET', 'HEAD']) {
      const response = await onRequest({
        request: new Request(
          'https://school.pages.dev/api/drive-video?id=drive_video_test_123456789',
          { method, headers: { Range: 'bytes=0-3' } },
        ),
      });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('Content-Range'), 'bytes 0-3/4');
      assert.equal(response.headers.get('Content-Type'), 'video/mp4');
      assert.equal((await response.arrayBuffer()).byteLength, method === 'HEAD' ? 0 : 4);
    }
  } finally {
    globalThis.fetch = old;
  }
});

test('Workers entry point routes Drive before SPA assets', async () => {
  const { default: worker } = await import('../cloudflare/worker.mjs');
  let assets = 0;
  const env = {
    ASSETS: {
      fetch: async () => {
        assets++;
        return new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } });
      },
    },
  };
  const error = await worker.fetch(
    new Request('https://school.workers.dev/api/drive-video?id=bad'),
    env,
  );
  assert.equal(error.status, 400);
  assert.equal(assets, 0);
  const app = await worker.fetch(new Request('https://school.workers.dev/admin'), env);
  assert.equal(await app.text(), '<html>app</html>');
  assert.equal(assets, 1);
});
