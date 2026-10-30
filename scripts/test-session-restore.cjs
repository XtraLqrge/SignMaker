// Restore on refresh: always, ask, never, and IndexedDB storage for large sessions.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
(async () => {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const url = process.argv[2] || "http://127.0.0.1:8765";
    const ready = () => page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    const panelCount = () => page.evaluate(() => app.getPost().panels.length);
    const setRestoreMode = async (mode) => {
      await page.evaluate(() => document.getElementById("closeWelcome")?.click());
      for (let attempt = 0; attempt < 2 && !(await page.locator("#restoreOnRefresh-button").isVisible()); attempt++) {
        await page.locator("#appSettingsConfig").click();
      }
      await choose(page, "#restoreOnRefresh", mode);
    };
    await page.goto(url);
    await ready();
    await page.evaluate(() => app.newPanel());
    assert.equal(await panelCount(), 2);

    await page.reload();
    await ready();
    assert.equal(await panelCount(), 2, "always restores");

    await setRestoreMode("prompt");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.reload();
    await ready();
    assert.equal(await panelCount(), 1, "declining the prompt starts a new sign");
    await page.evaluate(() => app.newPanel());
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await ready();
    assert.equal(await panelCount(), 2, "accepting the prompt restores");

    await setRestoreMode("never");
    await page.reload();
    await ready();
    assert.equal(await panelCount(), 1, "never restores");
    assert.equal(await page.locator("#restoreOnRefresh").inputValue(), "never");

    // A session too large for localStorage is kept in IndexedDB.
    await setRestoreMode("always");
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "signMaker.session") throw new DOMException("Quota", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
      app.newPanel();
      app.newPanel();
    });
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => localStorage.getItem("signMaker.session")), null);
    await page.reload();
    await ready();
    assert.equal(await panelCount(), 3, "restores from IndexedDB");
    assert.deepEqual(errors, []);
    console.log("Session restore: always, ask, never and IndexedDB fallback passed.");
  } finally {
    await browser.close();
  }
})();
