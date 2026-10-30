// Requires Playwright + WebKit. Accepts a localhost URL or the local index.html URL.
// NODE_PATH=/path/to/node_modules node scripts/test-sign-copy.cjs http://127.0.0.1:8766
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { webkit } = require("playwright");

(async () => {
  const browser = await webkit.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}),
  });
  try {
    // Keep the user's saved sign and system clipboard untouched.
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.argv[2] || "http://127.0.0.1:8766");
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    await page.evaluate(() => {
      window.copiedSign = null;
      Object.defineProperty(navigator.clipboard, "write", {
        value: async items => { window.copiedSign = await items[0].getType("image/png"); },
      });
      window.checkSignPng = async blob => {
        const image = new Image();
        const url = URL.createObjectURL(blob);
        try {
          image.src = url;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const sign = document.querySelector("#panel0 .sign").getBoundingClientRect();
          const tab = document.querySelector("#panel0 .exitTab");
          const top = getComputedStyle(tab).visibility === "visible"
            ? Math.min(sign.top, tab.getBoundingClientRect().top) : sign.top;
          const height = sign.bottom - top;
          const scale = image.naturalWidth / sign.width;
          if (Math.abs(image.naturalHeight - height * scale) > 2 * scale) {
            throw new Error(`Export cropped the sign: ${image.naturalHeight}px instead of ${height * scale}px`);
          }
          // Count actual white lettering in the EXIT row, excluding the panel border.
          const row = document.querySelectorAll("#panel0 .blockElementRow")[1].getBoundingClientRect();
          const left = Math.ceil((row.left - sign.left + row.width * 0.2) * scale);
          const rowTop = Math.ceil((row.top - top + 2) * scale);
          const pixels = context.getImageData(left, rowTop,
            Math.floor(row.width * 0.6 * scale), Math.floor((row.height - 4) * scale)).data;
          let whitePixels = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] > 220 && pixels[i + 1] > 220 && pixels[i + 2] > 220 && pixels[i + 3] > 220) whitePixels++;
          }
          if (whitePixels < 100 * scale * scale) throw new Error("EXIT 308B lettering missing from PNG");
        } finally {
          URL.revokeObjectURL(url);
        }
      };
    });

    for (const layout of ["fdot", "vertical", "standard", "visible-tab"]) {
      await page.evaluate(async layout => {
        const post = app.getPost();
        post.polePosition = ["fdot", "visible-tab"].includes(layout) ? "FDOTSpan" : "Center";
        post.showPost = true;
        post.copySignsOnly = true;
        post.copyScale = layout === "fdot" ? 8 : 2;
        post.panelOrientation = layout === "vertical" ? "Vertical" : "Horizontal";
        post.signAlignment = "Bottom";
        const panel = post.panels[0];
        panel.sign.subPanels[0].blockElements = new Control({
          rows: [
            [new ControlTextElement({ textContent: "American Family Field", fontFamily: "Series EM" })],
            [new ActionMessageElement({ textContent: "EXIT 308B", fontFamily: "Series E" })],
          ],
          blockProperties: [new Block(), new Block()],
        });
        Object.assign(panel.exitTabs[0], {
          width: "Edge", position: "Right", number: layout === "visible-tab" ? "EXIT 12A" : "",
        });
        app.setPost(post);
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, layout);
      const preview = await page.locator("#panelContainer").innerHTML();
      // Exercise the toolbar action, then the individual-panel copy action.
      await page.evaluate(() => { window.copiedSign = null; });
      await page.locator("#export").click();
      await page.waitForFunction(() => window.copiedSign !== null);
      await page.evaluate(() => window.checkSignPng(window.copiedSign));
      assert.equal(await page.evaluate(async () => {
        if (!await app.copyPanelToClipboard(0)) return false;
        await window.checkSignPng(window.copiedSign);
        return true;
      }), true);
      for (const panelOnly of [false, true]) {
        const downloadPromise = page.waitForEvent("download");
        assert.equal(await page.evaluate(panelOnly => panelOnly
          ? app.downloadPanelSign(0) : app.downloadCopiedSign(), panelOnly), true);
        const download = await downloadPromise;
        const bytes = await fs.readFile(await download.path());
        await page.evaluate(base64 => window.checkSignPng(new Blob([
          Uint8Array.from(atob(base64), character => character.charCodeAt(0)),
        ], { type: "image/png" })), bytes.toString("base64"));
      }
      assert.equal(await page.locator("#panelContainer").innerHTML(), preview);
      assert.equal(await page.locator(".exportStaticCaptureHost").count(), 0);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: full-sign and panel copy/download preserve EXIT 308B, visible tabs, and the preview in FDOT, vertical, and standard layouts.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
