import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
// Own Vite server pointed at the mocked Supabase origin, so a running dev:local session can't interfere.
const port = 24000 + Math.floor(Math.random() * 2000);
const origin = 'http://127.0.0.1:' + port;
const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://mock.school.test',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    stdio: 'ignore',
  },
);
for (let i = 0; i < 200; i++) {
  try {
    if ((await fetch(origin)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--no-sandbox'],
});
try {
  let paired = false,
    requestCount = 0;
  const errors = [];
  const qr =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=';
  const content = {
    title: 'اختبار الربط',
    subtitle: '',
    body: 'شاشة المدرسة',
    image: '',
    logo: '',
    autoDate: true,
    date: '2026-10-21',
    showBadge: false,
    showSubtitle: false,
    showFooter: false,
    showSecondary: false,
    showQR: true,
    qr,
  };
  const screen = {
    id: 's1',
    name: 'شاشة الاختبار',
    template: { displayMode: 'daily' },
    draft: null,
    updated_at: '2026-10-21T06:00:00Z',
  };
  const school = {
    name: 'مدارس الموهوبين التقنيه بجدة',
    tagline: '',
    logo_url: null,
  };
  const contexts = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: i ? 390 : 1920, height: i ? 844 : 1080 },
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    contexts.push(context);
    context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
    await context.route('**/*', async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (u.origin === origin) return route.fallback();
      if (u.origin !== 'https://mock.school.test') return route.abort();
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
      };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers });
      let body = [];
      if (u.pathname.endsWith('/rpc/current_staff'))
        body = {
          id: 'u1',
          username: 'Archo',
          permissions: { admin: true, news: true, daily: true },
          active: true,
          owner: true,
        };
      else if (u.pathname.endsWith('/rpc/request_pairing')) {
        requestCount++;
        body = { code: '482913', token: 'test-device-token' };
      } else if (u.pathname.endsWith('/rpc/get_screen_by_token'))
        body = paired
          ? {
              status: 'paired',
              screen,
              school,
              post: { id: 'p1', content },
              version: 'v1',
            }
          : { status: 'pending', code: '482913' };
      else if (u.pathname.endsWith('/rpc/pair_screen')) {
        const p = req.postDataJSON();
        assert.equal(p.p_code, '482913');
        assert.equal(p.p_screen_id, 's1');
        paired = true;
        body = null;
      } else if (u.pathname.endsWith('/school_settings')) body = school;
      else if (u.pathname.endsWith('/screens')) body = [screen];
      else if (u.pathname.endsWith('/posts'))
        body = u.search.includes('gt.')
          ? []
          : [
              {
                id: 'p1',
                screen_id: 's1',
                content,
                publish_at: '2026-10-21',
                created_at: '2026-10-21T06:00:00Z',
              },
            ];
      else if (u.pathname.endsWith('/screen_devices'))
        body = paired
          ? [
              {
                token: 'test-device-token',
                screen_id: 's1',
                last_seen_at: new Date().toISOString(),
              },
            ]
          : [];
      return route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
  }
  const [tvContext, adminContext] = contexts;
  const user = {
    id: 'u1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.test',
    app_metadata: {},
    user_metadata: {},
  };
  const token =
    Buffer.from('{"alg":"HS256"}').toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 36000 })).toString(
      'base64url',
    ) +
    '.test';
  await adminContext.addInitScript(
    ({ user, token, origin }) => {
      if (location.origin !== origin) return;
      localStorage.setItem(
        'sb-mock-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'test',
          expires_at: Math.floor(Date.now() / 1000) + 36000,
          user,
          token_type: 'bearer',
        }),
      );
    },
    { user, token, origin },
  );
  const tv = await tvContext.newPage();
  await tv.goto(origin + '/display');
  await tv.locator('.pair-code').waitFor();
  assert.equal((await tv.locator('.pair-code').innerText()).trim(), '482913');
  // /display is served directly (older TV launchers open it); no redirect needed.
  assert.equal(new URL(tv.url()).pathname, '/display');
  const admin = await adminContext.newPage();
  await admin.goto(origin + '/admin');
  await admin
    .getByRole('navigation', { name: 'التنقل الرئيسي' })
    .getByRole('button', { name: 'المزيد', exact: true })
    .click();
  await admin.getByRole('button', { name: /ربط جهاز جديد/ }).click();
  await admin.getByPlaceholder('000000').fill('482913');
  await admin.getByRole('button', { name: 'ربط الشاشة', exact: true }).click();
  // After pairing, the setup sheet shows the same-origin TV link.
  assert.equal(await admin.getByLabel('رابط التلفزيون').inputValue(), origin + '/tv');
  await tv.waitForFunction(() => !!document.querySelector('.screen .qr'), undefined, {
    timeout: 65000,
    polling: 500,
  });
  assert(paired);
  assert.equal(await tv.locator('.qr').getAttribute('src'), qr);
  const before = requestCount;
  await tv.reload();
  await tv.locator('.screen .qr').waitFor();
  assert.equal(requestCount, before, 'Saved TV token survives reload');
  assert.equal(
    await tv.evaluate(() => localStorage.getItem('sb-mock-auth-token')),
    null,
    'TV needs no admin login',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: /display TV page, same-origin setup link, fresh 6-digit pairing across isolated devices, QR image display, saved TV token, no TV login, zero page errors.',
  );
} finally {
  await browser.close();
  vite.kill();
}
