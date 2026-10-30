// v2.19 stacked and hidden panels, replacing v2.2's Vertical panels option.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    const stacking = () => page.evaluate(() => app.getPost().panels.map((panel) =>
      `${panel.stackedWithPrevious ? panel.stackedPanelPlacement : "main"}${panel.hiddenFromPost ? "-hidden" : ""}`));
    const label = () => page.locator("#currentlySelectedPanel").textContent();

    // Add panels below and above panel 1, then a second main panel.
    await page.locator("#subPanelConfig").click();
    await page.locator("#stackedPanelList button", { hasText: "Add Panel Below" }).click();
    await page.locator("#stackedPanelList button", { hasText: "Main Panel" }).click();
    await page.locator("#stackedPanelList button", { hasText: "Add Panel Above" }).click();
    assert.equal(await label(), "Panel 1A");
    await page.evaluate(() => app.newPanel());
    assert.deepEqual(await stacking(), ["main", "below", "above", "main"]);

    // Drawn as one stack, above panel first, beside panel 2.
    const drawn = await page.evaluate(() => [...document.querySelectorAll("#panelContainer > *")].map((el) =>
      el.classList.contains("panelStack")
        ? [...el.children].map((panel) => panel.dataset.panelIndex).join(",")
        : el.dataset.panelIndex));
    assert.deepEqual(drawn, ["2,0,1", "3"]);
    assert.deepEqual(await page.locator("#panelList .panelListLabel").allTextContents(),
      ["Panel 1", "Panel 1A", "Panel 1B", "Panel 2"]);

    // Stack spacing and match width live on the main panel.
    await page.evaluate(() => app.changeEditingPanel(0));
    await page.locator("#stackedPanelSpacing").fill("1.5");
    await page.locator("#stackedPanelSpacing").dispatchEvent("change");
    await page.locator("#stackedPanelMatchWidth").check();
    const stack = await page.evaluate(() => {
      const el = document.querySelector(".panelStack");
      return [app.getPost().panels[0].stackedPanelSpacing, el.classList.contains("stackedPanelMatchWidth"),
        el.style.getPropertyValue("--stackedPanelSpacing")];
    });
    assert.deepEqual(stack, [1.5, true, "1.5rem"]);

    // Export choices are main panels; a stack exports as one image.
    await page.evaluate(() => app.newPanel());
    await page.evaluate(() => app.togglePanelHidden(4));
    await page.evaluate(() => app.changeEditingPanel(0));
    assert.equal(await page.locator('#panelContainer .panel[data-panel-index="4"]').count(), 0);
    await page.locator("#exportDownload").click({ button: "right" });
    await page.locator("button", { hasText: "Export..." }).click();
    await page.locator("#entirePost").uncheck();
    assert.deepEqual(await page.locator("#downloadPanelButtons button").allTextContents(), ["1", "2"]);
    await page.locator("#cancelDownload").click();
    await page.locator("#panelSelector").click({ force: true });
    await page.locator("#panelListShowHiddenPanels").uncheck();
    assert.deepEqual(await page.locator("#panelList .panelListLabel").allTextContents(),
      ["Panel 1", "Panel 1A", "Panel 1B", "Panel 2"]);
    await page.locator("#panelListShowHiddenPanels").check();

    // Moving a main panel moves its stack; duplicating gives a standalone panel after the stack.
    await page.evaluate(() => app.movePanel(0, 4));
    assert.deepEqual(await stacking(), ["main", "main", "below", "above", "main-hidden"]);
    await page.evaluate(() => app.duplicatePanel(2));
    assert.deepEqual(await stacking(), ["main", "main", "below", "above", "main", "main-hidden"]);

    // Deleting a main panel deletes its stack; deleting an added panel removes only it.
    await page.evaluate(() => app.deletePanel(3));
    assert.deepEqual(await stacking(), ["main", "main", "below", "main", "main-hidden"]);
    await page.evaluate(() => app.deletePanel(1));
    assert.deepEqual(await stacking(), ["main", "main", "main-hidden"]);

    // v2.2 saves with Vertical panels load as one stack.
    const migrated = await page.evaluate(() => {
      const post = app.getPost();
      post.panels.forEach((panel) => { panel.hiddenFromPost = false; });
      post.panelOrientation = "Vertical";
      post.panelSpacing = 2;
      app.setPost(post);
      return [post.panelOrientation, post.panels[0].stackedPanelSpacing,
        document.querySelectorAll("#panelContainer > .panelStack > .panel").length];
    });
    assert.deepEqual(migrated, ["Horizontal", 2, 3]);
    assert.deepEqual(await stacking(), ["main", "below", "below"]);

    assert.deepEqual(errors, []);
    console.log("Stacked panels: add above/below, labels, stack render, spacing, hide, export choices, move, duplicate, delete and Vertical migration passed.");
  } finally {
    await browser.close();
  }
})();
