// Template rename from v2.19: renames saved templates, never built-in ones.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    page.on("dialog", (dialog) => dialog.type() === "prompt" ? dialog.accept("Renamed Template") : dialog.accept());
    await page.evaluate(() => app.savePanelTemplate("Original Template"));
    const item = page.locator(".templateItem", { hasText: "Original Template" });
    await item.locator(".templateRenameBtn").evaluate((button) => button.click());
    await page.locator(".templateItem", { hasText: "Renamed Template" }).waitFor({ state: "attached" });
    assert.equal(await page.locator(".templateItem", { hasText: "Original Template" }).count(), 0);
    const defaults = await page.locator(".templateItem").evaluateAll((items) =>
      items.filter((element) => /Default ·/.test(element.textContent))
        .map((element) => element.querySelector(".templateRenameBtn") !== null));
    assert(defaults.length > 0 && defaults.every((hasRename) => !hasRename), "default templates cannot be renamed");
    assert.deepEqual(errors, []);
    console.log("Template rename passed.");
  } finally {
    await browser.close();
  }
})();
