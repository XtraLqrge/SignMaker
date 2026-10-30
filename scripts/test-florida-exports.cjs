// Requires Playwright and its WebKit browser. Start a local server first.
// Usage: node scripts/test-florida-exports.cjs http://127.0.0.1:8765
const assert = require("node:assert/strict");
const { webkit } = require("playwright");

(async () => {
  const baseURL = process.argv[2] || "http://127.0.0.1:8765";
  const browser = await webkit.launch();
  try {
    // An isolated profile: do not touch the user's saved signs or clipboard.
    const page = await browser.newPage();
    await page.route("**/*", (route) => {
      // Prove the tracked supplement works without the ignored local bundle.
      if (route.request().url().endsWith("/js/ExportAssetData.js")) {
        return route.fulfill({ contentType: "text/javascript", body: "" });
      }
      return new URL(route.request().url()).origin === new URL(baseURL).origin
        ? route.continue()
        : route.abort();
    });
    await page.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = (url, ...args) => {
        if (String(url).includes("/Florida/")) {
          throw new Error("Florida exports must not depend on a network fetch");
        }
        return originalFetch(url, ...args);
      };
    });
    await page.goto(baseURL);
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    const results = await page.evaluate(async (testRoute) => {
      document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      const alerts = [];
      window.alert = (message) => alerts.push(message);
      let blob;
      let measuredInk;
      const originalMeasure = ShieldElement.prototype.measureOfficialRouteInk;
      ShieldElement.prototype.measureOfficialRouteInk = function (options) {
        measuredInk = originalMeasure.call(this, options);
        return measuredInk;
      };
      Object.defineProperty(navigator.clipboard, "write", {
        value: async (items) => { blob = await items[0].getType("image/png"); },
      });
      const originalToBlob = htmlToImage.toBlob;
      htmlToImage.toBlob = (element, options) => {
        const images = [...element.querySelectorAll("img.shieldImg")];
        if (!images.length || images.some((img) =>
          !/^data:image\/(svg\+xml|png);base64,/.test(img.src) ||
          !img.complete || !img.naturalWidth
        )) throw new Error("Shield missing from self-contained export");
        return originalToBlob(element, options);
      };
      const results = [];
      const florida = Shield.prototype.shieldDirectory["United States"].Florida;
      for (const [base, config] of Object.entries(florida)) {
        for (const variant of config.variants || []) {
          const post = app.getPost();
          post.copyScale = 1;
          post.panels[0].sign.subPanels[0].blockElements.rows = [[
            new ShieldElement({
              shieldBase: base,
              shieldType: variant,
              routeNumber: variant.includes("1-2") ? "44" : testRoute,
            }),
          ]];
          app.setPost(post);
          blob = null;
          const copied = await app.copySignToClipboard();
          if (base === "FL" && variant.includes("3 Digit")) {
            const shield = document.querySelector("#panelContainer .variableGuideWidth .shield");
            const border = shield.querySelector(".variableGuidePanelBorder");
            if (!["none", "normal"].includes(getComputedStyle(shield, "::after").content)) {
              throw new Error("Three-digit shield must not add a preview-only border");
            }
            if (border?.getAttribute("stroke-width") !== "0.625") {
              throw new Error("Three-digit panel border must match the fixed guide border");
            }
            const viewBox = shield.querySelector(".variableGuideContour").viewBox.baseVal;
            const pixelsPerInch = shield.getBoundingClientRect().height / viewBox.height;
            const artworkClip = parseFloat(getComputedStyle(shield.querySelector(".shieldImg")).clipPath.match(/inset\(([\d.]+)/)?.[1]);
            if (!(artworkClip >= 0.9375 * pixelsPerInch)) {
              throw new Error("Embedded artwork border must not overlap the full-width border");
            }
            const clearance = { 24: 8.25, 30: 8.75, 36: 11 }[viewBox.height];
            const route = shield.querySelector(".routeNumber");
            const offset = new DOMMatrix(getComputedStyle(route).transform).m41;
            const expected = (viewBox.width - clearance) * pixelsPerInch;
            if (Math.abs(offset + measuredInk.inkRight - expected) > 0.1) {
              throw new Error("Three-digit route ink must be right-aligned");
            }
            if (Math.abs(Number(border.getAttribute("width")) - (viewBox.width - 1.25)) > 0.001) {
              throw new Error("Panel border did not resize with the variable guide");
            }
          }
          results.push({ base, variant, copied, bytes: blob?.size || 0 });
        }
      }
      return { results, alerts };
    }, process.argv[3] || "417");
    assert.deepEqual(results.alerts, []);
    assert.equal(results.results.length, 20);
    for (const result of results.results) {
      assert.ok(result.copied && result.bytes > 0, JSON.stringify(result));
    }
    console.log("PASS: all 20 Florida variants export in WebKit with asset fetches blocked.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
