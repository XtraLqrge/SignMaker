const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {Node,parse,Event}=require('./fixtures/mobile-dom.cjs');
const {cascade}=require('./fixtures/css-cascade.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('scripts/index.source.html'),manifest=JSON.parse(read('build-manifest.json'));
const paneNames=['sdCtrlText','sdActionMessage','sdShield','sdBlocker','sdBeacon','sdElectronicSign','sdGroupedBlock'];
test('block and row properties are separate siblings and blocks expose four margins without padding controls',()=>{
 const tree=parse(html),properties=tree.querySelector('#smSPProperties'),block=tree.querySelector('#smSPElementProperties');
 assert.equal(properties.nextElementSibling,block);assert.equal(block.nextElementSibling.id,'smSPBlockProperties');
 assert.equal(properties.querySelectorAll('.sdElementBlockProperties').length,0);
 for(const field of ['topPadding','bottomPadding','leftMargin','rightMargin','backgroundColor','borderColor','backgroundFullWidth','width','stretchLeft','stretchCenter','stretchRight'])assert.ok(tree.querySelector('#sdElement_'+field),field);
 assert.equal(block.querySelectorAll('.propertySpacingField').length,4);
 assert.equal(block.querySelectorAll('[data-element-padding]').length,0);
 assert.equal(block.querySelector('#sdElement_leftPadding'),null);assert.equal(block.querySelector('#sdElement_rightPadding'),null);
 const legacy=tree.querySelector('#legacyElementPadding');assert.equal(legacy.hidden,true);
 for(const prefix of paneNames){const slot=legacy.querySelector(`[data-element-padding="${prefix}"]`);assert.ok(slot,prefix);assert.equal(slot.querySelectorAll('.sdElementPaddingControl').length,2);}
 const ids=tree.querySelectorAll('[id]').map(node=>node.id);assert.equal(ids.length,new Set(ids).size);
});
function models(){
 const make=tag=>{const node=new Node(tag);node.style.setProperty=(key,value)=>node.style[key]=value;return node;};
 const document={baseURI:'https://signmaker.test/',currentScript:{src:'https://signmaker.test/js/Control.js'},documentElement:make('html'),body:make('body'),createElement:make,querySelectorAll(){return[];},getElementById(){return null;},addEventListener(){}};
 const c=vm.createContext({document,window:{localStorage:{getItem(){return null;}},addEventListener(){}},URL,console,structuredClone,setTimeout,clearTimeout,Event});
 for(const name of ['lib','Shield','Sign','ExitTab','Panel','VmsPanel','Post','Arrows','Control','SubPanels'])vm.runInContext(read('public/js/'+name+'.js'),c,{filename:name+'.js'});
 vm.runInContext(read('public/js/BlockProperties.js'),c);
 return {c,make};
}
test('nested block spacing and row-side padding survive typed loading and duplication without changing legacy defaults',()=>{
 const {c}=models();const result=vm.runInContext(`(()=>{
  const saved={rows:[[{_elementType:'GroupedBlockElement',padding:1.25,blockElements:{rows:[[{_elementType:'ControlTextElement',textContent:'City',paddingHorizontal:2,paddingVertical:0.7}]],blockProperties:[{leftPadding:1.1,rightPadding:2.2}]}}]],blockProperties:[{leftPadding:0.6,rightPadding:0.8}]};
  const restored=Control.fromData(saved),copy=restored.clone();
  const group=copy.rows[0][0],text=group.blockElements.rows[0][0];
  return {horizontal:text.paddingHorizontal,vertical:text.paddingVertical,groupHorizontal:group.padding,groupVertical:group.paddingVertical,left:copy.blockProperties[0].leftPadding,right:copy.blockProperties[0].rightPadding,nestedLeft:group.blockElements.blockProperties[0].leftPadding,legacy:new ControlTextElement().paddingHorizontal,legacyRow:new Block().leftPadding};
 })()`,c);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{horizontal:2,vertical:0.7,groupHorizontal:1.25,groupVertical:1.25,left:0.6,right:0.8,nestedLeft:1.1,legacy:0,legacyRow:0});
});
test('element spacing applies to its own rendered box and leaves an untouched legacy box unchanged',()=>{
 const {c,make}=models();c.box=make('div');
 for(const type of ['ControlTextElement','ActionMessageElement','ShieldElement','BeaconElement','DividerElement']){
  vm.runInContext(`{const element=new ${type}();window.SignMakerBlockProperties.applyPadding(element,box);}`,c);
  assert.equal(c.box.classList.contains('hasBlockPadding'),false);
  vm.runInContext(`{const element=new ${type}();element.paddingHorizontal=1.2;element.paddingVertical=0.5;window.SignMakerBlockProperties.applyPadding(element,box);}`,c);
  assert.equal(c.box.style['--blockPaddingH'],'1.2rem');assert.equal(c.box.style['--blockPaddingV'],'0.5rem');
  c.box=make('div');
 }
});
test('diagrammatic and roundabout models retain their data when signs are copied',()=>{
 const {c}=models(),result=vm.runInContext(`(()=>{
  const graph={roads:[{id:8,lanes:3,ends:[{joint:1},{joint:2}]}],joints:[{id:1,x:2,y:3},{id:2,x:5,y:8}]};
  const original=new Sign({arrowMode:'diagrammatic',diagrammatic:{roadGraph:graph,width:28,height:16},roundabout:{size:22,exits:{left:false}}});
  const copy=new Sign(original);copy.diagrammatic.roadGraph.roads[0].lanes=4;
  return [original.diagrammatic.roadGraph.roads[0].lanes,copy.diagrammatic.roadGraph.roads[0].lanes,copy.roundabout.size,copy.roundabout.exits.left];
 })()`,c);
 assert.deepEqual(Array.from(result),[3,4,22,false]);
});
for(const [label,css] of [['source',[...html.matchAll(/<link\b[^>]*href="(css\/[^"]+)"/g)].map(m=>read('public/'+m[1].split('?')[0])).join('\n')],['production',read('public/'+manifest.deferredStyles)]]){
 test(label+': the entire desktop editor has a viewport-aware width independent of intrinsic controls',()=>{
  const tree=parse(html),style=cascade(css,{respectLayers:true}),editor=tree.querySelector('#sMSPTextEditor');
  assert.equal(style(editor,'width'),'39rem');
  assert.match(style(editor,'max-width'),/100vw.*--sm-app-zoom/);
  for(const name of ['sdCtrlText','sdShield','sdActionMessage']) {
   const pane=tree.querySelector(`[data-property="${name}"]`);
   assert.equal(style(pane,'width'),'100%');assert.equal(style(pane,'min-width'),'0');
  }
  assert.notEqual(style(editor,'overflow-x'),'hidden');
 });
 test(label+': both sections have two rows of two usable spacing editors within the bounded width',()=>{
  const tree=parse(html),style=cascade(css,{respectLayers:true});
  const rem=value=>{assert.match(value,/^(?:0|[.\d]+rem)$/);return parseFloat(value);};
  for(const id of ['smSPElementProperties','smSPBlockProperties']){
   const section=tree.querySelector('#'+id),row=section.querySelector('.propertySpacingRow');
   assert.equal(style(row,'display'),'grid');assert.equal(style(row,'width'),'100%');
   assert.equal(style(row,'grid-template-columns'),'max-content repeat(2,minmax(0,1fr))');
   assert.equal(style(section,'box-sizing'),'border-box');assert.equal(style(section,'max-width'),'100%');
   const fields=row.querySelectorAll('.propertySpacingField');assert.equal(fields.length,4);
   assert.deepEqual(fields.map(field=>field.querySelector('label').textContent.trim()),['Top','Bottom','Left','Right']);
   for(const field of fields){
    assert.equal(style(field,'width'),'100%');assert.equal(style(field,'min-width'),'0');
    assert.equal(style(field,'grid-template-columns'),'3rem minmax(0,1fr) 2.75rem');
    assert.equal(style(field.querySelector('label'),'grid-column'),undefined);assert.equal(style(field.querySelector('label'),'font-size'),'0.8rem');
    const range=field.querySelector('input[type="range"]'),number=field.querySelector('input[type="number"]');
    assert.equal(style(range,'width'),'100%');assert.equal(style(range,'min-width'),'0');assert.equal(style(range,'max-width'),'100%');
    for(const key of ['width','min-width','max-width'])assert.equal(style(number,key),'2.75rem');
   }
   if(id==='smSPElementProperties'){
    assert.equal(row.querySelectorAll('.propertySpacingLabel').length,1);
    assert.equal(style(row.querySelector('.propertySpacingLabel'),'grid-row'),'1/span 2');
   }else assert.equal(row.querySelectorAll('.propertySpacingLabel').length,2);
   for(const [viewport,zoom] of [[1920,1],[1280,1.5],[1024,1.5],[800,1.5]]){
    const editorWidth=Math.min(rem(style(tree.querySelector('#sMSPTextEditor'),'width')),(viewport/16-2)/zoom);
    const available=editorWidth-2; // Both the editor and section have 0.5rem side padding.
    // The wider heading is Padding, measured from the shipped Inter face.
    const track=(available-4.1592*.8-2*.5)/2;
    const slider=track-3-2.75-2*.3;
    assert.ok(slider>=6,`${id}: usable slider at ${viewport}px / ${zoom}: ${slider}rem`);
   }
  }
 });
 test(label+': both appearance rows keep colors, width and full-width toggle inside four bounded tracks',()=>{
  const tree=parse(html),style=cascade(css,{respectLayers:true});
  for(const id of ['smSPElementProperties','smSPBlockProperties']){
   const section=tree.querySelector('#'+id),row=section.querySelector('.propertyAppearanceRow');
   assert.equal(row.querySelectorAll('.propertyColorField').length,2);
   assert.ok(row.querySelector('.propertyWidthField'));assert.ok(row.querySelector('.propertyCheckField'));
   assert.equal(style(row,'display'),'grid');
   assert.equal(style(row,'grid-template-columns'),'minmax(0,1fr) minmax(0,1fr) max-content max-content');
   for(const field of row.querySelectorAll('.propertyColorField')){
    assert.equal(style(field,'grid-template-columns'),'max-content minmax(0,1fr)');
    const picker=new Node('div'),button=new Node('button');picker.className='colorPicker';button.className='colorPickerTrigger';picker.append(button);field.append(picker);
    assert.equal(style(picker,'width'),'100%');assert.equal(style(picker,'min-width'),'0');assert.equal(style(picker,'max-width'),'100%');
    assert.equal(style(button,'width'),'100%');assert.equal(style(button,'font-size'),'0.72rem');
   }
   assert.equal(style(row.querySelector('input[type="number"]'),'max-width'),'2.5rem');
  }
 });
}
test('diagrammatic and roundabout artwork, controls, and road geometry retain the supplied branch bytes',()=>{
 const crypto=require('node:crypto'),expected=JSON.parse(read('scripts/fixtures/diagrammatic-source-integrity.json'));
 for(const [file,hash] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public',file))).digest('hex'),hash,file);
});
for(const file of ['public/js/SpecialPanelLayout.js']){
 test(file+': special-panel destinations preserve their subpanel indices and the standard layout stays untouched',()=>{
  const {c,make}=models(),selected=[],bound=[],attached=[];
  c.window.SignMakerRoundabout={directions:['left','thru','right'],render:()=>({exits:{left:true,thru:false,right:true}})};
  c.window.SignMakerDiagrammatics={render(){},attachSubpanel:(frame,sign,index)=>attached.push(index)};
  vm.runInContext(read(file),c);
  const sign={shieldPosition:'Top',subPanels:[0,1,2].map(i=>({shields:[],diagrammaticBounds:i===1?null:{x:.1,y:.1,width:.2,height:.2},blockElements:{createElement:()=>make('div')}}))};
  const render=mode=>{const signElmt=make('div');const handled=c.window.SignMakerSpecialPanelLayout.render({mode,panel:{sign},index:4,signElmt,createShield(){},markSelectedRenderedSubpanel(){},bindRenderedBlockSelection:(node,index)=>bound.push(index),selectRenderedPanelArea:selection=>selected.push(selection)});return {signElmt,handled};};
  const standard=render('standard');assert.equal(standard.handled,false);assert.equal(standard.signElmt.children.length,0);
  const roundabout=render('roundabout');assert.equal(roundabout.handled,true);assert.deepEqual(roundabout.signElmt.children.map(n=>n.dataset.subpanelIndex),['0','2']);
  roundabout.signElmt.children[1].dispatchEvent(new (require('./fixtures/mobile-dom.cjs').Event)('click'));assert.equal(selected.at(-1).subPanelIndex,2);assert.equal(selected.at(-1).panelIndex,4);
  const diagrammatic=render('diagrammatic');assert.equal(diagrammatic.handled,true);assert.deepEqual(attached,[0,2]);assert.deepEqual(bound,[0,2,0,2]);
  assert.equal(sign.subPanels.length,3);assert.equal(sign.subPanels[1].diagrammaticBounds,null);
 });
}
test('placing a diagrammatic destination reuses an unplaced subpanel and keeps invalid bounds out of the model',()=>{
 const {c}=models();vm.runInContext(read('public/js/SpecialPanelLayout.js'),c);
 const sign=vm.runInContext("new Sign({arrowMode:'diagrammatic'})",c),selections=[];let updates=0,draws=0;
 sign.newSubPanel();
 const run=bounds=>c.window.SignMakerSpecialPanelLayout.addSubpanel({sign,bounds,panelIndex:2,selectRenderedPanelArea:value=>selections.push(value),updateForm:()=>updates++,redraw:()=>draws++,clamp:(v,min,max)=>Math.min(max,Math.max(min,v))});
 const count=sign.subPanels.length;run({x:.2,y:.3,width:.4,height:.3});assert.equal(sign.subPanels.length,count);assert.equal(selections[0].subPanelIndex,0);
 assert.deepEqual(JSON.parse(JSON.stringify(sign.subPanels[0].diagrammaticBounds)),{x:.2,y:.3,width:.4,height:.3});assert.equal(updates,1);assert.equal(draws,1);
 run({x:NaN,y:0,width:.2,height:.2});assert.equal(updates,1);assert.equal(sign.subPanels.length,count);
});
test('special-panel edits retain the live-preview redraw option and independent roundabout settings',()=>{
 const {c}=models();for(const file of ['Diagrammatics','Roundabout','SpecialPanelLayout'])vm.runInContext(read('public/js/'+file+'.js'),c);
 const sign={diagrammatic:{width:36,height:20},roundabout:{size:24,exits:{left:true}}};let updates=0,draws=0;
 const update=()=>updates++,draw=()=>draws++;
 c.window.SignMakerSpecialPanelLayout.editModel(sign,'diagrammatic',(model,current)=>{assert.equal(current,sign);model.height=18;},update,draw,false);
 assert.equal(sign.diagrammatic.height,18);assert.equal(sign.diagrammatic.width,36);assert.equal(updates,0);assert.equal(draws,0);
 c.window.SignMakerSpecialPanelLayout.editModel(sign,'roundabout',model=>model.exits.left=false,update,draw);
 assert.equal(sign.roundabout.size,24);assert.equal(sign.roundabout.exits.left,false);assert.equal(sign.diagrammatic.height,18);assert.equal(updates,1);assert.equal(draws,1);
});
test('all four block margins render outside the painted block independently of row padding',()=>{
 const {c,make}=models();c.node=make('div');
 const legacy=vm.runInContext('new ControlTextElement()',c);
 assert.equal(c.window.SignMakerBlockProperties.renderElement(legacy,c.node),c.node);
 legacy.blockProperties={topPadding:.4,bottomPadding:-.2,leftMargin:.5,rightMargin:-.75,backgroundColor:'Yellow',borderColor:'Red',backgroundFullWidth:false,width:8,stretchCenter:false};
 const frame=c.window.SignMakerBlockProperties.renderElement(legacy,c.node),paint=frame.children[0];
 assert.equal(frame.style.marginTop,'0.4rem');assert.equal(frame.style.marginBottom,'-0.2rem');assert.equal(frame.style.width,'8rem');assert.equal(frame.style.flexGrow,'0');
 assert.equal(frame.style.marginLeft,'0.5rem');assert.equal(frame.style.marginRight,'-0.75rem');assert.equal(paint.style.paddingLeft,'0rem');assert.equal(paint.style.paddingRight,'0rem');assert.equal(paint.style.color,'black');assert.match(paint.style.border,/solid (?:#|rgb|red)/);assert.equal(paint.children[0],c.node);assert.equal(paint.style.width,undefined);
 legacy.blockProperties={...legacy.blockProperties,width:0,backgroundFullWidth:true,stretchCenter:true};
 const wide=c.window.SignMakerBlockProperties.renderElement(legacy,make('div'));assert.equal(wide.style.flexGrow,'1');assert.equal(wide.children[0].style.width,'100%');
});
test('default margins keep the original node and legacy padding survives independent margin changes',()=>{
 const {c,make}=models(),api=c.window.SignMakerBlockProperties,node=make('div');
 const element=vm.runInContext('new ControlTextElement()',c);
 element.blockProperties={topPadding:0,bottomPadding:0,leftMargin:0,rightMargin:0};assert.equal(api.renderElement(element,node),node);
 element.blockProperties={leftPadding:1,rightPadding:2,leftMargin:-.5,rightMargin:.6};
 const frame=api.renderElement(element,node);assert.equal(frame.style.marginLeft,'-0.5rem');assert.equal(frame.style.marginRight,'0.6rem');
 assert.equal(frame.children[0].style.paddingLeft,'1rem');assert.equal(frame.children[0].style.paddingRight,'2rem');
});
test('per-block settings survive nested JSON and duplication without sharing mutable style objects',()=>{
 const {c}=models(),result=vm.runInContext(`(()=>{
  const control=Control.fromData({rows:[[{_elementType:'GroupedBlockElement',blockProperties:{leftMargin:1,backgroundColor:'Yellow'},blockElements:{rows:[[{_elementType:'ControlTextElement',textContent:'City',blockProperties:{topPadding:.6,width:7,borderColor:'Blue'}}]]}}]],blockProperties:[{leftPadding:3,backgroundColor:'Green'}]});
  const copy=control.clone();copy.rows[0][0].blockProperties.leftMargin=2;copy.rows[0][0].blockElements.rows[0][0].blockProperties.width=9;
  return [control.rows[0][0].blockProperties.leftMargin,control.rows[0][0].blockElements.rows[0][0].blockProperties.width,control.blockProperties[0].leftPadding,copy.blockProperties[0].leftPadding,copy.rows[0][0].blockElements.rows[0][0].blockProperties.topPadding];
 })()`,c);
 assert.deepEqual(Array.from(result),[1,7,3,3,.6]);
});
function propertyEditor(){
 const {c}=models(),tree=parse(html),get=id=>tree.querySelector('#'+id);
 const document={...c.document,documentElement:tree,activeElement:null,getElementById:get};c.document=document;
 const option=(text,value)=>{const node=new Node('option');node.textContent=text;node.value=value;return node;};
 c.Option=function(text,value){return option(text,value);};
 for(const select of tree.querySelectorAll('select')){Object.defineProperty(select,'options',{get:()=>select.children.filter(n=>n.tagName==='OPTION')});select.add=node=>select.append(node);}
 for(const field of ['backgroundColor','borderColor'])for(const value of [field==='borderColor'?'Match BG':'Inherit','White','Yellow','Green','Red'])get('sdBlock_'+field).add(option(value,value));
 let current={alignment:'Center'},begins=0,ends=0,draws=0,before;
 const api={getCurrentBlockElem:()=>current,beginUndoableChange:()=>{begins++;before=JSON.parse(JSON.stringify(current));},endUndoableChange:()=>ends++,redraw:()=>draws++};
 const sync=prefix=>c.window.SignMakerBlockProperties.sync(current,prefix,api);sync('sdShield');
 return {get,tree,sync,api,c,fire:(node,type)=>node.dispatchEvent(new Event(type,{bubbles:true})),select:(element,prefix)=>{current=element;sync(prefix);},current:()=>current,counts:()=>({begins,ends,draws}),before:()=>before};
}
test('the common block panel changes only the selected element and coalesces slider input into one undo entry',()=>{
 const h=propertyEditor(),row={topPadding:2,backgroundColor:'Green'};
 assert.equal(h.current().blockProperties,undefined,'Opening the editor does not migrate existing artwork');
 const slider=h.get('sdElement_topPadding');
 for(const value of ['.2','.4','.6']){slider.value=value;h.fire(slider,'input');}
 assert.equal(h.current().blockProperties.topPadding,.6);assert.deepEqual(row,{topPadding:2,backgroundColor:'Green'});assert.equal(h.counts().begins,1);assert.equal(h.counts().ends,0);
 h.fire(slider,'change');assert.equal(h.counts().ends,1);assert.equal(h.before().blockProperties,undefined);
 h.get('sdElement_backgroundColor').value='Yellow';h.fire(h.get('sdElement_backgroundColor'),'change');assert.equal(h.current().blockProperties.backgroundColor,'Yellow');
 const old=h.current();h.select({alignment:'Left'},'sdIcon');assert.equal(h.get('sdElement_topPaddingVal').value,0);assert.equal(old.blockProperties.topPadding,.6);assert.equal(h.current().blockProperties,undefined);
});
test('block resets, invalid input and manual values retain their own limits and do not affect row controls',()=>{
 const h=propertyEditor(),input=h.get('sdElement_rightMarginVal');input.value='1.27';h.fire(input,'input');h.fire(input,'change');assert.equal(h.current().blockProperties.rightMargin,1.27);
 input.value='-1.3';h.fire(input,'change');assert.equal(h.current().blockProperties.rightMargin,-1.3);
 input.value='100';h.fire(input,'change');assert.equal(input.value,10);assert.equal(h.current().blockProperties.rightMargin,10);
 input.value='';h.fire(input,'focusout');assert.equal(input.value,10);
 h.get('smSPElementProperties').querySelector('[data-element-reset="rightMargin"]').dispatchEvent(new Event('click'));assert.equal(h.current().blockProperties.rightMargin,0);assert.equal(input.value,0);assert.equal(h.get('sdBlock_rightPaddingVal').value,'0');
});
test('styled groups keep their nested block click targets and group path',()=>{
 const {c,make}=models();vm.runInContext(read('public/js/SpecialPanelLayout.js'),c);
 const master=make('div'),row=make('div'),group=make('div'),native=make('div'),nested=make('div'),innerRow=make('div'),inner=make('div');
 master.className='blockElementMaster';row.className=innerRow.className='blockElementRow';group.className='blockElementCenter';native.className='bE-groupedBlockElement';nested.className='bE-groupedBlockElementContent blockElementMaster';
 inner.setAttribute('data-sign-row','0');inner.setAttribute('data-sign-block','0');
 nested.append(innerRow);innerRow.append(inner);native.append(nested);
 const element={alignment:'Center',blockProperties:{backgroundColor:'Yellow'}},frame=c.window.SignMakerBlockProperties.renderElement(element,native);frame.setAttribute('data-sign-row','0');frame.setAttribute('data-sign-block','0');
 group.append(frame);row.append(group);master.append(row);const selected=[];
 c.window.SignMakerSpecialPanelLayout.bindRenderedBlockSelection(master,{index:1,subPanelIndex:0,currentlyEditingGroupPath:[],currentlySelectedPanelIndex:1,currentlySelectedSubPanelIndex:0,currentlySelectedRowIndex:0,currentlySelectedBlockIndex:0,selectRenderedPanelArea:value=>selected.push(value)});
 inner.dispatchEvent(new Event('click',{bubbles:true}));assert.equal(selected.length,1);assert.equal(selected[0].blockIndex,0);assert.deepEqual(JSON.parse(JSON.stringify(selected[0].groupPath)),[{rowIndex:0,blockIndex:0}]);
});
