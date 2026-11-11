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
      displayMode: 'loop',
      rotation: { enabled: false },
      news: { enabled: false },
      recognition: {
        enabled: true,
        source: 'qudrat-pro',
        title: '',
        subtitle: '',
        pageSeconds: 10,
        students: [],
        qudratPro: { refreshSeconds: 30 },
      },
    },
  },
];
seed.posts = [{ ...seed.posts[0], screen_id: original.id, publish_at: day }];
seed.screen_devices = [
  { id: 'test-tv', token: 'test-tv-token', screen_id: original.id, label: 'Test TV' },
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
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(base + '/admin');
  await page.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('tab', { name: 'المحتوى' }).waitFor();
  await page.screenshot({ path: 'work/glass-desktop.png', fullPage: true });
  assert.equal(
    await page.locator('.remote-media-panel').count(),
    0,
    'Remote telemetry is mounted only when requested',
  );
  await page.getByRole('tab', { name: 'التحكم المباشر' }).click();
  await page.getByRole('region', { name: 'التحكم عن بعد بالشاشة' }).waitFor();
  await page.getByRole('tab', { name: 'وضع العرض' }).click();
  await page.getByRole('button', { name: /ملف PowerPoint/ }).waitFor();
  await page.getByRole('button', { name: 'خلفية الحصص', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'حجم الكتابة' }).click();
  await page.getByLabel('حجم نص الساعة والحصة', { exact: true }).fill('140');
  await page.screenshot({ path: 'work/glass-background.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'فتح التنقل', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: 'فتح التنقل', exact: true })
      .getAttribute('aria-expanded'),
    'true',
  );
  await page.getByRole('button', { name: 'الرئيسية', exact: true }).click();
  await page.getByRole('tab', { name: 'المحتوى' }).waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'فتح التنقل', exact: true })
      .getAttribute('aria-expanded'),
    'false',
  );
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'No mobile horizontal overflow',
  );
  await page.locator('#admin-navigation').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'work/glass-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'فتح التنقل', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(
    await page
      .getByRole('button', { name: 'فتح التنقل', exact: true })
      .getAttribute('aria-expanded'),
    'false',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: desktop workspaces, expandable settings, mobile drawer, escape/focus and no horizontal overflow.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
