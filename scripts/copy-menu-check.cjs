/* File:// WebKit checks for the toolbar's panel-copy context menu. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser = await webkit.launch(process.env.WEBKIT_EXECUTABLE ? {executablePath:process.env.WEBKIT_EXECUTABLE} : {});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await page.evaluate(() => {
   document.getElementById('closeWelcome')?.click();
   const doc = JSON.parse(app.serializeSignJSON());
   const panel = doc.post.panels[0];
   doc.post.panels = Array.from({length:4}, () => JSON.parse(JSON.stringify(panel)));
   doc.post.panels[2].stackedWithPrevious = true;
   doc.post.panels[3].hiddenFromPost = true;
   app.importSignJSON(JSON.stringify(doc));
  });
  const button = page.locator('#copySign');
  const menu = page.locator('#copyPanelContextMenu');
  for (const position of ['top','bottom','left','right']) {
   for (const scale of [75,100,150]) {
    await page.evaluate(({position,scale}) => {
     document.getElementById('sMConfigBar').dataset.position = position;
     const field = document.getElementById('appUiScale'); field.value=scale; field.dispatchEvent(new Event('input',{bubbles:true}));
    }, {position,scale});
    await button.click({button:'right'});
    assert.deepEqual(await menu.locator('button').allTextContents(), ['Copy Panel 1','Copy Panel 2 (stacked)']);
    const geometry = await menu.evaluate(node => {
     const r=node.getBoundingClientRect();
     return {inside:r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight, hit:node.contains(document.elementFromPoint(r.left+15,r.top+15)), parent:node.parentElement.tagName};
    });
    assert.deepEqual(geometry, {inside:true,hit:true,parent:'BODY'}, `${position}/${scale}`);
    await page.keyboard.press('Escape');
    assert.equal(await button.getAttribute('aria-expanded'), 'false');
    assert.equal(await button.evaluate(node => document.activeElement === node), true);
   }
  }
  await page.evaluate(() => {document.getElementById('sMConfigBar').dataset.position='bottom'; const f=document.getElementById('appUiScale');f.value=100;f.dispatchEvent(new Event('input',{bubbles:true}));});
  await button.focus();
  await page.keyboard.press('Shift+F10');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Copy Panel 2 (stacked)');
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Copy Panel 1');
  await page.screenshot({path:'/tmp/signmaker-copy-menu.png'});
  await page.mouse.click(5,5);
  assert.equal(await button.getAttribute('aria-expanded'), 'false');
  await page.addScriptTag({url:new URL('js/HtmlToImage.js', pathToFileURL(path.resolve('public/index.html'))).href});
  await page.evaluate(() => {
   window.copyAudit = [];
   const render = window.htmlToImage.toPng;
   window.htmlToImage.toPng = async (node,options) => {
    window.copyAudit.push([...node.querySelectorAll('.panel[data-panel-index]')].map(panel=>Number(panel.dataset.panelIndex)));
    return render(node,options);
   };
   window.clipboardCopies = 0;
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{
    const blob=await items[0].getType('image/png');
    if (!blob.size) throw Error('Empty copied image');
    window.clipboardCopies++;
   }}});
  });
  for (const [index,expected] of [[0,[0]],[1,[1,2]]]) {
   await button.click({button:'right'});
   await menu.locator(`button[data-panel-index="${index}"]`).click();
   await page.waitForFunction(count => window.clipboardCopies === count, expected.length === 1 ? 1 : 2, {timeout:90000});
   assert.deepEqual(await page.evaluate(() => window.copyAudit.at(-1)), expected);
   assert.equal(await button.getAttribute('aria-expanded'), 'false');
  }
  await button.click();
  await page.waitForFunction(() => window.clipboardCopies === 3, null, {timeout:90000});
  assert.deepEqual(await page.evaluate(() => window.copyAudit.at(-1)), [0,1,2]);
  await page.evaluate(() => {const doc=JSON.parse(app.serializeSignJSON());doc.post.panels.forEach(panel=>panel.hiddenFromPost=true);app.importSignJSON(JSON.stringify(doc));});
  await button.click({button:'right'});
  assert.equal(await menu.locator('button').textContent(), 'No visible panels to copy');
  assert.equal(await menu.locator('button').isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('Passed: right-click menu across 4 toolbar positions and 3 scales, on-screen hit testing, keyboard navigation/dismissal, individual and stacked PNG copies, hidden panels, and normal full-copy behavior.');
 } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
