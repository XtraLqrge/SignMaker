/* Exercise the warning-panel checkbox and real file:// exports in WebKit. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await webkit.launch(process.env.WEBKIT_EXECUTABLE ? {executablePath:process.env.WEBKIT_EXECUTABLE} : {});
 try {
  const page = await browser.newPage({viewport:{width:1400,height:1000}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await page.evaluate(() => {
   document.getElementById('closeWelcome')?.click();
   const doc = JSON.parse(app.serializeSignJSON());
   doc.post.panels[0].color = 'Yellow';
   doc.post.panels[0].corner = 'Round';
   app.importSignJSON(JSON.stringify(doc));
  });
  await page.locator('#panelStyleConfig').click();
  await page.locator('label[for="panelWarningDiamond"]').click();
  await page.waitForSelector('.warningDiamondFace');
  assert.equal(await page.evaluate(() => app.getPost().panels[0].warningDiamond), true);
  assert.equal(await page.locator('.warningDiamondFace').isVisible(), true, 'Rounded warning face must not inherit hidden wrapper visibility');
  const geometry = await page.locator('.warningDiamondFace').evaluate(face => {
   const sign = face.parentElement.querySelector('.sign');
   return {square:face.offsetWidth === face.offsetHeight, rotated:getComputedStyle(face).transform.includes('0.707107'), upright:getComputedStyle(sign).transform === 'none', fits:face.parentElement.offsetWidth >= sign.offsetWidth + sign.offsetHeight};
  });
  assert.deepEqual(geometry, {square:true,rotated:true,upright:true,fits:true});
  for (const corner of ['Sharp', 'Round']) {
   await page.evaluate(corner => {const doc=JSON.parse(app.serializeSignJSON());doc.post.panels[0].corner=corner;app.importSignJSON(JSON.stringify(doc));}, corner);
   assert.equal(await page.locator('.warningDiamondFace').isVisible(), true, `${corner} face must be visible`);
  }
  await page.evaluate(() => app.importSignJSON(app.serializeSignJSON()));
  assert.equal(await page.locator('#panelWarningDiamond').isChecked(), true);
  await page.locator('label[for="panelWarningDiamond"]').click();
  assert.equal(await page.locator('.warningDiamondFace').count(), 0);
  await page.evaluate(() => app.undo());
  await page.waitForSelector('.warningDiamondFace');
  await page.evaluate(() => {
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items => {
    const blob = await items[0].getType('image/png');
    window.warningPNG = await new Promise(resolve => {const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
   }}});
  });
  await page.locator('#copySign').click();
  await page.waitForFunction(() => window.warningPNG, null, {timeout:90000});
  const dimensions = await page.evaluate(async () => {const image = new Image();image.src = window.warningPNG;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};});
  assert.ok(Math.abs(dimensions.width - dimensions.height) <= 4, 'Diamond export must include all four tips');
  const png = await page.evaluate(() => window.warningPNG);
  fs.writeFileSync('/tmp/signmaker-warning-export.png', Buffer.from(png.split(',')[1],'base64'));
  assert.deepEqual(errors, []);
  console.log('Passed: checkbox label, square rotated face, upright content, JSON round trip, disable, undo, and PNG export.');
 } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
