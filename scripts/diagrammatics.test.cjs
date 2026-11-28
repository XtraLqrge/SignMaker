const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({structuredClone,window:{addEventListener(){}}});vm.runInContext(fs.readFileSync('public/js/Diagrammatics.js','utf8'),c);
test('road graph survives normalization without losing arbitrary StripeMaker geometry',()=>{
 const graph={roads:[{id:7,lanes:3,ends:[{joint:1},{joint:2}],tapers:{'0:1':{mode:'taper',length:350}},arcAngle:60}],joints:[{id:1,links:[{a:7,b:9,ai:1,bi:0}]}]};
 const saved=c.window.SignMakerDiagrammatics.normalize({roadGraph:graph});
 assert.deepEqual(JSON.parse(JSON.stringify(saved.roadGraph)),graph);saved.roadGraph.roads[0].lanes=4;assert.equal(graph.roads[0].lanes,3);
});
test('the road engine bundles only the trimmed diagrammatic sources',()=>{
 const source=JSON.parse(fs.readFileSync('public/diagrammatics/stripe/SOURCE.json'));
 for(const file of source.files)assert.ok(fs.existsSync('public/diagrammatics/stripe/'+file),file);
 const controls=fs.readFileSync('public/diagrammatics/controls.source.html','utf8');
 for(const id of ['markingsEditor','bikeSetup','medianFields','goreFields','roadOpposite','laneType'])assert.ok(!controls.includes(`id="${id}"`),id);
 const engine=require('./build-diagrammatics.cjs')(process.cwd());
 for(const hook of ['longitudinal','intersections','markings','levels'])assert.ok(!engine.includes('StripeMaker.'+hook),hook);
});
test('independent diagrammatic dimensions preserve legacy proportions and gap preference',()=>{
 const normalize=c.window.SignMakerDiagrammatics.normalize;
 assert.equal(normalize({width:48}).height,30);
 assert.equal(normalize({width:48,height:18}).height,18);
 assert.equal(normalize({}).consistentGapsOnTurns,true);
 assert.equal(normalize({consistentGapsOnTurns:false}).consistentGapsOnTurns,false);
});
test('Panel Style fixes either diagrammatic axis without replacing the saved drawing size',()=>{
 const editor=require('./fixtures/diagrammatic-editor.cjs')({withStarter:true});
 const width=editor.doc.getElementById('diagrammaticWidth'),height=editor.doc.getElementById('diagrammaticHeight');
 editor.setPanelSize(50,null);
 assert.equal(width.disabled,true);
 assert.equal(height.disabled,false);
 assert.equal(Number(width.value),50);
 assert.equal(editor.engine.app.sheets.selected.width,(50-.4)*40);
 assert.equal(editor.engine.app.sheets.selected.height,25*40);
 assert.deepEqual(editor.host.querySelectorAll('.diagrammaticPanelHandle').map(handle=>handle.dataset.edge),['n','s']);
 editor.setPanelSize(50,32);
 assert.equal(height.disabled,true);
 assert.equal(editor.host.querySelectorAll('.diagrammaticPanelHandle').length,0);
 assert.equal(editor.engine.app.sheets.selected.height,(32-.4)*40);
 editor.engine.editSettings(model=>{model.arrowHeadSize=125;});
 assert.equal(editor.sign.diagrammatic.roadGraph.width,40*40);
 assert.equal(editor.sign.diagrammatic.roadGraph.height,25*40);
 editor.setPanelSize(null,null);
 assert.equal(width.disabled,false);
 assert.equal(height.disabled,false);
 assert.equal(editor.engine.app.sheets.selected.width,40*40);
 assert.equal(editor.engine.app.sheets.selected.height,25*40);
});
test('turn dashes share right-edge stations across lanes of different lengths',()=>{
 const draw=c.window.SignMakerDiagrammatics.alignedDashes;
 const right=[{x:0,y:0},{x:20,y:0},{x:20,y:20}];
 const inner=[{x:0,y:5},{x:15,y:5},{x:15,y:20}];
 assert.equal(draw(right,right,10),'M0,0L10,0 M20,0L20,10 ');
 assert.equal(draw(inner,right,10),'M0,5L7.5,5 M15,5L15,12.5 ');
 assert.equal(draw([{x:0,y:0},{x:0,y:0}], [{x:0,y:0},{x:0,y:0}],10),'');
});
test('dashes continue from the roads feeding into a joined road',()=>{
 const draw=c.window.SignMakerDiagrammatics.alignedDashes,line=[{x:0,y:0},{x:30,y:0}];
 // 15 of a 10-on/10-off pattern already ran upstream: finish that gap first.
 assert.equal(draw(line,line,10,15),'M5,0L15,0 M25,0L30,0 ');
});
test('old diagrams retain their drawing scale when independent dimensions are introduced',()=>{
 const model=c.window.SignMakerDiagrammatics.normalize({width:48,roadGraph:{width:1600,height:1000}});
 assert.equal(model.width*model.unitsPerRem,1600);assert.ok(Math.abs(model.height*model.unitsPerRem-1000)<1e-9);
});
test('diagrammatic dimensions accept sizes below the old limits',()=>{
 const model=c.window.SignMakerDiagrammatics.normalize({width:4,height:3});
 assert.equal(model.width,4);assert.equal(model.height,3);
});
test('diagrammatic JSON round-trips the road graph and drawing size',()=>{
 const {toJSON,fromJSON}=c.window.SignMakerDiagrammatics;
 const roadGraph={roads:[{id:3,lanes:2,laneWidth:12,arcAngle:45,arrowHeadSize:140,ends:[{joint:1,sign:1,length:null},{joint:2,sign:1,length:null}]}],joints:[{id:1,x:10,y:20,links:[]},{id:2,x:300,y:40,links:[]}],overlapOrder:[3,9],autoTapers:true};
 const imported=fromJSON(toJSON({width:36,height:20,unitsPerRem:40,consistentGapsOnTurns:false,arrowHeadSize:125,straightenOnShiftClick:false,roadGraph,artwork:'<svg/>'}));
 assert.deepEqual(JSON.parse(JSON.stringify(imported)),{version:2,width:36,height:20,consistentGapsOnTurns:false,arrowHeadSize:125,straightenOnShiftClick:false,unitsPerRem:40,artwork:'',roadGraph:{...roadGraph,overlapOrder:[3]}});
});

