import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// .m4v videos (Apple's name for MP4) play on the TV, in Edge (the TV's browser, H.264):
// uploaded in image/video mode, and sent phone → TV in presenting mode.
const folder = await mkdtemp(join(tmpdir(), 'm4v-')),
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
seed.posts[0].content = { ...seed.posts[0].content, fullMedia: '', videoPlaylist: undefined };
seed.screen_devices = [{ id: 'v', token: 'v', screen_id: seed.screens[0].id, label: 'TV' }];
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
  browser = await chromium.launch({
    channel: 'msedge',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const errors = [];
  context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  const m4v = {
    name: 'عرض المدرسة.m4v',
    mimeType: 'video/x-m4v',
    buffer: await readFile('tests/fixtures/sample.m4v'),
  };
  const tv = await context.newPage();
  await tv.goto(base + '/display?token=v');
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(base + '/admin');
  await phone.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await phone.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await phone.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();

  // 1) Image / video mode: upload the .m4v from the phone, publish, the TV plays it.
  await phone.getByLabel('ملفات من الجوال').setInputFiles(m4v);
  await phone.getByText('يُعرض بملء الشاشة', { exact: true }).waitFor();
  assert.equal(await phone.locator('.media-text small').first().innerText(), 'فيديو');
  await phone.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.waitForFunction(
    () => {
      const v = document.querySelector('.screen video');
      return v && v.currentTime > 0.2 && v.videoWidth > 0;
    },
    undefined,
    { timeout: 30000 },
  );

  // 2) Presenting mode: send the .m4v straight to the TV; it is saved, checked and plays.
  const nav = phone.getByRole('navigation', { name: 'التنقل الرئيسي' });
  await nav.getByRole('button', { name: 'التصميم', exact: true }).click();
  await phone.getByRole('radio', { name: /وضع التقديم/ }).click();
  await phone.getByRole('button', { name: 'تطبيق على الشاشة', exact: true }).click();
  await nav.getByRole('button', { name: 'اليوم', exact: true }).click();
  await phone.getByText('التلفزيون متصل. أضف ملفات العرض').waitFor({ timeout: 30000 });
  await phone.locator('.show-add input[type=file]').setInputFiles(m4v);
  await phone.getByText('كل شيء محفوظ على التلفزيون. جاهز للعرض').waitFor({ timeout: 60000 });
  await phone.getByRole('button', { name: 'ابدأ العرض' }).click();
  await tv.waitForFunction(
    () => {
      const v = document.querySelector('.show-layer video');
      return v && v.currentTime > 0.2 && v.videoWidth > 0;
    },
    undefined,
    { timeout: 30000 },
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS .m4v: uploaded and played full screen, and sent phone → TV and played in presenting mode (Edge).',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
