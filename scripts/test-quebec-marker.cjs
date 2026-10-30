// Quebec Exit Marker exit tab variant: draws the numbered QC marker on the
// sign instead of a tab, opposite the arrow when there is an Exit Only band.
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
    await page.locator("#exitTabConfig").click();
    await choose(page, "#exitVariant", "Quebec Exit Marker");
    await page.locator("#exitNumber").fill("23");
    const marker = page.locator("#panelContainer .sign .qcExitMarker");
    assert.equal(await marker.count(), 1);
    assert.equal(await marker.locator(".qcExitMarkerNumber").textContent(), "23");
    assert.equal(await page.locator("#panelContainer .exitTabContainer.tabVisible").count(), 0);

    // The marker sits below the legend rather than over it.
    const overlap = await page.evaluate(() => {
      const m = document.querySelector(".qcExitMarker").getBoundingClientRect();
      const holder = document.querySelector("#panelContainer .signHolder").getBoundingClientRect();
      return m.top < holder.bottom - 1;
    });
    assert.equal(overlap, false);

    await choose(page, "#exitTabPosition", "Right");
    assert.equal(await marker.evaluate((el) => el.classList.contains("qcRight")), true);

    // With an Exit Only band the marker goes opposite the arrow.
    await page.evaluate(() => {
      document.getElementById("guideArrow").value = "Exit Only";
      document.getElementById("guideArrowLanes").value = "1";
      const arrowLocations = document.getElementById("arrowLocations");
      if (![...arrowLocations.options].some((option) => option.value === "Left")) {
        arrowLocations.add(new Option("Left", "Left"));
      }
      arrowLocations.value = "Left";
      formHandler.readForm();
    });
    await page.locator("#exitNumber").fill("24");
    assert.equal(await marker.evaluate((el) => el.className), "qcExitMarker qcOnSign qcRight flipped");

    await page.locator("#exitNumber").fill("");
    assert.equal(await marker.count(), 0);
    assert.deepEqual(errors, []);
    console.log("Quebec marker: on-sign marker, position, Exit Only placement and empty number passed.");
  } finally {
    await browser.close();
  }
})();
