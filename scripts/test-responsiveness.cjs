// Responsiveness targets, measured with the browser's Event Timing API on
// real mouse and keyboard input: for each interaction, the slowest event's
// processing stays within one frame (16ms) and input-to-paint under 100ms
// (half of the 200ms "good" INP threshold). Entries under 16ms aren't
// reported by the API and count as within target.
const pw = require("playwright");
const assert = require("node:assert/strict");
const engine = process.argv[3] || "webkit";
(async () => {
  const browser = await pw[engine].launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__events = [];
      new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
        if (["click", "keydown", "pointerdown", "pointerup", "input"].includes(entry.name)) {
          window.__events.push({ processing: entry.processingEnd - entry.processingStart, duration: entry.duration });
        }
      })).observe({ type: "event", durationThreshold: 16, buffered: true });
    });
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.evaluate(() => { localStorage.clear(); document.getElementById("closeWelcome")?.click(); for (let i = 0; i < 3; i++) app.newPanel(); });
    await page.waitForTimeout(1500);
    const closeMenu = async () => {
      const menu = await page.evaluate(() => document.getElementById("sMConfigBar").dataset.currentMenu);
      if (menu) await page.evaluate((menu) => document.getElementById(menu).click(), menu);
      await page.waitForTimeout(150);
    };
    const results = [];
    const measure = async (name, action) => {
      await page.evaluate(() => { window.__events = []; });
      await action();
      await page.waitForTimeout(300);
      const events = await page.evaluate(() => window.__events);
      const slowest = events.length ? Math.max(...events.map((event) => event.processing)) : 0;
      const worst = events.length ? Math.max(...events.map((event) => event.duration)) : 0;
      results.push({ name, slowest, worst });
    };
    await closeMenu();
    for (const id of ["postConfig", "panelStyleConfig", "exitTabConfig", "subPanelConfig", "guideArrowConfig", "templates", "appSettingsConfig"]) {
      await measure(`open ${id}`, async () => {
        for (let i = 0; i < 3; i++) {
          await page.locator(`#${id}`).click();
          await page.waitForTimeout(150);
          await page.locator(`#${id}`).click();
          await page.waitForTimeout(150);
        }
      });
    }
    await measure("switch panel from the panel list", async () => {
      for (let i = 0; i < 3; i++) {
        if (!(await page.locator("#panelList .panelListButton").first().isVisible())) {
          await page.locator("#panelSelector").click();
          await page.waitForTimeout(400);
        }
        await page.locator("#panelList .panelListButton").nth(i % 3).click({ force: true });
        await page.waitForTimeout(300);
      }
      await closeMenu();
    });
    await page.locator("#exitTabConfig").click();
    await page.waitForTimeout(300);
    await measure("drag a slider", async () => {
      const box = await page.locator("#minHeight").boundingBox();
      await page.mouse.move(box.x + 3, box.y + box.height / 2);
      await page.mouse.down();
      for (let x = 3; x < box.width - 3; x += 3) await page.mouse.move(box.x + x, box.y + box.height / 2);
      await page.mouse.up();
    });
    await measure("type an exit number", async () => {
      await page.locator("#exitNumber").click();
      await page.keyboard.type("EXIT 12A", { delay: 20 });
    });
    await closeMenu();
    await page.locator("#subPanelConfig").click();
    await page.waitForTimeout(300);
    await measure("select a block chip", async () => {
      for (let i = 0; i < 4; i++) {
        await page.locator(".textEditorBlock").first().click({ position: { x: 20, y: 10 } });
        await page.waitForTimeout(120);
      }
    });
    await measure("type block text", async () => {
      await page.locator("#sdCtrlText_textContent").click();
      await page.keyboard.type(" Street", { delay: 20 });
    });
    await measure("choose from a dropdown (mouse)", async () => {
      for (const label of ["Left", "Center", "Right", "Center"]) {
        await page.locator("#sdCtrlText_alignment-button").click();
        await page.locator(".symbolPickerMenu.open .symbolPickerItem")
          .filter({ has: page.locator(".symbolPickerLabel", { hasText: new RegExp(`^${label}$`) }) }).first().click();
        await page.waitForTimeout(150);
      }
    });
    await measure("choose from a dropdown (keyboard)", async () => {
      for (const key of ["l", "c", "r", "c"]) {
        await page.locator("#sdCtrlText_alignment-button").focus();
        await page.keyboard.press(key);
        await page.waitForTimeout(150);
      }
    });
    await measure("toggle a checkbox", async () => {
      for (let i = 0; i < 4; i++) {
        await page.locator("#sdCtrlText_useBannerFormatting").click();
        await page.waitForTimeout(150);
      }
    });
    for (const { name, slowest, worst } of results) {
      console.log(`${name.padEnd(36)} worst processing ${slowest.toFixed(0).padStart(3)}ms  worst input-to-paint ${worst.toFixed(0).padStart(3)}ms`);
    }
    for (const { name, slowest, worst } of results) {
      assert.ok(slowest <= 16, `${name}: processing ${slowest.toFixed(1)}ms > 16ms`);
      assert.ok(worst <= 100, `${name}: input-to-paint ${worst.toFixed(1)}ms > 100ms`);
    }
    assert.deepEqual(errors, []);
    console.log(`Responsiveness (${engine}): ${results.length} interactions within 16ms processing and 100ms input-to-paint passed.`);
  } finally {
    await browser.close();
  }
})();
