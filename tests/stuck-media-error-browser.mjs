import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// A daily video that fails at 0% shows its error briefly, then the TV clears it.
const folder = await mkdtemp(join(tmpdir(), 'stuck-media-')),
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
  image: 'https://fixture.invalid/broken.webm',
  imageType: 'video',
  videoPlaylist: undefined,
  backgroundAudio: undefined,
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
  browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('https://fixture.invalid/**', (route) =>
    route.fulfill({ status: 403, body: 'denied' }),
  );
  const tv = await context.newPage();
  await tv.goto(base + '/display');
  const line = tv.locator('.cache-status-line.failed'),
    retry = tv.locator('.cache-retry');
  await line.waitFor({ timeout: 30000 });
  await retry.waitFor();
  const shownAt = Date.now();
  await line.waitFor({ state: 'detached', timeout: 15000 });
  await retry.waitFor({ state: 'detached', timeout: 15000 });
  const seconds = (Date.now() - shownAt) / 1000;
  assert(seconds >= 5 && seconds <= 12, 'hidden after ' + seconds + 's');
  console.log(
    'PASS stuck-at-0% media error and retry button hide after ' + seconds.toFixed(1) + 's.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