test('larger and smaller arrowheads keep their connection to the stem',()=>{
 const {arrowHeadPath,normalize}=c.window.SignMakerDiagrammatics;
 assert.equal(normalize({}).straightenOnShiftClick,true);
 assert.equal(normalize({}).arrowHeadSize,100);
 assert.match(arrowHeadPath(50),/^M202\.043,478 /);
 assert.match(arrowHeadPath(200),/^M202\.043,478 /);
 assert.match(arrowHeadPath(50),/L320\.543,239 /);
 assert.match(arrowHeadPath(200),/L320\.543,-478 /);
});

test('assemblies grow to fit new text and can be narrowed again',()=>{
 const {fitAssembly}=c.window.SignMakerDiagrammatics;
 const bounds={x:.7,y:.1,width:.2,height:.3};
 assert.equal(fitAssembly(bounds,.4,.4),bounds);
 const expanded=fitAssembly(bounds,.6,.4);
 assert.equal(expanded.width,.6);
 assert.equal(expanded.x,.4);
 assert.equal(expanded.height,bounds.height);
 const narrowed={...expanded,width:.25};
 assert.equal(fitAssembly(narrowed,.6,.6),narrowed);
 assert.equal(fitAssembly(narrowed,.7,.6).width,.7);
});
test('diagrammatic JSON import rejects files that are not a usable road graph',()=>{
 const {fromJSON}=c.window.SignMakerDiagrammatics,file=graph=>JSON.stringify({format:'signmaker-diagrammatic',version:1,roadGraph:graph});
 assert.throws(()=>fromJSON('{'),/not valid JSON/);
 assert.throws(()=>fromJSON(JSON.stringify({panels:[]})),/not a diagrammatic export/);
 assert.throws(()=>fromJSON(file({roads:[]})),/no road graph/);
 assert.throws(()=>fromJSON(file({roads:[{id:1,lanes:1,laneWidth:12,ends:[{joint:1},{joint:5}]}],joints:[{id:1,x:0,y:0}]})),/invalid arrow stem/);
 assert.throws(()=>fromJSON(file({roads:[],joints:[{id:1,x:'0',y:0}]})),/invalid node/);
});

