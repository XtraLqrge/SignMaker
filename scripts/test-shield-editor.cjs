// Shield editor: picker tree, typed banners, plaques, road name and legacy saves.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    await page.locator("#subPanelConfig").click();
    await page.locator('[data-tab="sMSPBlocks"]').click();
    await choose(page, "#sMSPElementSelect", { label: "Shield" });
    await page.locator("#sMSPCreateElement").click();
    const shieldBlock = () => page.evaluate(() => app.getPost().panels[0].sign.subPanels[0]
      .blockElements.rows.flat().find((element) => element instanceof ShieldElement));

    // Picker tree: open Texas and choose Texas FM.
    await page.locator(".shieldPicker:not(.arrowPicker) .shieldPickerTrigger").click();
    await page.locator('.shieldPickerItem[data-node-id="us-texas"]').click();
    await page.locator('.shieldPickerItem[data-node-value="TXFM"]').click();
    assert.equal((await shieldBlock()).shieldBase, "TXFM");
    assert.match(await page.locator(".shieldPicker:not(.arrowPicker) .shieldPickerTriggerLabel").textContent(), /\bFM\b/);
    const variants = await page.locator("#sdShield_shieldType option").allTextContents();
    assert.deepEqual(variants, ["Auto", "2 Digit", "3 Digit", "4 Digit", "5 Digit"]);

    // Typed banners, a TOLL plaque and a road name.
    await page.locator("#sdShield_routeNumber").fill("12345");
    await page.locator("#sdShield_bannerCustomText").fill("North");
    await page.locator("#sdShield_bannerCustomText2").fill("TOLL");
    await page.locator("#sdShield_roadName").fill("Ranch Rd");
    const rendered = page.locator("#panelContainer .bE-shieldElement");
    const text = await rendered.textContent();
    for (const part of ["12345", "North", "TOLL", "Ranch Rd"]) assert(text.includes(part), part);
    assert.equal(await rendered.locator(".specialShieldPlaque").count(), 1);
    assert(await rendered.locator("img.shieldImg").evaluate((img) => img.src.includes("TXFM-5Digit")));

    // Banner size and background color controls.
    await page.locator("#sdShield_bannerFontSize1Display").fill("20");
    assert.equal((await shieldBlock()).bannerFontSize1, 2);
    await page.locator("#sdShield_bannerBackgroundColor1-button").click();
    await page.locator(".symbolPickerMenu.open .symbolPickerItem", { hasText: "White" }).first().click();
    await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
    assert.equal((await shieldBlock()).bannerBackgroundColor1, "White");

    // Saves from v2.2 ("None", TOLL checkbox) and v2.19 (FLCFX) still load.
    const legacy = await page.evaluate(() => {
      const fromV22 = new ShieldElement({
        shieldBase: "I", bannerType: "None", bannerType2: "None",
        showTollBanner: true, tollBannerPosition: "Below",
      });
      const fromV219 = new ShieldElement({ shieldBase: "FLCFX", shieldType: "CFX Guide", routeNumber: "408" });
      const config = ShieldElement.prototype.getBlockShieldConfig(fromV219.shieldBase);
      return {
        banner: fromV22.bannerType, position: fromV22.bannerPosition, banner2: fromV22.bannerType2,
        cfx: config.value,
        cfxVariant: ShieldElement.prototype.migrateLegacyBlockVariant(fromV219.shieldType, "408", config),
      };
    });
    assert.deepEqual(legacy, {
      banner: "TOLL", position: "Below", banner2: "",
      cfx: "FLCFXToll", cfxVariant: "TM 36x48 CFX Jurisdiction",
    });
    assert.deepEqual(errors, []);
    console.log("Shield editor: picker tree, variants, typed banners, plaques, road name, banner styling and legacy saves passed.");
  } finally {
    await browser.close();
  }
})();
