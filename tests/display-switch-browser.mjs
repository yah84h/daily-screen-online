import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const folder = await mkdtemp(join(tmpdir(), 'daily-media-todo-')),
  port = 33000 + Math.floor(Math.random() * 14000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
const seed = JSON.parse(await readFile(join(folder, 'seed.json'), 'utf8'));
seed.screens[0].template = {
  ...seed.screens[0].template,
  displayMode: 'daily',
  loopHidePhoto: false,
  rotation: { enabled: true, normal: 'daily', normalSeconds: 600, leaderboardSeconds: 15 },
  news: { enabled: false },
};
seed.posts[0].publish_at = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
seed.posts[0].content = {
  ...seed.posts[0].content,
  image: 'https://fixture.invalid/daily.webm',
  imageType: 'video',
  fullMedia: 'https://fixture.invalid/unused-broken.webm',
  fullType: 'video',
  videoPreparation: 'cache',
  imageCrop: { x: 25, y: 75, zoom: 150 },
  videoSound: false,
  videoPlaylist: undefined,
  backgroundAudio: { url: 'https://fixture.invalid/background.mp3', name: 'Fixture music' },
};
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
  const context = await browser.newContext({ serviceWorkers: 'block' }),
    errors = [];
  context.on('page', (page) =>
    page.on(
      'pageerror',
      (error) => (errors.push(error.message), console.log('PAGEERROR', error.message)),
    ),
  );
  const webm = await readFile('tests/fixtures/drive-test.webm'),
    mp3 = await readFile('tests/fixtures/direct-link.mp3'),
    gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  let audioDownloads = 0;
  await context.route('https://fixture.invalid/**', (route) => {
    const url = route.request().url();
    if (url.includes('unused-broken'))
      return route.fulfill({ status: 500, body: 'Unused media must not block other modes' });
    if (url.endsWith('.mp3') && route.request().resourceType() === 'fetch') audioDownloads++;
    return route.fulfill({
      contentType: url.endsWith('.mp3')
        ? 'audio/mpeg'
        : url.endsWith('.gif')
          ? 'image/gif'
          : 'video/webm',
      body: url.endsWith('.mp3') ? mp3 : url.endsWith('.gif') ? gif : webm,
    });
  });
  const tv = await context.newPage();
  await tv.goto(base + '/display');
  await tv.waitForFunction(() => {
    const video = document.querySelector('.screen-image video');
    return video?.src.startsWith('blob:') && video.currentTime > 0;
  });
  assert.equal(
    await tv.locator('.screen-image .daily-media-content>div').evaluate((el) => el.style.transform),
    'scale(1.5)',
  );
  const admin = await context.newPage();
  await admin.goto(base + '/admin');
  await admin.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await admin.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await admin.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await admin.waitForURL('**/admin');
  await admin.getByRole('navigation').getByRole('button', { name: 'التصميم', exact: true }).click();
  await admin.getByRole('radio', { name: /خلفية الحصص/ }).click();
  await admin.getByRole('button', { name: 'تطبيق على الشاشة', exact: true }).click();
  await tv.locator('.screen-loop').waitFor();
  await tv.waitForFunction(() =>
    document.querySelector('.loop-center-media video')?.src.startsWith('blob:'),
  );
  await admin.getByRole('radio', { name: /المحتوى اليومي/ }).click();
  await admin.getByRole('button', { name: 'تطبيق على الشاشة', exact: true }).click();
  await tv.waitForFunction(() =>
    document.querySelector('.screen-image video')?.src.startsWith('blob:'),
  );
  await admin
    .getByRole('navigation')
    .getByRole('button', { name: 'التحكم المباشر', exact: true })
    .click();

  await admin.getByRole('navigation').getByRole('button', { name: 'المحتوى', exact: true }).click();
  await admin.getByRole('button', { name: 'الصور والفيديو', exact: true }).click();
  await admin
    .getByLabel('رابط وسائط الشاشة اليومية', { exact: true })
    .fill('https://fixture.invalid/poster.gif');
  await admin.getByRole('button', { name: 'استخدام رابط الشاشة اليومية', exact: true }).click();
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.waitForFunction(() =>
    document.querySelector('.screen-image img')?.src.startsWith('blob:'),
  );
  await admin.getByRole('navigation').getByRole('button', { name: 'التصميم', exact: true }).click();
  await admin.getByRole('radio', { name: /صورة \/ فيديو فقط/ }).click();
  await admin.getByRole('button', { name: 'تطبيق على الشاشة', exact: true }).click();
  await admin.getByRole('navigation').getByRole('button', { name: 'المحتوى', exact: true }).click();
  let driveRequests = 0;
  await context.route('**/api/drive-video?**', (route) => {
    driveRequests++;
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || 'bytes=0-');
    const start = Number(range?.[1] || 0),
      end = Math.min(Number(range?.[2] || webm.length - 1), webm.length - 1);
    return route.fulfill({
      status: 206,
      contentType: 'video/webm',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${webm.length}`,
        'Accept-Ranges': 'bytes',
      },
      body: webm.subarray(start, end + 1),
    });
  });
  await admin
    .getByLabel('رابط الوسائط', { exact: true })
    .fill('https://drive.google.com/file/d/drive_video_test_123456789/view');
  await admin.getByRole('button', { name: 'استخدام رابط الوسائط', exact: true }).click();
  await admin.getByLabel('تجهيز فيديو Drive', { exact: true }).selectOption('stream');
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.waitForFunction(() => {
    const v = document.querySelector('.screen-media video');
    return v?.src.includes('/api/drive-video') && v.currentTime > 0;
  });
  await admin.getByLabel('تجهيز فيديو Drive', { exact: true }).selectOption('cache');
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.waitForFunction(() => {
    const v = document.querySelector('.screen-media video');
    return v?.src.startsWith('blob:') && v.currentTime > 0;
  });
  assert(driveRequests > 0);
  assert.deepEqual(errors, []);
  await tv.screenshot({ path: 'work/display-switch-fixed.png' });
  console.log(
    'PASS daily/class/video mode changes stop stale rotation, unused broken files do not block playback, loop photo/video renders, GIF updates, and Drive streams/caches before playback.',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await rm(folder, { recursive: true, force: true });
}
