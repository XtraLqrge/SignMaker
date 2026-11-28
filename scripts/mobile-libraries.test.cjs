const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Node, Event, parse} = require('./fixtures/mobile-dom.cjs');
const {cascade} = require('./fixtures/css-cascade.cjs');
const {parse: parseJS} = require('./build.cjs');
const root = path.resolve(__dirname, '..'), read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('scripts/index.source.html');
const manifest = JSON.parse(read('build-manifest.json'));
const declarations = new Map();
function declaration(file, name) {
  const key = file + name;
  if (declarations.has(key)) return declarations.get(key);
  const source = read(file), stack = [parseJS(source)];
  while (stack.length) {
    const current = stack.pop();
    if (current.type === 'VariableDeclarator' && current.id.name === name) {
      const result = `let ${source.slice(current.start, current.end)};`;
      declarations.set(key, result); return result;
    }
    for (const value of Object.values(current)) if (value && typeof value === 'object') {
      if (Array.isArray(value)) stack.push(...value.filter(item => item?.type));
      else if (value.type) stack.push(value);
    }
  }
  throw Error('Missing ' + name);
}
const main = name => declaration('public/js/main.js', name);
function environment() {
  const tree = parse(html); tree.setAttribute('data-mobile-ui', '');
  const get = id => tree.querySelector('#' + id);
  for (const element of [tree, ...tree.querySelectorAll('*')]) {
    element.style.setProperty = (key, value) => { element.style[key] = value; };
    element.style.removeProperty = key => { delete element.style[key]; };
    element.focus = () => { document.activeElement = element; };
  }
  const document = {documentElement: tree, getElementById: get, querySelector: s => tree.querySelector(s),
    createElement: tag => { const element = new Node(tag); element.focus = () => { document.activeElement = element; }; return element; }, createComment: text => new Node('#comment', text)};
  const viewport = {height: 640, offsetTop: 0, addEventListener(){}, removeEventListener(){}};
  const window = {innerHeight: 800, visualViewport: viewport, addEventListener(){}, removeEventListener(){}};
  let mutation;
  const context = vm.createContext({window, document, console, Event, URL, Promise,
    MutationObserver: class { constructor(fn){mutation=fn;} observe(){} disconnect(){} },
    ResizeObserver: class { observe(){} disconnect(){} }});
  window.ResizeObserver = context.ResizeObserver;
  return {tree, get, document, context, window, viewport, mutate: () => mutation?.()};
}
const styles = [['source', read('public/css/form.css') + '\n' + read('public/css/mobile.css') + '\n' + read('public/css/custom-shield-maker.css')], ['production', read('public/' + manifest.deferredStyles)]];
for (const [version, css] of styles) {
  const style = cascade(css);
  const source = version === 'source' ? read('public/js/MobileShieldMaker.js') : read('public/' + manifest.assets.find(asset => asset.source === 'js/MobileShieldMaker.js').output);
  test(`${version}: shield workspace retains every input, its events and exact desktop position`, () => {
    const h = environment(), dialog = h.get('customShieldMaker');
    const originals = dialog.querySelectorAll('input, select, button').map(node => [node, node.parentElement, node.parentElement.childNodes.indexOf(node)]);
    const save = h.get('customShieldMakerSaveButton'); let saves = 0;
    save.addEventListener('click', () => saves++);
    vm.runInContext(source, h.context);
    const api = h.window.SignMakerMobileShieldMaker;
    for (let cycle = 0; cycle < 3; cycle++) {
      api.setActive(true); api.setActive(true);
      assert.equal(dialog.querySelectorAll('.mobileShieldTabs').length, 0);
      assert.equal(save.closest('.mobileShieldHeaderActions')?.parentElement, dialog.querySelector('.customShieldMakerHeader'));
      assert.deepEqual(save.parentElement.children.map(button => button.id), ['customShieldMakerSaveButton','customShieldMakerClose']);
      assert.deepEqual(dialog.querySelector('.mobileShieldTransferActions').children.map(button=>button.id), ['customShieldMakerImportButton','customShieldMakerExportButton']);
      assert.equal(save.querySelector('.material-symbols-outlined').textContent,'check');
      assert.equal(style(h.get('customShieldMakerTitle'),'display'),'none');
      const nameRow=dialog.querySelector('.mobileShieldNameRow');
      assert.equal(nameRow.children[0], h.get('customShieldMakerNameInput').closest('label'));
      assert.equal(nameRow.children[1], h.get('customShieldMakerUploadButton'));
      assert.equal(nameRow.nextElementSibling,dialog.querySelector('.customShieldMakerPreviewFrame'));
      assert.equal(dialog.querySelector('.customShieldMakerAlignmentButton').textContent, 'Left');
      for (const field of dialog.querySelectorAll('.customShieldMakerField')) {
        const label = field.children[0];
        if (label?.tagName === 'SPAN') assert.equal(style(label, 'font'), '500 12px/1.3 Inter,sans-serif', label.textContent);
      }
      assert.equal(h.get('customShieldMakerPreviewImg').closest('.mobileShieldPreview')?.parentElement, dialog.querySelector('.customShieldMakerShell'));
      assert.equal(h.get('customShieldMakerRouteInput').closest('.mobileShieldPage'), h.get('mobileShieldFields'));
      save.dispatchEvent(new Event('click')); assert.equal(saves, cycle + 1);
      assert.equal(style(dialog.querySelector('.customShieldMakerBody'), 'overflow-y'), 'auto');
      assert.equal(style(dialog.querySelector('.customShieldMakerControls'), 'grid-area'), 'auto');
      assert.equal(style(save.closest('.mobileShieldHeaderActions'),'justify-content'),'space-between');
      assert.equal(style(h.get('mobileShieldFields'),'display'),'grid');
      api.setActive(false);
      assert.equal(dialog.querySelector('.customShieldMakerAlignmentButton').textContent, 'L');
      assert.equal(save.querySelector('.material-symbols-outlined').textContent,'save');
      for (const [node, parent, index] of originals) {
        assert.equal(node.parentElement, parent, node.id);
        assert.equal(parent.childNodes.indexOf(node), index, node.id);
      }
      assert.equal(dialog.querySelector('.mobileShieldPreview'), null);
    }
  });
  test(`${version}: shield preview fits wide and tall artwork and responds to the keyboard viewport`, () => {
    const h = environment(); vm.runInContext(source, h.context); h.window.SignMakerMobileShieldMaker.setActive(true);
    const dialog = h.get('customShieldMaker'), frame = dialog.querySelector('.customShieldMakerPreviewFrame'), stage = dialog.querySelector('.customShieldMakerPreviewStage');
    dialog.open = true; frame.clientWidth = 296; frame.clientHeight = 150;
    for (const [width, height] of [[400, 48], [48, 400], [48, 48], [10000, 48]]) {
      stage.offsetWidth = width; stage.offsetHeight = height; h.mutate();
      const scale = Number(frame.style['--customShieldPreviewScale']);
      assert.ok(width * scale <= 272 && height * scale <= 130);
    }
    h.viewport.height = 380; h.viewport.offsetTop = 20; h.window.SignMakerMobileShieldMaker.fit();
    assert.equal(dialog.style['--mobile-shield-height'], '380px');
    assert.equal(dialog.style['--mobile-shield-top'], '20px');
    h.window.SignMakerMobileShieldMaker.setActive(false);
    assert.equal(dialog.style['--mobile-shield-height'], undefined);
  });
  test(`${version}: the original shield slider bindings commit typed values in the flat mobile view`, () => {
    const h = environment();
    h.context.isUsableLiveInput = input => input.value !== '' && Number.isFinite(Number(input.value));
    h.context.recordCustomShieldMakerHistoryCheckpoint=()=>{};
    vm.runInContext('let customShieldMakerActiveSlider=null;'+['finishCustomShieldMakerSliderEdit','beginCustomShieldMakerSliderEdit','setCustomShieldMakerRangeValue','bindCustomShieldMakerRangePair'].map(name=>declaration('public/js/form.js',name)).join('\n') + ';this.bindPair=bindCustomShieldMakerRangePair;', h.context);
    const slider = h.get('customShieldMakerRouteLetterSpacing'), input = h.get('customShieldMakerRouteLetterSpacingVal');
    h.context.bindPair(slider, input);
    vm.runInContext(source, h.context); h.window.SignMakerMobileShieldMaker.setActive(true);
    input.value = '-12'; input.dispatchEvent(new Event('input')); assert.equal(String(slider.value),'0');
    input.dispatchEvent(new Event('blur')); assert.equal(String(slider.value), '-12');
    slider.value = '18'; slider.dispatchEvent(new Event('input')); assert.equal(input.value, '18');
    assert.equal(input.value, '18');
    h.window.SignMakerMobileShieldMaker.setActive(false);
    input.value = '1000'; input.dispatchEvent(new Event('change')); assert.equal(String(slider.value), '100');
  });
  test(`${version}: actual template renderer keeps five saved actions in one strip and calls the original operations`, async () => {
    const h = environment(), editor = new Node('section'); editor.id = 'mobileEditor';
    h.tree.append(editor); editor.append(h.tree.querySelector('.modals'));
    const calls = [], records = [{id:'saved',name:'A very long saved template name',templateScope:'panel',dateCreated:'2026-11-16',variants:[]}, {id:'default-apl',name:'Standard APL',isDefault:true,variants:[]}];
    Object.assign(h.context, {initTemplateDB: async()=>({getAllTemplates:async()=>records}), ensureDefaultTemplates:async()=>{},
      getTemplateSearchValue:()=>'',getTemplateSortMode:()=> 'alphabetical',getTemplateLoadWarningEnabled:()=>false,
      normalizeTemplateVariants:t=>t.variants,inferTemplateScope:t=>t.templateScope || 'panel', formatDate:()=> '11/16/2026',
      editTemplate:()=>{}, renameTemplate:id=>calls.push(['rename',id]), deleteTemplate:id=>calls.push(['delete',id]),
      loadTemplate:(id,mode)=>calls.push([mode,id]), endTemplatePanelDrag:()=>{}});
    vm.runInContext(main('createTemplateActionButton') + main('refreshTemplatesList') + ';this.render=refreshTemplatesList;', h.context);
    await h.context.render();
    const card = h.get('savedTemplatesList').children[0], strip = card.querySelector('.templateItemActions');
    assert.equal(strip.children.length, 5); assert.equal(style(strip,'flex-wrap'),'nowrap');
    const actions = ['replace-post','replace-panel','add','rename','delete'];
    for (const [index,button] of strip.children.entries()) {
      assert.ok(button.getAttribute('aria-label'));
      assert.notEqual(style(button,'display'),'none');
      button.dispatchEvent(new Event('click')); assert.deepEqual(calls.at(-1),[actions[index],'saved']);
    }
    assert.equal(style(card.querySelector('.templateDesktopRename'),'display'),'none');
    const minWidth = 320 - 20 - 18, fixedActions = 34 * 2 + 4 * 4;
    assert.ok((minWidth-fixedActions)/3 >= 60,'Post, Panel, Add retain room at 320px');
    assert.equal(h.get('presetTemplatesList').children[0].querySelector('.templateItemActions').children.length,3);
    assert.equal(style(h.get('templateNameInput'),'min-width'),'0');
  });
}

