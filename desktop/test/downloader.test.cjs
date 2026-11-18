const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDownloader, driveTarget, confirmFormURL } = require('../downloader.cjs');

test('recognises Drive share links and the site proxy URL', () => {
  assert.deepEqual(driveTarget('https://drive.google.com/file/d/1ecsvqBpKI-YoILtv2bd0MmzQLj7ulyqu/view'), {
    id: '1ecsvqBpKI-YoILtv2bd0MmzQLj7ulyqu',
    resourcekey: '',
  });
  assert.equal(
    driveTarget('/api/drive-video?id=1ecsvqBpKI-YoILtv2bd0MmzQLj7ulyqu&resourcekey=k', 'https://ezaati.com/tv').resourcekey,
    'k',
  );
  assert.equal(driveTarget('https://example.com/a.mp4'), null);
});

test('resubmits the Drive large-file warning form', () => {
  const html = `<form id="download-form" action="https://drive.usercontent.google.com/download" method="get">
    <input type="hidden" name="id" value="ABCDEFGHIJKL"><input type="hidden" name="confirm" value="t">
    <input type="hidden" name="uuid" value="u-1"></form>`;
  const u = confirmFormURL(html);
  assert.equal(u.searchParams.get('uuid'), 'u-1');
  assert.equal(u.searchParams.get('id'), 'ABCDEFGHIJKL');
});

test('downloads once to disk, follows the warning page, and reuses the saved file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezaati-'));
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    if (!String(url).includes('uuid'))
      return new Response('<form action="https://drive.usercontent.google.com/download"><input type="hidden" name="uuid" value="x"></form>', {
        headers: { 'content-type': 'text/html' },
      });
    return new Response(new Uint8Array(1000), { headers: { 'content-type': 'video/mp4', 'content-length': '1000' } });
  };
  const d = createDownloader({ dir, fetcher });
  const link = 'https://drive.google.com/file/d/1ecsvqBpKI-YoILtv2bd0MmzQLj7ulyqu/view';
  const progress = [];
  const [a, b] = await Promise.all([
    d.prepare(link, { onProgress: (l) => progress.push(l) }),
    d.prepare(link),
  ]);
  assert.equal(a, b);
  assert.equal(a.size, 1000);
  assert.equal(calls, 2);
  assert.ok(fs.existsSync(d.fileFor(a.file).path));
  // A new downloader (after a restart) still finds it without the network.
  const again = createDownloader({ dir, fetcher: () => assert.fail('no network') });
  assert.equal((await again.prepare(link)).file, a.file);
  await again.forget(link);
  assert.equal(again.fileFor(a.file), null);
});

test('rejects private Drive files that only return HTML', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezaati-'));
  const d = createDownloader({
    dir,
    fetcher: async () => new Response('<html>sign in</html>', { headers: { 'content-type': 'text/html' } }),
  });
  await assert.rejects(d.prepare('https://drive.google.com/file/d/AAAAAAAAAAAAAAAA/view'), /DRIVE_NOT_PUBLIC/);
});
