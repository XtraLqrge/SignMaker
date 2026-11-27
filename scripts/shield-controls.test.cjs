const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Node, Event, parse} = require('./fixtures/mobile-dom.cjs');
const {cascade} = require('./fixtures/css-cascade.cjs');
const {parse: parseJS} = require('./build.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('scripts/index.source.html'),manifest=JSON.parse(read('build-manifest.json'));
const parsed=new Map();
function declaration(file,name) {
  if(!parsed.has(file)) {const source=read(file);parsed.set(file,{source,ast:parseJS(source)});}
  const {source,ast}=parsed.get(file),stack=[ast];
  while(stack.length) {
    const current=stack.pop();
    if(current.type==='VariableDeclarator' && current.id.name===name) return `let ${source.slice(current.start,current.end)};`;
    for(const value of Object.values(current))if(value&&typeof value==='object') {
      if(Array.isArray(value))stack.push(...value.filter(item=>item?.type));else if(value.type)stack.push(value);
    }
  }
  throw Error('Missing '+name);
}
const form=name=>declaration('public/js/form.js',name);
function sliderEditor(mobile=false) {
  const tree=parse(html),get=id=>tree.querySelector('#'+id),document={activeElement:null,documentElement:tree};
  if(mobile)tree.setAttribute('data-mobile-ui','');
  const sliders=tree.querySelectorAll('.customShieldMakerSliderField input[type="range"]');
  for(const slider of sliders) {
    const input=get(slider.id+'Val');
    input.focus=()=>{document.activeElement=input;input.dispatchEvent(new Event('focus'));};
    input.blur=()=>{document.activeElement=null;input.dispatchEvent(new Event('blur'));input.closest('.customShieldMakerSliderField').dispatchEvent(new Event('focusout',{relatedTarget:null}));};
  }
  const c=vm.createContext({document,Event,dialog:{open:true},console,isUsableLiveInput:input=>input.value!==''&&Number.isFinite(Number(input.value)),
    getCustomShieldMakerHistorySnapshot:()=>Object.fromEntries(sliders.map(slider=>[slider.id,slider.value])),
    restoreCustomShieldMakerHistorySnapshot:snapshot=>{for(const slider of sliders){slider.value=snapshot[slider.id];get(slider.id+'Val').value=slider.value;}}});
  vm.runInContext('let customShieldMakerActiveSlider=null,customShieldMakerUndoStack=[],customShieldMakerRedoStack=[],customShieldMakerLastHistoryKey="",customShieldMakerRestoringHistory=false;'+
    ['recordCustomShieldMakerHistoryCheckpoint','finishCustomShieldMakerSliderEdit','beginCustomShieldMakerSliderEdit','setCustomShieldMakerRangeValue','bindCustomShieldMakerRangePair','resetCustomShieldMakerHistory','undoCustomShieldMakerEdit','redoCustomShieldMakerEdit','finishCustomShieldMakerInputOnOutsidePointer'].map(form).join('\n')+
    ';this.bind=bindCustomShieldMakerRangePair;this.undo=undoCustomShieldMakerEdit;this.redo=redoCustomShieldMakerEdit;this.reset=resetCustomShieldMakerHistory;this.count=()=>customShieldMakerUndoStack.length;this.checkpoint=recordCustomShieldMakerHistoryCheckpoint;this.outside=finishCustomShieldMakerInputOnOutsidePointer;',c);
  for(const slider of sliders) {
    c.bind(slider,get(slider.id+'Val'));
    // Use the same history entry point called by the live preview listeners.
    slider.addEventListener('input',c.checkpoint);slider.addEventListener('change',c.checkpoint);
  }
  c.reset();return {get,sliders,c,document,tree};
}
test('dragging a shield slider previews live but records one undo entry only when its field loses focus',()=>{
  const h=sliderEditor(),slider=h.get('customShieldMakerRouteFontSize');
  h.document.activeElement=slider;slider.dispatchEvent(new Event('focus'));
  for(const value of ['230','240','250']){slider.value=value;slider.dispatchEvent(new Event('input'));}
  slider.dispatchEvent(new Event('change'));assert.equal(h.c.count(),1);
  slider.closest('.customShieldMakerSliderField').dispatchEvent(new Event('focusout',{relatedTarget:null}));
  assert.equal(h.c.count(),2);h.c.undo();assert.equal(slider.value,'220');h.c.redo();assert.equal(slider.value,'250');
});
test('undo during a focused drag commits the whole drag and undoes it once',()=>{
  const h=sliderEditor(),slider=h.get('customShieldMakerRouteTopOffset');
  slider.value='17';slider.dispatchEvent(new Event('input'));assert.equal(h.c.count(),1);
  h.c.undo();assert.equal(slider.value,'0');h.c.redo();assert.equal(slider.value,'17');
});
test('paired inputs accept whole numbers, preserve loaded 235, and use ten or one for step buttons',()=>{
  const h=sliderEditor();
  for(const [name,value,next] of [['FontSize','235','245'],['LetterSpacing','-12','-11'],['TopOffset','2','3'],['HorizontalOffset','0','1']]) {
    const slider=h.get('customShieldMakerRoute'+name),input=h.get(slider.id+'Val');input.focus();input.value=value;input.dispatchEvent(new Event('input'));
    const row=slider.closest('.customShieldMakerSliderField');row.querySelector('[data-shield-step="1"]').dispatchEvent(new Event('click'));
    assert.equal(input.value,next);assert.equal(slider.step,name==='FontSize'?'10':'1');input.blur();
  }
  const input=h.get('customShieldMakerRouteTopOffsetVal');input.focus();input.value='-12.6';input.dispatchEvent(new Event('input'));assert.equal(input.value,'-13');
  const dot=new Event('keydown',{key:'.'});input.dispatchEvent(dot);assert.equal(dot.defaultPrevented,true);
  input.blur();assert.equal(h.get('customShieldMakerRouteTopOffset').value,'-13');
  input.value='';input.blur();assert.equal(input.value,'-13');
});
test('reset buttons return to the field default and remain reversible',()=>{
  const h=sliderEditor();
  for(const slider of h.sliders) {
    const input=h.get(slider.id+'Val'),row=slider.closest('.customShieldMakerSliderField');input.focus();input.value=slider.id.endsWith('FontSize')?'270':'15';input.dispatchEvent(new Event('input'));
    row.querySelector('.customShieldMakerReset').dispatchEvent(new Event('click'));
    assert.equal(input.value,slider.id.endsWith('FontSize')?'220':'0');h.c.undo();assert.equal(input.value,slider.id.endsWith('FontSize')?'270':'15');
  }
});
for (const mobile of [false,true]) {
  test(`${mobile?'mobile':'desktop'} numeric typing waits for blur while arrow controls preview immediately`,()=>{
    const h=sliderEditor(mobile),slider=h.get('customShieldMakerRouteFontSize'),input=h.get(slider.id+'Val');let previews=0;
    slider.addEventListener('input',()=>previews++);
    input.focus();input.value='235';input.dispatchEvent(new Event('input'));
    assert.equal(slider.value,'220');assert.equal(previews,0);assert.equal(h.c.count(),1);
    input.blur();assert.equal(slider.value,'235');assert.equal(previews,1);assert.equal(h.c.count(),2);
    input.focus();input.value='250';input.dispatchEvent(new Event('input'));assert.equal(slider.value,'235');
    slider.closest('.customShieldMakerSliderField').querySelector('[data-shield-step="1"]').dispatchEvent(new Event('click'));
    assert.equal(slider.value,mobile?'255':'260');assert.equal(previews,2);assert.equal(slider.step,mobile?'5':'10');
    input.dispatchEvent(new Event('keydown',{key:'ArrowDown'}));assert.equal(slider.value,'250');assert.equal(previews,3);
    input.dispatchEvent(new Event('change'));input.blur();assert.equal(previews,3,'Change and blur must not repeat the same preview update');
  });
}
test('changing device layout resynchronizes the text-size step without changing the displayed value',()=>{
  const h=sliderEditor(true),slider=h.get('customShieldMakerRouteFontSize');assert.equal(slider.step,'5');
  h.tree.removeAttribute('data-mobile-ui');slider._syncCustomShieldMakerInput();assert.equal(slider.step,'10');assert.equal(slider.value,'220');
  h.tree.setAttribute('data-mobile-ui','');slider._syncCustomShieldMakerInput();assert.equal(slider.step,'5');assert.equal(slider.value,'220');
});
test('generic dropdown conversion always leaves shield font and color ownership to their specialized builders',()=>{
  const c=vm.createContext({window:{SignMakerEditorRuntime:{pendingKind(){assert.fail('A reserved picker must not enter generic initialization');}}}});
  vm.runInContext(declaration('public/js/MergeUI.js','convertSelect')+';this.convert=convertSelect;',c);
  for(const id of ['customShieldMakerRouteFont','customShieldMakerRouteColor'])c.convert({id});
});
test('every shield dialog opening constructs or syncs both specialized dropdowns before display',()=>{
  const calls=[],fontSelect={},colorSelect={},c=vm.createContext({fontSelect,colorSelect,
    createFontPicker:options=>calls.push(['font',options.force,options.selectEl]),createColorPicker:(select,options)=>calls.push(['color',options.force,select]),
    window:{SignMakerEditorRuntime:{ensureElement:select=>calls.push(['drain',select])}}});
  vm.runInContext(form('ensureCustomShieldMakerPickers')+';this.ensure=ensureCustomShieldMakerPickers;',c);c.ensure();c.ensure();
  assert.deepEqual(calls.slice(0,2),[['font',true,fontSelect],['color',true,colorSelect]]);assert.equal(calls.length,8);
});
const sourceStyles=[...html.matchAll(/<link\b[^>]*href="(css\/[^"?]+)/g)].map(match=>read('public/'+match[1])).join('\n');
for(const [version,css] of [['source',sourceStyles],['production',read('public/'+manifest.deferredStyles)]]) {
  const style=cascade(css,{respectLayers:true});
  for(const mobile of [false,true])test(`${version}: ${mobile?'mobile':'desktop'} shield dropdowns keep the same geometry despite older important theme rules and sibling changes`,()=>{
    const tree=parse(html),dialog=tree.querySelector('#customShieldMaker');if(mobile){tree.setAttribute('data-mobile-ui','');dialog.classList.add('mobileShieldMaker');}
    const triggers=[];
    for(const kind of ['Color','Font']) {
      const select=tree.querySelector('#customShieldMakerRoute'+kind),wrapper=new Node('div');wrapper.className=(kind==='Color'?'colorPicker':'fontPicker')+' customShieldMaker'+kind+'Picker';
      const trigger=new Node('button');trigger.className=kind==='Color'?'colorPickerTrigger':'fontPickerTrigger';wrapper.append(trigger);select.after(wrapper);
      const label=new Node('span');label.className=kind==='Color'?'colorPickerTriggerLabel':'fontPickerTriggerLabel';trigger.append(label);
      if (kind==='Font') assert.equal(style(label,'font-size'),mobile?'17px':'1rem');
      // A marker inserted by another editor must not make scoped styles vanish.
      select.after(new Node('span'));
      triggers.push(trigger);
      for(const property of ['height','min-height','max-height'])assert.equal(style(trigger,property),mobile?'40px':'2.1rem',property);
      assert.equal(style(trigger,'display'),'grid');assert.equal(style(wrapper,'width'),'100%');
    }
    for(const property of ['padding','border','background','color','height'])assert.equal(style(triggers[0],property),style(triggers[1],property),property);
    for (const field of tree.querySelectorAll('.customShieldMakerField')) assert.equal(style(field,'width'), !mobile && (field.classList.contains('customShieldMakerNameField') || field.classList.contains('customShieldMakerAlignmentField')) ? 'auto' : '100%');
    const row=tree.querySelector('.customShieldMakerSliderField');assert.equal(style(row,'grid-template-columns'),mobile?'minmax(0,1fr) 96px 32px':'minmax(0,1fr) 4.4rem 1.9rem');
    const buttons=tree.querySelector('.customShieldMakerStepButtons');assert.equal(style(buttons,'display'),mobile?'grid':'none');
    if (mobile) assert.equal(style(tree.querySelector('.customShieldMakerStepper input'), 'appearance'), 'textfield');
    if (mobile) assert.equal(style(buttons.children[0],'background'),'rgb(var(--inputColor))');
    if (!mobile) {
      assert.equal(tree.querySelector('#customShieldMakerDeleteButton').parentElement,tree.querySelector('.customShieldMakerNameRow'));
      assert.equal(tree.querySelector('.customShieldMakerFooter'),null);
      assert.equal(style(tree.querySelector('.customShieldMakerPreviewDropdowns'),'grid-template-columns'),'repeat(2,minmax(0,1fr)) max-content');
    }
  });
}

