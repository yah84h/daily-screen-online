import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// Mode transitions in the TV's real browser (Microsoft Edge plays the H.264 clips):
// switching daily → media plays intro, loops while the new video prepares, then the outro
// reveals the new mode only once it is ready.
const folder = await mkdtemp(join(tmpdir(), 'transitions-')),
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
seed.posts[0].publish_at = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
seed.posts[0].content = {
  ...seed.posts[0].content,
  image: '',
  fullMedia: 'https://fixture.invalid/slow.webm',
  fullType: 'video',
  videoPreparation: 'cache',
  videoPlaylist: undefined,
  backgroundAudio: undefined,
};
seed.screen_devices = [{ id: 'tv', token: 'tv-token', screen_id: seed.screens[0].id, label: 'TV' }];
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
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  const webm = await readFile('tests/fixtures/drive-test.webm');
  // The new mode's video takes 7 s to arrive, so the loop has to cover the wait.
  await context.route('https://fixture.invalid/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 7000));
    await route.fulfill({ contentType: 'video/webm', body: webm });
  });
  const tv = await context.newPage();
  await tv.addInitScript(() => {
    window.__phases = [];
    const seen = () => {
      const phase = document.querySelector('.transition-curtain')?.dataset.phase || null;
      const media = !!document.querySelector('.screen-media, .full-media, .screen video');
      const last = window.__phases.at(-1);
      if (!last || last.phase !== phase || last.media !== media)
        window.__phases.push({ phase, media, at: performance.now() });
    };
    new MutationObserver(seen).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-phase'],
    });
  });
  await tv.goto(base + '/display?token=tv-token');
  await tv.locator('.screen').first().waitFor();
  await tv.waitForFunction(async () => {
    return !!document.querySelector('.transition-curtain video');
  });
  const admin = await context.newPage();
  await admin.goto(base + '/admin');
  await admin.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await admin.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await admin.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  const nav = admin.getByRole('navigation', { name: 'التنقل الرئيسي' });
  await nav.getByRole('button', { name: 'التصميم', exact: true }).click();
  await admin.getByRole('radio', { name: /صورة \/ فيديو/ }).click();
  await admin.getByRole('button', { name: 'تطبيق على الشاشة', exact: true }).click();

  await tv.waitForFunction(
    () => document.querySelector('.transition-curtain')?.dataset.phase === 'intro',
  );
  // The curtain sweeps over the old screen at once: no fade, its loop video plays.
  await tv.waitForFunction(() => {
    const clip = getComputedStyle(document.querySelector('.transition-curtain')).clipPath;
    return (
      clip.startsWith('polygon') &&
      document.querySelector('.transition-curtain video').currentTime > 0.35
    );
  });
  await tv.screenshot({ path: 'work/curtain-sweep.png' });
  assert.equal(
    await tv.evaluate(() => {
      const pill = document.querySelector('.cache-status-line');
      return !pill || getComputedStyle(pill).visibility === 'hidden';
    }),
    true,
    'no progress pill over the curtain',
  );
  await tv.waitForFunction(
    () => document.querySelector('.transition-curtain')?.dataset.phase === 'loop',
  );
  await tv.waitForFunction(
    () => document.querySelector('.transition-curtain')?.dataset.phase === 'outro',
    undefined,
    { timeout: 30000 },
  );
  await tv.waitForFunction(() => !document.querySelector('.transition-overlay.active'), undefined, {
    timeout: 15000,
  });
  await tv.screenshot({ path: 'work/transition-after.png' });
  const phases = await tv.evaluate(() => window.__phases.map((p) => p.phase));
  const order = phases.filter((p, i) => p && p !== phases[i - 1]);
  assert.deepEqual(order, ['intro', 'loop', 'outro']);
  // The new mode is never visible before the outro starts.
  const log = await tv.evaluate(() => window.__phases);
  const outroAt = log.find((p) => p.phase === 'outro').at;
  assert(
    !log.some((p) => p.media && p.at < outroAt && p.phase !== null),
    'new mode stays hidden until the outro',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS mode transition in Edge: curtain sweeps in, loop covers a 7 s preparation, outro reveals the ready mode, no JS errors.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
