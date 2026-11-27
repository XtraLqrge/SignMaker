const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(process.argv[2]);await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 await page.locator('#guideArrowConfig').click();await page.locator('[data-tab="sMDiagrammatics"]').click();
 // These fixture coordinates use the historical 1600 × 1000 road graph.
 await page.evaluate(()=>SignMakerDiagrammatics.engine.editSettings(model=>{model.width=40;model.height=25;},{resize:true}));
 const seed=async(reverse=false,turn=1)=>page.evaluate(({reverse,turn})=>{
  const e=SignMakerDiagrammatics.engine,s=e.app.sheets.selected;
  s.roads=[{id:1,lanes:3,laneWidth:12,ends:[{joint:1,sign:1,length:null},{joint:2,sign:1,length:null}]},{id:2,lanes:3,laneWidth:12,arcAngle:90*turn,ends:[{joint:2,sign:1,length:null},{joint:3,sign:1,length:null}]}];
  s.joints=[{id:1,x:250,y:300,root:1,dir:{x:1,y:0},links:[]},{id:2,x:650,y:300,root:1,dir:{x:1,y:0},links:[{a:1,b:2,ai:0,bi:0}]},{id:3,x:950,y:300+300*turn,root:2,dir:{x:0,y:turn},links:[]}];
  if(reverse){for(const r of s.roads){r.ends.reverse();if(r.arcAngle!=null)r.arcAngle=-r.arcAngle;}for(const j of s.joints){j.dir.x*=-1;j.dir.y*=-1;}}
  s.overlapOrder=[];e.app.roadEditor.focusRoad(s.roads[1]);e.commit();
 },{reverse,turn});
 const state=()=>page.evaluate(()=>{
  const e=SignMakerDiagrammatics.engine,s=e.app.sheets.selected,r=s.roads[1],joint=s.joints.find(j=>j.id===2);
  const a=s.joints.find(j=>j.id===r.ends[0].joint),b=s.joints.find(j=>j.id===r.ends[1].joint),arc=e.app.circularArc.geometry(a,b,r.arcAngle),at=r.ends[0].joint===2?0:1;
  const bands=[...e.live.shadowRoot.querySelectorAll('.diagrammaticRoad [data-silhouette]')];
  const edges=s.roads.map(road=>{const d=e.live.shadowRoot.querySelector(`.diagrammaticRoad[data-road-id="${road.id}"] [data-silhouette]`).getAttribute('d');return [...d.matchAll(/[ML]([-\d.e+]+),([-\d.e+]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));});
  // At a 3-lane joint, both pavement corners must coincide in world space.
  const hostEdge=edges[0],arcEdge=edges[1],n=hostEdge.length/2,m=arcEdge.length/2;
  const host=at===0?[hostEdge[n-1],hostEdge[n]]:[hostEdge[0],hostEdge.at(-1)];
  const mouth=at===0?[arcEdge[0],arcEdge.at(-1)]:[arcEdge[m-1],arcEdge[m]];
  return {roads:structuredClone(s.roads),joints:structuredClone(s.joints),tangent:arc.point(at).tangent,heading:joint.dir,radius:arc.radius,gaps:host.map((p,i)=>({x:mouth[i].x-p.x,y:mouth[i].y-p.y})),hostPath:bands[0].getAttribute('d')};
 });
 // Joined ends overlap by a quarter graphic inch each (2.4 sheet px here) along
 // the shared heading, so the corners differ only by that seam-hiding overlap.
 const assertJoin=s=>{assert.ok(s.gaps.every(g=>Math.abs(Math.hypot(g.x,g.y)-2.4)<.01&&Math.abs(g.x*s.heading.y-g.y*s.heading.x)<.01),`pavement corners must meet: ${JSON.stringify(s.gaps)}`);assert.ok(Math.hypot(s.tangent.x-s.heading.x,s.tangent.y-s.heading.y)<1e-6);};
 for(const reverse of [false,true])for(const turn of [1,-1]){
  await seed(reverse,turn);const initial=await state();assertJoin(initial);
  await page.locator('#roadArcRadius').fill('200');await page.locator('#roadArcRadius').press('Tab');
  let resized=await state();assertJoin(resized);assert.ok(Math.abs(resized.radius-400)<.01);assert.equal(resized.hostPath,initial.hostPath);
  await page.locator('#roadArcAngleValue').fill(reverse?String(-60*turn):String(60*turn));await page.locator('#roadArcAngleValue').press('Tab');
  resized=await state();assertJoin(resized);assert.equal(resized.hostPath,initial.hostPath);assert.ok(Math.abs(resized.radius-400)<.01);
 }
 await seed();
 const initial=await state();
 const handle=page.locator('.diagrammaticLiveLayer [aria-label="Arc radius handle"]');
 // Use the same on-screen radius control as the editor, with its keyboard nudge.
 await handle.focus();await page.keyboard.press('ArrowDown');
 const changed=await state();assertJoin(changed);assert.equal(changed.hostPath,initial.hostPath);assert.notEqual(changed.radius,initial.radius);
 await page.locator('#undoButton').click();await page.waitForFunction(j=>JSON.stringify(SignMakerDiagrammatics.engine.app.sheets.selected.joints)===JSON.stringify(j),initial.joints);
 assertJoin(await state());
 await page.evaluate(()=>{const e=SignMakerDiagrammatics.engine;e.app.roadEditor.focusRoad(e.app.sheets.selected.roads[1]);});
 const drag=async(locator,dx,dy)=>{await locator.click({trial:true});const r=await locator.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:6});await page.mouse.up();};
 await drag(handle,12,18);const radiusDragged=await state();assertJoin(radiusDragged);assert.notEqual(radiusDragged.radius,initial.radius);assert.equal(radiusDragged.hostPath,initial.hostPath);
 await drag(page.locator('.diagrammaticLiveLayer .roadNode[data-road="2"][data-end="1"][data-lane="2"]'),20,-15);
 const endDragged=await state();assertJoin(endDragged);assert.equal(endDragged.hostPath,initial.hostPath);
 // A disconnected arc retains StripeMaker's fixed-endpoint radius behavior.
 await seed();await page.evaluate(()=>{const e=SignMakerDiagrammatics.engine,s=e.app.sheets.selected;s.joints.push({...structuredClone(s.joints[1]),id:4,root:2,links:[]});s.roads[1].ends[0].joint=4;s.joints[1].links=[];e.app.roadEditor.focusRoad(s.roads[1]);e.commit();});
 const freeBefore=await state();
 await page.locator('#roadArcRadius').fill('200');await page.locator('#roadArcRadius').press('Tab');
 const freeAfter=await state();assert.ok(Math.abs(freeAfter.radius-400)<.01);
 assert.deepEqual(freeAfter.joints.map(j=>[j.x,j.y]),freeBefore.joints.map(j=>[j.x,j.y]));
 assert.deepEqual(errors,[]);console.log('Attached circular arc radius/angle edits preserve tangent, pavement corners, host geometry, and undo for both ends and turn directions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