test('drawing edits commit once and undo or redo restores the engine without adding a new edit',()=>{
  const editor=require('./fixtures/diagrammatic-editor.cjs')();
  const {engine,roadEditor,workspace,controls,previous,pointer}=editor;
  const {Event:DomEvent}=require('./fixtures/mobile-dom.cjs');
  controls.getElementById('addRoad').click();
  for(const [x,y]of [[170,370],[170,190]]){
    pointer(workspace,'pointerdown',{clientX:x,clientY:y});
    pointer(workspace,'pointerup',{clientX:x,clientY:y});
    pointer(workspace,'click',{clientX:x,clientY:y});
  }
  controls.getElementById('addRoad').click();
  assert.equal(editor.sign.diagrammatic.roadGraph.roads.length,1);
  assert.equal(previous.length,1,'Drawing a stem produces one history action');
  assert.equal(roadEditor.diagnostics().selectedRoad.id,1);
  const slider=controls.getElementById('roadArrowHeadSize');
  for(const value of [125,150,175]){
    slider.value=String(value);slider.dispatchEvent(new DomEvent('input'));
  }
  assert.equal(previous.length,1);
  slider.dispatchEvent(new DomEvent('change'));
  assert.equal(previous.length,2);
  assert.equal(editor.sign.diagrammatic.roadGraph.roads[0].arrowHeadSize,175);
  const angle=controls.getElementById('roadArcAngle');
  angle.value='60';angle.dispatchEvent(new DomEvent('input'));angle.dispatchEvent(new DomEvent('change'));
  assert.equal(editor.sign.diagrammatic.roadGraph.roads[0].arcAngle,60);
  const nodes=()=>workspace.querySelectorAll('.roadNode').filter(node=>!node.hidden&&Number(node.dataset.road)===1);
  for(const [end,shiftKey]of [['0',false],['1',true]]){
    const control=nodes().find(node=>String(node.dataset.end)===end);assert.ok(control);
    pointer(control,'pointerdown',{shiftKey});pointer(control,'pointerup',{shiftKey});
  }
  assert.equal(editor.sign.diagrammatic.roadGraph.roads[0].arcAngle,0);
  assert.equal(previous.length,4,'Endpoint selection is not an edit; straightening is one edit');
  editor.undo();
  assert.equal(editor.sign.diagrammatic.roadGraph.roads[0].arcAngle,60);
  assert.equal(roadEditor.diagnostics().selectedRoad.arcAngle,60);
  editor.undo();
  assert.equal(editor.sign.diagrammatic.roadGraph.roads[0].arrowHeadSize,175);
  editor.redo();
  assert.equal(editor.sign.diagrammatic.roadGraph.roads[0].arcAngle,60);
  editor.redo();
  assert.equal(editor.sign.diagrammatic.roadGraph.roads[0].arcAngle,0);
  assert.equal(previous.length,4);
  engine.editSettings(model=>{model.arrowHeadSize=120;});
  assert.equal(editor.sign.diagrammatic.arrowHeadSize,120);
  assert.equal(previous.length,5);
  editor.undo();
  assert.equal(editor.sign.diagrammatic.arrowHeadSize,100);
  editor.redo();
  assert.equal(editor.sign.diagrammatic.arrowHeadSize,120);
});

test('the assembly receives the first click and only the second click opens its subpanel',()=>{
  const editor=require('./fixtures/diagrammatic-editor.cjs')();
  const {context,sign,host,make,doc}=editor;
  vm.runInContext(fs.readFileSync('public/js/SpecialPanelLayout.js','utf8'),context);
  sign.subPanels.push({shields:[],diagrammaticBounds:{x:.3,y:.2,width:.13,height:.25},blockElements:{
    createElement(){const text=make('div');text.textContent='A longer destination name';return text;}
  }});
  const selections=[];
  context.window.SignMakerSpecialPanelLayout.render({mode:'diagrammatic',panel:{sign},index:0,
    signElmt:host,createShield(){},markSelectedRenderedSubpanel(){},bindRenderedBlockSelection(){},
    selectRenderedPanelArea:selection=>{
      selections.push(selection.menu);
      doc.getElementById('sMConfigBar').dataset.currentMenu=selection.menu==='subpanel'?'subPanelConfig':'guideArrowConfig';
    }
  });
  const assembly=host.querySelector('.diagrammaticSubpanel');
  assert.ok(parseFloat(assembly.style.width)>13,'The assembly grows to the rendered text width');
  assembly.click();
  assert.deepEqual(selections,['guideArrows']);
  assert.ok(assembly.classList.contains('diagrammaticAssemblySelected'));
  assembly.click();
  assert.deepEqual(selections,['guideArrows','subpanel']);
});

test('new diagrams start smaller while a saved drawing keeps its legacy viewport',()=>{
  const normalize=c.window.SignMakerDiagrammatics.normalize;
  assert.equal(normalize({}).width,24);
  assert.equal(normalize({}).height,15);
  assert.equal(normalize({roadGraph:{width:1600,height:1000}}).width,40);
});

test('drawing from the end of an existing curved stem preserves its outline and angle',()=>{
  const {roadEditor,engine,controls,workspace,pointer}=require('./fixtures/diagrammatic-editor.cjs')();
  const {Event:DomEvent}=require('./fixtures/mobile-dom.cjs');
  const click=(x,y)=>{for(const type of ['pointerdown','pointerup','click'])pointer(workspace,type,{clientX:x,clientY:y});};
  controls.getElementById('addRoad').click();
  click(170,370);click(170,190);
  controls.getElementById('addRoad').click();
  const angle=controls.getElementById('roadArcAngle');
  angle.value='60';angle.dispatchEvent(new DomEvent('input'));angle.dispatchEvent(new DomEvent('change'));
  const sheet=engine.app.sheets.selected;
  const points=()=>workspace.querySelector('.diagrammaticRoad[data-road-id="1"] [data-silhouette]').getAttribute('d');
  const previous=points(),end=sheet.joints.find(j=>j.id===sheet.roads[0].ends[1].joint);
  controls.getElementById('addRoad').click();click(end.x/2,end.y/2);click(335,95);
  controls.getElementById('addRoad').click();
  assert.equal(sheet.roads.length,2);
  assert.ok(sheet.roads[1].ends.some(e=>e.joint===end.id),'New stem joins the old one');
  assert.equal(sheet.roads[0].arcAngle,60);
  const numbers=path=>path.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
  const a=numbers(previous),b=numbers(points());
  assert.equal(a.length,b.length);
  // The renderer extends the last edge points slightly to hide a joined seam.
  assert.ok(a.every((n,i)=>Math.abs(n-b[i])<1e-6||i>=a.length/2-2&&i<a.length/2+2));
  assert.ok(roadEditor.diagnostics().selectedRoad);
});