test('supplied preset documents migrate stock IDs in place and preserve saved user templates', async () => {
  const documents = Object.fromEntries(['simple_exit','mileage_sign','mile_marker','standard_apl','vms'].map(name=>[name,JSON.parse(read('public/presets/'+name+'.json'))]));
  const saved = {id:'user',name:'My template',data:'unchanged'}, variants = [{id:'variant',data:'custom'}];
  const existing = [saved,{id:'default-simple-exit',data:'old',variants,dateCreated:'2026-01-01',dateLastUsed:'2026-02-01'}, {id:'default-mileage-sign',data:'old'}, {id:'default-tolled-exit'}, {id:'default-control-cities-advance-junction'}];
  const written = [], c = vm.createContext({window:{SignMakerPresetTemplates:documents},Promise,URL,
    buildSimpleExitTemplate(){},buildMileageTemplate(){},buildTolledExitTemplate(){},buildControlCitiesAdvanceJunctionTemplate(){},
    DEFAULT_TEMPLATE_DATE:'2026-08-24T00:00:00.000Z',createDefaultTemplateData:()=>{throw Error('Unexpected legacy preset regeneration');}});
  vm.runInContext(main('DEFAULT_TEMPLATE_DEFINITIONS')+main('loadPresetDocuments')+'let defaultTemplatesPromise;'+main('ensureDefaultTemplates')+';this.ensure=ensureDefaultTemplates;',c);
  await c.ensure({getAllTemplates:async()=>existing,saveTemplate:async data=>written.push(data)});
  assert.equal(written.length,5); assert.equal(saved.data,'unchanged');
  for(const [id, key] of [['simple-exit','simple_exit'],['mileage-sign','mileage_sign'],['standard-apl','standard_apl'],['vms','vms']]) {
    const record=written.find(item=>item.id==='default-'+id);
    assert.deepEqual(JSON.parse(record.data),documents[key].post); assert.equal(record.presetRevision,1);
  }
  const replacement=written.find(item=>item.id==='default-simple-exit');
  assert.deepEqual([...replacement.variants],variants); assert.equal(replacement.dateLastUsed,'2026-02-01'); assert.equal(replacement.dateCreated,'2026-01-01');
  const mileMarker=written.find(item=>item.id==='default-mile-marker'), [enhanced, standard]=documents.mile_marker.post.panels;
  assert.equal(mileMarker.name,'Mile Marker'); assert.equal(mileMarker.baseName,'Enhanced'); assert.equal(mileMarker.presetRevision,1);
  assert.deepEqual(JSON.parse(mileMarker.data).panels,[enhanced]);
  assert.deepEqual(JSON.parse(JSON.stringify(mileMarker.variants.map(({id,name})=>({id,name})))),[{id:'standard',name:'Standard'}]);
  assert.deepEqual(JSON.parse(mileMarker.variants[0].data).panels,[standard]);
});
test('preset artwork is emitted as a separate lazy asset and matches the supplied documents', () => {
  const bundle=manifest.assets.find(asset=>asset.source==='js/PresetTemplates.js'); assert.ok(bundle);
  const c=vm.createContext({window:{}}); vm.runInContext(read('public/'+bundle.output),c);
  for(const name of ['simple_exit','mileage_sign','mile_marker','standard_apl','vms']) assert.deepEqual(JSON.parse(JSON.stringify(c.window.SignMakerPresetTemplates[name])), JSON.parse(read('public/presets/'+name+'.json')));
  assert.ok(!read('public/index.html').includes(bundle.output));
  const startup=manifest.assets.find(asset=>asset.source==='js/Startup.js');assert.ok(!read('public/'+startup.output).includes(bundle.output));
  const mainAsset=manifest.assets.find(asset=>asset.source==='js/main.js');assert.ok(read('public/'+mainAsset.output).includes(bundle.output));
});


