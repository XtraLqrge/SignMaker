const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.argv[2]);
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  for(const action of ['newPanel','createPanelRightOfSelected','createPanelLeftOfSelected','createStackedPanelAboveSelected','createStackedPanelBelowSelected']) {
   for(const corner of ['Round','Sharp']) {
    const result=await page.evaluate(async ({action,corner})=>{
     const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     const current=app.exposeToFormHandler.getCurrentPanel();
     current.corner=corner;current.borderRadius=1.35;
     const count=app.getPost().panels.length;
     app[action]();
     const added=app.exposeToFormHandler.getCurrentPanel();
     const result={corner:added.corner,radius:added.borderRadius,count:app.getPost().panels.length-count};
     app.undo();await settle();result.undoCount=app.getPost().panels.length-count;
     app.redo();await settle();result.redoCorner=app.exposeToFormHandler.getCurrentPanel().corner;
     return result;
    },{action,corner});
    assert.deepEqual(result,{corner,radius:1.35,count:1,undoCount:0,redoCorner:corner},action);
   }
  }
  assert.deepEqual(errors,[]);
  console.log('New panels inherit sharp/round corners and custom radius; undo/redo preserves them.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