test('tapping an outside action commits the typed draft before that action reads the configuration',()=>{
  const h=sliderEditor(true),slider=h.get('customShieldMakerRouteFontSize'),input=h.get(slider.id+'Val');
  input.focus();input.value='235';input.dispatchEvent(new Event('input'));assert.equal(slider.value,'220');
  h.c.outside({target:h.get('customShieldMakerSaveButton')});
  assert.equal(slider.value,'235');assert.equal(h.document.activeElement,null);assert.equal(h.c.count(),2);
});

function shieldDeletionEditor({mobile=false,source='US',selectedUsesShield=true}={}) {
  const tree=parse(html),get=id=>tree.querySelector('#'+id),events=[];
  if(mobile)tree.setAttribute('data-mobile-ui','');
  const makeNode=tag=>{
    const node=new Node(tag);node.style.setProperty=(name,value)=>node.style[name]=value;
    node.replaceChildren=(...children)=>{node.innerHTML='';node.append(...children);};
    node.insertAdjacentElement=(position,other)=>{assert.equal(position,'afterend');node.after(other);};
    Object.defineProperty(node,'options',{get:()=>node.children.filter(child=>child.tagName==='OPTION')});
    return node;
  };
  for(const id of ['sdShield_shieldBase','sdShield_shieldType']) {
    const original=get(id),replacement=makeNode('select');replacement.id=id;original.after(replacement);original.remove();
    if(mobile){const field=makeNode('div');field.className='mobileField';replacement.before(field);field.append(replacement);}
  }
  const record={id:'a',value:'CUSTOMSHIELD-a',sourceShieldBase:source,name:'Custom US',imageData:'image'};
  const child={id:'b',value:'CUSTOMSHIELD-b',sourceShieldBase:record.value,name:'Derived',imageData:'image'};
  class ShieldElement {}
  Object.assign(ShieldElement.prototype,{defaultShieldBase:'I',defaultVariant:'Auto',normalizeShieldCode:value=>String(value||'').replace(/\s+/g,''),
    getBlockShieldConfig:value=>ShieldElement.prototype.blockShieldBases.find(base=>base.value===value),
    formatVariantKey:value=>value.replace(/\s+/g,''),getShieldAssetPath:(config,key)=>config.value+'/'+key,
    blockShieldBases:[{value:'I',variants:['2 Digit','3 Digit']},{value:'US',variants:['Standard','Wide']},{value:'C',variants:['Standard','Green']},
      {value:record.value,customShieldMaker:true,variants:['1 Digit','2 Digit']},{value:child.value,customShieldMaker:true,variants:['1 Digit','2 Digit']}]});
  const shield=()=>Object.assign(new ShieldElement(),{shieldBase:record.value,type:record.value,shieldType:'2 Digit',routeNumber:'90',shieldSize:2.7,bannerType:'NORTH',alignment:'Right'});
  const active=shield(),nested=shield(),header=shield(),footer=shield(),secondPanel=shield(),legacy={type:record.value,routeNumber:'45'},other=Object.assign(shield(),{shieldBase:'C',type:'C',shieldType:'Green'});
  if(!selectedUsesShield)Object.assign(active,{shieldBase:'US',type:'US',shieldType:'Wide'});
  const control=(...elements)=>({rows:[elements]});
  const grouped={blockElements:control({blockElements:control(nested)})};
  const post={panels:[{sign:{blockElements:control(active,other),globalTopBlockElements:control(header),globalBottomBlockElements:control(footer),subPanels:[{blockElements:control(grouped),shields:[legacy]}]}},
    {sign:{blockElements:control(secondPanel)}}]};
  const apiSet=new Set(),document={documentElement:tree,getElementById:get,createElement:makeNode};
  const buildPicker=({mount,value=''})=>{
    const element=makeNode('div'),button=makeNode('button');element.append(button);mount.after(element);mount.remove();
    const api={element,getValue:()=>value,setValue(next){value=next;button.textContent=next;},setState(state){this.setValue(state.value);},refreshPreview(){},
      refresh(){assert.ok(ShieldElement.prototype.blockShieldBases.some(base=>base.value===value),'Picker refreshed with a deleted shield');}};
    api.setValue(value);return api;
  };
  const c=vm.createContext({document,window:{},console,ShieldElement,post,customShieldMakerRecords:[record,child],sdShieldVariantSelectionMemory:new WeakMap(),
    SHIELD_PICKER_TREE:[{value:'__customShieldMaker'},{value:record.value,customSavedShield:true},{value:child.value,customSavedShield:true}],SHIELD_PICKER_CUSTOM_MAKER_VALUE:'__customShieldMaker',activeShieldPickerApis:apiSet,
    exposed:{getPost:()=>post,getCurrentBlockElem:()=>active,beginUndoableChange:()=>events.push('begin'),endUndoableChange:()=>events.push('end'),redraw:()=>events.push('redraw')},
    dialog:{_editingCustomShieldId:record.id},saveCustomShieldMakerRecords:()=>events.push('persist'),
    buildCustomShieldMakerConfig:record=>({value:record.value,customShieldMaker:true,variants:['1 Digit','2 Digit']}),buildCustomShieldMakerPickerNode:record=>({value:record.value,customSavedShield:true}),
    createShieldPicker:options=>{const api=buildPicker(options);apiSet.add(api);return api;},createSdShieldVariantPicker:buildPicker,
    lib:{appendOption(select,value){const option=makeNode('option');option.value=value;select.append(option);}},
    setCustomShieldMakerDeleteVisibility(){},closeCustomShieldMaker:()=>events.push('close'),updateShieldCountyVisibility(){},updateForm:()=>events.push('update')});
  vm.runInContext(['getCustomShieldMakerRecordById','getCustomShieldMakerFallbackBase','traverseControlShieldElements','revertCustomShieldMakerUsageToSource',
    'syncCustomShieldMakerConfigs','syncCustomShieldMakerPickerTree','refreshAllShieldPickers','refreshCustomShieldMakerRegistry','deleteCustomShieldMakerRecord',
    'getSdShieldAutoVariantValue','getSdShieldVariantConfig','sdShieldUsesExplicitFirstVariant','getSdShieldDefaultVariantValue','getSdShieldVariantValues',
    'getSdShieldVariantMemory','getRememberedSdShieldVariantSelection','rememberSdShieldVariantSelection','populateSdShieldVariantNativeOptions',
    'syncShieldBasePickerValue','ensureSdShieldBasePicker','syncSdShieldVariantPickerForBase','refreshAfterCustomShieldMutation','deleteCurrentCustomShieldMakerRecord'].map(form).join('\n')+
    ';this.remove=deleteCurrentCustomShieldMakerRecord;this.ensure=ensureSdShieldBasePicker;this.variants=syncSdShieldVariantPickerForBase;this.remember=rememberSdShieldVariantSelection;',c);
  c.ensure();c.variants(active.shieldBase,{requestedValue:active.shieldType});
  return {c,get,tree,active,nested,header,footer,secondPanel,legacy,other,post,record,child,events};
}
for(const mobile of [false,true]) {
  test(`${mobile?'mobile':'desktop'} custom shield deletion restores its source across panels and nested groups before refreshing pickers`,()=>{
    const h=shieldDeletionEditor({mobile});h.c.remember(h.nested,'US','Wide');h.c.remove();
    for(const shield of [h.active,h.nested,h.header,h.footer,h.secondPanel,h.legacy]){
      assert.equal(shield.shieldBase,'US');assert.equal(shield.type,'US');
      assert.ok(['Auto','Wide'].includes(shield.shieldType));
    }
    assert.equal(h.nested.shieldType,'Wide');
    assert.equal(h.active.routeNumber,'90');assert.equal(h.active.shieldSize,2.7);assert.equal(h.active.bannerType,'NORTH');assert.equal(h.active.alignment,'Right');
    assert.equal(h.other.shieldBase,'C');assert.equal(h.other.shieldType,'Green');
    const base=h.get('sdShield_shieldBase'),variant=h.get('sdShield_shieldType');
    assert.equal(base.value,'US');assert.equal(base.dataset.pickerValue,'US');assert.equal(base._shieldPickerApi.getValue(),'US');
    assert.equal(variant.value,'Auto');assert.ok(base._shieldPickerApi.element.isConnected);assert.ok(variant._shieldVariantPickerApi.element.isConnected);
    assert.equal(h.c.customShieldMakerRecords.length,1);assert.equal(h.child.sourceShieldBase,'US');
    assert.equal(h.events[0],'begin');assert.equal(h.events.at(-1),'end');assert.equal(h.events.filter(event=>event==='persist').length,1);
    assert.equal(h.c.dialog._editingCustomShieldId,null);
    h.c.ensure();h.c.variants('US',{requestedValue:'Wide',updateBlock:true});assert.equal(variant.value,'Wide');assert.equal(h.active.shieldType,'Wide');
  });
  test(`${mobile?'mobile':'desktop'} deleting a shield repairs detached base and variant picker elements`,()=>{
    const h=shieldDeletionEditor({mobile}),base=h.get('sdShield_shieldBase'),variant=h.get('sdShield_shieldType');
    const oldBase=base._shieldPickerApi,oldVariant=variant._shieldVariantPickerApi;oldBase.element.remove();oldVariant.element.remove();
    h.c.remove();assert.notEqual(base._shieldPickerApi,oldBase);assert.notEqual(variant._shieldVariantPickerApi,oldVariant);
    assert.ok(base._shieldPickerApi.element.isConnected);assert.ok(variant._shieldVariantPickerApi.element.isConnected);
    assert.equal(base._shieldPickerApi.getValue(),'US');assert.equal(variant.value,'Auto');
  });
}
test('deleting a County-based shield selects a supported variant and preserves county text',()=>{
  const h=shieldDeletionEditor({source:'C'});h.active.countyText='COOK';h.c.remove();
  assert.equal(h.active.shieldBase,'C');assert.equal(h.active.shieldType,'Standard');assert.equal(h.active.countyText,'COOK');
  assert.equal(h.get('sdShield_shieldType').value,'Standard');
});
test('deleting another custom shield preserves the active shield and its variant',()=>{
  const h=shieldDeletionEditor({selectedUsesShield:false});h.c.remove();
  assert.equal(h.active.shieldBase,'US');assert.equal(h.active.shieldType,'Wide');assert.equal(h.get('sdShield_shieldType').value,'Wide');
  assert.equal(h.nested.shieldBase,'US');
});
test('uploaded or unavailable shield sources fall back to a built-in shield without leaving orphan selections',()=>{
  for(const source of ['', 'missing', 'CUSTOMSHIELD-a']) {
    const h=shieldDeletionEditor({source});h.c.remove();
    assert.equal(h.active.shieldBase,'I');assert.equal(h.get('sdShield_shieldBase').value,'I');
  }
});
test('deleting a derived shield later still returns to the original source',()=>{
  const h=shieldDeletionEditor();h.c.remove();Object.assign(h.active,{shieldBase:h.child.value,type:h.child.value,shieldType:'1 Digit'});
  h.c.dialog._editingCustomShieldId=h.child.id;h.c.ensure();h.c.variants(h.child.value);h.c.remove();
  assert.equal(h.active.shieldBase,'US');assert.equal(h.get('sdShield_shieldBase').value,'US');assert.equal(h.c.customShieldMakerRecords.length,0);
});

