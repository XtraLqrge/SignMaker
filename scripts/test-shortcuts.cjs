// Shortcuts tab: v2.19's remappable shortcuts drive panels, rows, menus,
// zoom, undo and block copy/paste.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = process.argv[2] || "http://127.0.0.1:8765";
    const ready = async () => {
      await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
      await page.evaluate(() => document.getElementById("closeWelcome")?.click());
    };
    await page.goto(url);
    await ready();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await ready();
    const panels = () => page.evaluate(() => app.getPost().panels.length);
    const menu = () => page.evaluate(() => document.getElementById("sMConfigBar").dataset.currentMenu);
    const blur = () => page.evaluate(() => document.activeElement?.blur());

    // Default keys.
    await blur();
    await page.keyboard.press("p");
    assert.equal(await panels(), 2);
    assert.equal(await page.locator("#shortcutActionNotice").textContent(), "Selected: Panel 2");
    await page.keyboard.press("Shift+ArrowLeft");
    assert.equal(await page.evaluate(() => app.getPost().panels.indexOf(formHandler) === -1 &&
      document.getElementById("currentlySelectedPanel").textContent), "Panel 1");
    await page.keyboard.press("Alt+p");
    assert.equal(await panels(), 1);
    await page.keyboard.press("Meta+z");
    assert.equal(await panels(), 2, "Cmd+Z undoes the delete");
    await page.keyboard.press("Meta+y");
    assert.equal(await panels(), 1, "Cmd+Y still redoes");
    await page.keyboard.press("4");
    assert.equal(await menu(), "exitTabConfig");
    await page.keyboard.press("Escape");
    assert.equal(await menu(), "");
    const zoom = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sm-app-zoom").trim());
    await page.keyboard.press("=");
    assert.equal(await zoom(), "1.1");
    await page.keyboard.press("-");
    assert.equal(await zoom(), "1");

    // Typing in a field doesn't trigger bare-key shortcuts.
    await page.locator("#subPanelConfig").click();
    const field = page.locator("#sMSPBlocks input[type=text]:visible, #sMSPBlocks textarea:visible").first();
    await field.click();
    await page.keyboard.press("p");
    assert.equal(await panels(), 1);

    // Remap New Panel to Shift+N in the Shortcuts tab; it survives a reload.
    await page.locator("#appSettingsConfig").click();
    await page.locator('.appSettingsConfig .sMModalTab[data-tab="sMAppShortcuts"]').click();
    const input = page.locator("#appShortcutNewPanel");
    await input.click();
    await page.keyboard.press("Shift+N");
    assert.equal(await input.inputValue(), "⇧N");
    await page.reload();
    await ready();
    await blur();
    await page.keyboard.press("p");
    assert.equal(await panels(), 1, "P no longer adds a panel");
    await page.keyboard.press("Shift+N");
    assert.equal(await panels(), 2);

    // Keybinds set to Undo/Redo only turns the rest off; reset restores P.
    await page.evaluate(() => localStorage.setItem("signMaker.keybindMode", "undo-redo"));
    await page.keyboard.press("Shift+N");
    assert.equal(await panels(), 2);
    await page.evaluate(() => localStorage.setItem("signMaker.keybindMode", "all"));
    await page.locator("#appSettingsConfig").click();
    await page.locator('.appSettingsConfig .sMModalTab[data-tab="sMAppShortcuts"]').click();
    await page.locator("#resetAppShortcuts").click();
    assert.equal(await input.inputValue(), "P");
    await page.locator("#appSettingsConfig").click();
    await blur();
    await page.keyboard.press("p");
    assert.equal(await panels(), 3);
    assert.deepEqual(errors, []);
    console.log("Shortcuts: defaults, undo/redo, menus, zoom, typing guard, remap, reload, keybind mode and reset passed.");
  } finally {
    await browser.close();
  }
})();
