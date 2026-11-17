const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await webkit.launch(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href);
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  await page.evaluate(()=>{
   document.getElementById('closeWelcome')?.click();
   const b=app.exposeToFormHandler;b.addAPLArrow('UP');b.addAPLArrow('UP');
   const doc=JSON.parse(app.serializeSignJSON());doc.post.panels.push(JSON.parse(JSON.stringify(doc.post.panels[0])));doc.post.panels[1].stackedWithPrevious=true;app.importSignJSON(JSON.stringify(doc));formHandler.updateForm();
  });
  const result=await page.evaluate(()=>{
   const fields=[...document.querySelectorAll('input[type="checkbox"]')];
   const failures=[];const records=[];
   for(const field of fields){
    const proxy=field.id&&document.querySelector(`[data-shield-checkbox-target="${field.id}"]`);
    if(!field.labels.length){if(!field.hidden||!proxy)failures.push('Missing label: '+field.id);continue;}
    for(const label of field.labels){
     if(label.control!==field)failures.push('Wrong label association: '+field.id);
     records.push({label:label.cloneNode(true),field:field.cloneNode(),name:field.id||label.textContent.trim()});
    }
   }
   const host=document.createElement('div');document.body.append(host);
   for(const [index,record] of records.entries()){
    const {label,field,name}=record;host.replaceChildren();
    label.removeAttribute('id');label.querySelectorAll('input,select,textarea,button').forEach(e=>e.remove());
    field.id='audit-checkbox-'+index;field.disabled=false;field.hidden=false;field.checked=false;
    label.htmlFor=field.id;host.append(label,field);
    if(getComputedStyle(label).pointerEvents==='none')failures.push('Label rejects pointer clicks: '+name);
    let changes=0;field.addEventListener('change',()=>changes++);
    label.click();if(!field.checked||changes!==1)failures.push('Does not toggle once: '+name);
    label.click();if(field.checked||changes!==2)failures.push('Does not toggle back: '+name);
    field.disabled=true;label.click();if(field.checked||changes!==2)failures.push('Disabled field toggled: '+name);
   }
   host.remove();return {fields:fields.length,labels:records.length,failures};
  });
  assert.deepEqual(result.failures,[]);
  // Exercise real labels with app handlers and saved preferences, using pointer
  // clicks rather than programmatic checkbox activation.
  await page.locator('#appSettingsConfig').click();
  const field=page.locator('#appShrinkSignsForPanels');
  const initial=await field.isChecked();
  await page.locator('label[for="appShrinkSignsForPanels"]').click();
  assert.equal(await field.isChecked(),!initial);
  assert.equal(await page.evaluate(()=>localStorage.getItem('signMaker.shrinkSignsForPanels')),String(!initial));
  await page.locator('label[for="appShrinkSignsForPanels"]').click();
  assert.equal(await field.isChecked(),initial);
  const copy=page.locator('#copySignsOnly');const copyBefore=await copy.isChecked();
  await page.locator('label[for="copySignsOnly"]').click();
  assert.equal(await page.evaluate(()=>app.getPost().copySignsOnly),!copyBefore);
  await page.evaluate(()=>app.undo());
  await page.waitForFunction(expected=>app.getPost().copySignsOnly===expected,copyBefore);
  assert.deepEqual(errors,[]);
  console.log(`Passed: ${result.fields} checkbox controls audited, ${result.labels} native label toggles, disabled behavior, real settings-label pointer clicks, saved preferences, and undo. Hidden shield toggles retain their existing button controls.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
