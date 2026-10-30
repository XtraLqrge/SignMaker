// Exit tab profiles from v2.19: named styles shared by linked tabs.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept(dialog.message().startsWith("Rename") ? "Ramp" : "Quebec"));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    await page.locator("#exitTabConfig").click();
    const tabs = () => page.evaluate(() => app.getPost().panels[0].exitTabs.map((tab) => ({
      profileId: tab.profileId, fontFamily: tab.fontFamily, bilingual: tab.bilingual, number: tab.number })));
    const select = page.locator("#exitTabProfileSelect");

    // New saves the tab's style as a profile and links the tab.
    await page.locator("#exitNumber").fill("EXIT 1");
    await choose(page, "#exitTabFontFamily", "Series D");
    await page.locator("#exitTabProfileNew").click();
    let state = await tabs();
    assert.ok(state[0].profileId);
    const profileId = state[0].profileId;
    assert.equal(await select.inputValue(), profileId);
    assert.deepEqual(await select.locator("option").allTextContents(), ["None", "Quebec"]);

    // A second tab picks up the profile's style when linked.
    await page.evaluate(() => app.newExitTab());
    await page.locator("#exitNumber").fill("EXIT 2");
    await choose(page, "#exitTabProfileSelect", profileId);
    state = await tabs();
    assert.equal(state[1].fontFamily, "Series D");
    assert.equal(state[1].number, "EXIT 2");

    // Editing one linked tab restyles the other.
    await page.locator("#exitTabBilingual").check();
    state = await tabs();
    assert.deepEqual(state.map((tab) => tab.bilingual), [true, true]);
    assert.deepEqual(state.map((tab) => tab.number), ["EXIT 1", "EXIT 2"]);

    // Unlinking stops sharing; rename and delete keep tabs' looks.
    await choose(page, "#exitTabProfileSelect", "");
    await choose(page, "#exitTabFontFamily", "Series E");
    state = await tabs();
    assert.equal(state[1].profileId, undefined);
    assert.equal(state[0].fontFamily, "Series D");
    await page.evaluate(() => app.changeEditingExitTab(0, -1));
    await page.locator("#exitTabProfileRename").click();
    assert.deepEqual(await select.locator("option").allTextContents(), ["None", "Ramp"]);
    await page.locator("#exitTabProfileDelete").click();
    state = await tabs();
    assert.equal(state[0].profileId, undefined);
    assert.equal(state[0].fontFamily, "Series D");
    assert.deepEqual(await select.locator("option").allTextContents(), ["None"]);

    // v2.19 saves: the built-in default profile is dropped, others keep working.
    const restored = await page.evaluate(() => {
      const post = app.getPost();
      post.exitTabProfiles = { selectedId: "default", profiles: [
        { id: "default", name: "Default Profile", settingsByVariant: { Default: {} } },
        { id: "p1", name: "Blue", settings: { color: "Blue" } },
      ] };
      post.panels[0].exitTabs[0].profileId = "p1";
      formHandler.updateForm();
      return [...document.querySelectorAll("#exitTabProfileSelect option")].map((option) => option.textContent);
    });
    assert.deepEqual(restored, ["None", "Blue"]);
    await choose(page, "#exitTabProfileSelect", "");
    await choose(page, "#exitTabProfileSelect", "p1");
    assert.equal(await page.evaluate(() => app.getPost().panels[0].exitTabs[0].color), "Blue");

    assert.deepEqual(errors, []);
    console.log("Exit tab profiles: new, link, shared edits, unlink, rename, delete and v2.19 saves passed.");
  } finally {
    await browser.close();
  }
})();
