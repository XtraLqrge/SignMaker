// Requires Playwright + WebKit and a running local server.
// NODE_PATH=/path/to/node_modules node scripts/test-live-editing.cjs http://127.0.0.1:8766
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
const { webkit } = require("playwright");

(async () => {
  const browser = await webkit.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8766");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    await page.locator("#subPanelConfig").click();
    await page.locator('[data-tab="sMSPBlocks"]').click();
    const text = page.locator("#sdCtrlText_textContent");
    await text.fill("Live Road");
    assert.equal(await page.locator("#panelContainer").textContent(), "Live Road");
    await text.press("ArrowLeft");
    await text.press("X");
    assert.equal(await page.locator("#panelContainer").textContent(), "Live RoaXd");
    assert.deepEqual(await text.evaluate(field => ({ active: document.activeElement === field, caret: field.selectionStart })),
      { active: true, caret: 9 });

    await choose(page, "#sdCtrlText_fontFamily", "Arial");
    assert((await page.locator(".bE-controlTextElement").evaluate(element => element.style.fontFamily)).includes("Arial"));
    // Font Size is a v2.19 slider with a number box; type into the box.
    const size = page.locator("#sdCtrlText_fontSizeVal");
    await size.fill("125");
    const renderedSize = () => page.locator(".bE-controlTextElement").evaluate(element => element.style.getPropertyValue("--fontSize"));
    assert.equal(await renderedSize(), "2.1875rem");
    await size.fill("");
    assert.equal(await renderedSize(), "2.1875rem");
    await size.press("1");
    assert.equal(await renderedSize(), "2.1875rem");
    await size.press("5");
    await size.press("0");
    assert.equal(await renderedSize(), "2.625rem");
    assert.equal(await size.evaluate(field => document.activeElement === field), true);

    // Dispatch input alone, as during a slider drag, without a change or blur event.
    await page.locator("#sdCtrlText_lineHeight").evaluate(field => {
      field.value = "75";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(await page.locator(".bE-controlTextElement").evaluate(element => element.style.getPropertyValue("--lineHeight")), "75");
    assert.equal(await page.locator("#sdCtrlText_lineHeightVal").inputValue(), "75");
    await page.locator("#sdCtrlText_lineHeightVal").fill("120");
    assert.equal(await page.locator("#sdCtrlText_lineHeight").inputValue(), "120");
    assert.equal(await page.locator(".bE-controlTextElement").evaluate(element => element.style.getPropertyValue("--lineHeight")), "120");

    await choose(page, "#sMSPElementSelect", { label: "Shield" });
    await page.locator("#sMSPCreateElement").click();
    await page.locator("#sdShield_routeNumber").fill("42");
    assert((await page.locator("#panelContainer .bE-shieldElement").textContent()).includes("42"));
    await page.locator("#sdShield_bannerCustomText").fill("Live Banner");
    assert((await page.locator("#panelContainer .bE-shieldElement").textContent()).includes("Live Banner"));
    assert.equal(await page.locator("#sdShield_bannerCustomText").evaluate(field => document.activeElement === field), true);

    await page.locator("#panelStyleConfig").click();
    await page.locator("#panelBorderRadius").fill("1.50");
    assert.equal(await page.evaluate(() => app.getPost().panels[0].borderRadius), 1.5);
    assert.equal(await page.locator("#panelBorderRadius").inputValue(), "1.50");
    assert.equal(await page.locator("#panelBorderRadius").evaluate(field => document.activeElement === field), true);
    await page.locator("#exitTabConfig").click();
    await page.locator("#exitNumber").fill("12A");
    assert.equal(await page.evaluate(() => app.getPost().panels[0].exitTabs[0].number), "12A");
    await page.locator("#panelSpacing").evaluate(field => {
      field.value = "1.25";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(await page.evaluate(() => app.getPost().panelSpacing), 1.25);

    await page.reload();
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    assert((await page.locator("#panelContainer").textContent()).includes("Live RoaXd"));
    assert.equal(await page.evaluate(() => app.getPost().panels[0].borderRadius), 1.5);
    assert.equal(await page.evaluate(() => app.getPost().panels[0].exitTabs[0].number), "12A");
    assert.deepEqual(errors, []);
    console.log("Live text, caret, dropdown, numeric draft, slider, paired value, shield, panel, exit tab, spacing, and persistence checks passed.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
