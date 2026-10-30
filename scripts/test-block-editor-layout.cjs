// Block element editors use v2.19's layout, with its controls working:
// letter spacing, small letters, message spacing, icon padding/alignment,
// arrow alignment, and v2.2's justification kept.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.evaluate(() => { localStorage.clear(); document.getElementById("closeWelcome")?.click(); });
    await page.locator("#subPanelConfig").click();
    const setBlock = (kind, options = {}) => page.evaluate(([kind, options]) => {
      const post = app.getPost();
      const blockElements = post.panels[0].sign.subPanels[0].blockElements;
      blockElements.rows = [[new (eval(kind))(options)]];
      blockElements.blockProperties = [new Block()];
      app.setPost(post);
      formHandler.updateForm();
    }, [kind, options]);
    const block = () => page.evaluate(() => app.getPost().panels[0].sign.subPanels[0].blockElements.rows[0][0]);
    const setRange = (id, value) => page.locator(`#${id}`).evaluate((field, value) => {
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);

    // Control Text: v2.19 rows, letter spacing and sized small letters.
    await setBlock("ControlTextElement", { textContent: "Main Street" });
    for (const selector of [".sdCtrlTextTopRow", ".sdCtrlTextSpacingSliderRow", "#sdCtrlText_justification-button"]) {
      assert.equal(await page.locator(`[data-property="sdCtrlText"] ${selector}`).isVisible(), true, selector);
    }
    await setRange("sdCtrlText_letterSpacing", "0.2");
    assert.equal(Number((await block()).letterSpacing), 0.2);
    assert.equal(await page.locator("#panelContainer .bE-controlTextElement").evaluate((element) => element.style.letterSpacing), "var(--betweenLetterSpacing)");
    await page.locator("#sdCtrlText_smallCapitals").check();
    await page.locator("#sdCtrlText_smallLettersSize").fill("60");
    await page.locator("#sdCtrlText_smallLettersSize").dispatchEvent("change");
    const letters = await page.locator("#panelContainer .bE-controlTextElement .bE-smallLetters").allTextContents();
    assert.deepEqual(letters, ["ain", "treet"]);
    assert.equal(await page.locator("#panelContainer .bE-controlTextElement").evaluate((element) => element.style.getPropertyValue("--smallLettersSize")), "60");
    await choose(page, "#sdCtrlText_justification", "Left");
    assert.equal((await block()).justification, "Left");

    // Advisory and Action Message: spacing and small letters, as in v2.19.
    for (const [kind, prefix] of [["AdvisoryMessageElement", "sdAdvisory"], ["ActionMessageElement", "sdActionMessage"]]) {
      await setBlock(kind);
      await page.locator(`#${prefix}_spacing`).fill("1.5");
      await page.locator(`#${prefix}_spacing`).dispatchEvent("change");
      assert.equal(Number((await block()).spacing), 1.5, kind);
      assert.equal(await page.locator("#panelContainer .bE-textElement").first().evaluate((element) => element.style.getPropertyValue("--spacing")), "1.5rem");
      await page.locator(`#${prefix}_smallCapitals`).check();
      assert.equal((await block()).smallCapitals, true, kind);
    }

    // Icon: size slider, padding and alignment buttons, preview.
    await setBlock("IconElement");
    await setRange("sdIcon_iconSizeSlider", "5");
    assert.equal(Number((await block()).iconSize), 5);
    assert.equal(await page.locator("#sdIcon_iconSize").inputValue(), "5");
    await setRange("sdIcon_paddingHorizontal", "1");
    assert.equal(Number((await block()).paddingHorizontal), 1);
    assert.equal(await page.locator("#panelContainer .bE-iconElement").evaluate((element) => element.style.paddingLeft), "1rem");
    await page.locator("#sdIcon_paddingHorizontalReset").click();
    assert.equal(Number((await block()).paddingHorizontal), 0);
    await page.locator('[data-sd-icon-align="Left"]').click();
    assert.equal((await block()).alignment, "Left");
    assert.equal(await page.locator('[data-sd-icon-align="Left"]').getAttribute("aria-pressed"), "true");
    assert.match(await page.locator("#sdIcon_previewImage").getAttribute("src"), /AIRPORT/);
    assert.equal(await page.locator("#sdIcon_alignment + .symbolPicker").count(), 0, "no second alignment control");

    // Arrow: alignment defaults to following the previous block.
    await setBlock("ArrowElement");
    assert.equal((await block()).alignment, "Auto");
    await choose(page, "#sdArrow_alignment", "Right");
    assert.equal((await block()).alignment, "Right");
    assert.equal(await page.locator("#panelContainer .blockElementRight .bE-arrowElement, #panelContainer .blockElementRight img").count() > 0, true);

    // Shield keeps v2.2's official size and small caps switches.
    await setBlock("ShieldElement");
    for (const id of ["sdShield_useOfficialDimensions", "sdShield_disableSmallCaps", "sdShield_disableSmallCaps2"]) {
      assert.equal(await page.locator(`#${id}`).isVisible(), true, id);
    }
    assert.equal(await page.locator(".sdShieldCountyRow").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log("Block editor layout: v2.19 rows, letter spacing, small letters, message spacing, icon controls, arrow alignment and shield options passed.");
  } finally {
    await browser.close();
  }
})();
