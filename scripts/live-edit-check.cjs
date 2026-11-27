/* Optional integration audit: PLAYWRIGHT_MODULE and WEBKIT_EXECUTABLE may point
   to an existing installation. No input test dispatches change until checked. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await webkit.launch(process.env.WEBKIT_EXECUTABLE ? { executablePath: process.env.WEBKIT_EXECUTABLE } : {});
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    page.setDefaultTimeout(10000);
    const url = process.env.TEST_URL || pathToFileURL(path.resolve('public/index.html')).href;
    const reset = async () => {
      await page.goto(url);
      await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
      await page.evaluate(() => document.getElementById('closeWelcome')?.click());
    };
    await reset();
    const results = await page.evaluate(async () => {
      const bridge = app.exposeToFormHandler;
      const scopes = { ControlTextElement: 'sdCtrlText', DividerElement: 'sdBlocker', ShieldElement: 'sdShield', AdvisoryMessageElement: 'sdAdvisory', IconElement: 'sdIcon', BeaconElement: 'sdBeacon', ArrowElement: 'sdArrow', TollLogoElement: 'sdTollLogo', ActionMessageElement: 'sdActionMessage', ElectronicSignElement: 'sdElectronicSign', GroupedBlockElement: 'sdGroupedBlock' };
      const results = [];
      for (const [type, scope] of Object.entries(scopes)) {
        bridge.replaceControlElemTypeAt(0, 0, type);
        formHandler.updateForm();
        const fields = [...document.querySelectorAll(`[data-property="${scope}"] input,[data-property="${scope}"] textarea`)]
          .filter(e => ['range', 'number', 'text', 'textarea'].includes(e.type) && !e.disabled && e.id && !/(_icon$|_arrow$)/.test(e.id));
        for (const field of fields) {
          formHandler.updateForm();
          const before = JSON.stringify(bridge.getCurrentBlockElem());
          if (['range', 'number'].includes(field.type)) {
            const step = Number(field.step) || 1;
            let value = (Number(field.value) || 0) + step;
            if (field.max && value > Number(field.max)) value = Number(field.value) - step;
            field.value = String(Number(value.toFixed(4)));
          } else field.value += '7';
          field.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(requestAnimationFrame);
          results.push({ id: field.id, changed: before !== JSON.stringify(bridge.getCurrentBlockElem()) });
          field.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(requestAnimationFrame);
        }
      }
      return results;
    });
    assert.ok(results.length >= 80);
    assert.deepEqual(results.filter(result => !result.changed), [], 'Every continuous block control updates before change/blur');
    console.log('Block sweep passed:', results.length);
    await reset();
    await page.locator('#subPanelConfig').click();
    const input = page.locator('#sdBlock_topPaddingVal');
    await input.fill('1.2');
    assert.equal(await page.evaluate(() => app.exposeToFormHandler.getCurrentSubPanel().blockElements.blockProperties[0].topPadding), 1.2);
    await input.fill('-0.5');
    assert.equal(await page.evaluate(() => app.exposeToFormHandler.getCurrentSubPanel().blockElements.blockProperties[0].topPadding), -0.5);
    await input.fill('');
    assert.equal(await page.evaluate(() => app.exposeToFormHandler.getCurrentSubPanel().blockElements.blockProperties[0].topPadding), -0.5, 'Empty numeric draft does not overwrite the model');
    await input.fill('1.20');
    assert.equal(await input.inputValue(), '1.20', 'Live editing preserves numeric draft formatting');
    await input.blur();
    await page.evaluate(() => app.undo());
    await page.waitForFunction(() => app.exposeToFormHandler.getCurrentSubPanel().blockElements.blockProperties[0].topPadding === 0);
    await page.evaluate(() => { app.exposeToFormHandler.replaceControlElemTypeAt(0, 0, 'ControlTextElement'); app.exposeToFormHandler.setSelectedRowAndBlock(0, 0); });
    // Paired numeric fields update the model and slider without stealing focus.
    await page.locator('#sdCtrlText_fontSizeVal').fill('125');
    assert.equal(await page.evaluate(() => Number(app.exposeToFormHandler.getCurrentBlockElem().fontSize)), 125);
    assert.equal(await page.locator('#sdCtrlText_fontSize').inputValue(), '125');
    await page.locator('#sdCtrlText_fontSizeVal').blur();
    const text = page.locator('#sdCtrlText_textContent');
    await text.fill('Live typing');
    assert.equal(await page.evaluate(() => app.exposeToFormHandler.getCurrentBlockElem().textContent), 'Live typing');
    assert.ok(await page.locator('#panel0').innerText().then(text => text.includes('Live typing')));
    assert.equal(await text.evaluate(e => e === document.activeElement), true);
    await text.blur();
    // Selected-panel controls and dynamic individual arrows.
    const checks = await page.evaluate(async () => {
      const b = app.exposeToFormHandler, results = [];
      const edit = (id, value, read) => {
        const e = document.getElementById(id); e.value = value;
        e.dispatchEvent(new Event('input', { bubbles: true }));
        results.push([id, read()]);
        e.dispatchEvent(new Event('change', { bubbles: true }));
      };
      edit('panelBorderRadius', '2', () => b.getCurrentPanel().borderRadius);
      edit('paddingTop', '1.25', () => b.getCurrentPanel().sign.padding);
      edit('settingsPanelSpacingValue', '2.5', () => app.getPost().panelSpacing);
      edit('postThicknessValue', '1.5', () => app.getPost().thickness);
      document.getElementById('guideArrow').value = 'Standard Arrow';
      formHandler.readForm();
      edit('guideArrowLanes', '2', () => Number(b.getCurrentPanel().sign.guideArrowLanes));
      edit('standardArrowPaddingValue', '1.25', () => b.getCurrentPanel().sign.standardArrowPadding);
      await new Promise(requestAnimationFrame);
      const angle = document.querySelector('#standardArrowIndividualRows input[type="number"]');
      angle.value = '35'; angle.dispatchEvent(new Event('input', { bubbles: true }));
      results.push(['individual angle', b.getCurrentPanel().sign.standardArrowIndividuals[0].angle, angle.isConnected]);
      angle.dispatchEvent(new Event('change', { bubbles: true }));
      return results;
    });
    assert.equal(checks[0][1], 2);
    assert.ok(String(checks[1][1]).includes('1.25'));
    assert.deepEqual(checks.slice(2), [['settingsPanelSpacingValue', 2.5], ['postThicknessValue', 1.5], ['guideArrowLanes', 2], ['standardArrowPaddingValue', 1.25], ['individual angle', 35, true]]);
    await page.evaluate(() => {
      app.exposeToFormHandler.replaceControlElemTypeAt(0, 0, 'ControlTextElement');
      app.exposeToFormHandler.setSelectedRowAndBlock(0, 0);
    });
    const otherEditors = await page.evaluate(async () => {
      const b = app.exposeToFormHandler, results = [];
      // Exit-tab text and geometry, including the fields that had only change handlers.
      for (const id of ['exitNumber', 'exitTabCharacterSpacing', 'borderThickness', 'minHeight', 'fontSize', 'exitTabHorizontalPadding', 'exitTabTextSizePercent']) {
        formHandler.updateForm();
        const field = document.getElementById(id);
        const before = JSON.stringify(b.getCurrentPanel().exitTabs);
        if (field.type === 'text') field.value = '123A';
        else {
          const step = Number(field.step) || 1;
          const next = Number(field.value) + step;
          field.value = String(field.max && next > Number(field.max) ? Number(field.value) - step : next);
        }
        field.dispatchEvent(new Event('input', { bubbles: true }));
        results.push([id, before !== JSON.stringify(b.getCurrentPanel().exitTabs)]);
        field.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(requestAnimationFrame);
      }
      b.setCurrentPanelArrowMode('apl');
      b.addAPLArrow('UP');
      b.addAPLArrow('UP');
      b.setAPLExitOnly(0, true);
      formHandler.updateForm();
      const edit = (selector, value, read) => {
        const e = document.querySelector(selector);
        if (!e) throw Error('Missing ' + selector);
        e.value = value; e.dispatchEvent(new Event('input', { bubbles: true }));
        results.push([selector, read(), e.isConnected]);
        e.dispatchEvent(new Event('change', { bubbles: true }));
      };
      edit('.aplArrowSizeSlider', '5.5', () => b.getCurrentPanel().sign.aplArrows[0].arrowSizeRem);
      edit('.aplExitTextField-left input', 'LEAVE', () => b.getCurrentPanel().sign.aplArrows[0].aplExitText.left);
      edit('.aplArrowSpacingRow input', '6', () => b.getCurrentPanel().sign.aplArrows[0].spacingAfterRem);
      // Custom shield designer numeric companions must fire the existing live preview path.
      const numeric = document.getElementById('customShieldMakerRouteTopOffsetVal');
      const range = document.getElementById('customShieldMakerRouteTopOffset');
      numeric.value = '2'; numeric.dispatchEvent(new Event('input', { bubbles: true }));
      results.push(['custom shield offset', range.value]);
      return results;
    });
    assert.ok(otherEditors.slice(0, 7).every(result => result[1]), JSON.stringify(otherEditors));
    assert.deepEqual(otherEditors.slice(7), [['.aplArrowSizeSlider', 5.5, true], ['.aplExitTextField-left input', 'LEAVE', true], ['.aplArrowSpacingRow input', 6, true], ['custom shield offset', '2']]);
    const originalColor = await page.evaluate(() => app.exposeToFormHandler.getCurrentBlockElem().backgroundColor);
    const openCustom = async () => page.evaluate(() => {
      const api = document.getElementById('sdCtrlText_backgroundColor')._colorPickerApi;
      api.trigger.click();
      api.menu.querySelector('.colorPickerCustomColorButton').click();
    });
    await openCustom();
    const custom = page.locator('.colorPickerCustomPanel[data-owner-color-picker="sdCtrlText_backgroundColor"]');
    await custom.locator('.colorPickerHexInput').fill('#123456');
    assert.equal(await page.evaluate(() => app.exposeToFormHandler.getCurrentBlockElem().backgroundColor.toLowerCase()), '#123456');
    await custom.locator('.colorPickerCancelButton').click();
    assert.equal(await page.evaluate(() => app.exposeToFormHandler.getCurrentBlockElem().backgroundColor), originalColor);
    // The menu remains open after Cancel; reopen its custom editor directly.
    await page.evaluate(() => document.getElementById('sdCtrlText_backgroundColor')._colorPickerApi.menu.querySelector('.colorPickerCustomColorButton').click());
    await custom.locator('.colorPickerHexInput').fill('#abcdef');
    await custom.locator('.colorPickerAddButton').click();
    assert.equal(await page.evaluate(() => app.exposeToFormHandler.getCurrentBlockElem().backgroundColor.toLowerCase()), '#abcdef');
    await page.evaluate(() => app.undo());
    await page.waitForFunction(original => app.exposeToFormHandler.getCurrentBlockElem().backgroundColor === original, originalColor);
    assert.deepEqual(errors, []);
    console.log(`Passed: ${results.length} continuous block controls, padding drafts, paired inputs, rendered text, focus, undo, panel/post settings, and individual arrows (${url}).`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
