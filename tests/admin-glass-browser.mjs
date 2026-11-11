import { scheduleVersion } from '../local-test/assistant-schedule.mjs';
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
  await page.goto(base + '/login');
  await page.screenshot({ path: 'work/login-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByLabel('كلمة المرور', { exact: true }).fill('test');
  await page.getByRole('button', { name: 'إظهار كلمة المرور', exact: true }).click();
  assert.equal(await page.getByLabel('كلمة المرور', { exact: true }).getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'إخفاء كلمة المرور', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'work/login-mobile.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('اسم المستخدم', { exact: true }).fill('Archo');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('Arc@2027');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
  await page.getByRole('heading', { name: 'محتوى يستحق العرض.' }).waitFor();
  assert.equal(await nav.getByRole('button').count(), 5);
  await page.screenshot({
    path: 'work/studio-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  assert.equal(await page.locator('.remote-media-panel').count(), 0);
  const updated = await page.request.post(base + '/local/query', {
    data: {
      table: 'posts',
      action: 'update',
      filters: [['id', 'eq', seed.posts[0].id]],
      values: { content: { ...seed.posts[0].content, title: 'محتوى يوم جديد متزامن' } },
    },
  });
  assert(updated.ok());
  await page.waitForFunction(
    () => document.querySelector('#daily-title')?.value === 'محتوى يوم جديد متزامن',
    null,
    { timeout: 25000 },
  );

  await page.getByLabel('عنوان اليوم', { exact: true }).fill('رسالة تجريبية للتصميم الجديد');
  await page.getByRole('button', { name: 'الصور والفيديو', exact: true }).click();
  await page.getByLabel('رابط وسائط الشاشة اليومية').waitFor();
  await page.getByRole('button', { name: 'النص', exact: true }).click();
  assert.equal(
    await page.getByLabel('عنوان اليوم', { exact: true }).inputValue(),
    'رسالة تجريبية للتصميم الجديد',
  );
  await page.getByRole('button', { name: 'صوت الخلفية', exact: true }).click();
  await page.getByRole('region', { name: 'صوت الخلفية', exact: true }).waitFor();
  await nav.getByRole('button', { name: 'التحكم المباشر', exact: true }).click();
  await page.getByRole('region', { name: 'التحكم عن بعد بالشاشة' }).waitFor();
  await page.getByRole('region', { name: 'مراقبة أجهزة العرض' }).waitFor();
  await page.getByRole('region', { name: 'معاينة المحتوى المنشور' }).waitFor();
  await page.screenshot({
    path: 'work/studio-live-controls.png',
    fullPage: true,
    animations: 'disabled',
  });
  await nav.getByRole('button', { name: 'التصميم', exact: true }).click();
  await page.getByRole('radio', { name: /ملف PowerPoint/ }).waitFor();
  assert.equal(await page.locator('summary').filter({ hasText: 'طريقة العرض' }).count(), 0);
  await page.screenshot({
    path: 'work/studio-display-modes.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'الخلفية والساعة', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'أدوات الخلفية' })
    .getByRole('button', { name: /حجم الكتابة/ })
    .click();
  await page.getByLabel('حجم نص الساعة والحصة', { exact: true }).fill('140');
  await page.screenshot({
    path: 'work/studio-background.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.route('**/local/assistant', async (route) => {
    const input = route.request().postDataJSON();
    if (input.action === 'apply_schedule') return route.continue();
    if (input.action === 'chat' && input.text.includes('اختبر خطة')) {
      assert.equal(input.files.length, 1, 'Attached plan is sent with the request');
      return route.fulfill({
        json: {
          text: '## خطة الإذاعة\n\n**مهم**: راجع التواريخ.\n\n| اليوم | الموضوع |\n| --- | --- |\n| الأحد | التعاون |\n\n- فقرة أولى\n- فقرة ثانية\n\n<script>window.unsafeMarkdown=true</script>\n[unsafe](javascript:alert(1))',
          screenId: original.id,
          scheduleVersion: scheduleVersion(seed.posts, original.id),
          proposal: {
            summary: 'خطة الإذاعة',
            schedule: [
              {
                date: new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', {
                  timeZone: 'Asia/Riyadh',
                }),
                content: { title: 'إذاعة التعاون', body: 'إعداد الصف الأول' },
              },
            ],
          },
        },
      });
    }
    const result =
      input.action === 'status'
        ? { connected: true, sharing: true, pending: false, profiles: [{ label: 'Test account' }] }
        : input.action === 'models'
          ? { models: [{ id: 'test-model', name: 'Test model' }] }
          : {
              text: 'اقتراح جاهز للمراجعة',
              screenId: original.id,
              proposal: {
                summary: 'تغيير رسالة اليوم',
                content: {
                  title: 'رسالة من المساعد',
                  subtitle: 'عنوان فرعي من المساعد',
                  body: 'رسالة رئيسية من المساعد',
                },
              },
            };
    await route.fulfill({ json: result });
  });
  await nav.getByRole('button', { name: 'ChatGPT', exact: true }).click();
  await page.getByLabel('طلبك للمساعد').fill('غيّر عنوان اليوم');
  await page.getByRole('button', { name: 'إرسال', exact: true }).click();
  await page.getByRole('button', { name: 'تطبيق على المسودة', exact: true }).waitFor();
  await page.screenshot({ path: 'work/assistant-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'تطبيق على المسودة', exact: true }).click();
  await page.getByRole('button', { name: 'تم التطبيق على المسودة', exact: true }).waitFor();
  await nav.getByRole('button', { name: 'المحتوى', exact: true }).click();
  assert.equal(
    await page.getByLabel('عنوان اليوم', { exact: true }).inputValue(),
    'رسالة من المساعد',
  );
  assert.equal(
    await page.getByLabel('العنوان الفرعي', { exact: true }).inputValue(),
    'عنوان فرعي من المساعد',
  );
  assert.equal(
    await page.getByLabel('الرسالة الرئيسية', { exact: true }).inputValue(),
    'رسالة رئيسية من المساعد',
  );
  await page.getByLabel('العنوان الفرعي', { exact: true }).fill('تعديل يدوي');
  assert.equal(await page.getByLabel('العنوان الفرعي', { exact: true }).inputValue(), 'تعديل يدوي');
  await nav.getByRole('button', { name: 'ChatGPT', exact: true }).click();
  await page.locator('.assistant-composer input[type=file]').setInputFiles({
    name: 'broadcast.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('اليوم,الموضوع\nالأحد,التعاون'),
  });
  await page.getByLabel('طلبك للمساعد').fill('اختبر خطة الإذاعة');
  await page.getByRole('button', { name: 'إرسال', exact: true }).click();
  await page.getByRole('region', { name: 'مراجعة خطة الإذاعة الأسبوعية' }).waitFor();
  assert.equal(await page.locator('.assistant-markdown strong').innerText(), 'مهم');
  assert.equal(await page.locator('.assistant-markdown table').count(), 1);
  assert.equal(await page.locator('.assistant-markdown script').count(), 0);
  assert.equal(await page.locator('.assistant-markdown a[href^="javascript:"]').count(), 0);
  assert.equal(
    await page.locator('.assistant-file-chips button').count(),
    1,
    'File remains available for follow-up',
  );
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: 'work/assistant-weekly-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'تأكيد جدولة الإذاعة', exact: true }).click();
  await page.getByRole('button', { name: 'تم حفظ خطة الإذاعة', exact: true }).waitFor();
  const conversationId = await page.getByLabel('المحادثات المحفوظة').inputValue();
  await page.reload();
  await nav.getByRole('button', { name: 'ChatGPT', exact: true }).click();
  await page.getByRole('region', { name: 'مراجعة خطة الإذاعة الأسبوعية' }).waitFor();
  assert.equal(
    await page.getByLabel('المحادثات المحفوظة').inputValue(),
    conversationId,
    'Conversation restored after refresh',
  );
  await page.getByRole('button', { name: 'محادثة جديدة', exact: true }).click();
  assert.equal(
    await page.getByLabel('المحادثات المحفوظة').locator('option').count(),
    2,
    'New conversation preserves the previous one',
  );
  await page.getByLabel('المحادثات المحفوظة').selectOption(conversationId);
  await page.getByRole('region', { name: 'مراجعة خطة الإذاعة الأسبوعية' }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Assistant fits a phone',
  );
  await page.locator('.studio-toast').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: 'work/assistant-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole('button', { name: /الجدولة والسجل/ }).click();
  await page.getByText('إذاعة التعاون', { exact: true }).waitFor();
  await nav.getByRole('button', { name: 'المحتوى', exact: true }).click();
  await page.getByLabel('استخدام تاريخ اليوم تلقائيًا', { exact: true }).uncheck();
  const scheduledDate = new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Riyadh',
  });
  await page.getByLabel('تاريخ المحتوى والمعاينة').fill(scheduledDate);
  await page
    .getByText(
      'تم تحميل محتوى ' + scheduledDate + ' في المحرر والمعاينة. لم يُنشر شيء على الشاشة.',
      { exact: true },
    )
    .waitFor();
  assert.equal(await page.getByLabel('عنوان اليوم', { exact: true }).inputValue(), 'إذاعة التعاون');
  assert.equal(
    await page.getByLabel('الرسالة الرئيسية', { exact: true }).inputValue(),
    'إعداد الصف الأول',
  );
  assert.equal(
    await page.getByLabel('العنوان الفرعي', { exact: true }).inputValue(),
    '',
    'Unspecified weekly subtitle must not inherit an old topic',
  );
  await nav.getByRole('button', { name: /الجدولة والسجل/ }).click();

  await page.getByRole('button', { name: 'سجل النشر', exact: true }).click();
  await page.getByRole('button', { name: 'الأجهزة والإعدادات', exact: true }).click();
  await page.getByRole('heading', { name: 'مساحة المدرسة.', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole('button', { name: 'المحتوى', exact: true }).click();
  assert.equal(await nav.getByRole('button').count(), 5);
  for (const button of await nav.getByRole('button').all()) assert(await button.isVisible());
  await page.getByRole('button', { name: 'فتح مراقبة الشاشة', exact: true }).click();
  await page.getByRole('region', { name: 'التحكم عن بعد بالشاشة' }).waitFor();
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Live controls fit a phone',
  );
  await page.screenshot({
    path: 'work/studio-live-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await nav.getByRole('button', { name: 'المحتوى', exact: true }).click();
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'No mobile horizontal overflow',
  );
  await page.screenshot({ path: 'work/studio-mobile.png', fullPage: true, animations: 'disabled' });
  const publish = page.getByRole('button', { name: 'نشر على الشاشة', exact: true });
  await publish.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'work/studio-mobile-editor.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'تكبير المعاينة', exact: true }).click();
  await page.getByRole('dialog', { name: 'معاينة الشاشة' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(
    await page
      .getByRole('button', { name: 'تكبير المعاينة', exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page
      .locator('.studio-page')
      .evaluate((element) => getComputedStyle(element).animationName),
    'none',
  );
  await page.goto(base + '/news');
  await page.getByRole('tab', { name: 'الومضات والاقتباسات', exact: true }).click();
  await page.getByLabel('بحث الومضات والاقتباسات').fill('البرمجة');
  await page.getByRole('button', { name: 'إضافة كإعلان', exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'إضافة كإعلان', exact: true }).first().click();
  await page.getByRole('tab', { name: /إعلانات المدرسة/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: five visible destinations, field persistence, all workspaces, phone navigation, no overflow, dialog focus and reduced motion.',
  );
} finally {
  await browser?.close();
  server.kill();
  await rm(folder, { recursive: true, force: true });
}
