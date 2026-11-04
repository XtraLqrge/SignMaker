/* Optional real-browser regression and timing capture, run on your computer. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const url=process.argv[2]||'http://localhost:8765';
(async()=>{
  const browser=await chromium.launch({headless:process.env.HEADED!=='1'});
  const errors=[],failedRequests=[];
  const output=path.resolve('browser-results');fs.mkdirSync(output,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),reason:request.failure()?.errorText}));
  await page.addInitScript(()=>{
    window.__longTasks=[];window.__lcp=[];
    for(const [type,target] of [['longtask','__longTasks'],['largest-contentful-paint','__lcp']]){
      try{new PerformanceObserver(list=>window[target].push(...list.getEntries().map(entry=>entry.toJSON()))).observe({type,buffered:true});}catch{}
    }
  });
  try{
    await page.goto(url,{waitUntil:'load'});
    const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',null,{timeout:60000});
    await ready();
    assert.equal(await page.locator('#presetShieldList img').count(),0,'Closed shield gallery loads no thumbnails');
    const metrics=await page.evaluate(()=>({
      url:location.href,userAgent:navigator.userAgent,
      navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),
      paint:performance.getEntriesByType('paint').map(e=>e.toJSON()),
      phases:performance.getEntriesByType('measure').filter(e=>e.name.startsWith('signmaker:')).map(e=>e.toJSON()),
      longTasks:window.__longTasks,lcp:window.__lcp,
      resources:performance.getEntriesByType('resource').map(e=>e.toJSON()),
      domNodes:document.querySelectorAll('*').length,pendingPickers:window.SignMakerEditorRuntime.pendingCount(),
      instantiated:{fonts:document.querySelectorAll('.fontPicker').length,colors:document.querySelectorAll('.colorPicker').length,native:window.nativeSelectPickers.size}
    }));
    fs.writeFileSync(path.join(output,'startup.json'),JSON.stringify(metrics,null,2));
    await page.evaluate(()=>document.getElementById('closeWelcome')?.click());
    const openMenu=async id=>{
      if(await page.locator('#sMConfigBar').getAttribute('data-current-menu')!==id)await page.locator('#'+id).click();
    };
    await openMenu('subPanelConfig');
    const font=page.locator('#sdCtrlText_fontFamily + .fontPicker .fontPickerTrigger');
    await font.click();
    const menu=page.locator('.fontPickerMenu.open');await menu.waitFor({state:'visible'});
    const bounds=await menu.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=1001);
    await menu.evaluate(element=>{element.scrollTop=element.scrollHeight;});assert.ok(await menu.evaluate(element=>element.scrollTop)>0);
    await font.click();await menu.waitFor({state:'hidden'});
    // Both collapsing the type picker and clicking outside it must close it.
    const type=page.locator('.blockTypeInlinePickerTrigger').first();
    await type.click();await page.locator('.blockTypePickerPopover.open').waitFor({state:'visible'});
    await type.click();await page.locator('.blockTypePickerPopover.open').waitFor({state:'hidden'});
    await type.click();await page.locator('#sMSPCreateRow').click();await page.locator('.blockTypePickerPopover.open').waitFor({state:'hidden'});
    await openMenu('appSettingsConfig');
    for(const tab of ['sMAppSettings','sMDefaults','sMAppShortcuts']){
      await page.locator(`#settings22Modal [data-tab="${tab}"]`).click();
      assert.equal(await page.locator('#settings22Modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,tab+' overflows');
      await page.locator('#settings22Modal').screenshot({path:path.join(output,tab+'.png')});
    }
    await page.locator('#settings22Modal [data-tab="sMAppSettings"]').click();
    await page.locator('#appDropdownAnimations').uncheck();
    assert.equal(await page.locator('html').getAttribute('data-dropdown-animations'),'false');
    await page.locator('#appDropdownAnimations').check();
    const panelsBefore=await page.evaluate(()=>app.getPost().panels.length);
    await page.evaluate(()=>app.newPanel());assert.equal(await page.evaluate(()=>app.getPost().panels.length),panelsBefore+1);
    await page.evaluate(()=>app.undo());await page.waitForFunction(count=>app.getPost().panels.length===count,panelsBefore);
    await page.evaluate(()=>app.redo());await page.waitForFunction(count=>app.getPost().panels.length===count,panelsBefore+1);
    await page.reload();await ready();assert.equal(await page.evaluate(()=>app.getPost().panels.length),panelsBefore+1);
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed. Timings and screenshots: '+output);
  }finally{
    fs.writeFileSync(path.join(output,'errors.json'),JSON.stringify({errors,failedRequests},null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
