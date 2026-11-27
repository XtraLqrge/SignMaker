/* Optional file:// WebKit integration check; uses the same env as test:live. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await webkit.launch(process.env.WEBKIT_EXECUTABLE ? {executablePath:process.env.WEBKIT_EXECUTABLE} : {});
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await page.evaluate(() => document.getElementById('closeWelcome')?.click());
  const result = await page.evaluate(async () => {
   const check = (ok, message) => { if (!ok) throw Error(message); };
   const types = Object.keys(Control.prototype.blockToClassElems).filter(k => k !== 'getElem');
   for (const type of types) {
    app.exposeToFormHandler.replaceControlElemTypeAt(0, 0, type);
    const saved = app.serializeSignJSON();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg">' + SignMakerSignDocument.svgMetadata(saved) + '</svg>';
    app.importSignSVG(svg);
    check(app.exposeToFormHandler.getCurrentBlockElem().constructor.name === type, type + ' lost SVG class');
    app.importSignJSON(saved);
    check(app.exposeToFormHandler.getCurrentBlockElem().constructor.name === type, type + ' lost class');
    const normalized = app.serializeSignJSON();
    app.importSignJSON(normalized);
    check(app.serializeSignJSON() === normalized, type + ' unstable round trip');
   }
   const special = JSON.parse(app.serializeSignJSON());
   special.post.portableLabel = 'Québec & <West> </metadata> 🚗';
   app.importSignJSON(JSON.stringify(special));
   const before = app.serializeSignJSON();
   const svgFor = json => '<svg xmlns="http://www.w3.org/2000/svg">' + SignMakerSignDocument.svgMetadata(json) + '</svg>';
   const svg = svgFor(before);
   check(SignMakerSignDocument.fromSVG(svg) === before, 'SVG Unicode/XML escaping failed');
   for (const invalid of ['<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AA=="/></svg>', '<svg>', '<!DOCTYPE svg><svg/>', svg.replace('"schemaVersion": 1', '"schemaVersion": 999'), svg.replace('</svg>', SignMakerSignDocument.svgMetadata(before) + '</svg>')]) {
    try {app.importSignSVG(invalid); throw Error('accepted invalid SVG');} catch(e) {check(e.message !== 'accepted invalid SVG', e.message);}
    check(app.serializeSignJSON() === before, 'invalid SVG changed canvas');
   }
   // Only metadata is read: imported SVG markup never executes or enters the DOM.
   app.importSignSVG(svg.replace('</svg>', '<script>window.svgExecuted=true</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" id="untrustedSVGContent">Untrusted</div></foreignObject></svg>'));
   check(!window.svgExecuted && !document.getElementById('untrustedSVGContent'), 'SVG markup was activated');
   for (const bad of ['{}', '{"panels":[null]}', '{"schemaVersion":999}', 'no JSON']) {
    try {app.importSignJSON(bad); throw Error('accepted invalid');} catch(e) {check(e.message !== 'accepted invalid', e.message);}
    check(app.serializeSignJSON() === before, 'invalid import changed canvas');
   }
   const legacy = {panelSpacing:0, panels:[{sign:{subPanels:[]}, corner:'sharp'}]};
   app.importSignSVG(svgFor(JSON.stringify(legacy)));
   check(app.getPost().panelSpacing === 0, 'zero spacing lost');
   app.undo();
   await new Promise(r => setTimeout(r, 150));
   const diff = (a,b,p='') => {
    if (a === b) return [];
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [p+': '+JSON.stringify(a)+' != '+JSON.stringify(b)];
    return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diff(a[k],b[k],p+'.'+k));
   };
   check(!diff(JSON.parse(app.serializeSignJSON()),JSON.parse(before)).length, 'undo mismatch: '+diff(JSON.parse(app.serializeSignJSON()),JSON.parse(before)).join('; '));
   const doc = JSON.parse(before);
   const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
   doc.assets.customShields = [{id:'json-test',value:'CUSTOM_JSON_TEST',name:'JSON Shield',imageData:pixel,routeNumber:'12',usesUploadedImage:true}];
   doc.post.panels[0].sign.subPanels[0].blockElements.rows = [[{_elementType:'ShieldElement',shieldBase:'CUSTOM_JSON_TEST',type:'CUSTOM_JSON_TEST',routeNumber:'12'}]];
   app.importSignJSON(JSON.stringify(doc));
   const exported = JSON.parse(app.serializeSignJSON());
   check(exported.assets.customShields.length === 1, 'custom shield asset lost');
   check(exported.assets.customShields[0].imageData === pixel, 'custom shield image changed');
   const saved = app.serializeSignJSON();
   app.importSignJSON(saved);
   check(app.serializeSignJSON() === saved, 'custom asset round trip unstable');
   const collision = JSON.parse(saved);
   collision.assets.customShields[0].name = 'Different imported shield';
   app.importSignJSON(JSON.stringify(collision));
   const collided = JSON.parse(app.serializeSignJSON());
   check(collided.assets.customShields[0].id !== exported.assets.customShields[0].id, 'asset ID collision overwritten');
   check(collided.assets.customShields[0].name === 'Different imported shield', 'collision asset lost');
   const panels = JSON.parse(saved);
   panels.post.panels.push(JSON.parse(JSON.stringify(panels.post.panels[0])), JSON.parse(JSON.stringify(panels.post.panels[0])));
   panels.post.panels[1].stackedWithPrevious = true;
   panels.post.panels[2].stackedWithPrevious = false;
   app.importSignJSON(JSON.stringify(panels));
   document.getElementById('entirePost').checked = false;
   app.updatePreview();
   for (const button of [...document.querySelectorAll('#downloadPanelButtons button')]) {
    const wanted = button.dataset.panelIndex === '0';
    if ((button.getAttribute('aria-pressed') === 'true') !== wanted) button.click();
   }
   check(JSON.parse(app.serializeSignJSON()).post.panels.length === 2, 'selected stack was not exported together');
   document.getElementById('entirePost').checked = true;
   app.updatePreview();
   // The native import input reads a File and allows selecting the same file again.
   const input = document.getElementById('importJSONFile');
   const transfer = new DataTransfer(); transfer.items.add(new File([saved], 'sign.json', {type:'application/json'})); input.files = transfer.files;
   await app.importJSONFile(input);
   check(input.value === '', 'file picker not reset');
   check(document.getElementById('signJSONStatus').textContent.includes('Sign imported'), 'file import failed');
   return types.length;
  });
  const download = page.waitForEvent('download');
  await page.evaluate(() => app.downloadJSONSign());
  const file = await download;
  assert.equal(file.suggestedFilename(), 'downloadedSign.json');
  await page.evaluate(() => {
   const doc = JSON.parse(app.serializeSignJSON());
   doc.post.panels.push(JSON.parse(JSON.stringify(doc.post.panels[0])), JSON.parse(JSON.stringify(doc.post.panels[0])));
   doc.post.panels[1].stackedWithPrevious = true;
   doc.post.panels[2].stackedWithPrevious = false;
   app.importSignJSON(JSON.stringify(doc));
   document.getElementById('entirePost').checked = false;
   app.updatePreview();
   for (const button of [...document.querySelectorAll('#downloadPanelButtons button')]) {
    if ((button.getAttribute('aria-pressed') === 'true') !== (button.dataset.panelIndex === '0')) button.click();
   }
  });
  const expected = JSON.parse(await page.evaluate(() => app.serializeSignJSON()));
  assert.equal(expected.post.panels.length, 2);
  const svgDownload = page.waitForEvent('download', {timeout:90000});
  await page.evaluate(() => app.downloadSVGSign());
  const svgFile = await svgDownload;
  assert.equal(svgFile.suggestedFilename(), 'downloadedSign.svg');
  const svgText = fs.readFileSync(await svgFile.path(), 'utf8');
  assert.match(svgText, /<image /);
  const imported = await page.evaluate(async text => {
   const input = document.getElementById('importJSONFile');
   const transfer = new DataTransfer(); transfer.items.add(new File([text], 'sign.svg', {type:'image/svg+xml'})); input.files = transfer.files;
   await app.importJSONFile(input);
   if (!document.getElementById('signJSONStatus').textContent.includes('Sign imported')) throw Error(document.getElementById('signJSONStatus').textContent);
   return JSON.parse(app.serializeSignJSON());
  }, svgText);
  assert.deepEqual(imported, expected);
  const copied = await page.evaluate(async () => {
   let copiedText;
   Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{
    write: async items => { const item=items[0]; copiedText=await (await item.getType(item.types[0])).text(); },
    writeText: async text => {copiedText=text;}
   }});
   await app.copySVGSign();
   if (!copiedText) throw Error('SVG copy did not produce data');
   return JSON.parse(SignMakerSignDocument.fromSVG(copiedText));
  });
  assert.deepEqual(copied.post, expected.post);
  assert.deepEqual(copied.assets, expected.assets);
  await page.evaluate(() => document.getElementById('export').click());
  await page.locator('#downloadContent').screenshot({path:'/tmp/signmaker-svg-menu.png'});
  assert.deepEqual(errors, []);
  console.log(`Passed: ${result} block types, stable JSON round trips, legacy defaults, invalid files, undo, custom shield assets, native file import, download, SVG metadata/escaping, SVG file import, and copied SVG in WebKit.`);
 } finally {await browser.close();}
})().catch(e => {console.error(e); process.exitCode=1;});