function coloradoShieldRenderer() {
  const makeNode=tag=>{const node=new Node(tag);node.style.setProperty=(key,value)=>{node.style[key]=value;};return node;};
  const document={baseURI:'https://signmaker.test/',currentScript:{src:'https://signmaker.test/js/Control.js'},addEventListener(){},
    getElementById(){return null;},querySelectorAll(){return[];},createElement:makeNode,documentElement:makeNode('html')};
  document.documentElement.style.getPropertyValue=()=>'';
  const window={localStorage:{getItem(){return null;}},addEventListener(){},getComputedStyle:()=>({fontFamily:'Series D',letterSpacing:'0px',getPropertyValue(){return '';}})};
  const c=vm.createContext({document,window,URL,console,Image:class{},requestAnimationFrame:()=>0});
  for(const name of ['lib','Shield','Sign','ExitTab','Panel','VmsPanel','Post','Arrows','Control','SubPanels'])vm.runInContext(read('public/js/'+name+'.js'),c,{filename:name+'.js'});
  return c;
}
test('Colorado is a submenu with exactly the standard shield, E-470, and Northwest Parkway',()=>{
  const c=vm.createContext({SHIELD_PICKER_CUSTOM_MAKER_VALUE:'__customShieldMaker'});
  vm.runInContext(form('SHIELD_PICKER_TREE')+';this.tree=SHIELD_PICKER_TREE;',c);
  const us=c.tree.find(node=>node.id==='us'),colorado=us.children.find(node=>node.id==='us-colorado');
  assert.ok(colorado);assert.equal(colorado.label,'Colorado');assert.equal(us.children.some(node=>node.value==='CO'),false);
  assert.deepEqual(Array.from(colorado.children,node=>[node.value,node.label]),[['CO','Colorado'],['CO-E470','E-470'],['CO-NWP','Northwest Parkway']]);
  for(const entry of colorado.children){assert.ok(entry.asset.startsWith('img/shields/United States/CO/'));assert.ok(fs.existsSync(path.join(root,'public',entry.asset)));}
});
test('Colorado shields resolve through the moved folder in both current and legacy registries',()=>{
  const c=coloradoShieldRenderer();
  const result=JSON.parse(vm.runInContext(`JSON.stringify(['CO','CO-E470','CO-NWP'].map(value=>{
    const config=ShieldElement.prototype.getBlockShieldConfig(value);
    return {value:config.value,legacy:Shield.prototype.getDirectoryFromShield(value,'2 Digit'),
      image:ShieldElement.prototype.getRenderedShieldAssetPath(config,'3Digit'),static:config.suppressRouteNumber};
  }))`,c));
  for(const item of result){const expected='img/shields/United States/CO/'+(item.value==='CO'?'CO-2Digit':item.value)+'.svg';assert.equal(item.image,expected);assert.equal(item.legacy,expected);assert.equal(item.static,item.value!=='CO');}
});
test('static Colorado logos never render route-number overlays and keep their shield identity after JSON restoration',()=>{
  const c=coloradoShieldRenderer();
  for(const value of ['CO-E470','CO-NWP'])for(const number of ['90','470','']) {
    c.value=value;c.number=number;
    const element=vm.runInContext('Control.fromData({rows:[[{blockElemType:"ShieldElement",shieldBase:value,routeNumber:number}]]}).rows[0][0].createElement()',c);
    assert.equal(element.querySelector('.routeNumber'),null);
    assert.equal(element.querySelector('img').src,'img/shields/United States/CO/'+value+'.svg');
  }
  const standard=vm.runInContext('new ShieldElement({shieldBase:"CO",routeNumber:"470"}).createElement()',c);
  assert.ok(standard.querySelector('.routeNumber'));assert.equal(standard.querySelector('.routeNumber').innerHTML.replace(/<[^>]+>/g,''),'470');
  assert.equal(standard.querySelector('img').src,'img/shields/United States/CO/CO-2Digit.svg');
});
test('legacy None banners stay blank after template reconstruction without removing intentional blank or quoted banners',()=>{
  const c=coloradoShieldRenderer();
  assert.equal(vm.runInContext('ShieldElement.prototype.normalizeBannerType("None")',c),'');
  assert.equal(vm.runInContext('ShieldElement.prototype.hasBannerValue(" None ")',c),false);
  assert.equal(vm.runInContext('ShieldElement.prototype.hasBannerValue("   ")',c),true);
  c.quoted='"None"';assert.equal(vm.runInContext('ShieldElement.prototype.getBannerDisplayInfo(quoted).displayValue',c),'None');
  const rendered=vm.runInContext('Control.fromData({rows:[[{_elementType:"ShieldElement",shieldBase:"IL",bannerType:"None",bannerType2:"None"}]]}).rows[0][0].createElement()',c);
  assert.equal(rendered.querySelector('.bannerA'),null);assert.equal(rendered.querySelector('.bannerB'),null);
});
test('exit tab defaults use Series E while Series EEM remains an explicit selectable font',()=>{
  const c=coloradoShieldRenderer();
  assert.equal(vm.runInContext('ExitTab.prototype.defaultFHWAFontFamily',c),'Series E');
  assert.equal(vm.runInContext('new ExitTab({FHWAFont:true}).fontFamily',c),'Series E');
  assert.equal(vm.runInContext('new ExitTab({fontFamily:"Series EEM"}).fontFamily',c),'Series EEM');
  assert.equal(vm.runInContext('TextElement.prototype.fontFamily.includes("Series EEM")',c),true);
});

