import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
// The animated school wallpaper for the classes background follows the palette colors.
const colors = {
  background: '#edf7f3',
  text: '#214c43',
  line1: '#3fae8f',
  line2: '#7bd3bc',
};
const folder = await mkdtemp(join(tmpdir(), 'wallpaper-')),
  port = 33000 + Math.floor(Math.random() * 14000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
const seed = JSON.parse(await readFile(join(folder, 'seed.json'), 'utf8'));
seed.screen_devices = [{ id: 'w', token: 'w', screen_id: seed.screens[0].id, label: 'TV' }];
seed.screens[0].template = {
  ...seed.screens[0].template,
  displayMode: 'loop',
  loopBackdrop: 'zigzag',
  loopAppearance: colors,
  modeTransitions: false,
  rotation: { enabled: false },
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(base + '/display?token=w');
  await page.locator('.zigzag-wallpaper .zz-fill').waitFor();
  const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
  const fills = await page.evaluate(() => ({
    field: getComputedStyle(document.querySelector('.zz-field')).fill,
    band: getComputedStyle(document.querySelector('.zz-fill')).fill,
    dash: getComputedStyle(document.querySelector('#zigzag-dashes rect')).fill,
    edge: getComputedStyle(document.querySelector('.zz-edge')).stroke,
    moving: getComputedStyle(document.querySelector('.zz-band')).animationName,
    logos: getComputedStyle(document.querySelector('.screen-loop')).getPropertyValue(
      '--brand-filter',
    ),
  }));
  assert.equal(fills.field, rgb(colors.text));
  assert.equal(fills.band, rgb(colors.background));
  assert.equal(fills.dash, rgb(colors.line1));
  assert.equal(fills.edge, rgb(colors.line2));
  assert.equal(fills.moving, 'zz-drift');
  assert.match(fills.logos, /invert/, 'logos turn white on the dark field');
  console.log(
    'PASS school wallpaper: drawn, animated, every color from the palette, readable logos.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
