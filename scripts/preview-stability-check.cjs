/* Frame-by-frame preview audit. Run after building; see test:live for setup. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await webkit.launch(process.env.WEBKIT_EXECUTABLE ? { executablePath: process.env.WEBKIT_EXECUTABLE } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.clear());
    await page.goto(process.env.TEST_URL || pathToFileURL(path.resolve('public/index.html')).href);
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await page.evaluate(async () => {
      document.getElementById('closeWelcome')?.click();
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 700));
    });
    await page.exposeFunction('auditProgress', mode => console.log('Completed preview layout:', mode));
    const results = await page.evaluate(async modes => {
      const bridge = app.exposeToFormHandler;
      const scopes = { ControlTextElement: 'sdCtrlText', DividerElement: 'sdBlocker', ShieldElement: 'sdShield', AdvisoryMessageElement: 'sdAdvisory', IconElement: 'sdIcon', BeaconElement: 'sdBeacon', ArrowElement: 'sdArrow', TollLogoElement: 'sdTollLogo', ActionMessageElement: 'sdActionMessage', ElectronicSignElement: 'sdElectronicSign', GroupedBlockElement: 'sdGroupedBlock' };
      const frame = () => new Promise(requestAnimationFrame);
      const snapshot = () => [...document.querySelectorAll('#panelContainer .sign,#panelContainer .signContainer,#panelContainer .blockElementRow,#panelContainer img,#panelContainer .standardGuideArrowFrame,#panelContainer .modernExitArrowFrame')].map(node => {
        const rect = node.getBoundingClientRect();
        return { class: node.className, rect: [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 64) / 64), background: node.style.backgroundImage, complete: node.complete };
      });
      const settle = async () => {
        await document.fonts.ready;
        let previous = '', equal = 0;
        for (let i = 0; i < 40; i++) {
          await frame(); const next = JSON.stringify(snapshot());
          equal = next === previous ? equal + 1 : 0; previous = next;
          if (equal >= 6) return;
        }
      };
      const results = [];
      const check = async (field, mode, value) => {
        await settle();
        let redraws = 0;
        const observer = new MutationObserver(records => { for (const record of records) redraws += record.addedNodes.length; });
        observer.observe(document.getElementById('panelContainer'), { childList: true });
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        const frames = []; const fontStates = [];
        for (let i = 0; i < 7; i++) { await frame(); frames.push(snapshot()); fontStates.push(document.fonts.status); }
        observer.disconnect();
        const stable = frames.every(value => JSON.stringify(value) === JSON.stringify(frames[0]));
        results.push({ mode, id: field.id || field.className, stable, redraws, ...(stable ? {} : { frames, fontStates, markup: document.querySelector("#panel0").outerHTML }) });
        field.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const nextValue = field => {
        if (!['range', 'number'].includes(field.type)) return field.value + '7';
        const step = Number(field.step) || 1;
        let value = (Number(field.value) || 0) + step;
        if (field.max && value > Number(field.max)) value = Number(field.value) - step;
        return String(Number(value.toFixed(4)));
      };
      for (const mode of modes) {
        const panel = bridge.getCurrentPanel();
        panel.corner = 'Round';
        const sign = panel.sign;
        const row = bridge.getCurrentSubPanel().blockElements.blockProperties[0];
        row.backgroundColor = 'Purple';
        row.borderColor = 'White';
        row.backgroundFullWidth = true;
        sign.arrowMode = mode === 'apl' ? 'apl' : 'standard';
        sign.guideArrow = mode === 'standard' ? 'Standard Arrow' : mode === 'exit' ? 'Exit Only' : 'None';
        sign.guideArrowLanes = 2;
        sign.standardArrowType = sign.exitArrowType = 'DOWN';
        sign.exitOnlyEditorVersion = 1;
        if (mode === 'apl') bridge.initializeAPLArrowsForCurrentPanel();
        for (const [type, scope] of Object.entries(scopes)) {
          bridge.replaceControlElemTypeAt(0, 0, type);
          formHandler.updateForm(); bridge.redraw();
          await settle();
          const fields = [...document.querySelectorAll(`[data-property="${scope}"] input,[data-property="${scope}"] textarea`)]
            .filter(field => ['range', 'number', 'text', 'textarea'].includes(field.type) && !field.disabled && field.id && !/(_icon$|_arrow$)/.test(field.id));
          for (const field of fields) {
            formHandler.updateForm();
            await check(field, mode, nextValue(field));
          }
        }
        bridge.replaceControlElemTypeAt(0, 0, 'ControlTextElement');
        for (const id of ['sdBlock_topPadding', 'sdBlock_bottomPadding', 'sdBlock_topPaddingVal', 'sdBlock_bottomPaddingVal', 'sdBlock_width', 'panelBorderRadius', 'panelBorderThickness', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'postThickness', 'settingsPanelSpacingValue', 'exitNumber', 'borderThickness', 'fontSize', 'minHeight']) {
          formHandler.updateForm(); const field = document.getElementById(id);
          await check(field, mode, nextValue(field));
        }
        const arrowFields = mode === 'standard'
          ? ['standardArrowAngle', 'standardArrowAngleValue', 'standardArrowSize', 'standardArrowSizeValue', 'standardArrowPadding', 'standardArrowSpacing']
          : mode === 'exit' ? ['exitArrowAngle', 'exitArrowSize', 'exitArrowPadding', 'exitArrowSpacing', 'exitTextLeft', 'exitTextRight', 'exitTextSize', 'exitTextSpacing'] : [];
        for (const id of arrowFields) {
          formHandler.updateForm(); const field = document.getElementById(id);
          await check(field, mode, nextValue(field));
        }
        // Repeated slider steps must not oscillate the row's left/right padding.
        for (const id of ['sdBlock_topPadding', 'sdBlock_bottomPadding']) {
          for (const value of ['0.1', '0.2', '0.3', '0.2', '0']) await check(document.getElementById(id), mode, value);
        }
        await window.auditProgress(mode);
      }
      return results;
    }, process.env.PREVIEW_MODES?.split(',') || ['none', 'standard', 'exit', 'apl']);
    await page.locator('#subPanelConfig').click();
    await page.waitForTimeout(700); // Let the menu animation finish before measuring drawing.
    await page.evaluate(() => {
      window.nativePreviewRedraws = 0;
      window.nativePreviewObserver = new MutationObserver(records => {
        for (const record of records) window.nativePreviewRedraws += record.addedNodes.length;
      });
      window.nativePreviewObserver.observe(document.getElementById('panelContainer'), { childList: true });
    });
    await page.locator('#sdBlock_topPaddingVal').fill('0.7');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => { nativePreviewObserver.disconnect(); return nativePreviewRedraws; }), 1, 'Native input draws once, after all handlers');
    const failures = results.filter(result => !result.stable || result.redraws > 1);
    if (failures.length) fs.writeFileSync(process.env.PREVIEW_AUDIT_OUTPUT || '/tmp/signmaker-preview-failures.json', JSON.stringify(failures, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(failures.map(({ mode, id, stable, redraws }) => ({ mode, id, stable, redraws })), []);
    console.log(`Passed ${results.length} preview checks across plain, standard-arrow, exit-only and APL layouts: stable geometry/artwork/borders and at most one redraw per input.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
