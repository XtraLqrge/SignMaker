// APL exit-only labels: per-arrow font, size and letter spacing from v2.19.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    const label = await page.evaluate(() => {
      const post = app.getPost();
      const sign = post.panels[0].sign;
      sign.arrowMode = "apl";
      sign.newAPLArrow("APL_UP");
      Object.assign(sign.aplArrows[0], {
        exitOnly: true, exitOnlyFont: "Clearview 5", exitOnlySize: 120, exitOnlyLetterSpacing: 0.1,
      });
      app.setPost(post);
      const element = document.querySelector("#panelContainer .aplExitOnlyLabel");
      return { font: element.style.fontFamily, size: element.style.fontSize, spacing: element.style.letterSpacing };
    });
    assert.deepEqual(label, { font: '"Clearview 5W"', size: "calc(1.2em)", spacing: "0.1em" });
    const plain = await page.evaluate(() => {
      const post = app.getPost();
      const arrow = post.panels[0].sign.aplArrows[0];
      delete arrow.exitOnlyFont;
      delete arrow.exitOnlySize;
      delete arrow.exitOnlyLetterSpacing;
      app.setPost(post);
      const element = document.querySelector("#panelContainer .aplExitOnlyLabel");
      return element.style.fontFamily + element.style.fontSize + element.style.letterSpacing;
    });
    assert.equal(plain, "", "labels without settings keep v2.2's styling");
    assert.deepEqual(errors, []);
    console.log("APL exit-only labels: font, size and letter spacing passed.");
  } finally {
    await browser.close();
  }
})();
