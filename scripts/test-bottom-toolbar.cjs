// Settings > Toolbar: v2.19's right sidebar or v2.2's bottom bar.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const ready = async () => {
      await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
      await page.evaluate(() => document.getElementById("closeWelcome")?.click());
    };
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await ready();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await ready();
    // The toolbar animates between layouts (0.28s).
    const bar = () => page.waitForTimeout(400).then(() => page.evaluate(() => {
      const rect = document.getElementById("sMConfigBar").getBoundingClientRect();
      const label = document.querySelector("#export span:not(.material-symbols-outlined)");
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        labelShown: getComputedStyle(label).display !== "none" };
    }));
    let state = await bar();
    assert.ok(state.right > 1400 && state.labelShown, "starts as the labelled right sidebar");

    // Switch with the Settings window open: the bar moves to the bottom at once.
    await page.locator("#appSettingsConfig").click();
    await choose(page, "#appToolbarPosition", "bottom");
    state = await bar();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.toolbar), "bottom");
    assert.ok(state.bottom > 860 && state.left >= 0 && state.right <= 1440, `bottom bar on screen: ${JSON.stringify(state)}`);
    assert.equal(state.labelShown, false, "less-used buttons are icon-only");
    assert.equal(await page.evaluate(() => document.querySelector(".modals").classList.contains("sidebarPopover")), false);

    // The panel list opens above the bar.
    await page.locator("#appSettingsConfig").click();
    await page.locator("#panelSelector").click();
    const list = await page.locator("#panelSelect").boundingBox();
    assert.ok(list.y + list.height <= state.top + 1, "panel list opens upward");
    await page.locator("#panelSelector").click();

    // The choice is kept, and switching back restores the sidebar.
    await page.reload();
    await ready();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.toolbar), "bottom");
    await page.locator("#appSettingsConfig").click();
    assert.equal(await page.locator("#appToolbarPosition").inputValue(), "bottom");
    await choose(page, "#appToolbarPosition", "right");
    state = await bar();
    assert.ok(state.right > 1400 && state.labelShown);
    assert.deepEqual(errors, []);
    console.log("Bottom toolbar: switch live, icon-only buttons, upward panel list, reload and switch back passed.");
  } finally {
    await browser.close();
  }
})();
