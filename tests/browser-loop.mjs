import { chromium } from "playwright";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const artifacts = await mkdtemp(join(tmpdir(), "daily-screen-check-"));
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const errors = [];
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  const school = {
    name: "ثانوية الموهوبين التقنية",
    tagline: "",
    logo_url: null,
  };
  const initial = {
    title: "التوعية بالأمن السيبراني",
    subtitle: "التعلم",
    body: "تقنية",
    image: "",
    logo: "",
    autoDate: true,
    date: "2026-10-21",
    showBadge: false,
    showSubtitle: true,
    showFooter: false,
    showQR: false,
    showSecondary: false,
  };
  let screen = {
    id: "s1",
    name: "الشاشة الرئيسية",
    template: {},
    draft: null,
    updated_at: new Date().toISOString(),
  };
  let uploaded;
  let templateWrites = [];
  let user = {
    id: "u1",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: "u1",
        exp: Math.floor(Date.now() / 1000) + 36000,
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url") +
    ".test";
  await ctx.addInitScript(
    ({ token, user }) => {
      if (location.origin !== "http://127.0.0.1:5173") return;
      localStorage.setItem(
        "sb-mock-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "test",
          expires_at: Math.floor(Date.now() / 1000) + 36000,
          expires_in: 36000,
          token_type: "bearer",
          user,
        }),
      );
      localStorage.setItem("tv-token", "tv-test");
    },
    { token, user },
  );
  await ctx.route("**/*", (route) => {
    const origin = new URL(route.request().url()).origin;
    return ["http://127.0.0.1:5173", "https://mock.school.test"].includes(
      origin,
    )
      ? route.fallback()
      : route.abort();
  });
  await ctx.route("https://mock.school.test/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    let body = {};
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    };
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 200, headers });
    if (path.startsWith("/auth/")) body = user;
    else if (path.includes("/storage/v1/object/public/"))
      return route.fulfill({
        status: 200,
        headers,
        body: uploaded || Buffer.from(""),
        contentType: "image/webp",
      });
    else if (path.includes("/storage/")) {
      uploaded = req.postDataBuffer();
      const start = uploaded.indexOf(Buffer.from("RIFF"));
      if (start >= 0)
        uploaded = uploaded.subarray(
          start,
          start + 8 + uploaded.readUInt32LE(start + 4),
        );
      body = { Key: "media/content/test.webp" };
    } else if (path.includes("/rpc/get_screen_by_token"))
      body = {
        status: "paired",
        screen,
        school,
        post: { id: "p1", content: initial },
        version: screen.updated_at,
      };
    else if (path.endsWith("/school_settings")) body = school;
    else if (path.endsWith("/screens")) {
      if (req.method() === "PATCH") {
        const patch = req.postDataJSON();
        templateWrites.push(patch);
        screen = { ...screen, ...patch, updated_at: new Date().toISOString() };
        body = null;
      } else body = [screen];
    } else if (path.endsWith("/posts"))
      body = url.search.includes("gt.")
        ? []
        : [
            {
              id: "p1",
              screen_id: "s1",
              content: initial,
              publish_at: "2026-10-21",
              created_at: new Date().toISOString(),
            },
          ];
    else if (path.endsWith("/screen_devices"))
      body = [
        {
          token: "tv-test",
          screen_id: "s1",
          last_seen_at: new Date().toISOString(),
        },
      ];
    else if (path.endsWith("/presets")) body = [];
    else console.log("UNHANDLED", req.method(), path);
    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  console.log("Mock ready");
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.goto("http://127.0.0.1:5173/admin");
  await page.getByRole("button", { name: "خلفية الحصص", exact: true }).click();
  await page.getByLabel("وضع الشاشة", { exact: true }).selectOption("loop");
  await page.getByLabel("إظهار اللوحة", { exact: true }).check();
  await page.getByLabel("عنوان اللوحة", { exact: true }).fill("نجوم التقنية");
  await page
    .getByLabel("اسم المدرسة في الخلفية", { exact: true })
    .fill("اسم تجريبي");
  await page
    .getByLabel("اسم المدرسة في الخلفية", { exact: true })
    .fill("مدارس الموهوبين التقنيه بجدة");
  await page
    .getByLabel("شعارات الخلفية", { exact: true })
    .selectOption("school");
  await page
    .getByLabel("شعارات الخلفية", { exact: true })
    .selectOption("paired");
  for (let i = 1; i <= 3; i++) {
    await page.getByRole("button", { name: "إضافة طالب", exact: true }).click();
    await page
      .getByLabel("اسم الطالب " + i, { exact: true })
      .fill("طالب التقنية " + i);
    await page
      .getByLabel("إنجاز الطالب " + i, { exact: true })
      .fill("الأول في البرمجة");
    console.log("Added student", i);
  }
  // Generate an actual transparent PNG and send it through the production image compressor/uploader.
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 50;
    c.height = 50;
    const x = c.getContext("2d");
    x.fillStyle = "#4b91f7";
    x.fillRect(15, 15, 20, 20);
    return c.toDataURL("image/png").split(",")[1];
  });
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "صورة اختيارية · PNG مدعوم" })
    .first()
    .click();
  await (
    await chooser
  ).setFiles({
    name: "student.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page
    .getByRole("button", { name: "حفظ الخلفية ولوحة التميز", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.body.textContent.includes("تم حفظ القالب"),
  );
  assert.equal(screen.template.recognition.students.length, 3);
  assert(screen.template.recognition.students[0].photo.includes("/content/"));
  assert(uploaded.length > 0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile must not horizontally overflow",
  );
  console.log("Mobile upload and save passed");
  await page.screenshot({
    path: join(artifacts, "mobile-loop.png"),
    fullPage: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "خلفية الحصص", exact: true }).click();
  assert.equal(
    await page.getByLabel("اسم الطالب 1", { exact: true }).inputValue(),
    "طالب التقنية 1",
  );
  console.log("Reload persisted");
  // Removing an entry, then hiding, preserves the remaining records on reload.
  await page
    .getByRole("button", { name: "حذف الطالب طالب التقنية 3", exact: true })
    .click();
  await page.getByLabel("إظهار اللوحة", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "حفظ الخلفية ولوحة التميز", exact: true })
    .click();
  await page.waitForTimeout(1800);
  assert.equal(screen.template.recognition.enabled, false);
  assert.equal(screen.template.recognition.students.length, 2);
  await page.getByLabel("إظهار اللوحة", { exact: true }).check();
  await page
    .getByRole("button", { name: "حفظ الخلفية ولوحة التميز", exact: true })
    .click();
  await page.waitForTimeout(1800);
  console.log("Remove/hide saved");
  const tv = await ctx.newPage();
  await tv.emulateMedia({ reducedMotion: "no-preference" });
  tv.setDefaultTimeout(60000);
  await tv.setViewportSize({ width: 3840, height: 2160 });
  await tv.clock.setFixedTime(new Date("2026-10-21T07:45:59+03:00"));
  await tv.goto("http://127.0.0.1:5173/tv");
  await tv.locator(".recognition-board").waitFor();
  await tv.waitForTimeout(800);
  assert.equal(await tv.locator(".recognition-student").count(), 2);
  assert.equal(
    await tv
      .locator(".screen-loop")
      .evaluate((el) => el.getBoundingClientRect().width),
    3840,
  );
  assert.equal(
    await tv
      .locator(".screen-loop")
      .evaluate((el) => el.getBoundingClientRect().height),
    2160,
  );
  assert.equal(await tv.locator(".native-brand-pair img").count(), 2);
  assert.equal(
    await tv.locator(".native-school-name").innerText(),
    "مدارس الموهوبين التقنيه بجدة",
  );
  const brands = await tv
    .locator(".native-brand-pair img")
    .evaluateAll((images) =>
      images.map((img) => ({
        x: img.getBoundingClientRect().x,
        ready: img.complete && img.naturalWidth > 0,
      })),
    );
  assert(
    brands[0].x < brands[1].x,
    "Ministry logo stays left of Tuwaiq despite RTL",
  );
  assert(
    brands.every((img) => img.ready),
    "Both bundled logos load successfully",
  );
  console.log("4K loop rendered");
  await tv.screenshot({ path: join(artifacts, "tv-loop-4k.png") });
  const alpha = await tv.evaluate(async () => {
    const source = document.querySelector(".recognition-photo").src;
    const img = await createImageBitmap(await (await fetch(source)).blob());
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, 1, 1).data[3];
  });
  assert.equal(alpha, 0, "PNG transparency retained");
  console.log("Alpha preserved");
  assert.equal(await tv.locator(".loop-period h2").innerText(), "بين الحصص");
  // Record short-lived classes before changing time: a remote browser round trip
  // can outlast the 440 ms animation, so sampling after the call is unreliable.
  await tv.evaluate(() => {
    window.__loopTransitions = { period: false, clock: false };
    const observer = new MutationObserver(() => {
      window.__loopTransitions.period ||= !!document.querySelector(
        ".loop-period .soft-in",
      );
      window.__loopTransitions.clock ||= !!document.querySelector(
        ".clock-digit .soft-in",
      );
    });
    observer.observe(document.querySelector(".screen-loop"), {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
  await tv.clock.setFixedTime(new Date("2026-10-21T07:46:00+03:00"));
  await tv.waitForFunction(
    () => window.__loopTransitions.period && window.__loopTransitions.clock,
  );
  assert(
    (await tv.locator(".loop-period h2").innerText()).includes("الحصة الثانية"),
  );
  await tv.waitForFunction(
    () => document.querySelectorAll(".soft-out").length === 0,
    undefined,
    { timeout: 5000 },
  );
  await tv.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await tv
      .locator(".recognition-page")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  console.log("Clock/period transitions and reduced motion passed");
  // Publishing from the controller reaches an already-open TV through its
  // automatic polling fallback; no manual refresh or shared component state.
  await page
    .getByLabel("عنوان اللوحة", { exact: true })
    .fill("نجوم الأسبوع في البرمجة");
  await page
    .getByRole("button", { name: "حفظ الخلفية ولوحة التميز", exact: true })
    .click();
  await tv.waitForFunction(
    () =>
      document.querySelector(".recognition-heading h2")?.textContent ===
      "نجوم الأسبوع في البرمجة",
    undefined,
    { timeout: 65000, polling: 500 },
  );
  assert.equal(screen.template.loopSchoolName, "مدارس الموهوبين التقنيه بجدة");
  assert.equal(screen.template.loopBranding, "paired");
  console.log("Controller → already-open TV automatic sync passed");
  // Wait for nested photo cache and then exercise offline page reload.
  await tv.waitForFunction(async () => {
    const req = indexedDB.open("daily-screen-offline", 1);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const tx = req.result.transaction("screen");
        const r = tx.objectStore("screen").get("last");
        r.onsuccess = () =>
          resolve(
            r.result?.screen.template.recognition.title ===
              "نجوم الأسبوع في البرمجة" &&
              r.result?.screen.template.recognition.students[0].photo.startsWith(
                "data:",
              ),
          );
      };
    });
  });
  await tv.route("https://mock.school.test/**", (r) => r.abort());
  await tv.reload();
  await tv.locator(".recognition-board").waitFor();
  assert.equal(
    await tv
      .locator(".recognition-photo")
      .evaluate((img) => img.src.startsWith("data:")),
    true,
  );
  assert.equal(
    await tv.locator(".recognition-heading h2").textContent(),
    "نجوم الأسبوع في البرمجة",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile add/edit/remove/hide/save/reload; PNG upload+alpha; 4K full-viewport native loop; offline nested photos; zero JS errors.",
  );
  console.log("Screenshots:", artifacts);
} catch (error) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      console.error(
        "Failure page:",
        page.url(),
        (await page.locator("body").innerText()).slice(-4000),
      );
      await page
        .screenshot({ path: join(artifacts, "failure.png"), fullPage: true })
        .catch(() => {});
    }
  }
  throw error;
} finally {
  await browser.close();
}
