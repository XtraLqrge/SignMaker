// Settings window: v2.19's theme mode, UI scale, keybind mode and On Refresh.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = process.argv[2] || "http://127.0.0.1:8765";
    const ready = async () => {
      await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
      await page.evaluate(() => document.getElementById("closeWelcome")?.click());
    };
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    const zoom = () => page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sm-app-zoom")));
    await page.goto(url);
    await ready();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await ready();
    assert.equal(await theme(), "light");
    assert.equal(await zoom(), 1);

    await page.locator("#appSettingsConfig").click();
    assert.equal(await page.locator(".sMModal.appSettingsConfig").isVisible(), true);
    await choose(page, "#appThemeMode", "dark");
    assert.equal(await theme(), "dark");
    await page.locator("#appUiScale").fill("120");
    await page.locator("#appUiScale").dispatchEvent("change");
    assert.equal(await page.locator("#appUiScaleValue").textContent(), "120%");
    assert.equal(await zoom(), 1.2);
    await choose(page, "#appKeybindMode", "none");
    assert.equal(await page.locator("#restoreOnRefresh-button").isVisible(), true);

    // Keybinds off: Cmd+Z does nothing.
    await page.evaluate(() => app.newPanel());
    await page.waitForTimeout(400);
    const panels = () => page.evaluate(() => app.getPost().panels.length);
    const before = await panels();
    await page.locator("body").click({ position: { x: 300, y: 900 } });
    await page.keyboard.press("Meta+z");
    assert.equal(await panels(), before, "undo shortcut is off");

    // Settings survive a reload; the sidebar Dark Mode button still toggles.
    await page.reload();
    await ready();
    assert.equal(await theme(), "dark");
    assert.equal(await zoom(), 1.2);
    assert.equal(await page.locator("#appKeybindMode").inputValue(), "none");
    await page.locator("#nightMode").click();
    assert.equal(await theme(), "light");
    assert.equal(await page.locator("#appThemeMode").inputValue(), "system");

    await page.locator("#appSettingsConfig").click();
    await choose(page, "#appKeybindMode", "all");
    await page.evaluate(() => app.newPanel());
    await page.waitForTimeout(400);
    const added = await panels();
    await page.locator("body").click({ position: { x: 300, y: 900 } });
    await page.keyboard.press("Meta+z");
    await page.waitForFunction((count) => app.getPost().panels.length < count, added);
    assert.deepEqual(errors, []);
    console.log("App settings: theme, UI scale, keybind mode, On Refresh, reload and Dark Mode button passed.");
  } finally {
    await browser.close();
  }
})();
