// Verify lazy loading, shared requests, ordered overrides, retries, and the
// arrow masks needed to keep direct-from-disk sign rendering independent.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..", "public");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
(async () => {
  const scripts = [];
  const context = {
    window: {}, URL,
    document: {
      baseURI: "file:///signmaker/index.html",
      createElement: () => ({ remove() {} }),
      head: { append: script => scripts.push(script) },
    },
  };
  vm.runInNewContext(read("js/ExportResources.js"), context);
  const loader = context.window.SignMakerExportResources;
  assert.equal(scripts.length, 0, "No export requests on startup");
  const first = loader.fonts();
  assert.equal(loader.fonts(), first, "Concurrent font requests share a promise");
  scripts[0].onload();
  await first;
  const assets = loader.assets();
  const duplicate = loader.assets();
  assert.equal(scripts.length, 2);
  assert(scripts[1].src.endsWith("/js/ExportAssetData.js"));
  scripts[1].onload();
  await Promise.resolve();
  assert.equal(scripts.length, 3);
  assert(scripts[2].src.endsWith("/js/FloridaExportAssetData.js"));
  scripts[2].onerror();
  await Promise.all([assert.rejects(assets), assert.rejects(duplicate)]);
  const retry = loader.assets();
  await Promise.resolve();
  assert.equal(scripts.length, 4, "Only the failed resource retries");
  scripts[3].onload();
  await retry;
  await loader.assets();
  assert.equal(scripts.length, 4, "Successful resources stay cached");

  const full = { window: {} };
  vm.runInNewContext(read("js/ExportAssetData.js"), full);
  vm.runInNewContext(read("js/ArrowAssetData.js"), context);
  const expected = Object.fromEntries(Object.entries(full.window.SIGNMAKER_EXPORT_ASSETS)
    .filter(([name]) => name.startsWith("img/arrowBlocks/")));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SIGNMAKER_ARROW_ASSETS)), expected);
  const html = read("index.html");
  for (const file of ["ExportAssetData", "FloridaExportAssetData", "ExportFontData"]) {
    assert(!html.includes('src="js/' + file + '.js"'), file + " must stay off the startup path");
  }
  console.log("Export resources: lazy requests, sharing, override ordering, retry, cache, and disk arrow parity passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
