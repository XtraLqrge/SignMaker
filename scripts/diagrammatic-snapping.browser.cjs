const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]);await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 await page.locator('#guideArrowConfig').click();await page.locator('[data-tab="sMDiagrammatics"]').click();
 const position=p=>page.evaluate(p=>{const e=SignMakerDiagrammatics.engine,s=e.app.sheets.selected,r=e.live.getBoundingClientRect();return{x:r.x+p.x*r.width/s.width,y:r.y+p.y*r.height/s.height};},p);
 const point=async p=>{const q=await position(p);await page.mouse.click(q.x,q.y);};
 const preview=()=>page.locator('.diagrammaticLiveLayer .diagrammaticRoad.preview [data-silhouette]').first().getAttribute('d');
 const angleOf=d=>{const p=[...d.matchAll(/[ML]([-\d.e+]+),([-\d.e+]+)/g)].map(m=>({x:+m[1],y:+m[2]})),n=p.length/2;return Math.atan2((p[n-1].y+p[n].y-p[0].y-p.at(-1).y)/2,(p[n-1].x+p[n].x-p[0].x-p.at(-1).x)/2);};
 const assertAngle=(angle,expected)=>assert.ok(Math.abs(Math.atan2(Math.sin(angle-expected),Math.cos(angle-expected)))<1e-6,`${angle} must snap to ${expected}`);
 for(let k=0;k<8;k++){
  await page.evaluate(()=>{const e=SignMakerDiagrammatics.engine,s=e.app.sheets.selected;s.roads=[];s.joints=[];s.gores=[];e.app.roadEditor.focusRoad(null);e.commit();});
  await page.locator('.diagrammaticEngineControls #addElement').click();await point({x:800,y:500});
  const expected=k*Math.PI/4,raw=expected+.16,target=await position({x:800+220*Math.cos(raw),y:500+220*Math.sin(raw)});
  await page.mouse.move(target.x,target.y);await page.locator('.diagrammaticLiveLayer .diagrammaticRoad.preview').waitFor();
  assertAngle(angleOf(await preview()),expected);
  if(k%2)await page.keyboard.down('Shift');await page.mouse.click(target.x,target.y);if(k%2)await page.keyboard.up('Shift');await page.keyboard.press('Escape');
  const angle=await page.evaluate(()=>{const s=SignMakerDiagrammatics.engine.app.sheets.selected,r=s.roads[0],a=s.joints.find(j=>j.id===r.ends[0].joint),b=s.joints.find(j=>j.id===r.ends[1].joint);return Math.atan2(b.y-a.y,b.x-a.x);});
  assertAngle(angle,expected);
 }
 assert.deepEqual(errors,[]);console.log('All eight drawing directions snap in both live preview and committed geometry, including Shift.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