test('shield picker folders can be hidden, reordered, and receive built-in and custom shields', () => {
  const context = vm.createContext({window:{}});
  vm.runInContext(read('public/js/ShieldPickerSettings.js'), context);
  const {buildLayout} = context.window.SignMakerShieldPickerSettings;
  const maker = {id:'maker', value:'__customShieldMaker', customShieldMaker:true};
  const duplicate = {value:'PIP', label:'Palisades Interstate Parkway'};
  const custom = {value:'CUSTOM-1', label:'My shield', customSavedShield:true, asset:'sample.svg'};
  const interstate = {value:'I', label:'Interstate'};
  const catalogue = [maker, custom,
    {id:'us', label:'United States', children:[
      {id:'nj', label:'New Jersey', children:[duplicate, interstate]},
      {id:'ny', label:'New York', children:[duplicate]},
    ]},
  ];
  const folder = 'folder:my-folder';
  const customKey = 'shield::CUSTOM-1';
  const duplicateKey = 'shield:folder:nj:PIP';
  const settings = JSON.parse(JSON.stringify({
    folders:[{id:'my-folder', label:'Favorite shields', parent:''}],
    hidden:['folder:us'],
    moves:{[customKey]:folder, [duplicateKey]:folder},
    orders:{[folder]:[duplicateKey,customKey]},
  }));
  const layout = buildLayout(catalogue, settings);
  const visible = Array.from(layout.pickerTree());
  assert.deepEqual(visible.map(node=>node.id),['maker','my-folder']);
  assert.deepEqual(Array.from(visible[1].children),[duplicate,custom]);
  assert.deepEqual(Array.from(layout.children.get('folder:nj'), entry=>entry.node.value),['I']);
  assert.deepEqual(Array.from(layout.children.get('folder:ny'), entry=>entry.node.value),['PIP']);
  assert.equal(catalogue[1],custom);
  assert.equal(catalogue[2].children[0].children[1],interstate);

  const restored = buildLayout(catalogue, {...settings,hidden:[],moves:{[customKey]:folder,[duplicateKey]:''}});
  assert.deepEqual(Array.from(restored.pickerTree(), node=>node.id || node.value),['maker','us','PIP','my-folder']);
  assert.deepEqual(Array.from(restored.children.get(folder), entry=>entry.node.value),['CUSTOM-1']);
});

