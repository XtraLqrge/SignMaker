// Icon picker: v2.19's picker with uploads, favorites and rename; the other
// image pickers use v2.19's asset selector dialog.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
const path = require("node:path");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = process.argv[2] || "http://127.0.0.1:8765";
    const setRows = (kind) => page.evaluate((kind) => {
      const post = app.getPost();
      const blockElements = post.panels[0].sign.subPanels[0].blockElements;
      blockElements.rows = [[new (eval(kind))({})]];
      blockElements.blockProperties = [new Block()];
      app.setPost(post);
      formHandler.updateForm();
    }, kind);
    const icon = () => page.evaluate(() => app.getPost().panels[0].sign.subPanels[0].blockElements.rows[0][0].icon);
    await page.goto(url);
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    await page.locator("#subPanelConfig").click();
    await page.locator('[data-tab="sMSPBlocks"]').click();
    await setRows("IconElement");

    // Built-in page: search and pick an icon.
    await page.locator("#sdIcon_chooseBtn").click();
    const modal = page.locator("#iconSelectorModal");
    await modal.locator("#iconPickerBuiltInTab").click();
    await modal.locator("#iconSearch").fill("baseball");
    await modal.locator('.iconPickerCard[data-asset-key="BASEBALL"] .iconPickerChooseButton').click();
    assert.equal(await modal.evaluate((dialog) => dialog.open), false);
    assert.equal(await icon(), "BASEBALL");
    assert.equal(await page.locator("#sdIcon_selectedLabel").textContent(), "Current: Baseball");

    // Favorites go into their own section and persist.
    await page.locator("#sdIcon_chooseBtn").click();
    await modal.locator("#iconSearch").fill("beach");
    await modal.locator('.iconPickerCard[data-asset-key="BEACH"]').hover();
    await modal.locator('.iconPickerCard[data-asset-key="BEACH"] .iconPickerFavoriteButton').click();
    await modal.locator("#iconSearch").fill("");
    await modal.locator("#iconSearch").dispatchEvent("input");
    assert.equal(await modal.locator('.iconPickerSection[data-favorites="true"] [data-asset-key="BEACH"]').count(), 1);

    // Upload an icon; it's selectable, renders, and survives a reload.
    const svg = path.join(__dirname, "..", "public", "img", "icons", "BEACH.svg");
    await modal.locator("#uploadCustomIconFile").setInputFiles({
      name: "My_Icon.svg", mimeType: "image/svg+xml", buffer: require("node:fs").readFileSync(svg),
    });
    const uploaded = modal.locator('.customIconGridCard');
    await uploaded.first().waitFor();
    assert.equal(await modal.locator("#iconPickerUploadedTab").getAttribute("aria-selected"), "true");
    assert.equal(await uploaded.locator(".iconPickerLabelText").textContent(), "My Icon");
    const key = await uploaded.getAttribute("data-asset-key");
    assert.match(key, /^CUSTOMICON-/);
    await uploaded.locator(".iconPickerChooseButton").click();
    assert.equal(await icon(), key);
    await page.waitForFunction(() => document.querySelector("#panelContainer .bE-iconElement img")?.src.startsWith("data:image/svg+xml"));

    // Rename stays with the picker preferences.
    await page.locator("#sdIcon_chooseBtn").click();
    await uploaded.hover();
    await uploaded.locator(".assetGridLabel").hover();
    await uploaded.locator(".iconPickerRenameButton").click();
    await uploaded.locator(".iconPickerRenameInput").fill("Renamed");
    await uploaded.locator(".iconPickerRenameInput").press("Enter");
    assert.equal(await uploaded.locator(".iconPickerLabelText").textContent(), "Renamed");
    await modal.locator("#closeIconSelector").click();
    assert.equal(await page.locator("#sdIcon_selectedLabel").textContent(), "Current: Renamed");

    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction((key) => typeof app !== "undefined" && IconElement.prototype.icons[key], key);
    assert.equal(await icon(), key, "the uploaded icon is restored");
    await page.waitForFunction(() => document.querySelector("#panelContainer .bE-iconElement img")?.src.startsWith("data:image/svg+xml"));

    // Deleting the uploaded icon puts the sign back on the default icon.
    await page.evaluate(() => document.getElementById("closeWelcome")?.click());
    if (!(await page.locator('[data-tab="sMSPBlocks"]').isVisible())) await page.locator("#subPanelConfig").click();
    await page.locator('[data-tab="sMSPBlocks"]').click();
    await page.locator("#sdIcon_chooseBtn").click();
    await uploaded.hover();
    await uploaded.locator(".customIconDeleteButton").click();
    assert.equal(await uploaded.count(), 0);
    assert.equal(await icon(), await page.evaluate(() => IconElement.prototype.defaultIcon));
    await modal.locator("#closeIconSelector").click();

    // Toll logo and arrow pickers use the asset selector cards.
    await setRows("TollLogoElement");
    await page.locator("#sdTollLogo_chooseBtn").click();
    const toll = page.locator("#tollLogoSelectorModal");
    const first = toll.locator(".assetGridCard").nth(1);
    const tollKey = await first.getAttribute("data-asset-key");
    await first.click();
    assert.equal(await page.evaluate(() => app.getPost().panels[0].sign.subPanels[0].blockElements.rows[0][0].logo), tollKey);
    await setRows("ArrowElement");
    await page.locator("#sdArrow_chooseBtn").click();
    await page.locator("#arrowSearch").fill("zzzz");
    assert.equal(await page.locator("#arrowGrid .assetGridEmpty").count(), 1);
    await page.locator("#closeArrowSelector").click();
    assert.equal(await page.locator("#arrowSelectorModal").evaluate((dialog) => dialog.open), false);

    // Exit tabs: the Icon variant uses the icon picker, Toll Logo the logo dialog.
    await page.locator("#exitTabConfig").click();
    await choose(page, "#exitVariant", "Icon");
    assert.equal(await page.locator("#exitIconChooseButton").isVisible(), true);
    assert.equal(await page.locator("#exitTollLogoChooseButton").isVisible(), false);
    assert.equal(await page.locator("#exitIconCurrent").textContent(), "Airport");
    await page.locator("#exitIconChooseButton").click();
    await modal.locator("#iconPickerBuiltInTab").click();
    await modal.locator("#iconSearch").fill("camping");
    await modal.locator('.iconPickerCard[data-asset-key="CAMPING"] .iconPickerChooseButton').click();
    const exitTab = () => page.evaluate(() => app.getPost().panels[0].exitTabs[0]);
    assert.equal((await exitTab()).icon, "CAMPING");
    assert.equal(await page.locator("#exitIconCurrent").textContent(), "Camping");
    await page.waitForFunction(() => document.querySelector("#panelContainer .exitTab.iconExitTab .exitTabIconImage")?.src.includes("CAMPING"));
    await choose(page, "#exitVariant", "Toll Logo");
    await page.locator("#exitTollLogoChooseButton").click();
    const logoCard = toll.locator(".assetGridCard").nth(2);
    const logoKey = await logoCard.getAttribute("data-asset-key");
    await logoCard.click();
    assert.equal((await exitTab()).icon, logoKey);
    assert.equal(await page.locator("#panelContainer .exitTab .tollLogoImage").count(), 1);

    assert.deepEqual(errors, []);
    console.log("Icon picker: built-in pick, favorites, upload, rename, reload, delete, asset selectors and exit tab icons passed.");
  } finally {
    await browser.close();
  }
})();
