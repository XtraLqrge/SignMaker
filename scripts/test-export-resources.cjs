// Verify lazy requests, shared loads, ordered overrides, retries, and disk exports.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..", "public");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const files = ["ExportAssetData.js", "ExportAssetData-2.js", "ExportAssetData-3.js"];
const drain = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
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
  assert.equal(scripts.length, 4, "Concurrent exports share all three image requests");
  for (let i = 0; i < files.length; i++) {
    assert(scripts[i + 1].src.endsWith("/js/" + files[i]));
    assert(fs.statSync(path.join(root, "js", files[i])).size < 25 * 1024 * 1024,
      files[i] + " must fit Cloudflare's individual asset limit");
  }
  scripts[3].onload();
  scripts[1].onload();
  await drain();
  assert.equal(scripts.length, 4, "Overrides wait for every image part");
  const rejected = Promise.all([assert.rejects(assets), assert.rejects(duplicate)]);
  scripts[2].onerror();
  await rejected;

  const retry = loader.assets();
  assert.equal(scripts.length, 5, "Only the failed image part retries");
  assert(scripts[4].src.endsWith("/js/ExportAssetData-2.js"));
  scripts[4].onload();
  await drain();
  assert.equal(scripts.length, 6);
  assert(scripts[5].src.endsWith("/js/FloridaExportAssetData.js"));
  const overrideRejected = assert.rejects(retry);
  scripts[5].onerror();
  await overrideRejected;
  const final = loader.assets();
  await drain();
  assert.equal(scripts.length, 7, "Only the failed override retries");
  scripts[6].onload();
  await final;
  await loader.assets();
  assert.equal(scripts.length, 7, "Successful resources stay cached");

  const full = { window: {} };
  for (const name of files) vm.runInNewContext(read("js/" + name), full);
  const reverse = { window: {} };
  for (const name of [...files].reverse()) vm.runInNewContext(read("js/" + name), reverse);
  assert.deepEqual(JSON.parse(JSON.stringify(reverse.window.SIGNMAKER_EXPORT_ASSETS)),
    JSON.parse(JSON.stringify(full.window.SIGNMAKER_EXPORT_ASSETS)),
    "All images survive regardless of script completion order");
  vm.runInNewContext(read("js/ArrowAssetData.js"), context);
  const expected = Object.fromEntries(Object.entries(full.window.SIGNMAKER_EXPORT_ASSETS)
    .filter(([name]) => name.startsWith("img/arrowBlocks/")));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SIGNMAKER_ARROW_ASSETS)), expected);
  const html = read("index.html");
  for (const name of [...files, "FloridaExportAssetData.js", "ExportFontData.js"]) {
    assert(!html.includes('src="js/' + name + '"'), name + " must stay off the startup path");
  }
  console.log("Export resources: lazy loading, shared requests, override ordering, failed-part retries, size limits, and disk arrow parity passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
