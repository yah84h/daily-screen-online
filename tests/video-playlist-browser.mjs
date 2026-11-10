import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const folder = await mkdtemp(join(tmpdir(), 'video-show-')),
  port = 33000 + Math.floor(Math.random() * 14000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
const seed = JSON.parse(await readFile(join(folder, 'seed.json'), 'utf8'));
seed.screens[0].template = {
  ...seed.screens[0].template,
  displayMode: 'daily',
  rotation: { enabled: false },
};
seed.posts[0].publish_at = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
seed.posts[0].content.backgroundAudio = undefined;
seed.posts[0].content.videoSound = false;
seed.posts[0].content.videoPlaylist = {
  enabled: true,
  loop: true,
  items: [1, 2].map((n) => ({
    id: 'clip' + n,
    url: 'https://show.example/' + n + '.webm',
    name: 'Clip ' + n,
    type: 'video',
  })),
};
seed.posts[0].content.videoPlaylist.items.push({
  id: 'photo',
  url: 'https://show.example/photo.png',
  name: 'Photo',
  type: 'image',
  seconds: 3,
});
await writeFile(join(folder, 'seed.json'), JSON.stringify(seed));
const server = spawn(process.execPath, [join(folder, 'server.mjs'), '--localhost'], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/local/status')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' }),
    errors = [];
  context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  const webm = await readFile('tests/fixtures/drive-test.webm'),
    png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
  let release, releaseThird;
  const gate = new Promise((r) => {
      release = r;
    }),
    third = new Promise((r) => {
      releaseThird = r;
    });
  let downloads = 0,
    failThird = true;
  await context.route('https://show.example/**', async (route) => {
    if (route.request().resourceType() === 'fetch') downloads++;
    if (route.request().url().includes('2.webm')) await gate;
    if (route.request().url().includes('3.webm')) {
      await third;
      if (failThird) {
        failThird = false;
        await route.fulfill({ status: 503, body: 'Unavailable' });
        return;
      }
    }
    await route.fulfill(
      route.request().url().endsWith('.png')
        ? { contentType: 'image/png', body: png }
        : { contentType: 'video/webm', body: webm },
    );
  });
  const tv = await context.newPage();
  await tv.goto(base + '/display');
  await tv.locator('.cache-status-line').waitFor();
  await tv.locator('.screen:not(.screen-media)').waitFor();
  assert.equal(await tv.locator('.drive-video-status').count(), 0);
  await tv.screenshot({ path: 'work/video-playlist-preparing.png' });
  release();
  await tv.locator('.cache-status-line').waitFor({ state: 'hidden' });
  assert.equal(downloads, 3);
  const admin = await context.newPage();
  await admin.goto(base + '/admin');
  await admin.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await admin.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await admin.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await admin.waitForURL('**/admin');
  await admin
    .getByRole('button', { name: 'صورة / فيديو فقط ملء الشاشة دون أي عناصر', exact: true })
    .click();
  await admin.getByRole('button', { name: 'رفع ترتيب 3', exact: true }).click();
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.bringToFront();
  await tv.locator('.video-playlist').waitFor();
  await tv.waitForFunction(() => document.querySelector('.video-playlist video')?.currentTime > 0);
  assert.equal(downloads, 3, 'Changing display mode reuses both saved videos');
  await tv.waitForFunction(
    () => document.querySelector('.video-playlist')?.getAttribute('data-playlist-index') === '1',
  );
  await tv.locator('.video-playlist>img').waitFor();
  assert(await tv.locator('.video-playlist>img').evaluate((img) => img.src.startsWith('blob:')));
  await tv.waitForFunction(
    () => document.querySelector('.video-playlist')?.getAttribute('data-playlist-index') === '0',
  );
  await admin.getByLabel('رابط ملف القائمة', { exact: true }).fill('https://show.example/3.webm');
  await admin.getByRole('button', { name: 'إضافة إلى القائمة', exact: true }).click();
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.bringToFront();
  await tv.locator('.cache-status-line').waitFor();
  assert.equal(
    await tv.locator('.video-playlist').count(),
    1,
    'Existing show stays visible while new clip downloads',
  );
  await tv.waitForFunction(() => {
    const v = document.querySelector('.video-playlist video');
    return v && v.currentTime > 0;
  });
  releaseThird();
  await tv.getByRole('button', { name: 'إعادة تجهيز الوسائط', exact: true }).waitFor();
  assert.equal(
    await tv.locator('.video-playlist').count(),
    1,
    'Failed download preserves previous show',
  );
  await tv.getByRole('button', { name: 'إعادة تجهيز الوسائط', exact: true }).click();
  await tv.locator('.cache-status-line').waitFor({ state: 'hidden' });
  assert.equal(downloads, 5, 'Only the added video is retried');
  await context.unroute('https://show.example/**');
  let unexpected = 0;
  await context.route('https://show.example/**', (route) => {
    unexpected++;
    return route.abort();
  });
  await tv.reload();
  await tv.locator('.video-playlist').waitFor();
  await tv.waitForFunction(() => document.querySelector('.video-playlist video')?.currentTime > 0);
  assert.equal(unexpected, 0);
  assert.deepEqual(errors, []);
  await tv.screenshot({ path: 'work/video-playlist-ready.png' });
  console.log('PASS failure retry without replacing the current show.');
  console.log(
    'PASS multi-video preparation behind normal screen, glass status, cached mode switch, ordered looping, admin append, uninterrupted old show during new download, and offline-media reload of all four cached media files.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
