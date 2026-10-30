// Dragging guide arrow padding with the mouse: the panel grows steadily and
// holds still once the drag ends. Exit Only padding pads every side, as in v2.2. It used to grow and shrink over later frames
// (the panel "glitched out" and resized rapidly).
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.evaluate(() => { localStorage.clear(); document.getElementById("closeWelcome")?.click(); });
    await page.locator("#subPanelConfig").click();
    await page.waitForTimeout(300);
    // A full-width header widens with the arrows, as in the reported case.
    await page.locator('.nativeSelectTrigger[aria-label^="Add Header"]').click();
    await page.locator(".symbolPickerMenu.open .symbolPickerItem")
      .filter({ has: page.locator(".symbolPickerLabel", { hasText: /^Yellow$/ }) }).first().click();
    await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
    await page.locator("#subPanelConfig").click();
    await page.locator("#guideArrowConfig").click();
    await page.waitForTimeout(300);

    // Records the panel's size as painted, on every frame until stopped. A
    // newly observed element is reported once in that frame, after all frame
    // callbacks and layout, just before paint; redraws replace the panel, so
    // each frame observes the current one.
    const startRecording = () => page.evaluate(() => {
      window.__widths = [];
      window.__recording = true;
      const record = () => {
        if (!window.__recording) return;
        const observer = new ResizeObserver(([entry]) => {
          observer.disconnect();
          const rect = entry.target.getBoundingClientRect();
          window.__widths.push([Math.round(rect.width), Math.round(rect.height)]);
        });
        observer.observe(document.querySelector("#panelContainer .panel"));
        requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    const stopRecording = () => page.evaluate(() => { window.__recording = false; return window.__widths; });
    const dragPadding = async (name, sliderId, setup) => {
      await page.evaluate(setup);
      await page.waitForTimeout(600);
      const box = await page.locator(`#${sliderId}`).boundingBox();
      assert.ok(box, `${name}: padding slider visible`);
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.mouse.down();
      await startRecording();
      for (let x = 2; x <= box.width - 2; x += 4) {
        await page.mouse.move(box.x + x, box.y + box.height / 2);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      const releasedAt = (await page.evaluate(() => window.__widths.length));
      await page.waitForTimeout(500);
      const sizes = await stopRecording();
      const result = {};
      for (const [axis, index] of [["width", 0], ["height", 1]]) {
        const values = sizes.map((size) => size[index]);
        const steps = values.slice(1).map((value, at) => Math.sign(value - values[at])).filter(Boolean);
        assert.ok(steps.every((step) => step > 0), `${name}: ${axis} only grows while dragging right (${values.join(",")})`);
        // Allow for the form refresh after release, then stillness.
        const settled = values.slice(releasedAt + 6);
        assert.equal(new Set(settled).size, 1, `${name}: ${axis} holds still after release (${settled.join(",")})`);
        result[axis] = `${values[0]}->${values.at(-1)}`;
      }
      return result;
    };

    const standard = await dragPadding("Standard Arrow", "standardArrowPadding", () => {
      const post = app.getPost();
      Object.assign(post.panels[0].sign, { guideArrow: "Standard Arrow", guideArrowLanes: 6, standardArrowPadding: 0 });
      app.setPost(post);
      document.querySelector('.guideArrowConfig .sMModalTab[data-tab="sMStandardArrows"]')?.click();
    });
    const exitOnly = await dragPadding("Exit Only", "exitArrowPadding", () => {
      const post = app.getPost();
      Object.assign(post.panels[0].sign, { guideArrow: "Exit Only", guideArrowLanes: 4, exitOnlyEditorVersion: 2, exitArrowPadding: 0 });
      app.setPost(post);
      document.querySelector('.guideArrowConfig .sMModalTab[data-tab="sMExitOnlyArrows"]')?.click();
    });
    assert.notEqual(standard.height.split("->")[0], standard.height.split("->")[1], "Standard Arrow padding grows the panel");
    for (const axis of ["width", "height"]) {
      const [from, to] = exitOnly[axis].split("->").map(Number);
      assert.ok(to > from, `Exit Only padding grows the panel's ${axis} (${from} -> ${to})`);
    }
    assert.deepEqual(errors, []);
    console.log(`Arrow padding drag: Standard (height ${standard.height}) and Exit Only (width ${exitOnly.width}, height ${exitOnly.height}) grow steadily and hold still passed.`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
