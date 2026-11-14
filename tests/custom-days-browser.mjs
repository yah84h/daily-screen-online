import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const folder = await mkdtemp(join(tmpdir(), 'custom-days-'));
const port = 32000 + Math.floor(Math.random() * 15000),
  base = 'http://127.0.0.1:' + port;
await cp('dist-local', folder, { recursive: true });
await rm(join(folder, 'data'), { recursive: true, force: true });
const seed = JSON.parse(await readFile(join(folder, 'seed.json'), 'utf8'));
const screen = seed.screens[0];
seed.screens = [
  {
    ...screen,
    template: {
      ...screen.template,
      displayMode: 'loop',
      rotation: { enabled: false },
      recognition: {
        enabled: true,
        source: 'manual',
        title: 'طلاب متميزون',
        subtitle: '',
        pageSeconds: 10,
        students: [{ id: 'one', name: 'طالب الاختبار', achievement: 'متميز' }],
      },
    },
  },
];
seed.screen_devices = [
  { id: 'custom-tv', token: 'custom-tv-token', screen_id: screen.id, label: 'TV' },
];
await writeFile(join(folder, 'seed.json'), JSON.stringify(seed));
const server = spawn(process.execPath, [join(folder, 'server.mjs'), '--localhost'], {
  env: {
    ...process.env,
    PORT: String(port),
    DAILY_SCREEN_LOCAL_ONLY: '1',
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
  },
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
  await page.clock.install({ time: new Date('2026-11-14T12:00:00+03:00') });
  await page.goto(base + '/login');
  await page.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'التصميم', exact: true }).click();
  await page.getByRole('button', { name: 'الخلفية والساعة', exact: true }).click();
  const editor = page.getByRole('region', { name: 'تصاميم المناسبات' });
  await editor.getByRole('button', { name: 'إضافة نبض', exact: true }).click();
  const frame = editor.frameLocator('iframe');
  await frame.locator('#oTitle').filter({ hasText: 'اليوم العالمي للسكري' }).waitFor();
  assert.equal(await frame.locator('#main').getAttribute('data-mode'), 'occasion');
  assert(
    await frame
      .locator('#oTitle')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 60),
    'Default occasion text remains large and readable',
  );
  assert.equal(
    await frame.locator('#photo').isVisible(),
    false,
    'Hidden photo does not reserve layout space',
  );
  async function assertArabicSpacing() {
    assert(
      await frame.locator('#oTitle').evaluate((el) => {
        const style = getComputedStyle(el);
        return parseFloat(style.lineHeight) / parseFloat(style.fontSize) >= 1.6;
      }),
      'Heading leaves room for Arabic descenders and dots',
    );
    assert(
      await frame.locator('#oSlogan').evaluate((el) => {
        const style = getComputedStyle(el);
        return parseFloat(style.marginTop) >= parseFloat(style.fontSize) * 0.4;
      }),
      'Subtitle has a separate gap below the heading',
    );
  }
  await assertArabicSpacing();
  assert.equal(await frame.locator('#fab').isVisible(), false);
  assert.equal(
    await frame.locator('#viewport').evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    true,
  );
  await editor.getByLabel('عنوان المناسبة', { exact: true }).fill('اليوم العالمي للسكري — اختبار');
  await frame.locator('#oTitle').filter({ hasText: '— اختبار' }).waitFor();
  await editor.getByLabel('حجم نص المناسبة').press('Home');
  await page.waitForTimeout(100);
  assert.equal(
    await frame.locator('#content').evaluate((el) => getComputedStyle(el).transform),
    'none',
  );
  assert(
    Number(await frame.locator('#content').evaluate((el) => el.style.getPropertyValue('--k'))) <=
      0.5,
  );
  await editor.getByLabel('حجم نص المناسبة').press('End');
  await page.waitForTimeout(100);
  assert(
    await frame.locator('#blockOccasion').evaluate((el) => {
      const box = document.getElementById('content');
      return el.scrollWidth <= box.clientWidth && el.scrollHeight <= box.clientHeight;
    }),
    'Large title and subtitle fit without clipping at 200%',
  );
  assert(
    await frame
      .locator('#oTitle')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 60),
    'Fitting must not collapse the title to tiny text',
  );
  await assertArabicSpacing();
  await editor.getByLabel('إظهار لوحة التميز الحالية').check();
  await editor.getByText('طالب الاختبار', { exact: true }).waitFor();
  await editor.getByLabel('إظهار الساعة والتاريخ').uncheck();
  await page.waitForFunction(() => document.querySelector('iframe') !== null);
  await frame.locator('.vitals .clock').waitFor({ state: 'hidden' });
  await editor.getByLabel('إظهار الساعة والتاريخ').check();
  await editor.getByLabel('تفعيل لهذا اليوم').check();
  await editor.getByRole('button', { name: 'حفظ تصاميم المناسبات', exact: true }).click();
  await page.getByText('تم حفظ القالب وإعدادات الخلفية.', { exact: true }).waitFor();
  const persisted = JSON.parse(await readFile(join(folder, 'data', 'state.json'), 'utf8'));
  assert.equal(
    persisted.screens.find((s) => s.id === screen.id).template.customDays[0].date,
    '2026-11-14',
  );
  const tv = await context.newPage();
  await tv.clock.install({ time: new Date('2026-11-14T12:00:00+03:00') });
  await tv.goto(base + '/tv?token=custom-tv-token');
  await tv.locator('.custom-day-screen').waitFor();
  await tv.frameLocator('iframe').locator('#oTitle').filter({ hasText: '— اختبار' }).waitFor();
  const isolation = await tv
    .frameLocator('iframe')
    .locator('body')
    .evaluate(() => {
      try {
        return !!parent.document.body;
      } catch {
        return false;
      }
    });
  assert.equal(isolation, false, 'HTML cannot read admin/parent document');
  await tv.screenshot({ path: 'work/custom-day-tv.png', animations: 'disabled' });
  await tv.clock.setSystemTime(new Date('2026-11-15T00:00:01+03:00'));
  await tv.clock.runFor(1100);
  await tv.locator('.custom-day-screen').waitFor({ state: 'detached' });
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'التصميم', exact: true }).click();
  await page.getByRole('button', { name: 'الخلفية والساعة', exact: true }).click();
  await page.getByLabel('عنوان المناسبة', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('عنوان المناسبة', { exact: true }).inputValue(),
    'اليوم العالمي للسكري — اختبار',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Mobile editor fits',
  );
  await page.screenshot({
    path: 'work/custom-day-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await editor.locator('input[type=file]').setInputFiles({
    name: 'custom.html',
    mimeType: 'text/html',
    buffer: Buffer.from(
      '<!doctype html><html><head><style>body{background:#123;color:white}</style></head><body><main><h1 data-school-field="title"></h1><b data-school-field="clock"></b></main></body></html>',
    ),
  });
  await frame
    .locator('[data-school-field="title"]')
    .filter({ hasText: 'اليوم العالمي للسكري' })
    .waitFor();
  await editor.getByLabel('عنوان المناسبة', { exact: true }).fill('قالب مستقل');
  await frame.locator('[data-school-field="title"]').filter({ hasText: 'قالب مستقل' }).waitFor();
  await editor.getByLabel('إظهار الساعة والتاريخ').uncheck();
  await frame.locator('[data-school-field="clock"]').waitFor({ state: 'hidden' });
  await editor
    .locator('input[type=file]')
    .setInputFiles({ name: 'large.html', mimeType: 'text/html', buffer: Buffer.alloc(120001, 65) });
  await editor.getByRole('alert').filter({ hasText: '١٢٠' }).waitFor();
  console.log(
    'PASS: Nabd import, editable live slots, clock toggle, current board, private sandbox, persistence, dated TV activation and next-day fallback, mobile layout.',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await rm(folder, { recursive: true, force: true });
}