test('preset document requests share one script and recover after a failed load', async () => {
  const scripts = [], window = {}, document = {baseURI:'https://example.test/signmaker/', head:{appendChild:script=>scripts.push(script)}, createElement:()=>({remove(){}})};
  const c=vm.createContext({window,document,URL,Promise});
  vm.runInContext('let presetDocumentsPromise;'+main('loadPresetDocuments')+';this.load=loadPresetDocuments;',c);
  const first=c.load(),same=c.load(); assert.equal(first,same); assert.equal(scripts.length,1);
  assert.equal(scripts[0].src,'https://example.test/signmaker/js/PresetTemplates.js');
  scripts[0].onerror(); await assert.rejects(first,/Unable to load/);
  const retry=c.load(); assert.equal(scripts.length,2);
  window.SignMakerPresetTemplates={loaded:true};scripts[1].onload();
  assert.equal(await retry,window.SignMakerPresetTemplates);
  assert.equal(await c.load(),window.SignMakerPresetTemplates);assert.equal(scripts.length,2);
});

function shieldCodec() {
  const c = vm.createContext({console, Promise, Date, ShieldElement:{prototype:{normalizeShieldCode:value=>value}}});
  const names = ['CUSTOM_SHIELD_MAKER_VALUE_PREFIX','CUSTOM_SHIELD_MAKER_VARIANT_KEYS','getCustomShieldMakerImageVariantKeys',
    'normalizeCustomShieldMakerVariantKey','getCustomShieldMakerVariantKeyFromRoute','normalizeCustomShieldMakerVariantList',
    'getCustomShieldMakerValue','createCustomShieldMakerId','getCustomShieldMakerDisplayNumber','normalizeCustomShieldMakerRouteStyle',
    'normalizeCustomShieldMakerAnchor','normalizeCustomShieldMakerRecord','parseCustomShieldMakerConfig','createCustomShieldMakerConfig'];
  vm.runInContext(names.map(name=>declaration('public/js/form.js',name)).join('\n')+';this.parseShield=parseCustomShieldMakerConfig;this.exportShield=createCustomShieldMakerConfig;', c);
  return c;
}
const sampleShield = () => ({id:'original',name:'My Shield',usesUploadedImage:true,routeNumber:'123',activeVariant:'3',
  imageDataByVariant:{'1':'data:image/png;base64,AQ==','2':'data:image/webp;base64,Ag==','3':'data:image/svg+xml;base64,Aw==','4':'data:image/png;base64,BA=='},
  routeStyleByVariant:Object.fromEntries(['1','2','3','4'].map((key,i)=>[key,{fontSize:417.125+i, fontFamily:'Series D',color:'#1a2b3c',fontWeight:4000,letterSpacing:-12.345,topOffset:2.75,horizontalOffset:-3.125,alignment:i%2?'left':'right'}])),
  anchorByVariant:Object.fromEntries(['1','2','3','4'].map(key=>[key,{x:42.875,y:63.125,seedTop:2.75,seedHorizontal:-3.125}]))});

