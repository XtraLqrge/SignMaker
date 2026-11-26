const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await webkit.launch(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  await page.evaluate(()=>{document.getElementById('closeWelcome')?.click();const d=JSON.parse(app.serializeSignJSON());d.post.panels.push(JSON.parse(JSON.stringify(d.post.panels[0])));app.importSignJSON(JSON.stringify(d));});
  const handle=page.locator('.panelDragHandle').first();
  const box=await handle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  assert.equal(await page.locator('.dragWiggle').count(),0,'clicking should not wiggle');
  await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2,{steps:4});
  assert.equal(await page.locator('.panelDragRoot.dragWiggle').count(),2);
  assert.equal(await page.locator('.dragWiggle').first().evaluate(e=>getComputedStyle(e).animationName),'signMakerDragWiggle');
  await page.screenshot({path:'/tmp/signmaker-drag-wiggle.png'});
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('.dragWiggle').count(),0);
  const count=await page.evaluate(async()=>{
   const check=(ok,msg)=>{if(!ok)throw Error(msg);};
   const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
   const host=document.createElement('div');document.body.appendChild(host);
   const classes=['textEditorBlock','sMControlRow','panelListButton','subPanelTabGroup','exitTabButton','exitTabNestedButton','aplArrowListItem','templateDragging'];
   for(const name of classes){
    host.replaceChildren();
    const row=document.createElement('div');row.className=name;row.draggable=true;row.dataset.draggableSubpanel='true';
    const peer=row.cloneNode();host.append(row,peer);
    row.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}));await wait();
    check(row.classList.contains('dragWiggle'),name+' source');
    if(name!=='templateDragging')check(peer.classList.contains('dragWiggle'),name+' peers');
    row.dispatchEvent(new DragEvent('dragend',{bubbles:true}));check(!document.querySelector('.dragWiggle'),name+' cleanup');
   }
   const control=document.createElement('button');control.draggable=true;host.replaceChildren(control);
   control.addEventListener('dragstart',e=>{e.preventDefault();e.stopPropagation();});
   control.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true}));await wait();
   check(!document.querySelector('.dragWiggle'),'cancelled control drag');
   const arrow=document.createElement('div');arrow.style.transform='translate(-50%, -50%) rotate(90deg)';host.appendChild(arrow);
   const transform=getComputedStyle(arrow).transform;
   document.documentElement.dataset.dropdownAnimations='false';
   SignMakerDragFeedback.begin([arrow]);await wait();
   check(getComputedStyle(arrow).animationName==='signMakerDragWiggle','dropdown preference must not suppress drag feedback');
   check(getComputedStyle(arrow).transform===transform,'position/orientation transform changed');
   window.dispatchEvent(new Event('blur'));check(!document.querySelector('.dragWiggle'),'blur cleanup');
   host.remove();return classes.length;
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>{const e=document.querySelector('.panelDragRoot');SignMakerDragFeedback.begin([e]);return getComputedStyle(e).animationName;}),'signMakerDragWiggle');
  await page.evaluate(()=>SignMakerDragFeedback.end());
  assert.deepEqual(errors,[]);
  console.log(`Passed: real canvas drag/escape, ${count} native drag families, cancellation, preserved arrow transforms, dropdown animation preference, and reduced motion.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
