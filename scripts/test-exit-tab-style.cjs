// Exit tab style options from v2.19 (font, spacing, colors, radius, padding,
// EXIT size, bilingual, transparent) and migration of v2.2's checkboxes.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
// Color dropdowns use the SignalMaker picker over a hidden select.
const pickColor = async (page, id, text) => {
  await page.locator(`#${id}-button`).click();
  await page.locator(".symbolPickerMenu.open .symbolPickerItem")
    .filter({ has: page.locator(".symbolPickerLabel", { hasText: new RegExp(`^${text}$`) }) })
    .click();
  // The picker applies the change after the next paint.
  await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
};
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.evaluate(() => localStorage.clear());
    await page.locator("#closeWelcome").click();

    // v2.2 saves: Match Sign Radius, Extend Padding and FHWA load as the new fields.
    const legacy = await page.evaluate(() => {
      const matched = new ExitTab({ matchSignCornerRadius: true, extendHorizontalPadding: true, FHWAFont: true });
      const plain = new ExitTab({ matchSignCornerRadius: false, extendHorizontalPadding: false, FHWAFont: false });
      const oldSquare = new ExitTab({ squareCorners: true });
      const v219 = new ExitTab({ cornerRadius: 1.2, horizontalPadding: 0.4, fontFamily: "Series D",
        exitTextSizePercent: 100, exitTextSizePercentVersion: 2 });
      const pick = (t) => [t.cornerRadius, t.horizontalPadding, t.fontFamily, t.FHWAFont, t.exitTextSizePercent];
      return { matched: pick(matched), plain: pick(plain), oldSquare: oldSquare.horizontalPadding, v219: pick(v219) };
    });
    assert.deepEqual(legacy.matched, ["panel", 0.8, "Series E", true, 67]);
    assert.deepEqual(legacy.plain, [0.5, 0, "Clearview 4", false, 67]);
    assert.equal(legacy.oldSquare, 0.8);
    assert.deepEqual(legacy.v219, [1.2, 0.4, "Series D", true, 67]);

    await page.locator("#exitTabConfig").click();
    await page.locator("#exitNumber").fill("EXIT 12A");
    const tab = page.locator("#panelContainer .exitTab").first();
    // Defaults keep v2.2's look: no custom classes or padding.
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert.equal(await tab.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft)), 0.5 * rem);
    assert.equal(await tab.evaluate((el) => el.classList.contains("customExitTextSize")), false);

    await choose(page, "#exitTabFontFamily", "Series D");
    await pickColor(page, "exitTabTextColor", "Yellow");
    await page.locator("#exitTabCharacterSpacing").fill("0.1");
    await page.locator("#exitTabCharacterSpacing").dispatchEvent("change");
    await page.locator("#exitTabHorizontalPadding").fill("1");
    await page.locator("#exitTabTextSizePercent").fill("80");
    const state = await page.evaluate(() => {
      const t = app.getPost().panels[0].exitTabs[0];
      return [t.fontFamily, t.FHWAFont, t.textColor, t.characterSpacing, t.horizontalPadding, t.exitTextSizePercent];
    });
    assert.deepEqual(state, ["Series D", true, "Yellow", 0.1, 1, 80]);
    const rendered = await tab.evaluate((el) => ({
      font: el.style.fontFamily,
      padding: parseFloat(getComputedStyle(el).paddingLeft),
      classes: ["customExitTabTextColor", "customExitTabSpacing", "customExitTextSize"].every((c) => el.classList.contains(c)),
    }));
    assert.match(rendered.font, /Series D/);
    assert.equal(rendered.padding, 1.5 * rem);
    assert.equal(rendered.classes, true);

    // Corner radius: the slider applies once "use sign radius" is off; Square Corners locks it.
    await page.locator("#fullBorder").check();
    await page.locator("#exitTabUsePanelCornerRadius").uncheck();
    await page.locator("#exitTabCornerRadius").fill("1.5");
    assert.equal(await tab.evaluate((el) => el.style.borderRadius), "1.5rem");
    await page.locator("#exitTabUsePanelCornerRadius").check();
    assert.equal(await page.evaluate(() => app.getPost().panels[0].exitTabs[0].cornerRadius), "panel");
    await page.locator("#squareCorners").check();
    assert.equal(await page.locator("#exitTabCornerRadius").isDisabled(), true);

    // Bilingual tabs stack EXIT over the bottom text beside the number.
    await page.locator("#exitTabBilingual").check();
    await page.locator("#exitTabBilingualBottomText").fill("Sortie");
    assert.deepEqual(
      await tab.locator(".exitTabBilingualLabelText").allTextContents(), ["EXIT", "SORTIE"]);
    assert.equal(await tab.locator(".exitTabBilingualNumber").textContent(), "12A");

    // Transparent only shows for toll logo and icon tabs.
    assert.equal(await page.locator("#exitTabTransparent").isVisible(), false);
    await choose(page, "#exitVariant", "Toll Logo");
    await page.locator("#exitTabTransparent").check();
    assert.equal(await page.locator("#panelContainer .exitTab.transparentAsset").count(), 1);

    assert.deepEqual(errors, []);
    console.log("Exit tab style: v2.19 options, rendering, bilingual, transparent and v2.2 migration passed.");
  } finally {
    await browser.close();
  }
})();
