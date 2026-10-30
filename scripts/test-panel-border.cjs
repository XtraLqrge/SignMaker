// v2.19 panel border thickness: sign rim width, exit tab follow and old saves.
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
    await page.locator("#closeWelcome").click();
    const rim = () => page.evaluate(() => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return parseFloat(getComputedStyle(document.querySelector("#panelContainer .sign")).borderTopWidth) / rem;
    });
    assert.equal(await rim(), 0.2);
    await page.locator("#panelStyleConfig").click();
    await page.locator("#panelBorderThickness").fill("0.4");
    assert.equal(await rim(), 0.4);
    assert.equal(await page.locator("#panelBorderThicknessValue").textContent(), "200%");
    await page.locator("#panelBorderThickness").fill("0");
    assert.equal(await rim(), 0);
    assert.equal(await page.evaluate(() => app.getPost().panels[0].exitTabs[0].borderThickness), 0);
    assert.equal(await page.locator("#panelContainer .panel.panelBorderHidden").count(), 1);
    // v2.19's older hideBorder flag reads as no border; v2.2 saves read as standard.
    assert.deepEqual(await page.evaluate(() => [
      Panel.getBorderThickness({ hideBorder: true }), Panel.getBorderThickness({}),
      Panel.getBorderThickness({ borderThickness: 0.33 })]), [0, 0.2, 0.3]);
    assert.deepEqual(errors, []);
    console.log("Panel border: thickness control, rim width, exit tab follow and old saves passed.");
  } finally {
    await browser.close();
  }
})();
