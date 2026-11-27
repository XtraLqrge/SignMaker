/* Optional real-browser regression and timing capture, run on your computer. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const url=process.argv.slice(2).find(argument=>!argument.startsWith('--'))||'http://localhost:8765';
const mobile=process.argv.includes('--mobile')||process.env.MOBILE==='1';
const viewport=mobile?{width:393,height:852}:{width:1440,height:1000};
(async()=>{
  const browser=await chromium.launch({headless:process.env.HEADED!=='1'});
  const errors=[],failedRequests=[];
  const output=path.resolve('browser-results',mobile?'mobile':'desktop');fs.mkdirSync(output,{recursive:true});
  const context=await browser.newContext({viewport,...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:3}:{})});
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
    if(mobile){
      await page.waitForFunction(()=>window.SignMakerMobile?.active===true,null,{timeout:10000});
      assert.equal(await page.locator('html').getAttribute('data-mobile-ui'),'');
      const toolbar=await page.locator('#sMConfigBar').boundingBox();
      assert.ok(toolbar.x>=0&&toolbar.x+toolbar.width<=viewport.width+1,'Phone toolbar fits the viewport');
      assert.ok(Math.abs(toolbar.y+toolbar.height-viewport.height)<=1,'Phone toolbar sits at the bottom');
      assert.ok(toolbar.height<100,'Phone toolbar uses one compact row');
      assert.equal(await page.locator('#mobileWorkspace main.mobileCanvas').count(),1);
      assert.equal(await page.locator('#panelContainer .panel:visible').count(),1,'One panel is visible');
    }
    assert.equal(await page.locator('#presetShieldList img').count(),0,'Closed shield gallery loads no thumbnails');
    assert.equal(await page.locator('input > option').count(),0,'Hidden asset inputs have no option children');
    assert.equal(await page.locator('[data-startup-inert]').count(),0,'The initialized editor is interactive');
    const metrics=await page.evaluate(()=>({
      url:location.href,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),
      paint:performance.getEntriesByType('paint').map(e=>e.toJSON()),
      phases:performance.getEntriesByType('measure').filter(e=>e.name.startsWith('signmaker:')).map(e=>e.toJSON()),
      longTasks:window.__longTasks,lcp:window.__lcp,
      resources:performance.getEntriesByType('resource').map(e=>e.toJSON()),
      domNodes:document.querySelectorAll('*').length,pendingPickers:window.SignMakerEditorRuntime.pendingCount(),
      instantiated:{fonts:document.querySelectorAll('.fontPicker').length,colors:document.querySelectorAll('.colorPicker').length,native:window.nativeSelectPickers.size}
    }));
    fs.writeFileSync(path.join(output,'startup.json'),JSON.stringify(metrics,null,2));
    assert.ok(!metrics.resources.some(entry=>/ShieldFallbacks\.[a-f0-9]+\.js/.test(entry.name)),'Backup shield artwork is absent from normal startup');
    assert.ok(!metrics.resources.some(entry=>/\/icons\/AIRPORT\.svg/.test(entry.name)),'Unused exit profiles do not prepare icons');
    await page.evaluate(()=>document.getElementById('closeWelcome')?.click());
    const openMenu=async id=>{
      if(await page.locator('#sMConfigBar').getAttribute('data-current-menu')===id)return;
      if(mobile&&!await page.locator('#'+id).isVisible())await page.locator('#mobileMore').click();
      await page.locator('#'+id).click();
    };
    await openMenu('subPanelConfig');
    if(mobile){
      const preview=await page.locator('main.mobileCanvas').boundingBox();
      const editor=await page.locator('#mobileEditor').boundingBox();
      assert.ok(editor.y>=preview.y+preview.height,'Editor follows the panel in the page');
      assert.equal(await page.locator('#mobileEditor .subPanelConfig').isVisible(),true);
    }
    assert.equal(await page.locator('#SMSPElementLabel').evaluate(element=>element.parentElement.classList.contains('SMSPNewElementHolder')),true,'Selected block label belongs to the action bar');
    const caret=page.locator('.blockTypeInlinePickerTrigger>.shieldPickerTriggerCaret').first();
    assert.ok(await caret.evaluate(element=>parseFloat(getComputedStyle(element).width)<=parseFloat(getComputedStyle(document.documentElement).fontSize)*0.81),'Element-label chevrons stay compact');
    if(!mobile){
      const label=await page.locator('#SMSPElementLabel').boundingBox();
      const picker=await page.locator('.SMSPNewElementHolder .blockTypePickerTrigger').boundingBox();
      assert.ok(Math.abs(label.y+label.height/2-picker.y-picker.height/2)<=3,'Selected block label aligns with the controls');
    }
    const font=page.locator('#sdCtrlText_fontFamily + .fontPicker .fontPickerTrigger');
    await font.click();
    const menu=page.locator('.fontPickerMenu.open');await menu.waitFor({state:'visible'});
    const bounds=await menu.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height+1);
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1);
    await menu.evaluate(element=>{element.scrollTop=element.scrollHeight;});assert.ok(await menu.evaluate(element=>element.scrollTop)>0);
    await font.click();await menu.waitFor({state:'hidden'});
    // Both collapsing the type picker and clicking outside it must close it.
    const type=page.locator('.blockTypeInlinePickerTrigger').first();
    await type.click();await page.locator('.blockTypePickerPopover.open').waitFor({state:'visible'});
    await type.click();await page.locator('.blockTypePickerPopover.open').waitFor({state:'hidden'});
    await type.click();await page.locator('#sMSPCreateRow').click();await page.locator('.blockTypePickerPopover.open').waitFor({state:'hidden'});
    await openMenu('appSettingsConfig');
    for(const tab of mobile?['sMAppSettings','sMDefaults']:['sMAppSettings','sMDefaults','sMAppShortcuts']){
      await page.locator(`#settings22Modal [data-tab="${tab}"]`).click();
      assert.equal(await page.locator('#settings22Modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,tab+' overflows');
      await page.locator('#settings22Modal').screenshot({path:path.join(output,tab+'.png')});
    }
    await page.locator('#settings22Modal [data-tab="sMAppSettings"]').click();
    await page.locator('#appDropdownAnimations').uncheck();
    assert.equal(await page.locator('html').getAttribute('data-dropdown-animations'),'false');
    await page.locator('#appDropdownAnimations').check();
    let movedOffset;
    if(!mobile){
    // Pointer dragging supports one panel as well as multi-panel posts.
    await page.evaluate(()=>{
      app.getPost().polePosition='Right';
      app.exposeToFormHandler.redraw();
      app.newPanel();
    });
    await page.locator('#hideConfig').click();
    await page.waitForTimeout(400);
    const firstPanel=page.locator('#panel0 > .signContainer');
    const start=await firstPanel.boundingBox();
    const startOffset=await page.evaluate(()=>app.getPost().panels[0].verticalOffsetRem);
    const x=start.x+start.width/2,y=start.y+start.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x,y+40,{steps:8});await page.mouse.up();
    movedOffset=await page.evaluate(()=>app.getPost().panels[0].verticalOffsetRem);
    assert.notEqual(movedOffset,startOffset);assert.ok(Math.abs(movedOffset)<=6);
    await page.evaluate(()=>app.undo());await page.waitForFunction(offset=>app.getPost().panels[0].verticalOffsetRem===offset,startOffset);
    await page.evaluate(()=>app.redo());await page.waitForFunction(offset=>app.getPost().panels[0].verticalOffsetRem===offset,movedOffset);
    }
    const panelsBefore=await page.evaluate(()=>app.getPost().panels.length);
    await page.evaluate(()=>app.newPanel());assert.equal(await page.evaluate(()=>app.getPost().panels.length),panelsBefore+1);
    if(mobile){
      await page.waitForFunction(()=>document.querySelector('#panelContainer .mobileCurrentPanel')?.dataset.panelIndex===String(app.exposeToFormHandler.vars.currentlySelectedPanelIndex));
      assert.equal(await page.locator('#panelContainer .panel:visible').count(),1);
      await page.locator('#panelContainer .mobileCurrentPanel .subPanelDisplay').first().click();
      assert.equal(await page.locator('#sMConfigBar').getAttribute('data-current-menu'),'subPanelConfig');
    }
    await page.evaluate(()=>app.undo());await page.waitForFunction(count=>app.getPost().panels.length===count,panelsBefore);
    await page.evaluate(()=>app.redo());await page.waitForFunction(count=>app.getPost().panels.length===count,panelsBefore+1);
    await page.reload();await ready();assert.equal(await page.evaluate(()=>app.getPost().panels.length),panelsBefore+1);
    if(!mobile)assert.equal(await page.evaluate(()=>app.getPost().panels[0].verticalOffsetRem),movedOffset,'Panel height survives reload');
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed. Timings and screenshots: '+output);
  }finally{
    fs.writeFileSync(path.join(output,'errors.json'),JSON.stringify({errors,failedRequests},null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
