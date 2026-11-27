const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]);await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 await page.locator('#guideArrowConfig').click();await page.locator('[data-tab="sMRoundabout"]').click();
 assert.equal(await page.locator('.roundaboutDestination').count(),3);
 assert.equal(await page.evaluate(()=>app.exposeToFormHandler.getCurrentPanel().sign.subPanels.length),3);
 for(const type of ['normal','bypass']){
  await page.locator('#roundaboutType').selectOption(type,{force:true});
  for(let mask=0;mask<8;mask++){
   for(const [i,name]of ['left','thru','right'].entries())await page.locator('#roundaboutExit-'+name).setChecked(!!(mask&(1<<i)));
   const result=await page.evaluate(()=>({svg:decodeURIComponent(document.querySelector('.roundaboutDrawing').src.split(',')[1]),indices:[...document.querySelectorAll('.roundaboutDestination')].map(n=>Number(n.dataset.subpanelIndex))}));
   assert.deepEqual(result.indices,[0,1,2].filter(i=>mask&(1<<i)));
   for(const [i,name]of ['left','thru','right'].entries())assert.equal(result.svg.includes(`data-exit="${name}"`),!!(mask&(1<<i)));
  }
 }
 assert.equal(await page.locator('#roundaboutEnabled,#diagrammaticEnabled').count(),0);
 await page.locator('#roundaboutPadding-left').fill('4');await page.locator('#roundaboutPadding-left').press('Tab');
 assert.equal(await page.locator('.roundaboutSign').evaluate(n=>n.style.paddingLeft),'4rem');
 assert.equal(await page.locator('.roundaboutSign').evaluate(n=>n.style.paddingTop),'1.5rem');
 const originalSize=await page.locator('.roundaboutDrawing').evaluate(n=>n.offsetWidth);
 await page.locator('#roundaboutSize').fill('27');await page.locator('#roundaboutSize').press('Tab');
 assert.equal(await page.locator('.roundaboutDrawing').evaluate(n=>n.offsetWidth),originalSize*1.5);
 await page.locator('#roundaboutSize').fill('18');await page.locator('#roundaboutSize').press('Tab');
 await page.screenshot({path:'/tmp/roundabout-sign.png'});
 const layout=await page.locator('.roundaboutSign').evaluate(n=>{const box=el=>el.getBoundingClientRect();return {diagram:box(n.querySelector('.roundaboutDrawing')).toJSON(),left:box(n.querySelector('.roundabout-left')).toJSON(),thru:box(n.querySelector('.roundabout-thru')).toJSON(),right:box(n.querySelector('.roundabout-right')).toJSON()};});
 assert.ok(layout.left.right<=layout.diagram.left+1);assert.ok(layout.thru.bottom<=layout.diagram.top);assert.ok(layout.right.left>=layout.diagram.right-1);
 assert.ok(await page.locator('#roundaboutEdit-right').evaluate(n=>n.getBoundingClientRect().right<=n.closest('.sMModal').getBoundingClientRect().right));
 await page.locator('#roundaboutEdit-thru').click();
 assert.equal(await page.evaluate(()=>app.exposeToFormHandler.vars.currentlySelectedSubPanelIndex),1);
 await page.locator('#guideArrowConfig').click();await page.locator('[data-tab="sMRoundabout"]').click();
 await page.locator('#roundaboutExit-thru').uncheck();await page.locator('#undoButton').click();
 await page.waitForFunction(()=>!!document.querySelector('.roundabout-thru'));
 await page.locator('#redoButton').click();await page.waitForFunction(()=>!document.querySelector('.roundabout-thru'));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 assert.equal(await page.locator('.roundaboutBypass').count(),1);
 assert.deepEqual(await page.locator('.roundaboutDestination').evaluateAll(ns=>ns.map(n=>n.dataset.subpanelIndex)),['0','2']);
 await page.locator('#guideArrowConfig').click();
 await page.locator('[data-tab="sMDiagrammatics"]').click();
 for(const [id,value]of [['diagrammaticWidth','20'],['diagrammaticHeight','12']]){await page.locator('#'+id).fill(value);await page.locator('#'+id).press('Tab');}
 assert.deepEqual(await page.locator('.diagrammaticSign').evaluate(n=>{const style=getComputedStyle(n),rem=parseFloat(getComputedStyle(document.documentElement).fontSize);return [parseFloat(style.width)/rem,parseFloat(style.height)/rem];}),[20,12]);
 assert.equal(await page.locator('#diagrammaticWidth').inputValue(),'20');
 assert.equal(await page.locator('#diagrammaticHeight').inputValue(),'12');
 await page.locator('#diagrammaticWidth').fill('40');await page.locator('#diagrammaticWidth').press('Tab');
 assert.equal(await page.locator('#diagrammaticConsistentGaps').isChecked(),true);
 await page.locator('#diagrammaticHeight').fill('35');await page.locator('#diagrammaticHeight').press('Tab');
 await page.waitForFunction(()=>SignMakerDiagrammatics.engine.app.sheets.selected.height===1400);
 assert.equal(await page.locator('#diagrammaticWidth').inputValue(),'40');
 await page.locator('#diagrammaticConsistentGaps').uncheck();
 assert.equal(await page.evaluate(()=>SignMakerDiagrammatics.engine.app.sheets.selected.consistentGapsOnTurns),false);
 await page.locator('#undoButton').click();await page.waitForFunction(()=>document.getElementById('diagrammaticConsistentGaps').checked);
 assert.deepEqual(errors,[]);console.log('Roundabout variants, exit combinations, destinations, undo/redo, and diagrammatic dimensions/gaps passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