test('custom shield JSON round-trips every image, decimal style and anchor without overwriting an existing shield', async () => {
  const c=shieldCodec(), original=sampleShield();
  const configuration=await c.exportShield(original, image=>image);
  const imported=c.parseShield(JSON.stringify(configuration));
  for(const property of ['name','routeNumber','activeVariant','imageDataByVariant','routeStyleByVariant','anchorByVariant','usesUploadedImage']) {
    assert.deepEqual(JSON.parse(JSON.stringify(imported[property])), original[property],property);
  }
  assert.notEqual(imported.id,original.id);assert.notEqual(imported.value,'CUSTOMSHIELD-original');
  assert.equal(configuration.format,'signmaker-custom-shield');assert.equal(configuration.schemaVersion,1);
});
test('custom shield export embeds remote artwork once even when variants share it', async () => {
  const c=shieldCodec(),calls=[],original=sampleShield();original.imageDataByVariant={1:'img/shared.svg',2:'img/shared.svg',3:'img/other.webp'};
  const configuration=await c.exportShield(original,async image=>{calls.push(image);return 'data:image/png;base64,AQ==';});
  assert.deepEqual(calls,['img/shared.svg','img/other.webp']);assert.ok(Object.values(configuration.shield.imageDataByVariant).every(image=>image.startsWith('data:')));
  assert.equal(original.imageDataByVariant[1],'img/shared.svg');assert.ok(c.parseShield(JSON.stringify(configuration)));
});
test('custom shield import rejects unrelated JSON, future versions, missing artwork and invalid style values', () => {
  const c=shieldCodec();
  for(const configuration of [{}, {format:'signmaker-custom-shield',schemaVersion:2,shield:sampleShield()},
    {format:'signmaker-custom-shield',schemaVersion:1,shield:{}},
    {format:'signmaker-custom-shield',schemaVersion:1,shield:{...sampleShield(),imageDataByVariant:{1:'https://example.test/image.svg'}}},
    {format:'signmaker-custom-shield',schemaVersion:1,shield:{...sampleShield(),routeStyle:{fontSize:'invalid'}}}]) {
    assert.throws(()=>c.parseShield(JSON.stringify(configuration)));
  }
});
test('preview and sign share the exact route style renderer for fonts, spacing, weight and alignment', () => {
  const h=environment();
  const makeRoute=()=>{const route=new Node('span');route.replaceChildren=(...nodes)=>{for(const child of [...route.childNodes])child.remove();route.append(...nodes);};return route;};
  const route=makeRoute(), shell=h.get('customShieldMakerShieldShell');
  Object.assign(h.context,{lib:{colors:{White:'#ffffff'}},isMotorwayFont:font=>font==='Motorway',encodeMotorwayRouteText:text=>text,
    resolveTextFontFamilyForRender:font=>font,routeNumber:route,routeInput:{value:'123'},fontSelect:{value:'Series D'},
    fontSizeInput:null,fontSizeValueInput:null,letterSpacingInput:null,letterSpacingValueInput:null,topOffsetInput:null,topOffsetValueInput:null,horizontalOffsetInput:null,horizontalOffsetValueInput:null,
    updateCustomShieldMakerCustomColorControls(){},fitCustomShieldMakerPreview(){}});
  vm.runInContext(['getCustomShieldMakerDisplayNumber','getCustomShieldMakerDisplayEm','getCustomShieldMakerCssColor','applyCustomShieldMakerRouteStyle'].map(name=>declaration('public/js/Control.js',name)).join('\n')+declaration('public/js/form.js','renderCustomShieldMakerRouteText')+declaration('public/js/form.js','updateCustomShieldMakerPreview')+';this.render=updateCustomShieldMakerPreview;this.apply=applyCustomShieldMakerRouteStyle;',h.context);
  for(const font of ['Series D','Clearview 5WR','Motorway'])for(const alignment of ['left','center','right']) {
    const style={fontFamily:font,fontSize:417.125,fontWeight:4000,letterSpacing:-12.345,topOffset:9.875,horizontalOffset:-3.5,alignment,color:'White'},anchor={x:42,y:62,seedTop:2.75,seedHorizontal:0};
    h.context.getCustomShieldMakerEditorStyle=()=>style;h.context.getCustomShieldMakerEditorAnchor=()=>anchor;h.context.fontSelect.value=font;
    h.context.render();
    const sign=makeRoute();sign.append(...Array.from('123',letter=>new Node('span',letter)));
    h.context.apply(sign,{customRouteStyle:style,customAnchor:anchor,routeNumber:'123'});
    assert.deepEqual(route.style,sign.style);
    assert.deepEqual(route.children.map(child=>child.style.marginLeft),sign.children.map(child=>child.style.marginLeft));
  }
  const style=cascade(read('public/css/form.css')+'\n'+read('public/css/custom-shield-maker.css'));
  assert.equal(style(shell,'font-size'),'1rem');
});
test('loaded slider values are whole numbers while text size retains a ten-unit slider step', () => {
  const c=vm.createContext({formatCustomShieldNumber:value=>String(Number(value))});
  vm.runInContext(declaration('public/js/form.js','setCustomShieldMakerRangeValue')+declaration('public/js/form.js','setInputValueIfPresent')+';this.set=setInputValueIfPresent;',c);
  const input=new Node('input');Object.assign(input,{id:'customShieldMakerRouteFontSize',type:'range',min:'50',max:'350',step:'10',value:'220'});
  c.set(input,417.125);assert.equal(input.value,'417');assert.equal(input.max,'417');assert.equal(input.step,'10');
  c.set(input,235);assert.equal(input.value,'235');assert.equal((Number(input.value)-Number(input.min))%10,0);
});