test('Shift-click straightens a connected path across segments as one edit',()=>{
  const editor=require('./fixtures/diagrammatic-editor.cjs')();
  const {engine,roadEditor,controls,workspace,previous,pointer}=editor;
  const click=(x,y)=>{for(const type of ['pointerdown','pointerup','click'])pointer(workspace,type,{clientX:x,clientY:y});};
  controls.getElementById('addRoad').click();
  click(170,370);click(170,190);click(360,120);
  controls.getElementById('addRoad').click();
  const sheet=engine.app.sheets.selected;
  const [start,finish]=sheet.roads;
  const node= (road,end,shiftKey=false) => {
    const button=workspace.querySelectorAll('.roadNode').find(n=>!n.hidden&&Number(n.dataset.road)===road.id&&Number(n.dataset.end)===end);
    assert.ok(button);
    for(const type of ['pointerdown','pointerup'])pointer(button,type,{shiftKey});
  };
  assert.equal(start.ends[1].joint,finish.ends[0].joint);
  const count=previous.length;
  const original=JSON.stringify(editor.sign.diagrammatic.roadGraph);
  roadEditor.focusRoad(start);
  node(start,0);
  node(finish,1,true);
  assert.deepEqual(Array.from(sheet.roads,r=>r.arcAngle),[0,0]);
  const joint=(road,end)=>sheet.joints.find(j=>j.id===road.ends[end].joint);
  const a=joint(start,0),b=joint(start,1),d=joint(finish,1);
  assert.ok(Math.abs((d.x-a.x)*(b.y-a.y)-(d.y-a.y)*(b.x-a.x))<1e-6);
  assert.equal(previous.length,count+1);
  editor.undo();
  assert.equal(JSON.stringify(editor.sign.diagrammatic.roadGraph),original);
});

test('click and drag placement generate usable subpanel bounds',()=>{
  const {controls,workspace,pointer,placements}=require('./fixtures/diagrammatic-editor.cjs')();
  const {Event:DomEvent}=require('./fixtures/mobile-dom.cjs');
  const menu=controls.getElementById('elementToAdd'),add=controls.getElementById('addElement');
  menu.value='subpanel';menu.dispatchEvent(new DomEvent('change'));
  add.click();pointer(workspace,'pointerdown',{clientX:400,clientY:200});pointer(workspace,'pointerup',{clientX:400,clientY:200});
  assert.equal(placements.length,1);
  assert.equal(placements[0].width,.15);
  assert.equal(placements[0].height,.12);
  add.click();pointer(workspace,'pointerdown',{clientX:80,clientY:100});
  pointer(workspace,'pointermove',{clientX:240,clientY:225});pointer(workspace,'pointerup',{clientX:240,clientY:225});
  assert.deepEqual(JSON.parse(JSON.stringify(placements[1])),{x:.1,y:.2,width:.2,height:.25});
});

test('panel handles resize the drawing, support undo, and keep the current zoom',()=>{
  const editor=require('./fixtures/diagrammatic-editor.cjs')();
  const {engine,host,doc,previous,pointer}=editor;
  engine.app.sheets.zoomBy(1.25);
  const world=doc.getElementById('diagrammaticPreviewWorld'),transform=world.style.transform;
  assert.match(transform,/scale\(1\.25\)/);
  const right=host.querySelector('.diagrammaticPanelHandle[data-edge="e"]');
  pointer(right,'pointerdown',{clientX:800,clientY:250});
  pointer(right,'pointermove',{clientX:880,clientY:250});
  assert.equal(host.style.width,'44rem');
  assert.equal(editor.sign.diagrammatic.width,40);
  pointer(right,'pointerup',{clientX:880,clientY:250});
  assert.equal(editor.sign.diagrammatic.width,44);
  assert.equal(editor.sign.diagrammatic.roadGraph.width,1760);
  assert.equal(world.style.transform,transform);
  assert.equal(previous.length,1);
  editor.undo();
  assert.equal(editor.sign.diagrammatic.width,40);
  assert.equal(world.style.transform,transform);
});

