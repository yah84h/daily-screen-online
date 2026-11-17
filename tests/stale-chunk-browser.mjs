import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// After a deploy, a page opened earlier asks for a code file that no longer exists
// ("Failed to fetch dynamically imported module"). The page must reload itself once and work.
const folder = await mkdtemp(join(tmpdir(), 'stale-chunk-')),
  port = 33000 + Math.floor(Math.random() * 14000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
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
  const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
  let blocked = 0,
    loads = 0;
  page.on('load', () => loads++);
  await page.route(/\/assets\/Login-[^/]+\.js$/, (route) => {
    if (blocked++ === 0) return route.fulfill({ status: 404, body: 'gone after deploy' });
    return route.fallback();
  });
  await page.goto(base + '/login');
  await page.getByLabel('اسم المستخدم', { exact: true }).waitFor({ timeout: 15000 });
  assert.equal(blocked, 2, 'the missing file was requested again after one reload');
  assert.equal(loads, 2, 'exactly one automatic reload');
  console.log('PASS stale code file after a deploy: one automatic reload, then the page works.');
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
