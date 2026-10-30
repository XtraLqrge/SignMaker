// Header and footer rows span the whole sign when guide arrows widen it, and
// Exit Only starts from v2.2's look (Type A arrow pointing up, lane on the left).
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.evaluate(() => { localStorage.clear(); document.getElementById("closeWelcome")?.click(); });
    await page.locator("#subPanelConfig").click();
    await page.waitForTimeout(300);
    for (const which of ["Header", "Footer"]) {
      await page.locator(`.nativeSelectTrigger[aria-label^="Add ${which}"]`).click();
      await page.locator(".symbolPickerMenu.open .symbolPickerItem")
        .filter({ has: page.locator(".symbolPickerLabel", { hasText: /^Yellow$/ }) }).first().click();
      await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
    }

    const scenarios = {
      sixArrows: (s) => { s.guideArrow = "Standard Arrow"; s.guideArrowLanes = 6; },
      wideExitTab: (s, p) => { p.exitTabs[0].number = "EXIT 123 A-B-C"; p.exitTabs[0].width = "Wide"; },
      exitOnly4: (s) => { s.guideArrow = "Exit Only"; s.guideArrowLanes = 4; s.exitOnlyEditorVersion = 2; },
    };
    for (const [name, change] of Object.entries(scenarios)) {
      await page.evaluate((source) => {
        const post = app.getPost();
        (0, eval)(`(${source})`)(post.panels[0].sign, post.panels[0]);
        app.setPost(post);
      }, change.toString());
      await page.waitForTimeout(700);
      const { sign, rows } = await page.evaluate(() => {
        const sign = document.querySelector("#panelContainer .sign").getBoundingClientRect();
        const rows = [...document.querySelectorAll("#panelContainer .blockElementRow")]
          .filter((row) => getComputedStyle(row).backgroundColor === "rgb(252, 207, 52)")
          .map((row) => row.getBoundingClientRect())
          .map((rect) => [rect.left, rect.right]);
        return { sign: [sign.left, sign.right], rows };
      });
      assert.equal(rows.length, 2, `${name}: header and footer rendered`);
      for (const [left, right] of rows) {
        assert.ok(left - sign[0] < 8 && sign[1] - right < 8,
          `${name}: row ${Math.round(left)}-${Math.round(right)} spans sign ${Math.round(sign[0])}-${Math.round(sign[1])}`);
      }
    }

    const defaults = await page.evaluate(() => {
      const sign = new Sign();
      return [sign.exitArrowType, sign.exitArrowSize, sign.exitArrowPadding, sign.exitTextSize, sign.exitArrowAngle];
    });
    assert.deepEqual(defaults, ["TYPE_A", 3.5, 0.25, 75, 0]);
    assert.deepEqual(errors, []);
    console.log("Full-width rows: headers and footers span widened signs and Exit Only uses v2.2 defaults passed.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