function listenerCode(target, type) {
  const source=declaration('public/js/form.js','initCustomShieldMaker'),stack=[parseJS(source)];
  while(stack.length) {
    const node=stack.pop();
    if(node.type==='CallExpression' && node.callee.object?.name===target && node.callee.property?.name==='addEventListener' && node.arguments[0]?.value===type) {
      const handler=node.arguments[1];return source.slice(handler.start,handler.end);
    }
    for(const value of Object.values(node))if(value&&typeof value==='object') {
      if(Array.isArray(value))stack.push(...value.filter(item=>item?.type));else if(value.type)stack.push(value);
    }
  }
  throw Error('Missing listener '+target);
}
test('import handler opens a new draft, clears the file input and leaves the editor intact on invalid JSON', async () => {
  const c=shieldCodec(),dialog={_editingCustomShieldId:'existing'},alerts=[],applied=[],input={value:'file.json',files:[{text:async()=>JSON.stringify({format:'signmaker-custom-shield',schemaVersion:1,shield:sampleShield()})}]};
  Object.assign(c,{dialog,importInput:input,window:{alert:message=>alerts.push(message)},
    applyCustomShieldMakerRecordToEditor:record=>applied.push(record),setCustomShieldMakerDeleteVisibility(){},updateCustomShieldMakerPreview(){},resetCustomShieldMakerHistory(){}});
  const handler=vm.runInContext('('+listenerCode('importInput','change')+')',c);
  await handler();assert.equal(applied.length,1);assert.equal(dialog._editingCustomShieldId,null);assert.equal(input.value,'');
  dialog._editingCustomShieldId='keep-this';input.value='invalid.json';input.files=[{text:async()=>'{broken'}];
  await handler();assert.equal(applied.length,1);assert.equal(dialog._editingCustomShieldId,'keep-this');assert.equal(alerts.length,1);assert.equal(input.value,'');
});
test('export handler downloads an application/json file with a portable shield configuration', async () => {
  const c=shieldCodec(),record=sampleShield(),button={disabled:false},body=new Node('body');let download,blob,revoked;
  Object.assign(c,{exportButton:button,collectCustomShieldMakerRecordFromEditor:()=>record,Blob,
    URL:{createObjectURL:value=>{blob=value;return 'blob:shield';},revokeObjectURL:url=>{revoked=url;}},
    document:{body,createElement:()=>{const link=new Node('a');link.click=()=>{download={href:link.href,name:link.download};};return link;}},
    window:{alert:message=>assert.fail(message),setTimeout:fn=>fn()}});
  const handler=vm.runInContext('('+listenerCode('exportButton','click')+')',c);await handler();
  assert.equal(button.disabled,false);assert.equal(blob.type,'application/json');assert.equal(download.name,'My_Shield.json');assert.equal(download.href,'blob:shield');assert.equal(revoked,'blob:shield');
  const configuration=JSON.parse(await blob.text());assert.equal(configuration.format,'signmaker-custom-shield');assert.deepEqual(configuration.shield.imageDataByVariant,record.imageDataByVariant);assert.equal(body.children.length,0);
});
test('WebP uploads reach the same variant state and preview path as SVG and PNG', () => {
  const images=[],state={activeVariant:'2',imageDataByVariant:{},routeStyleByVariant:{},anchorByVariant:{}},reader={readAsDataURL:file=>reader.onload({target:{result:'data:'+file.type+';base64,AQ=='}})};
  const c=vm.createContext({FileReader:class{constructor(){return reader;}},previewImg:{},emptyPreview:{},dialog:{dataset:{}},topOffsetInput:{value:'0'},horizontalOffsetInput:{value:'0'},
    setCustomShieldMakerAnchor(){},getDisplayInputValue:input=>Number(input.value),ensureCustomShieldMakerVariantState:()=>state,
    normalizeCustomShieldMakerVariantKey:key=>key,getCustomShieldMakerVariantKeyForEditor:()=> '2',getCustomShieldMakerImageVariantKeys:map=>Object.keys(map),
    getCustomShieldMakerEditorStyle:()=>({fontSize:220}),getCustomShieldMakerEditorAnchor:()=>({x:50,y:50}),updateCustomShieldMakerVariantButtons(){},
    updateCustomShieldMakerPreview:()=>images.push(state.imageDataByVariant['2']),recordCustomShieldMakerHistoryCheckpoint(){}});
  const handler=vm.runInContext('('+listenerCode('fileInput','change')+')',c);
  for(const type of ['image/webp','image/png','image/svg+xml'])handler({target:{files:[{name:'shield',type}]}});
  assert.equal(images.length,3);assert.ok(images[0].startsWith('data:image/webp;'));
});
