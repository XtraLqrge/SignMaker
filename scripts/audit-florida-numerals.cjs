// Requires Playwright/WebKit and a local server. Tests actual glyph pixels,
// not just whether PNG export succeeds. 8 samples per nominal sign inch.
const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const baseURL = process.argv[2] || "http://127.0.0.1:8765";
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*", (r) => new URL(r.request().url()).origin === new URL(baseURL).origin ? r.continue() : r.abort());
    await page.goto(baseURL);
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    const results = await page.evaluate(async () => {
      await document.fonts.load('100px "Series D"');
      const results = [];
      const S = 8;
      const catalog = Shield.prototype.shieldDirectory["United States"].Florida;
      for (const base of ["FL", "FLToll", "FLCFXToll"]) {
        const config = catalog[base];
        for (const [variant, style] of Object.entries(config.routeNumberByVariant)) {
          const dims = config.physicalDimensionsByVariant[variant];
          const variable = style.variablePanelWidth;
          const xml = await (await fetch(config.assetPathByVariant[variant])).text();
          const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
          if (variable) doc.querySelectorAll("rect").forEach((r) => r.remove());
          const image = new Image();
          image.src = "data:image/svg+xml;base64," + btoa(new XMLSerializer().serializeToString(doc));
          await image.decode();
          const canvas = document.createElement("canvas");
          const digits = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          const dc = digits.getContext("2d", { willReadFrequently: true });
          const height = dims.heightIn * S;
          const cap = style.capHeightIn * S;
          const first = base === "FL" && variable ? 100 : 1;
          const last = base === "FL" && !variable ? 99 : 999;
          const failures = [];
          let condensed = 0;
          let smallestScale = 1;
          for (let n = first; n <= last; n++) {
            const text = String(n);
            const options = { routeText: text, routeFontFamily: "Series D", capHeightPixels: cap, context: ctx };
            const natural = ShieldElement.prototype.measureOfficialRouteInk(options);
            const fit = ShieldElement.prototype.fitOfficialRouteInk(options, style.allowOpticalSpacing ? style.maxWidthIn * S : Infinity);
            let widthIn = dims.widthIn;
            if (variable) widthIn = Math.min(variable.maxWidthIn, Math.max(variable.minWidthIn,
              style.leftIn + natural.inkWidth / S + variable.rightClearanceIn));
            const width = Math.ceil(widthIn * S);
            canvas.width = digits.width = width;
            canvas.height = digits.height = height;
            ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, height);
            ctx.drawImage(image, variable ? (widthIn - variable.assetWidthIn) * S : 0, 0, dims.widthIn * S, height);
            if (variable) {
              for (const [inset, stroke, radius] of [[0.0625, 0.125, 1.1875], [0.625, 0.625, 0.625]]) {
                ctx.beginPath(); ctx.roundRect(inset * S, inset * S, (widthIn - 2 * inset) * S, height - 2 * inset * S, radius * S);
                ctx.lineWidth = stroke * S; ctx.strokeStyle = "black"; ctx.stroke();
              }
            }
            const background = ctx.getImageData(0, 0, width, height).data;
            const right = variable ? widthIn - variable.rightClearanceIn : style.rightIn;
            const start = Number.isFinite(right) ? right * S - fit.inkRight : style.centerXIn * S - (fit.inkLeft + fit.inkRight) / 2;
            const occupied = new Uint8Array(width * height);
            let digitHits = 0, outlineHits = 0, inkPixels = 0, cursor = 0;
            for (const ch of text) {
              dc.setTransform(1, 0, 0, 1, 0, 0); dc.clearRect(0, 0, width, height);
              dc.font = `${cap * 7 / 4}px "Series D"`; dc.fontKerning = "none";
              dc.fillStyle = "black"; dc.textBaseline = "alphabetic";
              dc.setTransform(fit.scaleX, 0, 0, 1, start, 0);
              dc.fillText(ch, cursor, (style.topIn + style.capHeightIn) * S);
              const pixels = dc.getImageData(0, 0, width, height).data;
              for (let i = 0; i < occupied.length; i++) {
                if (pixels[i * 4 + 3] <= 180) continue;
                inkPixels++;
                if (occupied[i]) digitHits++;
                occupied[i] = 1;
                const k = i * 4;
                if ((background[k] < 90 && background[k + 1] < 90 && background[k + 2] < 90) ||
                  (background[k] > 180 && background[k + 1] > 60 && background[k + 1] < 180 && background[k + 2] < 100)) outlineHits++;
              }
              cursor += OFFICIAL_ROADGEEK_METRICS["Series D"][ch][0] * cap + fit.spacing;
            }
            const outside = start + fit.inkLeft < 0 || start + fit.inkRight > widthIn * S + 0.01;
            if (digitHits || outlineHits || !inkPixels || outside) failures.push({ text, digitHits, outlineHits, outside });
            if (fit.scaleX < 1) condensed++;
            smallestScale = Math.min(smallestScale, fit.scaleX);
          }
          results.push({ base, variant, count: last - first + 1, condensed, smallestScale, failures: failures.length, examples: failures.slice(0, 5) });
        }
      }
      return results;
    });
    for (const result of results) console.log(JSON.stringify(result));
    assert.equal(results.reduce((sum, item) => sum + item.failures, 0), 0, "Glyph collision or clipping found");
    console.log(`PASS: ${results.reduce((sum, item) => sum + item.count, 0)} numeral layouts without digit/artwork collisions.`);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
