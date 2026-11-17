import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// Image / video mode, one file list: one file plays full screen, two or more become a
// playlist automatically; reorder and delete; the TV follows after publishing.
const folder = await mkdtemp(join(tmpdir(), 'media-editor-')),
  port = 33000 + Math.floor(Math.random() * 14000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
const seed = JSON.parse(await readFile(join(folder, 'seed.json'), 'utf8'));
seed.screens[0].template = {
  ...seed.screens[0].template,
  displayMode: 'media',
  modeTransitions: false,
  rotation: { enabled: false },
};
seed.posts[0].publish_at = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
seed.posts[0].content = {
  ...seed.posts[0].content,
  fullMedia: '',
  videoPlaylist: undefined,
  backgroundAudio: undefined,
  videoSound: false,
};
seed.screen_devices = [{ id: 'm', token: 'm', screen_id: seed.screens[0].id, label: 'TV' }];
await writeFile(join(folder, 'seed.json'), JSON.stringify(seed));
const server = spawn(process.execPath, [join(folder, 'server.mjs'), '--localhost'], {
  env: { ...process.env, PORT: String(port), DAILY_SCREEN_LOCAL_ONLY: '1' },
  stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/local/status')).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const errors = [];
  context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  const webm = await readFile('tests/fixtures/drive-test.webm');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=',
    'base64',
  );
  await context.route('https://media.example/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('.png')
        ? { contentType: 'image/png', body: png }
        : { contentType: 'video/webm', body: webm },
    ),
  );
  const tv = await context.newPage();
  await tv.goto(base + '/display?token=m');
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(base + '/admin');
  await phone.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await phone.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await phone.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  const editor = phone.getByRole('region', { name: 'الصور والفيديو بملء الشاشة' });
  await editor.waitFor();
  const publish = () => phone.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();

  // One file → full screen.
  await phone.getByLabel('رابط ملف').fill('https://media.example/opening.webm');
  await phone.getByRole('button', { name: 'إضافة', exact: true }).click();
  await editor.getByText('يُعرض بملء الشاشة', { exact: true }).waitFor();
  assert.equal(await editor.locator('.media-list>li').count(), 1);
  await publish();
  await tv.waitForFunction(
    () => !!document.querySelector('.screen video[src*="opening"], .screen video[src^="blob:"]'),
    undefined,
    { timeout: 20000 },
  );
  assert.equal(await tv.locator('.video-playlist').count(), 0, 'single file is not a playlist');

  // Second file → playlist automatically; image detected from the link.
  await phone.getByLabel('رابط ملف').fill('https://media.example/poster.png');
  await phone.getByRole('button', { name: 'إضافة', exact: true }).click();
  await editor.getByText('قائمة العرض · 2 ملفات', { exact: true }).waitFor();
  assert.equal(
    await editor.locator('.media-list>li').nth(1).locator('.media-text small').innerText(),
    'صورة',
  );
  // Reorder: the image first.
  await phone.getByRole('button', { name: 'تحريك الملف 2 للأعلى' }).click();
  assert.match(await editor.getByLabel('اسم الملف 1').inputValue(), /poster/);
  await publish();
  await tv.locator('.video-playlist').waitFor();
  await tv.locator('.video-playlist>img').waitFor();

  // Delete one → back to a single full-screen file.
  await phone.getByRole('button', { name: 'حذف الملف 1' }).click();
  await editor.getByText('يُعرض بملء الشاشة', { exact: true }).waitFor();
  await publish();
  await tv.locator('.video-playlist').waitFor({ state: 'detached' });
  await tv.waitForFunction(
    () => !!document.querySelector('.screen video[src*="opening"], .screen video[src^="blob:"]'),
    undefined,
    { timeout: 20000 },
  );
  // Options stay tucked away until needed.
  assert.equal(await phone.getByLabel('بعد انتهاء الفيديو').isVisible(), false);
  await phone.getByText('خيارات التشغيل').click();
  assert.equal(await phone.getByLabel('بعد انتهاء الفيديو').isVisible(), true);
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(
    'PASS media editor: one list, single file full screen, auto playlist, image detection, reorder, delete back to single, options tucked away.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