test('dragging a subpanel body moves it without opening either editor',()=>{
  const editor=require('./fixtures/diagrammatic-editor.cjs')();
  const {sign,host,make,pointer,previous}=editor;
  sign.subPanels.push({shields:[],diagrammaticBounds:{x:.2,y:.2,width:.3,height:.2}});
  const frame=make('div'),contents=make('div');
  frame.className='diagrammaticSubpanel';
  frame.append(contents);host.append(frame);
  editor.service.attachSubpanel(frame,sign,0,contents);
  let opened=false;frame.addEventListener('click',()=>{opened=true;});
  pointer(frame,'pointerdown',{clientX:250,clientY:150});
  pointer(frame,'pointermove',{clientX:330,clientY:200});
  pointer(frame,'pointerup',{clientX:330,clientY:200});
  frame.click();
  assert.equal(opened,false);
  assert.equal(frame.classList.contains('diagrammaticAssemblySelected'),false);
  assert.ok(Math.abs(sign.subPanels[0].diagrammaticBounds.x-.3)<1e-6);
  assert.ok(Math.abs(sign.subPanels[0].diagrammaticBounds.y-.3)<1e-6);
  assert.equal(previous.length,1);
  editor.undo();
  assert.equal(editor.sign.subPanels[0].diagrammaticBounds.x,.2);
});

test('a dash remains continuous across its SVG sample points',()=>{
  const draw=c.window.SignMakerDiagrammatics.alignedDashes;
  const points=[{x:0,y:0},{x:4,y:0},{x:6,y:1}];
  assert.equal(draw(points,points,10),'M0,0L4,0 L6,1 ');
});

test('subpanel alignment snaps matching centers and top edges',()=>{
  const snap=c.window.SignMakerDiagrammatics.snapBox;
  const result=snap({x:.61,y:.207,width:.2,height:.13},[{x:.6,y:.2,width:.2,height:.18}],{width:800,height:500});
  assert.ok(Math.abs(result.bounds.x-.6)<1e-9);
  assert.ok(Math.abs(result.bounds.y-.2)<1e-9);
  assert.equal(result.guides.y,.2);
  const far=snap({x:.61,y:.4,width:.2,height:.14},[{x:.6,y:.2,width:.2,height:.15}],{width:800,height:500});
  assert.equal(far.bounds.y,.4);
});

test('new standalone stems are vertical and a deliberate drawing override makes a diagonal',()=>{
  const {engine,controls,workspace,pointer}=require('./fixtures/diagrammatic-editor.cjs')();
  const click=(x,y,shiftKey=false)=>{for(const type of ['pointerdown','pointerup','click'])pointer(workspace,type,{clientX:x,clientY:y,shiftKey});};
  const add=controls.getElementById('addRoad');
  add.click();click(100,340);click(240,180);add.click();
  const sheet=engine.app.sheets.selected;
  const [a,b]=sheet.roads[0].ends.map(end=>sheet.joints.find(joint=>joint.id===end.joint));
  assert.equal(a.x,b.x);assert.ok(b.y<a.y);assert.equal(sheet.roads[0].arcAngle,0);
  add.click();click(400,360);click(550,210,true);add.click();
  const [d,e]=sheet.roads[1].ends.map(end=>sheet.joints.find(joint=>joint.id===end.joint));
  assert.ok(Math.abs(e.x-d.x-(d.y-e.y))<1e-6);
});

test('a new branch snaps to the reflection of a sibling at the same junction',()=>{
  const {engine,controls,workspace,pointer}=require('./fixtures/diagrammatic-editor.cjs')();
  const add=controls.getElementById('addRoad');
  const click=(x,y)=>{for(const type of ['pointerdown','pointerup','click'])pointer(workspace,type,{clientX:x,clientY:y});};
  const sheet=engine.app.sheets.selected;
  const road=(id,start,end)=>({id,lanes:1,laneWidth:12,arcAngle:0,straightened:true,ends:[start,end].map(joint=>({joint,sign:1,length:null}))});
  sheet.roads=[road(1,1,2),road(2,2,3)];
  sheet.joints=[
    {id:1,x:400,y:740,root:1,dir:{x:0,y:-1},links:[]},
    {id:2,x:400,y:440,root:1,dir:{x:0,y:-1},links:[{a:1,b:2,ai:0,bi:0}]},
    {id:3,x:270,y:200,root:2,dir:null,links:[]}
  ];
  engine.app.roadEditor.render();add.click();click(200,220);click(263,103);add.click();
  const branch=sheet.roads.at(-1);
  const [origin,end]=branch.ends.map(end=>sheet.joints.find(joint=>joint.id===end.joint));
  assert.equal(origin.id,2);
  assert.equal(end.x,530);assert.equal(end.y,200);
  assert.equal(branch.arcAngle,0);
});