test('shield picker drag placements survive reload and reject nesting a folder inside itself', () => {
  const context = vm.createContext({window:{}});
  vm.runInContext(read('public/js/ShieldPickerSettings.js'), context);
  const {buildLayout, placeItem} = context.window.SignMakerShieldPickerSettings;
  const catalogue = [
    {id:'roads', label:'Roads', children:[{value:'US', label:'U.S. Route'}]},
    {value:'I', label:'Interstate'},
    {value:'CUSTOM-1', label:'My shield', customSavedShield:true},
  ];
  const roads = 'folder:roads';
  const favorites = 'folder:favorites';
  const interstate = 'shield::I';
  const custom = 'shield::CUSTOM-1';
  const route = 'shield:folder:roads:US';
  const settings = {
    folders:[{id:'favorites', label:'Favorites', parent:roads}],
    hidden:[], moves:{}, orders:{},
  };
  const move = (key, placement) => placeItem(buildLayout(catalogue, settings), settings, key, placement);
  const orderIn = (parent) => Array.from(
    buildLayout(catalogue, JSON.parse(JSON.stringify(settings))).children.get(parent), item => item.key);

  assert.equal(move(custom, {destination:'', anchor:interstate}), true);
  assert.deepEqual(orderIn(''), [roads, custom, interstate]);
  assert.equal(move(custom, {destination:'', anchor:interstate}), false);
  assert.equal(move(custom, {destination:'', anchor:interstate, after:true}), true);
  assert.deepEqual(orderIn(''), [roads, interstate, custom]);
  assert.equal(move(custom, {destination:favorites}), true);
  assert.deepEqual(orderIn(favorites), [custom]);
  assert.equal(move(custom, {destination:roads, anchor:route}), true);
  assert.deepEqual(orderIn(roads), [custom, route, favorites]);
  assert.equal(move(roads, {destination:favorites}), false);
  assert.equal(move(favorites, {destination:favorites}), false);
  assert.equal(move(favorites, {destination:''}), true);
  assert.equal(move(roads, {destination:favorites}), true);
  assert.deepEqual(orderIn(''), [interstate, favorites]);
  assert.deepEqual(orderIn(favorites), [roads]);
  assert.deepEqual(orderIn(roads), [custom, route]);
});
