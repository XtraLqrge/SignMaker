// VMS panels: toggle, LED rendering, settings, PNG export and v2.2 "dms" saves.
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
    await page.locator("#panelStyleConfig").click();
    await page.locator("#vmsPanel").check();
    assert.equal(await page.evaluate(() => app.getPost().panels[0].isVms), true);
    assert.equal(await page.locator("#vmsPanelSettings").isHidden(), false);
    await page.waitForFunction(() => document.querySelector(".panel.vmsPanel.vmsReady .vmsEditorPreview"), null, { timeout: 15000 });

    await choose(page, "#vmsResolution", "low");
    assert.equal(await page.evaluate(() => app.getPost().panels[0].vmsResolution), "low");

    const exported = await page.evaluate(async () => {
      let blob = null;
      Object.defineProperty(navigator.clipboard, "write", {
        value: async (items) => { blob = await items[0].getType("image/png"); },
      });
      await app.copySignToClipboard();
      return blob ? blob.size : 0;
    });
    assert(exported > 1000, `exported PNG is ${exported} bytes`);

    const legacy = await page.evaluate(() => {
      const data = JSON.parse(JSON.stringify(app.getPost()));
      delete data.panels[0].isVms;
      data.panels[0].dms = true;
      const restored = new Panel(null, "Green", [], "Round", 0.75, true);
      Panel.applyVmsData(restored, data.panels[0]);
      return { isVms: restored.isVms, dms: "dms" in restored, resolution: restored.vmsResolution };
    });
    assert.deepEqual(legacy, { isVms: true, dms: false, resolution: "low" });

    await page.locator("#vmsPanel").uncheck();
    assert.equal(await page.locator(".panel.vmsPanel").count(), 0);
    assert.deepEqual(errors, []);
    console.log("VMS: toggle, LED preview, settings, PNG export and v2.2 dms saves passed.");
  } finally {
    await browser.close();
  }
})();
