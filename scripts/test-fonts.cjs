// v2.19 fonts: every font in the list loads, renders and v2.19 names map.
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
    const added = ["DIN 1451 Regular", "DIN 1451 Narrow", "Motorway Permanent", "Motorway Temporary",
      "Rawlinson Regular", "Rawlinson Bold", "ITC Stone Sans Regular", "ITC Stone Sans Bold",
      "Helvetica Thin", "Helvetica Light", "Helvetica Roman", "Helvetica Medium", "Helvetica Bold",
      "Transport Heavy", "Series EEM"];
    const result = await page.evaluate(async (added) => {
      const list = TextElement.prototype.fontFamily;
      const post = app.getPost();
      const blockElements = post.panels[0].sign.subPanels[0].blockElements;
      blockElements.rows = added.map((fontFamily) => [new ControlTextElement({ textContent: "A1 Exit 12", fontFamily })]);
      blockElements.blockProperties = blockElements.rows.map(() => new Block());
      app.setPost(post);
      await document.fonts.ready;
      const loaded = await Promise.all(added.map(async (font) =>
        (await document.fonts.load(`20px "${font}"`, "A1")).length > 0));
      return {
        missing: added.filter((font) => !list.includes(font)),
        unloaded: added.filter((font, index) => !loaded[index]),
        aliases: ["Transport Regular", "Helvetica Neue Bold", "ITC Stone Sans Semibold", "DIN 1451", "Series 4"]
          .map((name) => new ControlTextElement({ fontFamily: name }).fontFamily),
      };
    }, added);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.unloaded, []);
    assert.deepEqual(result.aliases, ["Transport", "Helvetica Bold", "ITC Stone Sans Bold", "DIN 1451 Regular", "Clearview 4"]);
    assert.equal(await page.locator("#panelContainer .bE-textElement").count() >= added.length, true);
    assert.deepEqual(errors, []);
    console.log("Fonts: v2.19 fonts listed, loaded and v2.19 names mapped.");
  } finally {
    await browser.close();
  }
})();
