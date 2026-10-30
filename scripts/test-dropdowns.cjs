// Every dropdown uses the SignalMaker picker: dynamic block chips, the
// Header/Footer color menus, and menus inside dialogs, without leaking menus.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.evaluate(() => { localStorage.clear(); document.getElementById("closeWelcome")?.click(); });

    // Only hidden legacy fields stay native.
    const visibleNative = await page.evaluate(() => [...document.querySelectorAll("select:not(.nativeSelectSource)")]
      .filter((select) => getComputedStyle(select).display !== "none" && !select.hidden &&
        select.getAttribute("aria-hidden") !== "true")
      .map((select) => select.id || select.className));
    assert.deepEqual(visibleNative, []);
    // A picker whose select is hidden is hidden too.
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".symbolPicker[hidden]")]
      .filter((picker) => getComputedStyle(picker).display !== "none").length), 0);

    // The block chip's ▾ menu changes the block type.
    await page.locator("#subPanelConfig").click();
    await page.locator('[data-tab="sMSPBlocks"]').click();
    await page.locator(".textEditorBlock .blockTypeInlinePicker .nativeSelectTrigger").first().click({ force: true });
    await page.locator(".symbolPickerMenu.open .symbolPickerItem", { hasText: /^Shield$/ }).first().click();
    await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
    assert.equal(await page.evaluate(() =>
      app.getPost().panels[0].sign.subPanels[0].blockElements.rows[0][0].constructor.name), "ShieldElement");

    // Header/Footer menus show color swatches but no Custom… row.
    await page.locator('.nativeSelectTrigger[aria-label^="Add Header"]').click();
    assert.ok(await page.locator(".symbolPickerMenu.open .colorPickerSwatch").count() > 3);
    assert.equal(await page.locator(".symbolPickerMenu.open [data-picker-custom]").count(), 0);
    await page.keyboard.press("Escape");

    // Rebuilding the block list replaces its pickers instead of adding more.
    const count = () => page.evaluate(() => [window.nativeSelectPickers.size,
      document.querySelectorAll(".symbolPickerMenu").length]);
    const before = await count();
    for (let i = 0; i < 5; i++) await page.evaluate(() => formHandler.updateForm());
    await page.waitForTimeout(100);
    assert.deepEqual(await count(), before);

    // A dropdown inside a modal dialog opens above it.
    await page.evaluate(() => {
      const post = app.getPost();
      const blockElements = post.panels[0].sign.subPanels[0].blockElements;
      blockElements.rows = [[new IconElement({})]];
      blockElements.blockProperties = [new Block()];
      app.setPost(post);
      formHandler.updateForm();
    });
    await page.locator("#sdIcon_chooseBtn").click();
    await page.locator("#iconPickerView-button").click();
    await page.locator("#iconSelectorModal .symbolPickerMenu.open .symbolPickerItem", { hasText: "List view" }).click();
    await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
    assert.equal(await page.evaluate(() => document.getElementById("iconGrid").dataset.view), "list");
    assert.deepEqual(errors, []);
    console.log("Dropdowns: all converted, block chip type, header colors, no leaks and dialog menus passed.");
  } finally {
    await browser.close();
  }
})();