test('dragging a stem body moves one entire connected assembly in a single undo',()=>{
  const editor=require('./fixtures/diagrammatic-editor.cjs')();
  const {engine,controls,workspace,pointer,previous}=editor;
  const click=(x,y)=>{for(const type of ['pointerdown','pointerup','click'])pointer(workspace,type,{clientX:x,clientY:y});};
  const add=controls.getElementById('addRoad');
  add.click();click(130,400);click(130,225);click(250,110);add.click();
  add.click();click(550,400);click(550,110);add.click();
  const sheet=engine.app.sheets.selected,before=structuredClone(sheet.joints),history=previous.length;
  pointer(workspace,'pointerdown',{clientX:130,clientY:320});
  pointer(workspace,'pointermove',{clientX:155,clientY:340,altKey:true});
  pointer(workspace,'pointerup',{clientX:155,clientY:340,altKey:true});
  assert.equal(previous.length,history+1);
  for(const [i,joint] of before.entries()){
    const moves=i<3;
    assert.equal(sheet.joints[i].x,joint.x+(moves?50:0));
    assert.equal(sheet.joints[i].y,joint.y+(moves?40:0));
  }
  editor.undo();
  assert.deepEqual(JSON.parse(JSON.stringify(editor.sign.diagrammatic.roadGraph.joints)),before);
});

test('leaving the diagrammatic editor fits the preview and reopening restores the edit zoom',()=>{
  const {engine,doc,host}=require('./fixtures/diagrammatic-editor.cjs')();
  const world=doc.getElementById('diagrammaticPreviewWorld'),tab=doc.getElementById('sMDiagrammatics');
  engine.app.sheets.zoomBy(2);
  const editingTransform=world.style.transform;
  assert.match(editingTransform,/scale\(2\)/);
  const initialIconScale=Number(engine.live.style['--handle-scale']);
  assert.ok(initialIconScale<1);
  tab.classList.add('tabHidden');engine.sync();
  assert.equal(world.style.transform,'translate(0px,0px) scale(1)');
  assert.equal(host.classList.contains('diagrammaticEditing'),false);
  tab.classList.remove('tabHidden');engine.sync();
  assert.equal(world.style.transform,editingTransform);
});

test('join bridges are white and lane markings sit above the stem fills with crossing masks',()=>{
  const {engine,make}=require('./fixtures/diagrammatic-editor.cjs')();
  const road=(id,start,end)=>({id,lanes:2,laneWidth:12,arcAngle:0,straightened:true,ends:[start,end].map(joint=>({joint,sign:1,length:null}))});
  const sheet={id:2,width:800,height:500,inchesPerPixel:6,content:make('div'),view:{scale:1},overlapOrder:[1,2,3],autoTapers:false,
    roads:[road(1,1,2),road(2,2,3),road(3,4,5)],
    joints:[
      {id:1,x:230,y:420,root:1,links:[]},
      {id:2,x:230,y:280,root:1,links:[{a:1,b:2,ai:0,bi:0}]},
      {id:3,x:360,y:130,root:2,links:[]},
      {id:4,x:190,y:210,root:3,links:[]},
      {id:5,x:535,y:210,root:3,links:[]}
    ]};
  engine.app.roadEditor.renderArtwork(sheet);
  const layer=sheet.roadLayer,bridge=layer.querySelector('.diagrammaticJoint');
  assert.equal(bridge.getAttribute('fill'),'white');
  const markings=layer.querySelector('.diagrammaticVisibleLaneLines');
  assert.equal(layer.children.at(-1),markings);
  const stem=layer.querySelector('.diagrammaticRoad[data-road-id="2"]');
  const lane=markings.querySelector('.diagrammaticLaneLines[data-road-id="2"]');
  assert.equal(lane.children[0].getAttribute('stroke'),'black');
  assert.equal(lane.getAttribute('mask'),stem.getAttribute('mask'));
  assert.match(lane.getAttribute('mask'),/diagrammatic-gap/);
  const head=stem.querySelector('[data-shape-scale]');
  assert.ok(head.getAttribute('transform').startsWith('translate('));
});

test('a dragged endpoint can match a separate stem’s angle and length',()=>{
  const {engine,workspace,pointer}=require('./fixtures/diagrammatic-editor.cjs')();
  const sheet=engine.app.sheets.selected;
  sheet.roads=[1,2].map(id=>({id,lanes:1,laneWidth:12,arcAngle:0,straightened:true,
    ends:[{joint:id*2-1,sign:1,length:null},{joint:id*2,sign:1,length:null}]}));
  sheet.joints=[{x:160,y:700},{x:360,y:500},{x:720,y:700},{x:870,y:510}].map((point,index)=>({
    ...point,id:index+1,root:Math.floor(index/2)+1,links:[]
  }));
  engine.app.roadEditor.focusRoad(sheet.roads[1]);
  const node=workspace.querySelector('.roadNode[data-road="2"][data-end="1"]');
  pointer(node,'pointerdown',{clientX:435,clientY:255});
  pointer(node,'pointermove',{clientX:459,clientY:248});
  pointer(node,'pointerup',{clientX:459,clientY:248});
  assert.ok(Math.abs(sheet.joints[3].x-920)<1e-6);
  assert.ok(Math.abs(sheet.joints[3].y-500)<1e-6);
});

