// Uses the existing browser test setup and a running local server.
// NODE_PATH=/path/to/node_modules node scripts/test-subpanel-divider.cjs http://127.0.0.1:8769
const assert = require('node:assert/strict');
const { webkit } = require('playwright');
(async () => {
  const browser = await webkit.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const ready = () => page.waitForFunction(() => typeof app !== 'undefined' && app.getPost()?.panels.length);
    await page.goto(process.argv[2] || 'http://127.0.0.1:8769');
    await ready();
    await page.locator('#closeWelcome').click();
    await page.evaluate(() => app.newSubPanel());
    await page.locator('#subPanelConfig').click();
    await page.locator('[data-tab="sMSPExtra"]').click();
    const divider = () => page.evaluate(() => {
      const element = document.querySelector('#panel0 #subDivider1');
      const style = getComputedStyle(element);
      return { line: style.backgroundColor, width: element.getBoundingClientRect().width,
        saved: app.getPost().panels[0].sign.subPanels[1].hideDivider };
    });
    const checkbox = page.locator('#subPanelHideDivider');
    assert.equal(await checkbox.isVisible(), true, 'Hide Divider shows for the second subpanel');
    assert.equal(await checkbox.isChecked(), false);
    const shown = await divider();
    assert.deepEqual([shown.line, shown.saved], ['rgb(255, 255, 255)', false]);
    await checkbox.check();
    const hidden = await divider();
    assert.deepEqual([hidden.line, hidden.saved], ['rgba(0, 0, 0, 0)', true]);
    assert.equal(hidden.width, shown.width, 'Hiding the line keeps the divider space');
    await page.waitForTimeout(800);
    await page.reload();
    await ready();
    assert.equal((await divider()).saved, true, 'Hide Divider must persist');
    assert.equal((await divider()).line, 'rgba(0, 0, 0, 0)');
    assert.deepEqual(errors, []);
    console.log('Subpanel divider: Hide Divider option, rendering, spacing and persistence passed.');
  } finally { await browser.close(); }
})();
