// Requires Playwright + WebKit and a running local server.
// NODE_PATH=/path/to/node_modules node scripts/test-fdot-supports.cjs http://127.0.0.1:8766
const assert = require("node:assert/strict");
const { choose } = require("./select-helper.cjs");
// Color dropdowns use the SignalMaker picker over a hidden select.
const pickColor = async (page, id, text) => {
  await page.locator(`#${id}-button`).click();
  await page.locator(".symbolPickerMenu.open .symbolPickerItem")
    .filter({ has: page.locator(".symbolPickerLabel", { hasText: new RegExp(`^${text}$`) }) })
    .click();
  // The picker applies the change after the next paint.
  await page.waitForFunction(() => !document.querySelector("[data-pending-change]"));
};
const fs = require("node:fs/promises");
const { webkit } = require("playwright");

const captureExports = () => {
  // Capture exports inside this isolated browser, without touching the real clipboard.
  window.fdotTestBlob = null;
  window.fdotTestHasSupport = false;
  const original = htmlToImage.toBlob;
  htmlToImage.toBlob = (element, options) => {
    window.fdotTestHasSupport = !!element.querySelector(".fdotSupport");
    return original(element, options);
  };
  Object.defineProperty(navigator.clipboard, "write", {
    configurable: true,
    value: async (items) => { window.fdotTestBlob = await items[0].getType("image/png"); },
  });
};