test('clicking an unselected diagrammatic panel’s subpanel uses the normal menu when guide arrows is closed',()=>{
  const {context,host,make,doc}=require('./fixtures/diagrammatic-editor.cjs')();
  vm.runInContext(fs.readFileSync('public/js/SpecialPanelLayout.js','utf8'),context);
  const other=make('div');host.parentElement.append(other);
  const sign={arrowMode:'diagrammatic',subPanels:[{
    shields:[],blockElements:{createElement:()=>make('div')}
  }]};
  const selections=[];
  context.window.SignMakerSpecialPanelLayout.render({mode:'diagrammatic',panel:{sign},index:1,
    signElmt:other,createShield(){},markSelectedRenderedSubpanel(){},bindRenderedBlockSelection(){},
    selectRenderedPanelArea:selection=>selections.push(selection)
  });
  const dest=other.querySelector('.diagrammaticSubpanel');
  doc.getElementById('sMConfigBar').dataset.currentMenu='panelStyleConfig';
  dest.click();
  assert.deepEqual(selections.map(item=>[item.panelIndex,item.subPanelIndex,item.menu]),[[1,0,'subpanel']]);
  doc.getElementById('sMConfigBar').dataset.currentMenu='guideArrowConfig';
  dest.click();
  assert.equal(selections.at(-1).menu,'guideArrows');
});

test('initializing diagrammatic mode creates one upright starter and preserves existing or deliberately empty diagrams',()=>{
  const {ensureStarter}=c.window.SignMakerDiagrammatics;
  const sign={diagrammatic:{},subPanels:[{name:'City'}]};
  ensureStarter(sign);
  const starter=sign.diagrammatic;
  assert.equal(starter.template,'straight');
  assert.equal(starter.width,24);
  assert.equal(starter.roadGraph.roads.length,1);
  const [from,to]=starter.roadGraph.joints;
  assert.equal(from.x,to.x);
  assert.ok(from.y>to.y);
  assert.equal(sign.subPanels[0].name,'City');
  ensureStarter(sign);
  assert.equal(sign.diagrammatic,starter);
  for(const diagrammatic of [{roadGraph:{roads:[],joints:[]}},{artwork:'<svg/>'}]){
    const old={diagrammatic};
    ensureStarter(old);
    assert.equal(old.diagrammatic,diagrammatic);
  }
});

test('template buttons build a fork, undo restores the starter, and a custom edit hides the choices',()=>{
  const editor=require('./fixtures/diagrammatic-editor.cjs')({withStarter:true});
  const {engine,doc,previous,controls,workspace,pointer}=editor;
  const fieldset=doc.getElementById('diagrammaticTemplates');
  const button=name=>fieldset.querySelector(`[data-diagrammatic-template="${name}"]`);
  assert.equal(fieldset.hidden,false);
  assert.equal(button('straight').getAttribute('aria-pressed'),'true');
  button('split').click();
  assert.equal(editor.sign.diagrammatic.template,'split');
  const {roads,joints}=editor.sign.diagrammatic.roadGraph;
  assert.equal(roads.length,3);
  assert.equal(roads[1].ends[0].joint,roads[2].ends[0].joint);
  assert.ok(Math.abs(roads[1].arcAngle+roads[2].arcAngle)<1e-8);
  assert.ok(Math.abs(roads[2].arcAngle-45)<1e-8,'The fork heads point upward and outward');
  assert.equal(joints[2].y,joints[3].y);
  assert.equal(previous.length,1);
  assert.equal(button('split').getAttribute('aria-pressed'),'true');
  editor.undo();
  assert.equal(editor.sign.diagrammatic.template,'straight');
  assert.equal(engine.app.sheets.selected.roads.length,1);
  assert.equal(button('straight').getAttribute('aria-pressed'),'true');
  button('right').click();
  assert.deepEqual(Array.from(editor.sign.diagrammatic.roadGraph.roads,r=>Math.sign(r.arcAngle)),[0,0,1]);
  button('left').click();
  assert.deepEqual(Array.from(editor.sign.diagrammatic.roadGraph.roads,r=>Math.sign(r.arcAngle)),[0,-1,0]);
  const add=controls.getElementById('addRoad');
  add.click();
  for(const [x,y] of [[600,380],[600,260]])for(const type of ['pointerdown','pointerup','click'])pointer(workspace,type,{clientX:x,clientY:y});
  add.click();
  assert.equal(fieldset.hidden,true);
  assert.equal(editor.sign.diagrammatic.template,undefined);
  const custom=JSON.stringify(editor.sign.diagrammatic);
  button('split').click();
  assert.equal(JSON.stringify(editor.sign.diagrammatic),custom);
});

