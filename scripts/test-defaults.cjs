// Requires Playwright + WebKit and a running local server.
const assert = require('node:assert/strict');
const { choose } = require("./select-helper.cjs");
const { webkit } = require('playwright');
(async () => {
  const browser = await webkit.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8767');
    await page.waitForFunction(() => typeof app !== 'undefined' && app.getPost()?.panels.length);
    await page.locator('#closeWelcome').click();
    await page.locator('#appSettingsConfig').click();
    await page.locator('[data-tab="sMDefaults"]').click();
    assert.equal(await page.locator('#defaultsCategory option').count(), 8);
    const originalRadius = await page.evaluate(() => app.getPost().panels[0].borderRadius);
    await page.getByLabel('Sign border radius (rem):', { exact: true }).fill('1.25');
    assert.equal(await page.evaluate(() => app.getPost().panels[0].borderRadius), originalRadius);
    await choose(page, '#defaultsCategory', 'ControlTextElement');
    await page.locator('#defaults_ControlTextElement_textContent').fill('Default City');
    await page.locator('#defaults_ControlTextElement_fontSize').fill('125');
    await choose(page, '#defaults_ControlTextElement_fontFamily', 'Arial');
    const before = await page.evaluate(() => app.getPost().panels[0].sign.subPanels[0].blockElements.rows[0][0].textContent);
    assert.notEqual(before, 'Default City');
    await page.evaluate(() => app.newRow('ControlTextElement'));
    assert.equal(await page.evaluate(() => app.getPost().panels[0].sign.subPanels[0].blockElements.rows[1][0].textContent), 'Default City');
    await page.reload();
    await page.waitForFunction(() => typeof app !== 'undefined' && app.getPost()?.panels.length);
    assert.equal(await page.locator('#defaults_ControlTextElement_textContent').inputValue(), 'Default City');
    await page.evaluate(() => app.newPanel());
    assert.deepEqual(await page.evaluate(() => {
      const panel = app.getPost().panels.at(-1);
      const block = panel.sign.subPanels[0].blockElements.rows[0][0];
      return [panel.borderRadius, block.textContent, block.fontSize, block.fontFamily];
    }), [1.25, 'Default City', 125, 'Arial']);
    await page.locator('#appSettingsConfig').click();
    await page.locator('[data-tab="sMDefaults"]').click();
    for (const [name, property, value] of [
      ['ShieldElement', 'routeNumber', '42'],
      ['ActionMessageElement', 'textContent', 'Next Exit'],
      ['AdvisoryMessageElement', 'fontSize', '80'],
      ['ArrowElement', 'rotation', '90'],
      ['IconElement', 'iconSize', '4'],
      ['TollLogoElement', 'spacing', '1.5'],
    ]) {
      await choose(page, '#defaultsCategory', name);
      await page.locator(`#defaults_${name}_${property}`).fill(value);
      assert.equal(await page.evaluate(({name, property}) =>
        blockDefaults.create(Control.prototype.blockToClassElems[name])[property], {name, property}),
        ['routeNumber', 'textContent'].includes(property) ? value : Number(value));
    }
    assert.equal(await page.locator('#defaultsFields select').evaluateAll(selects => selects.every(select => select.options.length > 0)), true);
    // Reset doesn't change signs that already exist.
    await page.locator('#resetBlockDefaults').click();
    assert.equal(await page.evaluate(() => app.getPost().panels.at(-1).borderRadius), 1.25);
    await page.evaluate(() => app.newPanel());
    assert.equal(await page.evaluate(() => app.getPost().panels.at(-1).borderRadius), 0.75);
    assert.notEqual(await page.evaluate(() => app.getPost().panels.at(-1).sign.subPanels[0].blockElements.rows[0][0].textContent), 'Default City');
    await choose(page, '#defaultsCategory', 'TollLogoElement');
    await page.screenshot({ path: '/tmp/signmaker-defaults.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: '/tmp/signmaker-defaults-mobile.png' });
    const bounds = await page.locator('.sMModal.defaultsConfig').boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.deepEqual(errors, []);
    console.log('Defaults: persistence, new blocks/signs, radius, reset, and existing content passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
