// Block clipboard: shift-click range selection and pasting after a refresh.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = process.argv[2] || "http://127.0.0.1:8765";
    const openBlocks = async () => {
      await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
      await page.evaluate(() => document.getElementById("closeWelcome")?.click());
      if (!(await page.locator('[data-tab="sMSPBlocks"]').isVisible())) {
        await page.locator("#subPanelConfig").click();
      }
      await page.locator('[data-tab="sMSPBlocks"]').click();
    };
    const blockTexts = () => page.evaluate(() => app.getPost().panels[0].sign.subPanels[0]
      .blockElements.rows.flat().map((block) => block.textContent ?? block.constructor.name));
    await page.goto(url);
    await openBlocks();
    await page.evaluate(() => {
      const post = app.getPost();
      const blockElements = post.panels[0].sign.subPanels[0].blockElements;
      blockElements.rows = [
        [new ControlTextElement({ textContent: "A" }), new ControlTextElement({ textContent: "B" })],
        [new ControlTextElement({ textContent: "C" })],
        [new ControlTextElement({ textContent: "D" })],
      ];
      blockElements.blockProperties = blockElements.rows.map(() => new Block());
      app.setPost(post);
      formHandler.updateForm();
    });
    await page.locator("#sMSPBlockSelectionMode").check();
    const boxes = page.locator(".blockSelectionCheckbox");
    assert.equal(await boxes.count(), 4);
    await boxes.nth(1).click();
    await boxes.nth(3).click({ modifiers: ["Shift"] });
    const checked = await boxes.evaluateAll((elements) => elements.map((element) => element.checked));
    assert.deepEqual(checked, [false, true, true, true], "shift-click selects B through D");

    await page.locator("#sMSPTextList, .sMSPBlockEditor, body").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press("Meta+c");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("signMaker.blockClipboard") || "null"));
    assert.equal(stored?.rows.flatMap((row) => row.blocks).length, 3, "the clipboard is stored");

    // A refresh starts a new sign, then pastes the stored blocks.
    await page.evaluate(() => localStorage.setItem("signMaker.restoreOnRefresh", "never"));
    await page.reload();
    await openBlocks();
    const before = (await blockTexts()).length;
    await page.keyboard.press("Meta+v");
    const after = await blockTexts();
    assert.equal(after.length, before + 3);
    assert.deepEqual(after.slice(-3), ["B", "C", "D"]);
    assert.deepEqual(errors, []);
    console.log("Block clipboard: shift-click range and paste after refresh passed.");
  } finally {
    await browser.close();
  }
})();
