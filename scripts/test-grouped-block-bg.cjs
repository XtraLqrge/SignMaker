// Uses the existing browser test setup and a running local server.
// NODE_PATH=/path/to/node_modules node scripts/test-grouped-block-bg.cjs http://127.0.0.1:8769
const assert = require('node:assert/strict');
// Color dropdowns use the SignalMaker picker over a hidden select.
const pickColor = async (page, id, text) => {
  await page.locator(`#${id}-button`).click();
  await page.locator(".symbolPickerMenu.open .symbolPickerItem")
    .filter({ has: page.locator(".symbolPickerLabel", { hasText: new RegExp(`^${text}$`) }) })
    .click();
  // The picker applies the change after the next paint.
  await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
};
const { webkit } = require('playwright');
(async () => {
  const browser = await webkit.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const url = process.argv[2] || 'http://127.0.0.1:8769';
    const ready = async () => {
      await page.waitForFunction(() => typeof app !== 'undefined' && app.getPost()?.panels.length);
    };
    // Selecting the group by its edge selects it; the chevron would open it.
    const selectGroup = async () => {
      await page.locator('#subPanelConfig').click();
      await page.locator('[data-tab="sMSPBlocks"]').click();
      const group = page.locator('.textEditorBlock.sdGroupedBlock').first();
      const box = await group.boundingBox();
      await group.click({ position: { x: 6, y: box.height / 2 } });
    };
    await page.goto(url);
    await ready();
    await page.locator('#closeWelcome').click();
    await page.evaluate(() => {
      const post = app.getPost();
      post.panels[0].sign.subPanels[0].blockElements = new Control({
        rows: [[new ControlTextElement({ textContent: 'Main St' })],
          [new GroupedBlockElement({ blockElements: new Control({
            rows: [[new ControlTextElement({ textContent: 'EXIT ONLY', fontFamily: 'Clearview 5' })]],
            blockProperties: [new Block()] }) })]],
        blockProperties: [new Block(), new Block()],
      });
      app.setPost(post);
    });
    await selectGroup();
    const select = page.locator('#sdGroupedBlock_backgroundColor');
    assert.deepEqual(await select.locator('option').allTextContents(),
      await page.evaluate(() => TextElement.prototype.backgroundColor));
    assert.equal(await select.inputValue(), 'Inherit');
    const rendered = () => page.evaluate(() => {
      const group = app.getPost().panels[0].sign.subPanels[0].blockElements.rows[1][0];
      const wrapper = document.querySelector('#panel0 .bE-groupedBlockElement');
      const text = wrapper.querySelector('.bE-textElement');
      return { value: group.backgroundColor, background: getComputedStyle(wrapper).backgroundColor,
        color: getComputedStyle(text).color, font: text.dataset.exportFontFamily };
    });
    const expected = {
      Yellow: { background: 'rgb(252, 207, 52)', color: 'rgb(0, 0, 0)', font: 'Clearview 5B' },
      Black: { background: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)', font: 'Clearview 5W' },
      Inherit: { background: 'rgba(0, 0, 0, 0)', color: 'rgb(255, 255, 255)', font: 'Clearview 5W' },
    };
    for (const [value, style] of Object.entries(expected)) {
      await pickColor(page, 'sdGroupedBlock_backgroundColor', value);
      assert.deepEqual(await rendered(), { value, ...style }, value);
    }
    await pickColor(page, 'sdGroupedBlock_backgroundColor', 'Yellow');
    // Padding and corner radius default to 0 and render in rem.
    const box = () => page.evaluate(() => {
      const group = app.getPost().panels[0].sign.subPanels[0].blockElements.rows[1][0];
      const wrapper = document.querySelector('#panel0 .bE-groupedBlockElement');
      const style = getComputedStyle(wrapper);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return { padding: Number(group.padding), borderRadius: Number(group.borderRadius),
        paddingPx: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(v => parseFloat(v) / rem),
        radiusPx: [style.borderTopLeftRadius, style.borderBottomRightRadius].map(v => parseFloat(v) / rem) };
    });
    assert.deepEqual(await box(), { padding: 0, borderRadius: 0, paddingPx: [0, 0, 0, 0], radiusPx: [0, 0] });
    await page.locator('#sdGroupedBlock_padding').fill('0.25');
    await page.locator('#sdGroupedBlock_borderRadius').fill('0.5');
    await page.locator('#sdGroupedBlock_borderRadius').blur();
    assert.deepEqual(await box(), { padding: 0.25, borderRadius: 0.5, paddingPx: [0.25, 0.25, 0.25, 0.25], radiusPx: [0.5, 0.5] });
    // Border: off by default, Inherit follows the text color, width matches the sign.
    const border = () => page.evaluate(() => {
      const wrapper = document.querySelector('#panel0 .bE-groupedBlockElement');
      const style = getComputedStyle(wrapper);
      return { width: style.borderTopWidth, style: style.borderTopStyle, color: style.borderTopColor,
        signWidth: getComputedStyle(document.querySelector('#panel0 .sign')).borderTopWidth };
    });
    assert.equal((await border()).style, 'none');
    await page.locator('#sdGroupedBlock_border').check();
    let b = await border();
    assert.deepEqual([b.style, b.width, b.color], ['solid', b.signWidth, 'rgb(0, 0, 0)'], 'Inherit border on Yellow');
    await pickColor(page, 'sdGroupedBlock_borderColor', 'White');
    assert.equal((await border()).color, 'rgb(255, 255, 255)');
    await page.waitForTimeout(800);
    await page.reload();
    await ready();
    assert.equal((await rendered()).value, 'Yellow', 'Group background must persist');
    await selectGroup();
    assert.equal(await select.inputValue(), 'Yellow', 'Editor must show the saved background');
    assert.equal(await page.locator('#sdGroupedBlock_padding').inputValue(), '0.25');
    assert.equal(await page.locator('#sdGroupedBlock_borderRadius').inputValue(), '0.5');
    assert.deepEqual((await box()).paddingPx, [0.25, 0.25, 0.25, 0.25], 'Padding must persist');
    assert.equal(await page.locator('#sdGroupedBlock_border').isChecked(), true);
    assert.equal(await page.locator('#sdGroupedBlock_borderColor').inputValue(), 'White');
    assert.equal((await border()).color, 'rgb(255, 255, 255)', 'Border must persist');
    assert.deepEqual(errors, []);
    console.log('Grouped block background: all standard colours, contrast, Clearview face, padding, corner radius, border, editor sync and persistence passed.');
  } finally { await browser.close(); }
})();
