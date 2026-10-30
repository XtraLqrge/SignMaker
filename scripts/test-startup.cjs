// Startup (v2.19 performance work): starts on DOMContentLoaded, paints a
// restored sign, reveals it once fonts load, and remembers font hints.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const ready = () => page.waitForFunction(() => typeof app !== "undefined" &&
      app.getPost()?.panels.length && !document.documentElement.hasAttribute("data-sign-loading"));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await ready();
    await page.evaluate(() => {
      localStorage.setItem("signMaker.restoreOnRefresh", "always");
      const post = app.getPost();
      post.panels[0].sign.subPanels[0].blockElements.rows[0][0].fontFamily = "DIN 1451 Regular";
      app.newPanel();
    });
    await page.waitForTimeout(300);

    // Reload: the restored sign is visible and its fonts were remembered.
    await page.reload();
    await ready();
    assert.equal(await page.evaluate(() => app.getPost().panels.length), 2);
    assert.equal(await page.locator("#panelContainer .panel").first().isVisible(), true);
    const hints = await page.evaluate(() => JSON.parse(localStorage.getItem("signMaker.fontHints.v1") || "[]"));
    assert.ok(hints.includes("DIN 1451 Regular"), `font hints: ${hints}`);
    assert.equal(await page.evaluate(() => document.fonts.check('16px "DIN 1451 Regular"', "A")), true);
    assert.equal(await page.locator('link[rel="preload"][href*="Mittelschrift"]').count(), 1);

    // The page also starts when opened straight from disk.
    const filePage = await context.newPage();
    filePage.on("pageerror", (error) => errors.push(error.message));
    await filePage.goto("file://" + path.join(__dirname, "..", "public", "index.html"));
    await filePage.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length &&
      !document.documentElement.hasAttribute("data-sign-loading"), null, { timeout: 15000 });
    assert.deepEqual(errors, []);
    console.log("Startup: restore, font-gated reveal, font hints, preload and file:// start passed.");
  } finally {
    await browser.close();
  }
})();
