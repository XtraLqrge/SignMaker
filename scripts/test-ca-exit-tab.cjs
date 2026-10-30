// Uses the existing browser test setup and a running local server.
// NODE_PATH=/path/to/node_modules node scripts/test-ca-exit-tab.cjs http://127.0.0.1:8769
const assert = require('node:assert/strict');
const { webkit } = require('playwright');
(async () => {
  const browser = await webkit.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8769');
    await page.waitForFunction(() => typeof app !== 'undefined' && app.getPost()?.panels.length);
    await page.locator('#closeWelcome').click();
    for (const width of ['Narrow', 'Wide', 'Full', 'Edge'])
    for (const position of ['Left', 'Center', 'Right']) {
      const label = `${width}/${position}`;
      const r = await page.evaluate(async ([width, position]) => {
        const post = app.getPost();
        const panel = post.panels[0];
        if (!panel.exitTabs.length) panel.newExitTab();
        // Non-default settings must survive CA style, except the corner
        // radius, which always follows the sign.
        Object.assign(panel.exitTabs[0], { number: '87', caStyle: true, variant: 'Default',
          position, width, squareCorners: true, borderThickness: 0.3, minHeight: 3, fontSize: 24 });
        app.setPost(post);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const sign = document.querySelector('#panel0 .sign');
        const tab = document.querySelector('#panel0 .exitTab');
        const s = getComputedStyle(sign), t = getComputedStyle(tab);
        const sr = sign.getBoundingClientRect(), tr = tab.getBoundingClientRect();
        const px = v => parseFloat(v);
        return {
          inSign: sign.contains(tab),
          signRadii: [s.borderTopLeftRadius, s.borderTopRightRadius],
          signRadius: px(getComputedStyle(sign).getPropertyValue('--signBorderRadius')) * px(getComputedStyle(document.documentElement).fontSize),
          tabRadii: [t.borderTopLeftRadius, t.borderTopRightRadius, t.borderBottomRightRadius, t.borderBottomLeftRadius].map(px),
          borders: [t.borderTopWidth, t.borderRightWidth, t.borderBottomWidth, t.borderLeftWidth].map(px),
          // The tab overlaps the sign's border, so compare outer edges.
          top: tr.top - sr.top,
          left: tr.left - sr.left,
          right: sr.right - tr.right,
          minHeight: px(t.minHeight), fontSize: px(t.fontSize),
          remPx: px(getComputedStyle(document.documentElement).fontSize),
        };
      }, [width, position]);
      const flushLeft = width === 'Full' || position === 'Left';
      const flushRight = width === 'Full' || position === 'Right';
      const thickness = 0.3 * r.remPx;
      assert(r.inSign, `${label}: tab must be inside the sign`);
      assert.equal(r.signRadii[0], r.signRadii[1], `${label}: sign corners must stay rounded`);
      assert(Math.abs(px(r.signRadii[0]) - r.signRadius) < 0.5, `${label}: sign radius changed`);
      assert(Math.abs(r.top) < 0.5, `${label}: tab must share the sign's top edge`);
      if (flushLeft) assert(Math.abs(r.left) < 0.5, `${label}: tab must share the left edge`);
      if (flushRight) assert(Math.abs(r.right) < 0.5, `${label}: tab must share the right edge`);
      assert.deepEqual(r.borders, [thickness, thickness, thickness, thickness], `${label}: borders`);
      for (const radius of r.tabRadii) assert(Math.abs(radius - r.signRadius) < 0.5, `${label}: corner radii ${r.tabRadii}`);
      assert.equal(r.minHeight, 3 * r.remPx, `${label}: min height setting`);
      assert(r.fontSize > 0, `${label}: font size setting`);
    }
    // Turning CA style on must not move the tab or the legend.
    for (const width of ['Narrow', 'Full']) {
      const positions = [];
      for (const caStyle of [false, true]) {
        positions.push(await page.evaluate(async ([width, caStyle]) => {
          const post = app.getPost();
          Object.assign(post.panels[0].exitTabs[0], { caStyle, width, position: 'Right' });
          app.setPost(post);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const top = selector => document.querySelector(`#panel0 ${selector}`).getBoundingClientRect().top;
          return { tab: top('.exitTab'), legend: top('.bE-textElement') };
        }, [width, caStyle]));
      }
      for (const part of ['tab', 'legend']) {
        assert(Math.abs(positions[0][part] - positions[1][part]) < 0.5,
          `${width}: CA style moved the ${part} from ${positions[0][part]} to ${positions[1][part]}`);
      }
    }
    assert.deepEqual(errors, []);
    console.log('CA exit tabs passed: flush corners, sign-matched radii, preserved settings for 4 widths x 3 positions, and unchanged tab/legend position.');
  } finally { await browser.close(); }
})();

function px(v) { return parseFloat(v); }