(async () => {
  const baseURL = process.argv[2] || "http://127.0.0.1:8766";
  const output = process.env.FDOT_TEST_OUTPUT || "/tmp/signmaker-fdot-tests";
  await fs.mkdir(output, { recursive: true });
  const browser = await webkit.launch({
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(baseURL).origin
        ? route.continue() : route.abort()
    );
    await page.goto(baseURL);
    await page.waitForFunction(() => typeof app !== "undefined" && app.getPost()?.panels.length);
    await page.locator("#closeWelcome").click();
    await page.locator("#postConfig").click();
    if (!(await page.locator("#postPosition").isVisible())) await page.locator("#postConfig").click();
    const ids = await page.locator("#postPosition option").evaluateAll((options) =>
      options.map((o) => o.value).filter((id) => id.startsWith("FDOT"))
    );
    assert.equal(ids.length, 26);
    assert.equal(await page.locator("#postPosition optgroup").count(), 3);

    await page.evaluate(captureExports);
    await page.evaluate(() => {
      app.getPost().copyScale = 1;
      app.getPost().copySignsOnly = false;
      formHandler.updateForm();
    });

    for (const id of ids) {
      await choose(page, "#postPosition", id);
      await page.waitForFunction(() => {
        const layer = document.querySelector("#postContainer > .fdotSupport");
        return layer?.complete && layer.naturalWidth > 0;
      });
      const result = await page.evaluate(async () => {
        const layer = document.querySelector("#postContainer > .fdotSupport");
        const svg = decodeURIComponent(layer.src.split(",").slice(1).join(","));
        const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
        const container = document.querySelector("#postContainer");
        const rect = container.getBoundingClientRect();
        const panelRect = document.querySelector("#panelContainer").getBoundingClientRect();
        const copied = await app.copySignToClipboard();
        const bitmap = await createImageBitmap(window.fdotTestBlob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        const pixels = ctx.getImageData(0, Math.floor(canvas.height*0.8), canvas.width, Math.ceil(canvas.height*0.2)).data;
        let basePixels = 0;
        for (let i=3; i<pixels.length; i+=4) if (pixels[i]>0) basePixels++;
        return {
          copied, bytes: window.fdotTestBlob.size, hasSupport: window.fdotTestHasSupport,
          parserError: !!parsed.querySelector("parsererror"),
          hasDepth: parsed.querySelectorAll("linearGradient").length >= 2,
          frontView: parsed.documentElement.getAttribute("data-view") === "front",
          perspectiveEllipses: parsed.querySelectorAll("ellipse").length,
          trussAngles: [...parsed.querySelectorAll('[data-fdot-part="front-truss"] rect[transform]')].map((rect) =>
            Number(rect.getAttribute("transform").match(/rotate\(([-\d.]+)\)/)[1])
          ),
          diagonalAngles: [...parsed.querySelectorAll('[data-fdot-part="front-diagonals"] rect')].map((rect) =>
            Number(rect.getAttribute("transform").match(/rotate\(([-\d.]+)\)/)[1])
          ),
          basePixels, width: rect.width, height: rect.height,
          panelFits: panelRect.left>=rect.left && panelRect.right<=rect.right+1 && panelRect.bottom<=rect.bottom,
          svg,
        };
      });
      assert.equal(result.parserError, false, id);
      assert(result.hasDepth && result.panelFits, `${id}: layout / shading`);
      if (result.frontView) assert.equal(result.perspectiveEllipses, 0, `${id}: orthographic caps and bases`);
      if (result.diagonalAngles.length) {
        const diagonals = result.diagonalAngles;
        assert.equal(result.trussAngles.filter((angle) => angle === 0).length, 2, `${id}: only top/bottom front chords`);
        assert.equal(result.trussAngles.filter((angle) => angle === 90).length, diagonals.length+1, `${id}: vertical panel members`);
        if (id.endsWith("Left")) assert(diagonals.every((angle) => angle > 0), `${id}: braces rise toward left upright`);
        else if (id.endsWith("Right")) assert(diagonals.every((angle) => angle < 0), `${id}: braces rise toward right upright`);
        else {
          assert.equal(diagonals.length%2, 0, `${id}: symmetric panel count`);
          assert(diagonals.slice(0, diagonals.length/2).every((angle) => angle > 0), `${id}: left half brace direction`);
          assert(diagonals.slice(diagonals.length/2).every((angle) => angle < 0), `${id}: right half brace direction`);
        }
      }
      assert(result.copied && result.bytes > 1000 && result.hasSupport && result.basePixels > 30, `${id}: visible support in PNG export`);
      await fs.writeFile(`${output}/${id}.svg`, result.svg);
      if (["FDOTSlipBaseBolted", "FDOTBarrierSide", "FDOTMultiColumnThree", "FDOTCantileverLeft", "FDOTCantileverRight", "FDOTSpan", "FDOTLitSpan", "FDOTDMSCantileverRight", "FDOTStreetWire"].includes(id)) {
        await page.locator("#postContainer").screenshot({ path: `${output}/${id}.png` });
      }
      console.log(`${id}: rendered and PNG export verified`);
    }

    await choose(page, "#postPosition", "FDOTSpan");
    await pickColor(page, "postColor", "Black");
    assert((await page.locator(".fdotSupport").getAttribute("src")).includes(encodeURIComponent("rgb(20, 20, 20)")));
    await page.locator("#showPost").check();
    assert.equal(await page.locator(".fdotSupport").isVisible(), false);
    await page.evaluate(() => app.copySignToClipboard());
    assert.equal(await page.evaluate(() => window.fdotTestHasSupport), false);
    await page.locator("#showPost").uncheck();
    await page.locator("#copySignsOnly").check();
    await page.evaluate(() => app.copySignToClipboard());
    assert.equal(await page.evaluate(() => window.fdotTestHasSupport), false);
    await page.locator("#postThicknessValue").fill("0");
    assert.equal(await page.locator(".fdotSupport").isVisible(), false);
    await page.locator("#postThicknessValue").fill("1.5");
    await pickColor(page, "postColor", "Silver");

    // Unequal sign heights, spacing, and vertical stacking must keep every panel visible.
    // v2.2's Vertical panels option loads as one v2.19 stack.
    await page.evaluate(() => {
      const post = app.getPost();
      post.duplicatePanel(0);
      post.panels[1].sign.padding = "2rem 2rem 2rem 2rem";
      post.panelSpacing = 2;
      post.panelOrientation = "Vertical";
      app.setPost(post);
    });
    assert.equal(await page.locator("#panelContainer > .panelStack > .panel").count(), 2);
    await page.waitForFunction(() => {
      const img = document.querySelector("#postContainer .fdotSupport");
      return img?.complete && img.naturalHeight === document.querySelector("#postContainer").offsetHeight;
    });
    await page.reload();
    await page.waitForFunction(() => app.getPost()?.polePosition === "FDOTSpan");
    await page.evaluate(captureExports);
    assert.equal(await page.locator("#postPosition").inputValue(), "FDOTSpan");
    assert.equal(await page.locator("#panelContainer > .panelStack > .panel").count(), 2);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { const post = app.getPost(); post.panelOrientation = "Horizontal"; app.setPost(post); });
    await page.waitForFunction(() => document.querySelector("#postContainer").getBoundingClientRect().width <= window.innerWidth);
    await page.locator("#postContainer").screenshot({ path: `${output}/mobile.png` });
    await page.evaluate(() => { const post = app.getPost(); post.copySignsOnly = false; app.setPost(post); });
    assert(await page.evaluate(() => app.copySignToClipboard()));
    assert(await page.evaluate(() => window.fdotTestHasSupport));

    await page.setViewportSize({ width: 1440, height: 1000 });
    if (!(await page.locator("#postPosition").isVisible())) {
      await page.locator("#postConfig").click();
      if (!(await page.locator("#postPosition").isVisible())) await page.locator("#postConfig").click();
    }
    await page.screenshot({ path: `${output}/desktop-ui.png` });

    // Exercise the existing SVG format button and whole-post download pipeline.
    await page.evaluate(() => {
      const dialog = document.querySelector("#downloadContent");
      document.querySelector("#modalHolder").style.display = "flex";
      dialog.style.display = "flex";
      dialog.showModal();
    });
    await page.locator("#SVG").click();
    await page.waitForFunction(() => document.querySelector("#downloadPreview img")?.complete);
    const svgDownload = page.waitForEvent("download");
    await page.locator("#download").click();
    const download = await svgDownload;
    assert(download.suggestedFilename().endsWith(".svg"));
    await download.saveAs(`${output}/whole-post.svg`);
    const exportedSVG = await fs.readFile(`${output}/whole-post.svg`, "utf8");
    assert(exportedSVG.includes("fdotSupport") && exportedSVG.includes("data:image/svg+xml"));
    await page.locator("#cancelDownload").click();

    await choose(page, "#postPosition", "Left");
    assert.equal(await page.locator("#postContainer .fdotSupport").count(), 0);
    assert.equal(await page.locator("#postContainer > .post").first().isVisible(), true);
    await choose(page, "#postPosition", "FDOTSpan");
    await page.evaluate(() => app.undo());
    assert.equal(await page.locator("#postPosition").inputValue(), "Left");
    assert.deepEqual(errors, []);
    console.log("Passed: all 26 supports, FDOT front brace patterns, orthographic bases, PNG / SVG exports, color/thickness/hide, signs-only copy, persistence, stacking, mobile, legacy supports, and undo.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
