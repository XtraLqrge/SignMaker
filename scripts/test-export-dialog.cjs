// Export dialog: opened from the download menu, several panels, SVG and copy.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    await page.evaluate(() => { app.newPanel(); app.newPanel(); });

    await page.locator("#exportDownload").click({ button: "right" });
    await page.locator("button", { hasText: "Export..." }).click();
    assert.equal(await page.locator("#downloadContent").evaluate((dialog) => dialog.open), true);

    await page.locator("#entirePost").uncheck();
    const panelButtons = page.locator("#downloadPanelButtons button");
    assert.equal(await panelButtons.count(), 3);
    assert.equal(await page.locator("#downloadPanelButtons button.activated").count(), 1);
    await panelButtons.nth(2).click();
    await page.waitForFunction(() => document.querySelectorAll("#downloadPanelButtons button.activated").length === 2);

    await page.locator("#SVG").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#download").click(),
    ]);
    const svg = require("node:fs").readFileSync(await download.path(), "utf8");
    const panelIds = [...new Set(svg.match(/id="panel\d"/g) || [])].sort();
    assert.deepEqual(panelIds, ['id="panel0"', 'id="panel2"'], "only the selected panels are exported");
    assert.equal(await page.locator("#panel1").evaluate((panel) => panel.style.display), "", "hidden panels are restored");

    await page.locator("#PNG").click();
    await page.evaluate(() => {
      window.copiedExport = null;
      Object.defineProperty(navigator.clipboard, "write", {
        value: async (items) => { window.copiedExport = await items[0].getType("image/png"); },
      });
    });
    await page.locator("#copyDownload").click();
    await page.waitForFunction(() => window.copiedExport?.size > 1000);
    assert.deepEqual(errors, []);
    console.log("Export dialog: menu entry, multi-panel SVG export and copy passed.");
  } finally {
    await browser.close();
  }
})();
