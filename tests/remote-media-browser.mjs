import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const folder = await mkdtemp(join(tmpdir(), 'remote-media-')),
  port = 32000 + Math.floor(Math.random() * 15000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
const seed = JSON.parse(await readFile(join(folder, 'seed.json'), 'utf8'));
const original = seed.screens[0],
  day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
seed.screens = [
  {
    ...original,
    template: {
      ...original.template,
      displayMode: 'media',
      rotation: { enabled: false },
      news: { enabled: false },
    },
  },
  {
    ...original,
    id: 'other-screen',
    name: 'Other screen',
    template: {
      ...original.template,
      displayMode: 'media',
      rotation: { enabled: false },
      news: { enabled: false },
    },
  },
];
seed.posts = seed.screens.map((screen, i) => ({
  ...seed.posts[0],
  id: 'post-' + i,
  screen_id: screen.id,
  publish_at: day,
  content: {
    ...seed.posts[0].content,
    backgroundAudio: undefined,
    videoSound: false,
    videoPlaylist: {
      enabled: true,
      loop: true,
      items: [0, 1].map((n) => ({
        id: 'clip-' + n,
        name: 'Clip ' + n,
        url: 'https://fixture.invalid/' + n + '.webm',
        type: 'video',
      })),
    },
  },
}));
seed.screen_devices = [
  { id: 'first-tv', token: 'first-tv-token', screen_id: original.id, label: 'First TV' },
  { id: 'other-tv', token: 'other-tv-token', screen_id: 'other-screen', label: 'Other TV' },
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
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(
    (
      await fetch(base + '/local/media-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen: original.id, action: 'state' }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + '/local/media-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen: 'other-screen', token: 'first-tv-token', action: 'state' }),
      })
    ).status,
    403,
  );
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [],
    webm = await readFile('tests/fixtures/drive-test.webm');
  async function context() {
    const c = await browser.newContext({ serviceWorkers: 'block' });
    c.on('page', (p) => p.on('pageerror', (error) => errors.push(error.message)));
    await c.route('https://fixture.invalid/**', (route) =>
      route.fulfill({ contentType: 'video/webm', body: webm }),
    );
    return c;
  }
  const one = await context(),
    two = await context(),
    phoneContext = await context();
  const tv = await one.newPage(),
    other = await two.newPage(),
    phone = await phoneContext.newPage();
  await tv.goto(base + '/display?token=first-tv-token');
  await other.goto(base + '/display?token=other-tv-token');
  for (const display of [tv, other])
    await display.waitForFunction(
      () => document.querySelector('.video-playlist video')?.currentTime > 0,
    );
  assert.equal(
    await tv.locator('.playback-toggle').count(),
    0,
    'The display has no local media control panel',
  );
  await phone.goto(base + '/admin');
  await phone.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await phone.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await phone.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await phone.waitForURL('**/admin');
  await phone.getByRole('tab', { name: 'التحكم المباشر' }).click();
  const panel = phone.getByRole('region', { name: 'التحكم عن بعد بالشاشة' });
  await panel.getByText('الشاشة متصلة', { exact: true }).waitFor();
  await phone.getByLabel('إيقاف الشاشة مؤقتًا عن بعد', { exact: true }).click();
  await tv.waitForFunction(() => document.querySelector('.video-playlist video')?.paused);
  assert.equal(
    await other.locator('.video-playlist video').evaluate((video) => video.paused),
    false,
    'Other screen is unaffected',
  );
  await phone.getByLabel('مستوى صوت الشاشة عن بعد', { exact: true }).fill('0.23');
  await tv.waitForFunction(
    () => Math.abs(document.querySelector('.video-playlist video').volume - 0.23) < 0.001,
  );
  assert.equal(await other.locator('.video-playlist video').evaluate((video) => video.volume), 1);
  await phone.getByRole('tab', { name: 'المحتوى' }).click();
  assert.equal(
    await phone
      .locator('.preview-card video')
      .first()
      .evaluate((video) => video.volume),
    1,
    'Phone preview is not being controlled',
  );
  await phone.getByRole('tab', { name: 'التحكم المباشر' }).click();
  await phone.getByLabel('الوسائط المراد التحكم بها', { exact: true }).selectOption('video');
  await phone.getByLabel('موضع التشغيل على الشاشة', { exact: true }).fill('0.8');
  await phone.getByLabel('موضع التشغيل على الشاشة', { exact: true }).dispatchEvent('pointerup');
  await tv.waitForFunction(
    () => Math.abs(document.querySelector('.video-playlist video').currentTime - 0.8) < 0.05,
  );
  await tv.locator('.video-playlist video').evaluate((video) => {
    video.currentTime = 1.1;
  });
  await tv.waitForTimeout(3500);
  assert(
    Math.abs(
      (await tv.locator('.video-playlist video').evaluate((video) => video.currentTime)) - 1.1,
    ) < 0.05,
    'Heartbeat updates must not replay a seek',
  );
  const before = Number(await tv.locator('.video-playlist').getAttribute('data-playlist-index'));
  await phone.getByRole('button', { name: 'التالي في القائمة', exact: true }).click();
  await tv.waitForFunction(
    (index) =>
      Number(document.querySelector('.video-playlist')?.getAttribute('data-playlist-index')) ===
      index,
    (before + 1) % 2,
  );
  await phone.getByRole('button', { name: 'السابق في القائمة', exact: true }).click();
  await tv.waitForFunction(
    (index) =>
      Number(document.querySelector('.video-playlist')?.getAttribute('data-playlist-index')) ===
      index,
    before,
  );
  await phone.getByLabel('إيقاف تنزيلات الشاشة مؤقتًا', { exact: true }).click();
  let state = await phone.request.post(base + '/local/media-control', {
    data: { screen: original.id, action: 'state' },
  });
  assert((await state.json()).downloadsPaused);
  await phone.getByLabel('متابعة تنزيلات الشاشة', { exact: true }).click();
  await phone.getByLabel('تشغيل الشاشة عن بعد', { exact: true }).click();
  await tv.waitForFunction(() => !document.querySelector('.video-playlist video')?.paused);
  // A new publication keeps screen playback preferences without needing another control command.
  await phone.getByRole('tab', { name: 'المحتوى' }).click();
  await phone.getByRole('button', { name: 'نشر على الشاشة', exact: true }).click();
  await tv.waitForTimeout(3500);
  state = await phone.request.post(base + '/local/media-control', {
    data: { screen: original.id, action: 'state' },
  });
  assert.equal((await state.json()).volume, 0.23);
  assert.deepEqual(errors, []);
  await phone.getByRole('tab', { name: 'التحكم المباشر' }).click();
  await panel.screenshot({ path: 'work/remote-admin-panel.png' });
  console.log(
    'PASS separate admin/display contexts: screen-scoped pause, volume, timeline seek without replay, playlist next/previous, download pause/resume, telemetry, publication persistence, token scoping, and unaffected second screen/phone preview.',
  );
} catch (error) {
  for (const c of browser?.contexts() || [])
    for (const p of c.pages()) console.log('DEBUG', p.url(), await p.locator('body').innerText());
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