test('new diagrammatic stems start with automatic tapers off', () => {
  const createEditor = require('./fixtures/diagrammatic-editor.cjs');
  const blank = createEditor();
  assert.equal(blank.engine.app.sheets.selected.autoTapers, false);
  const editor = createEditor({withStarter: true});
  const tapers = editor.controls.getElementById('autoTapers');
  assert.equal(tapers.checked, false);
  const choose = name => editor.doc.querySelector(`[data-diagrammatic-template="${name}"]`).click();
  for (const name of ['left', 'right', 'split', 'straight']) {
    choose(name);
    assert.equal(tapers.checked, false);
    assert.equal(editor.sign.diagrammatic.roadGraph.autoTapers, false);
  }
  tapers.checked = true;
  editor.pointer(tapers, 'change');
  assert.equal(editor.sign.diagrammatic.roadGraph.autoTapers, true);
  editor.undo();
  assert.equal(tapers.checked, false);
  editor.redo();
  assert.equal(tapers.checked, true);
});

test('Mirror fork uses the selected branch and restores the original geometry with undo', () => {
  const editor = require('./fixtures/diagrammatic-editor.cjs')({withStarter: true});
  const mirror = editor.controls.getElementById('mirrorFork');
  assert.equal(mirror.disabled, true);
  editor.doc.querySelector('[data-diagrammatic-template="left"]').click();
  const sheet = editor.engine.app.sheets.selected;
  const [trunk, left, right] = sheet.roads;
  const leftTip = sheet.joints.find(node => node.id === left.ends[1].joint);
  const rightTip = sheet.joints.find(node => node.id === right.ends[1].joint);
  rightTip.x += 155;
  rightTip.y -= 40;
  right.arcAngle = 62;
  right.straightened = false;
  right.arrowHeadSize = 125;
  editor.roadEditor.focusRoad(right);
  editor.engine.commit();
  const before = structuredClone(editor.sign.diagrammatic.roadGraph);
  const history = editor.previous.length;
  assert.equal(mirror.disabled, false);
  const join = sheet.joints.find(node => node.id === trunk.ends[1].joint);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} vs ${b}`);
  mirror.click();
  near(leftTip.x, 2 * join.x - rightTip.x);
  near(leftTip.y, rightTip.y);
  near(left.arcAngle, -right.arcAngle);
  assert.equal(left.arrowHeadSize, 125);
  for (const id of [trunk.id, right.id]) {
    assert.deepEqual(editor.sign.diagrammatic.roadGraph.roads.find(road => road.id === id), before.roads.find(road => road.id === id));
  }
  assert.deepEqual(editor.sign.diagrammatic.roadGraph.joints.find(node => node.id === join.id), before.joints.find(node => node.id === join.id));
  assert.equal(editor.previous.length, history + 1);
  mirror.click();
  assert.equal(editor.previous.length, history + 1, 'Repeating an applied mirror does not save an extra edit');
  editor.undo();
  assert.deepEqual(editor.sign.diagrammatic.roadGraph, before);
  editor.redo();
  near(editor.sign.diagrammatic.roadGraph.joints.find(node => node.id === leftTip.id).y, rightTip.y);
});

test('mirrored multi-lane branches use matching painted dash positions', () => {
  const editor = require('./fixtures/diagrammatic-editor.cjs')({withStarter: true});
  editor.doc.querySelector('[data-diagrammatic-template="left"]').click();
  const sheet = editor.engine.app.sheets.selected;
  const [trunk, left, right] = sheet.roads;
  const fork = sheet.joints.find(node => node.id === trunk.ends[1].joint);
  trunk.lanes = 4;
  left.lanes = right.lanes = 2;
  fork.links[1].ai = 2;
  editor.roadEditor.focusRoad(left);
  editor.controls.getElementById('mirrorFork').click();
  const getDashes = road => sheet.roadLayer.querySelector(
    `.diagrammaticVisibleLaneLines [data-road-id="${road.id}"] path`
  ).getAttribute('d');
  const moves = road => [...getDashes(road).matchAll(/M([^,]+),([^L ]+)/g)]
    .map(([, x, y]) => [Number(x), Number(y)]);
  const leftDash = moves(left), rightDash = moves(right);
  assert.ok(leftDash.length > 1);
  assert.equal(leftDash.length, rightDash.length);
  for (const [i, [x, y]] of leftDash.entries()) {
    assert.ok(Math.abs(x + rightDash[i][0] - 2 * fork.x) < 1e-7);
    assert.ok(Math.abs(y - rightDash[i][1]) < 1e-7);
  }
});

test('Diagrammatics and Roundabout occupy a separate row without imposing the tab widths on Guide Arrows',()=>{
  const {parse}=require('./fixtures/mobile-dom.cjs');
  const {cascade}=require('./fixtures/css-cascade.cjs');
  const dom=parse(fs.readFileSync('scripts/index.source.html','utf8'));
  const style=cascade(fs.readFileSync('public/css/form.css','utf8'));
  const header=dom.querySelector('.guideArrowConfig > .sMModalBar');
  const extra=header.querySelector('.guideArrowExtraTabs');
  assert.deepEqual(extra.children.map(node=>node.dataset.tab),['sMDiagrammatics','sMRoundabout']);
  assert.equal(style(header,'contain'),'inline-size');
  assert.equal(style(header,'flex-wrap'),'wrap');
  assert.equal(style(extra,'flex'),'0 0 100%');
});
