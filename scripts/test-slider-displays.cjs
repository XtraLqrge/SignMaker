// While a slider is dragged (input events only), its number box or label
// shows the new value at once, before the form refresh that follows release.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
// These sliders pair with differently named fields their own handlers update,
// or are hidden legacy controls.
const OWN_PAIRING = new Set(["sdShield_shieldSizeSlider", "sdIcon_iconSizeSlider", "exitOnlyPadding"]);
(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8765");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.evaluate(() => { localStorage.clear(); document.getElementById("closeWelcome")?.click(); });
    await page.waitForTimeout(800);
    const stale = await page.evaluate((ownPairing) => {
      const problems = [];
      for (const slider of document.querySelectorAll('input[type="range"][id]')) {
        if (ownPairing.includes(slider.id)) continue;
        const displays = [document.getElementById(slider.id + "Value"), document.getElementById(slider.id + "Val"),
          ...document.querySelectorAll(`output[for="${slider.id}"]`)].filter(Boolean);
        if (!displays.length) { problems.push(`${slider.id}: no display`); continue; }
        const min = Number(slider.min || 0), max = Number(slider.max || 100), step = Number(slider.step) || 1;
        slider.value = String(Math.min(max, Math.max(min, Math.round(((min + max) / 2 + step) / step) * step)));
        const before = displays.map((display) => display.value ?? display.textContent);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        if (displays.every((display, index) => (display.value ?? display.textContent) === before[index]) &&
            !displays.some((display) => String(display.value ?? display.textContent).includes(slider.value))) {
          problems.push(`${slider.id}: shows ${before.join(",")} for ${slider.value}`);
        }
      }
      return problems;
    }, [...OWN_PAIRING]);
    assert.deepEqual(stale, []);
    assert.deepEqual(errors, []);
    console.log("Slider displays: every slider's number box or label follows it while dragging passed.");
  } finally {
    await browser.close();
  }
})();
