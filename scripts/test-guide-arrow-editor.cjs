// Guide arrow editor: v2.19 Standard Arrow and Exit Only windows drive v2.2's renderer.
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
    await page.locator("#guideArrowConfig").click();
    const sign = () => page.evaluate(() => {
      const { guideArrow, guideArrowLanes, standardArrowType, standardArrowSize, exitOnlyEditorVersion } =
        app.getPost().panels[0].sign;
      return { guideArrow, guideArrowLanes, standardArrowType, standardArrowSize, exitOnlyEditorVersion };
    });

    // A new sign has no guide arrows, and the window shows 0 of them.
    assert.equal(await page.locator("#guideArrowLanes").inputValue(), "0");
    assert.equal(await page.locator("#panelContainer .guideArrows img").count(), 0);

    // Standard arrows: picker icons load, choosing Type E and a count renders arrows.
    await page.locator("#sMStandardArrows .shieldPickerTrigger").first().click();
    const popover = page.locator(".arrowPickerPopover.open");
    await popover.locator(".shieldPickerItem", { hasText: "Type E" }).click();
    await page.waitForFunction(() => app.getPost().panels[0].sign.standardArrowType === "TYPE_E");
    // Picking an arrow on a sign without arrows adds one.
    assert.equal(await page.locator("#guideArrowLanes").inputValue(), "1");
    await page.waitForFunction(() => document.querySelectorAll("#panelContainer img.standardGuideArrowImage").length === 1);
    await page.locator("#guideArrowLanes").fill("2");
    await page.locator("#guideArrowLanes").dispatchEvent("change");
    await page.locator("#standardArrowSizeValue").fill("4");
    await page.locator("#standardArrowSizeValue").dispatchEvent("change");
    let state = await sign();
    assert.equal(state.guideArrow, "Standard Arrow");
    assert.equal(Number(state.guideArrowLanes), 2);
    assert.equal(state.standardArrowType, "TYPE_E");
    assert.equal(state.standardArrowSize, 4);
    await page.waitForFunction(() => document.querySelectorAll("#panelContainer img.standardGuideArrowImage[src*=TYPE_E]").length === 2);

    // Padding changes lay the panel out once: no growth over later frames.
    const widths = await page.evaluate(async () => {
      const slider = document.getElementById("standardArrowPadding");
      const panel = () => Math.round(document.querySelector("#panelContainer .panel").getBoundingClientRect().width);
      const seen = [];
      for (const value of [0.2, 0.5, 0.8]) {
        slider.value = value;
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        const frames = [];
        for (let frame = 0; frame < 4; frame++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          frames.push(panel());
        }
        seen.push(new Set(frames).size);
      }
      return seen;
    });
    assert.deepEqual(widths, [1, 1, 1], "panel width settles in one pass");

    // Dragging updates the sign at once and refreshes the form on release.
    const drag = await page.evaluate(() => {
      const slider = document.getElementById("standardArrowSize");
      slider.value = "4.5";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      const during = app.getPost().panels[0].sign.standardArrowSize;
      slider.dispatchEvent(new Event("change", { bubbles: true }));
      return { during, value: document.getElementById("standardArrowSizeValue").value };
    });
    assert.deepEqual(drag, { during: 4.5, value: "4.5" });

    // Exit Only: mode buttons switch to the modern editor.
    await page.locator('.guideArrowConfig .sMModalTab[data-tab="sMExitOnlyArrows"]').click();
    await page.locator('[data-exit-mode="Half Exit Only"]').click();
    state = await sign();
    assert.equal(state.guideArrow, "Half Exit Only");
    assert(state.exitOnlyEditorVersion >= 1);

    // Picker icons all resolve to real images.
    const broken = await page.evaluate(async () => {
      const images = [...document.querySelectorAll(".arrowPickerPopover .arrowPickerIconImage")];
      await Promise.all(images.map((img) => img.decode().catch(() => {})));
      return images.filter((img) => !img.naturalWidth).map((img) => img.getAttribute("src"));
    });
    assert.deepEqual(broken, []);
    assert.deepEqual(errors, []);
    console.log("Guide arrow editor: standard arrow picker, controls, Exit Only modes and picker icons passed.");
  } finally {
    await browser.close();
  }
})();
