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
  rotation: { enabled: false },
  news: { enabled: false },
};
seed.posts[0].publish_at = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
seed.posts[0].content = {
  ...seed.posts[0].content,
  image: 'https://fixture.invalid/daily.webm',
  imageType: 'video',
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
  await admin.getByLabel('مستوى صوت الشاشة عن بعد', { exact: true }).fill('0.4');
  await tv.waitForFunction(
    () => Math.abs(document.querySelector('.screen-image video').volume - 0.4) < 0.001,
  );
  await admin.getByLabel('إيقاف الشاشة مؤقتًا عن بعد', { exact: true }).click();
  await tv.waitForFunction(() => document.querySelector('.screen-image video')?.paused);
  const pausedTime = await tv.locator('.screen-image video').evaluate((video) => video.currentTime);
  await tv.waitForTimeout(300);
  assert.equal(
    await tv.locator('.screen-image video').evaluate((video) => video.currentTime),
    pausedTime,
  );
  await admin.getByLabel('تشغيل الشاشة عن بعد', { exact: true }).click();
  await tv.waitForFunction(() => !document.querySelector('.screen-image video')?.paused);
  await tv.screenshot({ path: 'work/todo-controls.png' });
  await admin.getByLabel('إيقاف تنزيلات الشاشة مؤقتًا', { exact: true }).click();

  await admin
    .getByLabel('رابط وسائط الشاشة اليومية', { exact: true })
    .fill('https://fixture.invalid/next.webm');
  await admin.getByRole('button', { name: 'استخدام رابط الشاشة اليومية', exact: true }).click();
  await admin.getByLabel('قص وسائط الشاشة اليومية · التكبير', { exact: true }).fill('175');
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await admin.getByRole('status').filter({ hasText: 'تم نشر' }).waitFor();
  await tv.bringToFront();
  await tv.waitForTimeout(300);
  assert.equal(
    await tv.locator('.screen-image video').count(),
    1,
    'Previous daily video remains visible during download pause',
  );
  await admin.getByLabel('متابعة تنزيلات الشاشة', { exact: true }).click();
  await tv.locator('.cache-status-line').waitFor({ state: 'hidden' });
  await tv.waitForFunction(
    () =>
      document.querySelector('.screen-image .daily-media-content>div')?.style.transform ===
      'scale(1.75)',
  );
  await admin
    .getByLabel('رابط وسائط الشاشة اليومية', { exact: true })
    .fill('https://fixture.invalid/daily.gif');
  await admin.getByRole('button', { name: 'استخدام رابط الشاشة اليومية', exact: true }).click();
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.bringToFront();
  await tv.locator('.screen-image img').waitFor();
  assert(
    await tv
      .locator('.screen-image img')
      .evaluate((img) => img.src.startsWith('blob:') && img.naturalWidth > 0),
  );
  await context.unroute('https://fixture.invalid/**');
  await context.route('https://fixture.invalid/**', (route) => route.abort());
  await tv.reload();
  await tv.locator('.screen-image img').waitFor();
  await tv.waitForFunction(() =>
    document.querySelector('audio[data-background-audio]')?.src.startsWith('blob:'),
  );
  assert.equal(audioDownloads, 1, 'Background audio survives reload without another download');
  await admin
    .getByRole('button', { name: 'صورة / فيديو فقط ملء الشاشة دون أي عناصر', exact: true })
    .click();
  await admin.route('**/local/upload/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await admin.locator('.video-playlist-editor input[type=file]').setInputFiles([
    { name: 'lesson.webm', mimeType: 'video/webm', buffer: webm },
    { name: 'poster.gif', mimeType: 'image/gif', buffer: gif },
  ]);
  await admin.waitForFunction(() => document.querySelector('button.publish')?.disabled);
  await admin.getByText('اكتمل الرفع. انشر القائمة على الشاشة.', { exact: true }).waitFor();
  assert.equal(await admin.locator('.playlist-card').count(), 2);
  await admin.locator('.playlist-card').first().locator('summary').click();
  await admin.getByLabel('قص ملف 1 · التكبير', { exact: true }).fill('130');
  await admin.locator('.video-playlist-editor').screenshot({ path: 'work/todo-upload-stack.png' });
  await admin.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.bringToFront();
  await tv.locator('.video-playlist .playlist-video-crop').waitFor();
  assert.equal(
    await tv.locator('.playlist-video-crop').evaluate((element) => element.style.transform),
    'scale(1.3)',
  );
  console.log(
    'PASS mixed multi-file upload locks publication until completion, preserves GIF, and exposes per-item crop.',
  );
  assert.deepEqual(errors, []);
  await tv.screenshot({ path: 'work/todo-daily-media.png' });
  await admin.screenshot({ path: 'work/todo-media-admin.png', fullPage: true });
  console.log(
    'PASS daily video/GIF, saved crop, master volume/pause/resume, download pause preserving current video, and persistent background audio with network blocked.',
  );
} catch (error) {
  for (const context of browser?.contexts() || [])
    for (const page of context.pages()) {
      console.log(
        'DEBUG',
        page.url(),
        await page.locator('body').innerText(),
        await page.locator('video,audio').evaluateAll((elements) =>
          elements.map((element) => ({
            src: element.src,
            paused: element.paused,
            time: element.currentTime,
            error: element.error?.message,
          })),
        ),
      );
    }
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
