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
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + '/admin');
  await page.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await page.getByRole('button', { name: 'التصميم', exact: true }).click();
  await page.getByRole('button', { name: 'تصميم اليومي', exact: true }).click();
  const saved = page.locator('.saved-layouts');
  await saved.getByLabel('اسم القالب الجديد').fill('Daily custom');
  await saved.getByRole('button', { name: 'حفظ كتوزيع جديد', exact: true }).click();
  await saved.getByText('تم حفظ القالب على هذه الشاشة.', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'التصميم', exact: true }).click();
  await page.getByRole('button', { name: 'تصميم اليومي', exact: true }).click();
  await saved.getByText('Daily custom', { exact: true }).waitFor();
  await saved.getByRole('button', { name: 'تطبيق', exact: true }).click();
  await page.getByRole('button', { name: 'التصميم', exact: true }).click();
  await page.getByRole('button', { name: 'تصميم اليومي', exact: true }).click();
  await page.getByRole('button', { name: 'الخلفية والساعة', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'أدوات الخلفية' })
    .getByRole('button', { name: /حجم الكتابة/ })
    .click();
  assert.equal(await saved.getByText('Daily custom', { exact: true }).count(), 0);
  const clock = page.locator('.loop-preview-panel .animated-clock');
  const heading = page.locator('.loop-preview-panel .qudrat-brand h2');
  const originalClockSize = await clock.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const originalBoardSize = await heading.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  await page.getByLabel('حجم نص الساعة والحصة', { exact: true }).fill('150');
  await page.getByLabel('حجم نص لوحة التميز', { exact: true }).fill('130');
  assert(
    Math.abs(
      (await clock.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) /
        originalClockSize -
        1.5,
    ) < 0.02,
  );
  assert(
    Math.abs(
      (await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) /
        originalBoardSize -
        1.3,
    ) < 0.02,
  );
  await page
    .getByRole('navigation', { name: 'أدوات الخلفية' })
    .getByRole('button', { name: /التوزيع والقوالب/ })
    .click();
  await saved.getByLabel('اسم القالب الجديد').fill('Loop custom');
  await saved.getByRole('button', { name: 'حفظ كتوزيع جديد', exact: true }).click();
  await saved.getByText('تم حفظ القالب على هذه الشاشة.', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'التصميم', exact: true }).click();
  await page.getByRole('button', { name: 'تصميم اليومي', exact: true }).click();
  await page.getByRole('button', { name: 'الخلفية والساعة', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'أدوات الخلفية' })
    .getByRole('button', { name: /حجم الكتابة/ })
    .click();

  assert.equal(await page.getByLabel('حجم نص الساعة والحصة', { exact: true }).inputValue(), '150');
  assert.equal(await page.getByLabel('حجم نص لوحة التميز', { exact: true }).inputValue(), '130');
  await page
    .getByRole('navigation', { name: 'أدوات الخلفية' })
    .getByRole('button', { name: /التوزيع والقوالب/ })
    .click();
  await saved.getByText('Loop custom', { exact: true }).waitFor();
  await saved.getByRole('button', { name: 'تطبيق', exact: true }).click();
  await saved.getByRole('button', { name: 'تحديث من التوزيع الحالي', exact: true }).click();
  await saved.getByText('تم حفظ القالب على هذه الشاشة.', { exact: true }).waitFor();
  page.on('dialog', (dialog) => dialog.accept());
  await saved.getByRole('button', { name: 'حذف', exact: true }).click();
  await saved.getByText('Loop custom', { exact: true }).waitFor({ state: 'detached' });
  // Exercise the real mounted leaderboard polling without waiting a minute.
  const tv = await context.newPage();
  let requests = 0;
  await tv.route('**/api/qudrat-pro', (route) => {
    requests++;
    return route.fulfill({
      json: {
        exams: [{ kind: 'weekly', leaders: [{ rank: 1, name: 'طالب اختبار', score: 90 }] }],
        fetchedAt: Date.now(),
      },
    });
  });
  await tv.clock.install();
  await tv.goto(base + '/display?token=test-tv-token');
  await tv.getByText('طالب اختبار', { exact: true }).waitFor();
  const before = requests;
  await tv.clock.runFor(30050);
  assert(requests > before, 'Leaderboard fetches again after 30 seconds');
  await tv.keyboard.press('s');
  await tv.getByRole('button', { name: 'تحديث الموقع وإعادة تحميل الشاشة', exact: true }).click();
  await tv.waitForURL('**/*_update=*');
  await tv.getByText('طالب اختبار', { exact: true }).waitFor();
  assert(new URL(tv.url()).searchParams.get('token') === 'test-tv-token');
  console.log(
    'PASS: saved layouts persist across reloads, stay separate by mode, apply, update and delete.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
