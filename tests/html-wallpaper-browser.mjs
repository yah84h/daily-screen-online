// HTML wallpaper on the classes background: renders, gets live fields, is not spammed with
// messages every second, the cards drop the live blur over it, and no "tap for sound" hint.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  env: {
    ...process.env,
    VITE_SUPABASE_URL: 'https://mock.school.test',
    VITE_SUPABASE_ANON_KEY: 'k',
  },
  stdio: 'ignore',
});
const html = `<!doctype html><html><body style="background:#0b1116;color:#fff">
<div id="t">{{time}}</div><div id="s" data-school-field="school"></div>
<div class="spin" style="width:200px;height:200px;border:4px dashed #4fb3e3;animation:r 4s linear infinite"></div>
<style>@keyframes r{to{transform:rotate(360deg)}}</style>
<script>window.__msgs=0;addEventListener('message',function(){window.__msgs++});</script>
</body></html>`;
const screen = {
  id: 's1',
  name: 'TV',
  template: {
    displayMode: 'loop',
    loopBackdrop: 'html',
    loopWallpaperHtml: { name: 'test', html },
  },
  updated_at: new Date().toISOString(),
};
const school = { name: 'مدرسة الاختبار', tagline: '', logo_url: null };
const browser = await chromium.launch({ headless: true });
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://127.0.0.1:5173/')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('tv-token', 'tv-test');
    } catch {}
    // Record what the screen looks like the moment it first appears (before the design loads).
    new MutationObserver((_, obs) => {
      const el = document.querySelector('.screen-loop');
      if (!el) return;
      obs.disconnect();
      const art = el.querySelector('.native-artwork');
      window.__first = {
        bg: getComputedStyle(el).backgroundColor,
        image: getComputedStyle(el).backgroundImage,
        art: art ? getComputedStyle(art).display : 'none',
        frameOpacity: getComputedStyle(el.querySelector('.loop-html-wallpaper iframe')).opacity,
        ready: el.querySelector('.loop-html-wallpaper').dataset.ready,
        base: getComputedStyle(el.querySelector('.loop-html-wallpaper')).backgroundColor,
      };
    }).observe(document, { childList: true, subtree: true });
  });
  await ctx.route('https://mock.school.test/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
    let body = [];
    if (path.includes('/rpc/get_screen_by_token'))
      body = {
        status: 'paired',
        screen,
        school,
        post: { id: 'p1', content: {} },
        version: screen.updated_at,
      };
    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  const tv = await ctx.newPage();
  await tv.goto('http://127.0.0.1:5173/tv');
  await tv.locator('.loop-html-wallpaper iframe').waitFor({ timeout: 60000 });
  const frame = () => tv.frames().find((f) => f !== tv.mainFrame());
  await tv.waitForFunction(() => true);
  for (
    let i = 0;
    i < 40 && !(await frame()?.evaluate(() => document.getElementById('s')?.textContent));
    i++
  )
    await tv.waitForTimeout(250);
  const f = frame();
  assert.match(await f.evaluate(() => document.getElementById('s').textContent), /\S/);
  assert.match(await f.evaluate(() => document.getElementById('t').textContent), /[0-9٠-٩]/);
  // From the very first frame: the design's own color, no built-in wallpaper, frame hidden until painted.
  const first = await tv.evaluate(() => window.__first);
  console.log('first frame:', first);
  assert.equal(first.bg, 'rgb(11, 17, 22)');
  assert.equal(first.base, 'rgb(11, 17, 22)');
  assert.equal(first.image, 'none');
  assert.equal(first.art, 'none');
  assert.equal(first.frameOpacity, '0');
  await tv.waitForFunction(
    () => document.querySelector('.loop-html-wallpaper')?.dataset.ready === 'true',
  );
  const before = await f.evaluate(() => window.__msgs);
  await tv.waitForTimeout(5000);
  const after = await f.evaluate(() => window.__msgs);
  // The clock ticks every second; the wallpaper should hear only about real changes (≤ 1 a minute + countdown).
  console.log('messages in 5s:', after - before);
  assert(after - before <= 5, 'not posted on every render');
  const fps = await f.evaluate(
    () =>
      new Promise((done) => {
        let n = 0;
        const start = performance.now();
        const step = (t) => (t - start < 2000 ? (n++, requestAnimationFrame(step)) : done(n / 2));
        requestAnimationFrame(step);
      }),
  );
  console.log('wallpaper fps:', fps);
  assert(fps > 30, 'wallpaper animates smoothly');
  const blur = await tv
    .locator('.loop-clock-panel')
    .evaluate((el) => getComputedStyle(el).backdropFilter);
  assert.equal(blur, 'none', 'no live blur over the HTML wallpaper');
  assert.equal(await tv.locator('.tv-sound-hint').count(), 0, 'no tap-for-sound hint');
  assert.deepEqual(errors, []);
  console.log('PASS html wallpaper');
} finally {
  await browser.close();
  vite.kill();
}
