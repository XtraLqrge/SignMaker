// Exit tab dragging (v2.19): drag along the sign, snap, save, undo and reset.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = process.argv[2] || "http://127.0.0.1:8765";
    const ready = async () => {
      await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
      await page.evaluate(() => document.getElementById("closeWelcome")?.click());
    };
    await page.goto(url);
    await ready();
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("signMaker.restoreOnRefresh", "always");
    });
    await page.evaluate(() => {
      const post = app.getPost();
      const panel = post.panels[0];
      panel.sign.subPanels[0].blockElements.rows[0][0].textContent = "A Very Long Destination Name";
      panel.exitTabs[0].number = "EXIT 12";
      panel.exitTabs[0].position = "Right";
      app.setPost(post);
    });
    const tab = page.locator("#panelContainer .exitTabHolder > .exitTab").first();
    const sign = page.locator("#panelContainer .panel .signContainer > .sign").first();
    await tab.waitFor();
    const state = () => page.evaluate(() => {
      const { dragOffsetRem, dragSnapAnchor } = app.getPost().panels[0].exitTabs[0];
      return { dragOffsetRem, anchor: dragSnapAnchor && { kind: dragSnapAnchor.kind, point: dragSnapAnchor.point } };
    });
    assert.equal(await tab.evaluate((element) => element.classList.contains("draggableExitTab")), true);

    // Drag the tab so its center lands on the sign's center; it snaps there.
    const signBox = await sign.boundingBox();
    let tabBox = await tab.boundingBox();
    const startX = tabBox.x + tabBox.width / 2;
    const targetX = signBox.x + signBox.width / 2 + 4;
    await page.mouse.move(startX, tabBox.y + tabBox.height / 2);
    await page.mouse.down();
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(startX + (targetX - startX) * step / 10, tabBox.y + tabBox.height / 2);
    }
    await page.mouse.up();
    let dragged = await state();
    assert.ok(dragged.dragOffsetRem < 0, "the tab moved left");
    assert.deepEqual(dragged.anchor, { kind: "panel", point: "center" });
    tabBox = await tab.boundingBox();
    assert.ok(Math.abs(tabBox.x + tabBox.width / 2 - (signBox.x + signBox.width / 2)) < 1.5, "centered on the sign");

    // A redraw keeps the position, and it survives a reload.
    await page.evaluate(() => app.redraw?.() ?? formHandler.readForm());
    tabBox = await tab.boundingBox();
    assert.ok(Math.abs(tabBox.x + tabBox.width / 2 - (signBox.x + signBox.width / 2)) < 1.5);
    await page.waitForTimeout(300);
    await page.reload();
    await ready();
    await tab.waitFor();
    assert.equal((await state()).dragOffsetRem, dragged.dragOffsetRem);
    await page.waitForTimeout(200);
    tabBox = await tab.boundingBox();
    const reloadedSign = await sign.boundingBox();
    assert.ok(Math.abs(tabBox.x + tabBox.width / 2 - (reloadedSign.x + reloadedSign.width / 2)) < 1.5, "centered after reload");

    // The drag is one undo step.
    await page.evaluate(() => {
      const post = app.getPost();
      post.panels[0].exitTabs[0].dragOffsetRem = 0;
      post.panels[0].exitTabs[0].dragSnapAnchor = null;
      app.setPost(post);
    });
    tabBox = await tab.boundingBox();
    const plainRight = tabBox.x + tabBox.width;
    await page.mouse.move(tabBox.x + 10, tabBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(tabBox.x - 40, tabBox.y + 10, { steps: 5 });
    await page.mouse.up();
    assert.ok((await state()).dragOffsetRem < 0);
    await page.evaluate(() => app.undo());
    assert.equal((await state()).dragOffsetRem, 0);
    tabBox = await tab.boundingBox();
    assert.ok(Math.abs(tabBox.x + tabBox.width - plainRight) < 1);

    // Changing the tab's position drops the drag offset.
    await page.evaluate(() => {
      const post = app.getPost();
      post.panels[0].exitTabs[0].dragOffsetRem = -3;
      post.panels[0].exitTabs[0].dragLayoutPosition = "Right";
      post.panels[0].exitTabs[0].position = "Left";
      app.setPost(post);
    });
    assert.equal((await state()).dragOffsetRem, 0);
    assert.deepEqual(errors, []);
    console.log("Exit tab drag: drag, snap to center, redraw, reload, undo and position reset passed.");
  } finally {
    await browser.close();
  }
})();
