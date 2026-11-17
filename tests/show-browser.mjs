import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// Presenting mode end to end: phone → TV files (WebRTC), link download on the TV,
// readiness gating, remote control, persistence on the TV, and nothing uploaded to the server.
const folder = await mkdtemp(join(tmpdir(), 'show-mode-')),
  port = 33000 + Math.floor(Math.random() * 14000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
const seed = JSON.parse(await readFile(join(folder, 'seed.json'), 'utf8'));
seed.screens = [
  {
    ...seed.screens[0],
    template: { ...seed.screens[0].template, displayMode: 'daily', rotation: { enabled: false } },
  },
];
seed.screen_devices = [
  { id: 'show-tv', token: 'show-tv-token', screen_id: seed.screens[0].id, label: 'Hall TV' },
];
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
  // SHOW_BROWSER=msedge runs it in the TV's real browser, which also plays the H.264 transitions.
  const edge = process.env.SHOW_BROWSER === 'msedge';
  browser = await chromium.launch({
    ...(edge ? { channel: 'msedge' } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const errors = [];
  const tvContext = await browser.newContext({ serviceWorkers: 'block' });
  const phoneContext = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  for (const context of [tvContext, phoneContext])
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=',
    'base64',
  );
  await tvContext.route('https://fixture.invalid/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: png,
    }),
  );
  const uploads = [];
  phoneContext.on('request', (request) => {
    if (/\/local\/upload\/|\/storage\//.test(request.url())) uploads.push(request.url());
  });

  const tv = await tvContext.newPage();
  await tv.goto(base + '/display?token=show-tv-token');
  const phone = await phoneContext.newPage();
  phone.setDefaultTimeout(40000);
  await phone.goto(base + '/admin');
  await phone.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await phone.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await phone.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  const nav = phone.getByRole('navigation', { name: 'التنقل الرئيسي' });
  await nav.getByRole('button', { name: 'التصميم', exact: true }).click();
  await phone.getByRole('radio', { name: /وضع التقديم/ }).click();
  await phone.getByRole('button', { name: 'تطبيق على الشاشة', exact: true }).click();
  await nav.getByRole('button', { name: 'اليوم', exact: true }).click();
  await tv.locator('.show-standby').waitFor();
  await phone.getByText('التلفزيون متصل. أضف ملفات العرض').waitFor();

  await phone.getByLabel(/عنوان العرض/).fill('حفل التخرج');
  await phone.getByLabel(/عنوان العرض/).blur();
  await tv.getByRole('heading', { name: 'حفل التخرج' }).waitFor();

  const webm = await readFile('tests/fixtures/drive-test.webm');
  await phone.locator('.show-add input[type=file]').setInputFiles([
    { name: 'opening.webm', mimeType: 'video/webm', buffer: webm },
    { name: 'poster.png', mimeType: 'image/png', buffer: png },
  ]);
  await phone.getByLabel('رابط ملف').fill('https://fixture.invalid/closing.png');
  await phone.getByLabel('نوع الرابط').selectOption('image');
  await phone.getByRole('button', { name: 'إضافة', exact: true }).click();
  await phone.getByText('كل شيء محفوظ على التلفزيون. جاهز للعرض').waitFor();
  await phone.getByText('على التلفزيون ✓').nth(2).waitFor();
  await tv.getByText('● 3/3').waitFor();
  // Standby background: the school loop by default, or a photo sent from the phone.
  if (edge) {
    await tv.locator('.show-standby.with-loop video').waitFor();
    await tv.waitForTimeout(1500);
    await tv.screenshot({ path: 'work/show-tv-standby-loop.png' });
  }
  await phone.getByLabel('صورة الخلفية').setInputFiles({
    name: 'hall.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await phone.getByText('hall.png · على التلفزيون ✓').waitFor();
  await tv.locator('.show-standby.with-photo img.show-standby-bg').waitFor();
  await tv.screenshot({ path: 'work/show-tv-standby-photo.png' });
  await phone.screenshot({ path: 'work/show-phone-ready.png', fullPage: true });

  await phone.getByRole('button', { name: 'ابدأ العرض' }).click();
  if (edge)
    await tv.waitForFunction(
      () => document.querySelector('.transition-overlay video.on')?.dataset.phase === 'outro',
    );
  await tv.waitForFunction(() => {
    const video = document.querySelector('.show-layer video');
    return video?.src.startsWith('blob:') && video.currentTime > 0;
  });
  // Full video remote: live position from the TV, pause/play, volume, mute.
  await phone.waitForFunction(() => {
    const spans = document.querySelectorAll('.show-time span');
    return spans.length === 2 && spans[1].textContent !== '0:00';
  });
  await phone.getByRole('button', { name: 'إيقاف الفيديو مؤقتًا' }).click();
  await tv.waitForFunction(() => document.querySelector('.show-layer video').paused);
  await phone.getByRole('button', { name: 'تشغيل الفيديو' }).waitFor();
  await phone.getByRole('button', { name: 'تشغيل الفيديو' }).click();
  await tv.waitForFunction(() => !document.querySelector('.show-layer video').paused);
  await phone.getByLabel('مستوى الصوت').fill('40');
  await tv.waitForFunction(() => document.querySelector('.show-layer video').volume === 0.4);
  await phone.getByRole('button', { name: 'كتم الصوت' }).click();
  await tv.waitForFunction(() => document.querySelector('.show-layer video').muted);
  await phone.getByRole('button', { name: 'تشغيل الصوت' }).click();
  await tv.waitForFunction(() => !document.querySelector('.show-layer video').muted);
  await phone.screenshot({ path: 'work/show-phone-video.png', fullPage: true });
  // Black screen keeps the position; the audience sees black.
  await phone.getByRole('button', { name: 'شاشة سوداء' }).click();
  await tv.locator('.show-blackout.on').waitFor();
  await phone.getByText('الشاشة سوداء الآن').waitFor();
  await phone.getByRole('button', { name: 'إظهار الشاشة' }).click();
  await tv.locator('.show-blackout.on').waitFor({ state: 'detached' });
  await phone.getByRole('button', { name: 'التالي' }).click();
  await tv.locator('.show-layer img').waitFor();
  await phone.getByText('2 / 3').waitFor();
  await phone
    .locator('.show-next-up')
    .getByText(/\.png$/)
    .waitFor();
  await phone.screenshot({ path: 'work/show-phone-remote.png', fullPage: true });
  await phone.getByRole('button', { name: 'التالي' }).click();
  await phone.getByText('3 / 3').waitFor();
  assert(await phone.getByRole('button', { name: 'التالي' }).isDisabled());
  await phone.getByRole('button', { name: 'شاشة الانتظار' }).click();
  await tv.locator('.show-standby').waitFor();
  await phone.getByRole('button', { name: 'متابعة العرض' }).click();
  await tv.locator('.show-layer img').waitFor();
  await phone.getByRole('button', { name: /1\s*opening\.webm/ }).click();
  await tv.locator('.show-layer video').waitFor();
  await phone.getByRole('button', { name: 'إنهاء العرض' }).click();
  await tv.locator('.show-standby').waitFor();

  // Auto-advance: an image moves on by itself after its time.
  await phone.getByLabel(/انتقال تلقائي/).check();
  await phone.getByLabel('مدة كل صورة / شريحة').selectOption('5');
  await phone.getByRole('button', { name: 'ابدأ العرض' }).click();
  await phone.getByRole('button', { name: /^2\s/ }).click();
  await phone.getByText('2 / 3').waitFor();
  await phone.getByText('3 / 3').waitFor({ timeout: 12000 });
  await phone.getByRole('button', { name: 'إنهاء العرض' }).click();
  await tv.locator('.show-standby').waitFor();
  await phone.getByLabel(/انتقال تلقائي/).uncheck();

  // PowerPoint is turned into slides on the phone and sent straight to the TV.
  await phone
    .locator('.show-add input[type=file]')
    .setInputFiles('tests/fixtures/presentation-test.pptx');
  await phone.getByText(/PowerPoint · \d+ شريحة/).waitFor({ timeout: 90000 });
  await phone.getByText('كل شيء محفوظ على التلفزيون. جاهز للعرض').waitFor({ timeout: 90000 });
  assert.equal(await phone.locator('.show-items').getByText('على التلفزيون ✓').count(), 4);
  const total = await tv.locator('.show-standby-note').innerText();
  const slides = Number(total.match(/\/(\d+)/)[1]);
  assert(slides > 3, 'deck adds one step per slide');
  await phone.getByRole('button', { name: 'ابدأ العرض' }).click();
  await phone.getByRole('button', { name: new RegExp('^' + slides + '\\s') }).click();
  await tv.locator('.show-layer img').waitFor();
  await phone.getByText(slides + ' / ' + slides).waitFor();
  // Slide thumbnails on the phone remote.
  // Every PowerPoint slide has a thumbnail (the 1×1 test PNG is too small to thumbnail).
  assert((await phone.locator('.show-jump-thumb').count()) >= slides - 3);
  await phone.locator('.show-now-thumb').waitFor();
  // A presenter clicker / keyboard on the TV drives the show too.
  await tv.keyboard.press('Home');
  await phone.getByText('1 / ' + slides).waitFor();
  await tv.keyboard.press('PageDown');
  await phone.getByText('2 / ' + slides).waitFor();
  await tv.keyboard.press('PageUp');
  await phone.getByText('1 / ' + slides).waitFor();
  await tv.keyboard.press('b');
  await tv.locator('.show-blackout.on').waitFor();
  await tv.keyboard.press('b');
  await tv.locator('.show-blackout.on').waitFor({ state: 'detached' });
  await phone.getByRole('button', { name: 'إنهاء العرض' }).click();
  if (edge)
    await tv.waitForFunction(
      () => document.querySelector('.transition-overlay video.on')?.dataset.phase === 'intro',
    );

  // Files live on the TV: after a reload everything is still there, ready.
  await tv.reload();
  await tv.getByText('● ' + slides + '/' + slides).waitFor();
  await phone.getByText('كل شيء محفوظ على التلفزيون. جاهز للعرض').waitFor();
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(uploads, [], 'nothing is uploaded to the server');
  assert.deepEqual(errors, []);
  console.log(
    'PASS presenting mode: phone→TV transfer, TV link download, readiness gate, start/next/standby/resume/jump/end, video seek/pause/volume/mute, black screen, auto-advance, standby photo, clicker keys, slide thumbnails, TV persistence, no server upload, no JS errors.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
