// v2.19 custom colors in the SignalMaker color dropdowns.
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
    await page.evaluate(() => localStorage.removeItem("signMaker.customColors.v1"));
    await page.locator("#closeWelcome").click();
    // The system color chooser can't open headless; stand in for it.
    const chooseCustom = async (id, hex) => {
      await page.evaluate((value) => {
        HTMLInputElement.prototype.click = function () {
          if (this.type === "color") { this.value = value; this.dispatchEvent(new Event("change")); }
        };
      }, hex);
      await page.locator(`#${id}-button`).click();
      await page.locator(".symbolPickerMenu.open [data-picker-custom]").click();
    };
    const menuLabels = async (id) => {
      await page.locator(`#${id}-button`).click();
      const labels = await page.locator(".symbolPickerMenu.open .symbolPickerLabel").allTextContents();
      await page.keyboard.press("Escape");
      return labels;
    };

    // Panel: custom color renders with readable text and is remembered.
    await page.locator("#panelStyleConfig").click();
    await chooseCustom("panelColor", "#7a2e8c");
    const panel = await page.evaluate(() => {
      const el = document.querySelector("#panelContainer .panel");
      return [app.getPost().panels[0].color, el.classList.contains("customPanelColor"),
        getComputedStyle(el.querySelector(".sign")).backgroundColor];
    });
    assert.deepEqual(panel, ["#7a2e8c", true, "rgb(122, 46, 140)"]);
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem("signMaker.customColors.v1")))
      .map((record) => record.value), ["#7a2e8c"]);

    // Exit tab: saved colors appear in other color dropdowns.
    await page.locator("#exitTabConfig").click();
    await page.locator("#exitNumber").fill("EXIT 4");
    assert((await menuLabels("exitColor")).includes("#7a2e8c"));
    await chooseCustom("exitColor", "#ffcc00");
    const tab = await page.evaluate(() => {
      const el = document.querySelector("#panelContainer .exitTab");
      return [el.classList.contains("customExitTabColor"), getComputedStyle(el).backgroundColor, getComputedStyle(el).color];
    });
    assert.deepEqual(tab, [true, "rgb(255, 204, 0)", "rgb(0, 0, 0)"]);

    // Post: a custom color shades the post gradient.
    await page.locator("#postConfig").click();
    await chooseCustom("postColor", "#336699");
    assert.equal(await page.evaluate(() =>
      document.querySelector("#postContainer").style.getPropertyValue("--post-color-mid")), "#336699");

    // Removing a saved color drops it from dropdowns where it isn't selected.
    await page.locator("#exitTabConfig").click();
    await page.locator("#exitColor-button").click();
    await page.locator(".symbolPickerMenu.open .symbolPickerItem", { hasText: "#336699" })
      .locator("[data-picker-remove]").click();
    await page.keyboard.press("Escape");
    assert(!(await menuLabels("exitColor")).includes("#336699"));
    assert((await menuLabels("exitColor")).includes("#ffcc00"));

    // Custom colors survive a reload, even when not in the saved list.
    await page.evaluate(() => localStorage.removeItem("signMaker.customColors.v1"));
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    assert.equal(await page.evaluate(() => app.getPost().panels[0].color), "#7a2e8c");
    assert.equal(await page.locator("#panelColor-button .symbolPickerLabel").textContent(), "#7a2e8c");
    assert.deepEqual(errors, []);
    console.log("Custom colors: Custom… row, panel/exit tab/post rendering, saved list, remove and reload passed.");
  } finally {
    await browser.close();
  }
})();
