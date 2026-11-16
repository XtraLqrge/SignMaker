const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const c=vm.createContext({structuredClone,window:{addEventListener(){}}});vm.runInContext(fs.readFileSync('public/js/Diagrammatics.js','utf8'),c);
test('road graph survives normalization without losing arbitrary StripeMaker geometry',()=>{
 const graph={roads:[{id:7,lanes:3,ends:[{joint:1},{joint:2}],tapers:{'0:1':{mode:'taper',length:350}},arcAngle:60}],joints:[{id:1,links:[{a:7,b:9,ai:1,bi:0}]}]};
 const saved=c.window.SignMakerDiagrammatics.normalize({roadGraph:graph});
 assert.deepEqual(JSON.parse(JSON.stringify(saved.roadGraph)),graph);saved.roadGraph.roads[0].lanes=4;assert.equal(graph.roads[0].lanes,3);
});
test('vendored road geometry dependencies match the recorded StripeMaker sources',()=>{
 const source=JSON.parse(fs.readFileSync('public/diagrammatics/stripe/SOURCE.json'));
 for(const [file,hash]of Object.entries(source.sha256)){
  let source=fs.readFileSync('public/diagrammatics/stripe/'+file,'utf8');
  if(file==='js/elements.js')source=source.replace(/\n      if\(window\.DiagrammaticRoadRenderer\) return window\.DiagrammaticRoadRenderer\(sheet,road,shape,layers,className,\n        k=>boundary\(shape,k\), !road\.ends \|\| !attachments\(sheet,jointOf\(sheet,road\.ends\[1\]\.joint\)\)\.some\(item=>item\.road!==road&&item\.e===0\)\);/,'');
  source=source.replace(/\n      if\(window\.StripeMaker\.diagrammatic\) items=items\.filter[^\n]+/,'');
  source=source.replace(/      window\.StripeMaker\.diagrammaticRender\?\.\(sheet\);\n/,'').replace(/        \.\.\.\(window\.StripeMaker\.diagrammaticOrder \? \[[\s\S]*?\] : \[\]\),\n/,'');
  source=source.replace(/    \/\/ BEGIN SIGNMAKER ATTACHED ARC CONSTRAINTS[\s\S]*?    \/\/ END SIGNMAKER ATTACHED ARC CONSTRAINTS\n/,'')
   .replace(/      \/\/ BEGIN SIGNMAKER ARC RADIUS HANDLE[\s\S]*?      \/\/ END SIGNMAKER ARC RADIUS HANDLE\n/,'')
   .replace(/^.*\/\* SIGNMAKER \*\/ (?:diagrammaticSyncArcJoins|if\().*\n/gm,'')
   .replace('/* SIGNMAKER */ anchor:diagrammaticArcAnchor(sheets.selected,road,solved),','');
  source=source.replace(/      \/\/ BEGIN SIGNMAKER DRAWING (DIRECTION|TARGET)[\s\S]*?      \/\/ END SIGNMAKER DRAWING \1\n/g,'');
  source=source.replace("subpanel:'placeDiagrammaticSubpanel',",'');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),hash,file);
 }
});
test('independent diagrammatic dimensions preserve legacy proportions and gap preference',()=>{
 const normalize=c.window.SignMakerDiagrammatics.normalize;
 assert.equal(normalize({width:48}).height,30);
 assert.equal(normalize({width:48,height:18}).height,18);
 assert.equal(normalize({}).consistentGapsOnTurns,true);
 assert.equal(normalize({consistentGapsOnTurns:false}).consistentGapsOnTurns,false);
});
test('turn dashes share right-edge stations across lanes of different lengths',()=>{
 const draw=c.window.SignMakerDiagrammatics.alignedDashes;
 const right=[{x:0,y:0},{x:20,y:0},{x:20,y:20}];
 const inner=[{x:0,y:5},{x:15,y:5},{x:15,y:20}];
 assert.equal(draw(right,right,10),'M0,0L10,0 M20,0L20,10 ');
 assert.equal(draw(inner,right,10),'M0,5L7.5,5 M15,5L15,12.5 ');
 assert.equal(draw([{x:0,y:0},{x:0,y:0}], [{x:0,y:0},{x:0,y:0}],10),'');
});
test('old diagrams retain their drawing scale when independent dimensions are introduced',()=>{
 const model=c.window.SignMakerDiagrammatics.normalize({width:48,roadGraph:{width:1600,height:1000}});
 assert.equal(model.width*model.unitsPerRem,1600);assert.ok(Math.abs(model.height*model.unitsPerRem-1000)<1e-9);
});
test('diagrammatic dimensions accept sizes below the old limits',()=>{
 const model=c.window.SignMakerDiagrammatics.normalize({width:4,height:3});
 assert.equal(model.width,4);assert.equal(model.height,3);
});
