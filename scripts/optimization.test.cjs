const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {compactJS,parse,normalize} = require('./build.cjs');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const parsed=new Map();
function declaration(file,name) {
  if(!parsed.has(file))parsed.set(file,{source:read(file),ast:parse(read(file))});
  const {source,ast}=parsed.get(file),stack=[ast];
  while(stack.length){
    const node=stack.pop();
    if(node.type==='VariableDeclarator'&&node.id.name===name)return `let ${source.slice(node.start,node.end)};`;
    if(node.type==='FunctionDeclaration'&&node.id.name===name)return source.slice(node.start,node.end);
    for(const value of Object.values(node))if(value&&typeof value==='object'){
      if(Array.isArray(value))stack.push(...value.filter(x=>x?.type));else if(value.type)stack.push(value);
    }
  }
  throw Error('Missing declaration '+name);
}
const context=extras=>vm.createContext({console,URL,Promise,setTimeout,clearTimeout,queueMicrotask,...extras});
class Classes {
  constructor(...values){this.values=new Set(values);}
  contains(value){return this.values.has(value);}
  add(...values){values.forEach(value=>this.values.add(value));}
  remove(...values){values.forEach(value=>this.values.delete(value));}
  toggle(value,force){force=force??!this.contains(value);force?this.add(value):this.remove(value);return force;}
}
class Element {
  constructor(classes='',tag='DIV'){
    this.classList=new Classes(...classes.split(' ').filter(Boolean));this.tagName=tag;this.nodeType=1;
    this.children=[];this.parentElement=null;this.isConnected=true;this.hidden=false;this.dataset={};
    this.properties=new Map();this.writes=0;
    this.style={display:'',getPropertyValue:key=>this.properties.get(key)?.value||'',getPropertyPriority:key=>this.properties.get(key)?.priority||'',setProperty:(key,value,priority)=>{this.writes++;this.properties.set(key,{value,priority});}};
    this.scrollTop=0;this.scrollWidth=320;this.scrollHeight=900;this.offsetWidth=200;
    this.rect={left:100,right:200,top:100,bottom:130,width:100,height:30};this.events=[];
  }
  set className(value){this.classList=new Classes(...value.split(' ').filter(Boolean));}
  get className(){return [...this.classList.values].join(' ');}
  set innerHTML(value){assert.equal(value,'');this.children=[];}
  get childElementCount(){return this.children.length;}
  replaceWith(node){const parent=this.parentElement;if(parent){parent.children[parent.children.indexOf(this)]=node;node.parentElement=parent;this.parentElement=null;}}
  appendChild(node){node.parentElement?.children.splice(node.parentElement.children.indexOf(node),1);this.children.push(node);node.parentElement=this;return node;}
  append(...nodes){nodes.forEach(node=>this.appendChild(node));}
  remove(){this.parentElement?.children.splice(this.parentElement.children.indexOf(this),1);this.isConnected=false;}
  matches(selector){return selector.split(',').some(s=>s.startsWith('.')?this.classList.contains(s.slice(1)):this.tagName===s.toUpperCase());}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  contains(target){for(let node=target;node;node=node.parentElement)if(node===this)return true;return false;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getBoundingClientRect(){return this.rect;}
  setAttribute(key,value){this[key]=value;}
  addEventListener(...args){this.events.push(args);}
  animate(frames,options){this.animation={frames,options,cancel(){this.cancelled=true;}};return this.animation;}
}
function dropdownFixture(file, count=0){
  const body=new Element(),html=new Element(),triggers=[],wrappers=[],carets=[],observed=[];
  let scans=0;
  for(let n=0;n<count;n++){
    const wrapper=new Element('symbolPicker'),trigger=new Element('nativeSelectTrigger'),caret=new Element('symbolPickerCaret','SVG');
    wrapper.appendChild(trigger);trigger.appendChild(caret);body.appendChild(wrapper);
    trigger.querySelectorAll=selector=>selector.includes('Caret')?[caret]:[];
    wrappers.push(wrapper);triggers.push(trigger);carets.push(caret);
  }
  const document={body,documentElement:html,querySelectorAll(selector){scans++;if(selector==='.colorPicker,.smColorPicker'||selector==='.fontPicker')return[];if(selector.includes('nativeSelectTrigger'))return triggers;return[];}};
  const window={innerWidth:900,innerHeight:600,localStorage:{getItem(){return null;},setItem(){}}};
  const c=context({window,document,getComputedStyle:()=>({fontSize:'20px',getPropertyValue(){return '0.5';}}),MutationObserver:class{constructor(cb){this.cb=cb;}observe(target,options){observed.push({observer:this,target,options});}disconnect(){this.disconnected=true;}}});
  vm.runInContext(read(file),c);
  return{api:window.SignMakerDropdowns,body,html,observed,triggers,wrappers,carets,get scans(){return scans;},get writes(){return [...wrappers,...triggers,...carets].reduce((sum,n)=>sum+n.writes,0);}};
}

test('compaction preserves ASI, regular expressions, template literals and directives',()=>{
  for(const source of ['"use strict";\nfunction f(){return\n /a+/.test("a")}','let a=1\n++a; const value=` space ${ a /* comment */+2 } end`;', 'let a = 2 / 2; let b=/[/*]/g; // comment\n[a,b].map(x=>x);','function f(){return /* newline\n */ {ok:true}}']){
    assert.equal(normalize(parse(compactJS(source))),normalize(parse(source)));
  }
});
test('production HTML references existing, content-addressed assets',()=>{
  const html=read('public/index.html'),manifest=JSON.parse(read('build-manifest.json'));
  for(const match of html.matchAll(/(?:src|href)="((?:js|css)\/[^"?]+)(?:\?[^"]*)?"/g)){
    assert.ok(fs.existsSync(path.join(root,'public',match[1])),match[1]);
    assert.match(match[1],/\.[a-f0-9]{16}\.(js|css)$/);
  }
  assert.equal(manifest.localStylesheetCount,1);
  assert.ok(!html.includes('src="js/HtmlToImage'));
  for(const asset of manifest.assets.filter(asset=>asset.source)){
    let source=read('public/'+asset.source);
    if(asset.source==='js/main.js')source=source.replace('js/HtmlToImage.js',manifest.assets.find(a=>a.source==='js/HtmlToImage.js').output);
    if(asset.source==='js/Control.js')source=source.replace('IconFallbacks.js?v=773d7c4b80c1',path.basename(manifest.assets.find(a=>a.source==='js/IconFallbacks.js').output));
    assert.ok(normalize(parse(source))===normalize(parse(read('public/'+asset.output))),asset.source+' is stale or changed semantics; run npm run build');
    assert.ok(read('public/_headers').includes('/'+asset.output+'\n  Cache-Control: public, max-age=31536000, immutable'));
  }
});
test('picker appearance adds no startup scans, inline writes or closed-menu observers',()=>{
  const before=dropdownFixture('scripts/fixtures/dropdown-before.js',100),after=dropdownFixture('public/js/DropdownTheme.js',100);
  before.api.init();after.api.init();
  for(let n=0;n<20;n++){before.api.refresh();after.api.refresh();}
  assert.ok(before.writes>1000);assert.ok(before.scans>100);
  assert.equal(after.writes,0);assert.equal(after.scans,0);assert.equal(after.observed.length,0);
  console.log(JSON.stringify({benchmark:'100 pickers, initialization plus 20 refreshes',before:{documentQueries:before.scans,inlineWrites:before.writes},after:{documentQueries:after.scans,inlineWrites:after.writes}}));
});
test('menus are scaled before animation, fit the viewport, scroll and release observers',()=>{
  const f=dropdownFixture('public/js/DropdownTheme.js'),owner=new Element('symbolPicker open'),trigger=new Element(),menu=new Element('symbolPickerMenu');
  f.body.appendChild(owner);owner.appendChild(trigger);
  const result=f.api.positionMenu(menu,trigger,{minWidth:9,maxWidth:24});
  assert.equal(result.scale,0.5);assert.equal(menu.style.getPropertyValue('transform'),'scale(0.5)');
  assert.ok(result.top>=0&&result.top+result.height<=600);assert.ok(result.width<=884);
  assert.equal(menu.style.getPropertyValue('overflow-y'),'auto');assert.ok(menu.animation);
  assert.equal(menu.inert,false);assert.equal(menu['aria-hidden'],'false');
  f.api.setAnimationsEnabled(false);assert.ok(menu.animation.cancelled);
  owner.classList.remove('open');f.observed.find(record=>record.target===owner).observer.cb();
  assert.equal(menu.inert,true);assert.equal(menu.style.getPropertyValue('visibility'),'hidden');
  assert.ok(f.observed.every(record=>record.observer.disconnected));
  owner.classList.add('open');f.api.positionMenu(menu,trigger);assert.equal(menu.inert,false);
  f.api.closeMenu(menu);assert.equal(menu.inert,true);
});
test('closed editors defer construction and build once when their pane opens',()=>{
  const modal=new Element('sMModal appSettingsConfig'),pane=new Element('tabHidden'),field=new Element('', 'SELECT');
  modal.appendChild(pane);pane.appendChild(field);
  const bar={dataset:{currentMenu:''}},document={getElementById:()=>bar};
  const c=context({window:{},document});vm.runInContext(read('public/js/EditorRuntime.js'),c);
  const api=c.window.SignMakerEditorRuntime;let built=0;
  assert.equal(api.defer(field,'font',()=>built++),true);
  api.defer(field,'native',()=>{throw Error('A generic picker replaced a font picker');});
  bar.dataset.currentMenu='appSettingsConfig';api.ensure();assert.equal(built,0);
  pane.classList.remove('tabHidden');api.ensure();api.ensure();assert.equal(built,1);
  assert.equal(api.pendingCount(),0);
  field.classList.add('assetHiddenSetting');api.defer(field,'font',()=>built++);api.ensure();assert.equal(built,1);field.classList.remove('assetHiddenSetting');api.ensure();assert.equal(built,2);
  const dialog=new Element('','DIALOG'),source=new Element();dialog.appendChild(source);dialog.open=false;
  api.defer(source,'native',()=>built++);api.ensure();assert.equal(built,2);dialog.open=true;api.ensure();assert.equal(built,3);
  const removed=new Element();removed.isConnected=false;api.defer(removed,'native',()=>built++);api.ensure();assert.equal(api.pendingCount(),0);
});
test('shield catalog builds on opening, renders expanded branches and preserves selection',()=>{
  const body=new Element(),mount=new Element('','SELECT');body.appendChild(mount);
  const tree=[{id:'us',label:'United States',children:[{id:'branch',label:'Region',children:[{id:'a',value:'A',label:'First'},{id:'b',value:'B',label:'Second'}]},{id:'collapsed',label:'Closed region',children:[{id:'c',value:'C',label:'Third'}]}]}];
  let icons=0,changes=[];
  const document={createElement:tag=>new Element('',tag.toUpperCase()),body,querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){}};
  const window={addEventListener(){},SignMakerDropdowns:{prepareMenu(){},positionMenu(){},refresh(){}}};
  const c=context({document,window,requestAnimationFrame(){},SHIELD_PICKER_TREE:tree,SHIELD_PICKER_CUSTOM_MAKER_VALUE:'custom',SHIELD_DROPDOWN_PLACEHOLDER_ICON:'placeholder',activeShieldPickerApis:new Set(),buildShieldPickerIconSrc:()=>'',setShieldPickerButtonIcon:()=>icons++,getStoredItem:()=>null,setStoredItem(){},STORAGE_KEYS:{shieldPickerScrollTop:'scroll'}});
  const names=['findFirstSelectableShieldEntry','findShieldPickerEntryByValue','buildShieldPickerTriggerLabel','updateShieldPickerTreeState','createShieldPickerRow','renderShieldPickerTree','createShieldPicker'];
  vm.runInContext(names.map(name=>declaration('public/js/form.js',name)).join('\n')+'this.create=createShieldPicker;',c);
  const picker=c.create({mount,value:'A',rootNodes:tree,onChange:value=>changes.push(value)});
  const root=picker.element,trigger=root.children[0],popover=root.children[1],catalog=popover.children[0];
  assert.equal(catalog.children.length,0,'closed catalogs must be empty');
  picker.setValue('A');assert.equal(icons,1,'unchanged values must not recreate previews');
  const click=node=>node.events.find(([type])=>type==='click')[1]({preventDefault(){},stopPropagation(){}});
  click(trigger);assert.equal(catalog.querySelectorAll('.shieldPickerItem').length,5);
  assert.equal(catalog.querySelectorAll('.shieldPickerItem').some(node=>node.dataset.nodeValue==='C'),false);
  click(catalog.querySelectorAll('.shieldPickerItem').find(node=>node.dataset.nodeId==='collapsed'));
  assert.equal(picker.getValue(),'C');assert.equal(changes.at(-1),'C');
  assert.equal(catalog.querySelectorAll('.shieldPickerItem').some(node=>node.dataset.nodeValue==='C'&&node.classList.contains('selected')),true);
  click(catalog.querySelectorAll('.shieldPickerItem').find(node=>node.dataset.nodeId==='collapsed'));
  assert.equal(catalog.querySelectorAll('.shieldPickerItem').some(node=>node.dataset.nodeValue==='C'),false);
  click(trigger);picker.setValue('B');assert.equal(picker.getValue(),'B');
  click(trigger);assert.equal(catalog.querySelectorAll('.shieldPickerItem').some(node=>node.dataset.nodeValue==='B'&&node.classList.contains('selected')),true);
});
test('layout scheduling coalesces events and unchanged transforms cause no writes',()=>{
  const jobs=[],observed=[];let writes=0,transform='';
  const post={offsetWidth:300,style:{get transform(){return transform},set transform(value){writes++;transform=value;}}};
  const c=context({window:{innerWidth:1000,requestAnimationFrame:fn=>{jobs.push(fn);return jobs.length;},addEventListener(){}},document:{getElementById:()=>post,documentElement:{clientWidth:1000},body:{},querySelector:()=>null,querySelectorAll:()=>[]},VmsPanel:{refreshPreviews(){}},MutationObserver:class{observe(target,options){observed.push({target,options});}},ResizeObserver:class{observe(){}},getMainVisualScale:()=>1,getVisibleSideMenuElements:()=>[],postViewportLayoutFrame:null,postViewportLayoutObserver:null});
  vm.runInContext(['updatePostViewportLayout','schedulePostViewportLayoutUpdate','bindPostViewportLayoutWatcher'].map(name=>declaration('public/js/main.js',name)).join('\n')+'\nthis.check={updatePostViewportLayout,schedulePostViewportLayoutUpdate,bindPostViewportLayoutWatcher};',c);
  for(let n=0;n<100;n++)c.check.schedulePostViewportLayoutUpdate();assert.equal(jobs.length,1);jobs.shift()();
  c.check.updatePostViewportLayout();assert.equal(writes,1);
  c.check.bindPostViewportLayoutWatcher();assert.ok(observed.length);assert.ok(observed.every(record=>!record.options.subtree));
});
test('type picker text measurements are cached and invalidate when fonts change',()=>{
  let probes=0,measurements=0,fontSize='16px';
  const body=new Element(),wrapper=new Element(),trigger=new Element(),label=new Element();
  const document={body,fonts:{status:'loaded'},createElement(){probes++;const node=new Element();node.getBoundingClientRect=()=>{measurements++;return{width:node.textContent.length*parseFloat(node.style.fontSize)/2};};return node;}};
  const window={getComputedStyle:element=>element===label?{fontFamily:'Inter',fontSize,fontWeight:'400',fontStyle:'normal',letterSpacing:'normal',lineHeight:'normal'}:{paddingLeft:'4',paddingRight:'4',borderLeftWidth:'1',borderRightWidth:'1',columnGap:'3'}};
  const c=context({document,window,getSubpanelBlockTypeEntries:()=>[{label:'Text'},{label:'Action Message'},{label:'Shield'}]});
  vm.runInContext('let blockTypeLabelWidths=new Map();'+declaration('public/js/form.js','syncSubpanelStandaloneBlockTypePickerWidth')+'this.measure=syncSubpanelStandaloneBlockTypePickerWidth;',c);
  for(let n=0;n<20;n++)c.measure(wrapper,trigger,label);
  assert.equal(probes,1);assert.equal(measurements,3);const width=wrapper.style.getPropertyValue('--block-type-trigger-width');
  fontSize='20px';c.measure(wrapper,trigger,label);assert.equal(probes,2);assert.notEqual(wrapper.style.getPropertyValue('--block-type-trigger-width'),width);
  document.fonts.status='loading';c.measure(wrapper,trigger,label);c.measure(wrapper,trigger,label);assert.equal(probes,4);
});
test('palette alias cache preserves named, RGB, hex and custom color behavior',()=>{
  const c=context({lib:{colors:{Green:'rgb(0, 95, 77)',Red:'rgb(255, 0, 0)',Blue:'#00437b'}}});
  const names=['normalizeCustomColorHexInput','clampCustomColorChannel','clampCustomColorAlpha','rgbToCustomColorHex','normalizeCustomCssColorValue','getDefaultColorNameForCustomPickerValue'];
  vm.runInContext('let defaultColorLookupSource=null,defaultColorLookup=new Map();'+names.map(name=>declaration('public/js/form.js',name)).join('\n')+'this.lookup=getDefaultColorNameForCustomPickerValue;',c);
  for(const [value,expected] of [['red','Red'],['#FF0000','Red'],['rgb(255,0,0)','Red'],['rgba(255,0,0,1)','Red'],['rgba(255,0,0,0.5)',''],['#00437B','Blue'],['custom',''],['Green','Green']])assert.equal(c.lookup(value),expected);
  c.lib.colors={Orange:'#FF5904'};assert.equal(c.lookup('Red'),'');assert.equal(c.lookup('rgb(255,89,4)'),'Orange');
});
test('export dependency loads once, retries after failure, and accepts an existing library',async()=>{
  const scripts=[],window={},document={baseURI:'https://example.test/',createElement:()=>({remove(){}}),head:{appendChild:script=>scripts.push(script)}};
  const c=context({window,document});vm.runInContext('let imageExportLibraryPromise=null;'+declaration('public/js/main.js','loadImageExportLibrary')+'this.load=loadImageExportLibrary;',c);
  const a=c.load(),b=c.load();assert.equal(a,b);assert.equal(scripts.length,1);
  const rejected=assert.rejects(a,/Unable to load/);scripts[0].onerror();await rejected;
  const retried=c.load();assert.equal(scripts.length,2);window.htmlToImage={toPng(){}};scripts[1].onload();
  assert.equal(await retried,window.htmlToImage);assert.equal(await c.load(),window.htmlToImage);assert.equal(scripts.length,2);
});
test('control cloning retains nested groups, shield style and header/footer placement',()=>{
  const document={baseURI:'https://example.test/',currentScript:{src:'https://example.test/js/Control.js'},addEventListener(){},getElementById(){return null;},querySelectorAll(){return[];},documentElement:{style:{getPropertyValue(){return'';}}}};
  const window={localStorage:{getItem(){return null;}},addEventListener(){}};
  const c=context({document,window,Image:class{},requestAnimationFrame:()=>0});
  for(const file of ['lib','Shield','Sign','ExitTab','Panel','VmsPanel','Post','Arrows','Control','SubPanels'])vm.runInContext(read('public/js/'+file+'.js'),c,{filename:file+'.js'});
  const outcome=vm.runInContext(`(()=>{
    const inner=new Control({rows:[[new ShieldElement({shieldBase:'I',routeNumber:'29',numberStyle:'legacy'})]],blockProperties:[new Block()]});
    const control=new Control({rows:[[new ActionMessageElement({textContent:'HEADER'})],[new GroupedBlockElement({label:'Nested',blockElements:inner})],[new ActionMessageElement({textContent:'FOOTER'})]],blockProperties:[new Block({edgePlacement:'header'}),new Block(),new Block({edgePlacement:'footer'})]});
    const restored=Control.fromData(JSON.parse(JSON.stringify(control)));restored.duplicateRow(1);
    restored.rows[2][0].blockElements.rows[0][0].routeNumber='100';
    return JSON.stringify({placements:restored.getRowEdgePlacements(),originalNumber:restored.rows[1][0].blockElements.rows[0][0].routeNumber,cloneNumber:restored.rows[2][0].blockElements.rows[0][0].routeNumber,legacy:restored.rows[1][0].blockElements.rows[0][0].numberStyle,group:restored.rows[1][0] instanceof GroupedBlockElement});
  })()`,c);
  assert.deepEqual(JSON.parse(outcome),{placements:['header','','','footer'],originalNumber:'29',cloneNumber:'100',legacy:'legacy',group:true});
});
test('asset compression preserves PNG raster bytes and ancillary chunks',()=>{
  const {chunks,recompressPNG}=require('./optimize-assets.cjs'),zlib=require('node:zlib');
  const sample=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZXsAAAAASUVORK5CYII=','base64');
  const compressed=recompressPNG(sample),before=chunks(sample),after=chunks(compressed);
  const raster=parts=>zlib.inflateSync(Buffer.concat(parts.filter(part=>part.type==='IDAT').map(part=>part.data)));
  assert.ok(raster(before).equals(raster(after)));
  assert.deepEqual(after.filter(part=>part.type!=='IDAT').map(part=>part.raw),before.filter(part=>part.type!=='IDAT').map(part=>part.raw));
  assert.ok(compressed.length<=sample.length);assert.ok(recompressPNG(compressed).equals(compressed));
});

test('UI fonts load locally and every interface icon has a verified glyph',()=>{
  const crypto=require('node:crypto'),manifest=JSON.parse(read('scripts/ui-fonts.json')),coverage=JSON.parse(read('scripts/ui-icon-coverage.json'));
  const html=read('public/index.html');
  assert.match(html,/^<!DOCTYPE html>/i);
  assert.equal(/<(?:link|script)\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(html),false);
  const icons=fs.readFileSync(path.join(root,'public/fonts/ui',coverage.file));
  assert.equal(crypto.createHash('sha256').update(icons).digest('hex'),coverage.sha256);
  assert.ok(icons.length<25000);
  const required=require('./ui-icons.cjs').collect(root,read('scripts/index.source.html'));
  for(const icon of [...required,...manifest.iconNames])assert.ok(coverage.verifiedIconNames.includes(icon),icon);
  for(const [file,record]of Object.entries(manifest.files)){
    const bytes=fs.readFileSync(path.join(root,'public/fonts/ui',file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,file);
  }
  const css=read('public/css/ui-fonts.css');
  assert.equal(/url\(https?:/.test(css),false);
  assert.match(css,/font-family: 'Inter'/);assert.match(css,/font-family: 'Overpass'/);assert.match(css,/font-display: swap/);
});

test('settings positioning handles closed and unknown menus without invalid selectors',()=>{
  const bar={dataset:{currentMenu:''}},holder={classList:new Classes(),style:{removeProperty(){}}};
  const document={getElementById:id=>id==='sMConfigBar'?bar:null,querySelector:selector=>{
    if(selector.endsWith('.')||selector.includes('undefined'))throw Error('Invalid selector '+selector);
    return selector==='.modals'?holder:null;
  }};
  const c=context({document});
  vm.runInContext(['panelStylePopoverIsOpen','clearPanelStylePopoverPosition','positionPanelStylePopover'].map(name=>declaration('public/js/form.js',name)).join('\n')+'this.position=positionPanelStylePopover;',c);
  for(const menu of ['',undefined,'guideArrowConfig','subPanelConfig','templates','panelStyleConfig','appSettingsConfig']){
    bar.dataset.currentMenu=menu;assert.doesNotThrow(()=>c.position(),String(menu));
  }
});

test('deferred galleries can initialize before a dialog opens and stay initialized',()=>{
  const dialog=new Element('','DIALOG'),gallery=new Element();dialog.open=false;dialog.appendChild(gallery);
  const c=context({window:{},document:{getElementById:()=>null}});vm.runInContext(read('public/js/EditorRuntime.js'),c);
  const api=c.window.SignMakerEditorRuntime;let built=0;
  assert.equal(api.defer(gallery,'gallery',()=>built++),true);api.ensure();assert.equal(built,0);
  api.ensureElement(gallery);api.ensureElement(gallery);assert.equal(built,1);
  dialog.open=true;api.ensure();assert.equal(built,1);
});

test('legacy shield gallery creates no preview images during closed-dialog startup',()=>{
  const holder=new Element(),dialog=new Element('','DIALOG');dialog.open=false;dialog.appendChild(holder);let images=0;
  const document={createElement:tag=>{if(tag==='img')images++;return new Element('',tag.toUpperCase());},getElementById:()=>null};
  const c=context({document,window:{},presetShieldList:holder,Shield:{prototype:{shieldDirectory:{Region:{type:'category',I:{type:'shield',name:'Interstate',variants:['2 Digit']},US:{type:'shield',name:'US Route',variants:['2 Digit']}}},getDirectoryFromShield:(name,variant)=>name+'/'+variant}}});
  vm.runInContext(read('public/js/EditorRuntime.js'),c);
  vm.runInContext(['createShieldRow','createShieldCategory','createFromDir','populateLegacyShieldGallery'].map(name=>declaration('public/js/form.js',name)).join('\n')+'this.populate=populateLegacyShieldGallery;',c);
  c.window.SignMakerEditorRuntime.defer(holder,'gallery',c.populate);assert.equal(images,0);
  c.window.SignMakerEditorRuntime.ensureElement(holder);assert.equal(images,2);
  const rows=holder.querySelectorAll('.shieldCategoryType');assert.equal(rows.length,2);assert.equal(rows[0].dataset.name,'I');
  for(const image of holder.querySelectorAll('IMG')){assert.equal(image.loading,'lazy');assert.equal(image.decoding,'async');}
  c.populate();assert.equal(images,2);
});

test('arrow previews defer construction and list rows persist across selection changes',()=>{
  const modal=new Element('sMModal guideArrowConfig'),mount=new Element('','SELECT');modal.appendChild(mount);
  const bar={dataset:{currentMenu:''}},events=[];let images=0,selected='';
  const document={createElement:tag=>new Element('',tag.toUpperCase()),getElementById:()=>bar,addEventListener:(...args)=>events.push(args)};
  const window={addEventListener(){},SignMakerDropdowns:{prepareMenu(){},positionMenu(){}}};
  const c=context({document,window,AbortController,createArrowPreviewNode:()=>{images++;return new Element('','IMG');},ARROW_PICKER_ITEMS:[]});
  vm.runInContext(read('public/js/EditorRuntime.js'),c);
  vm.runInContext(['findArrowPickerEntryByValue','createFlatArrowPicker'].map(name=>declaration('public/js/form.js',name)).join('\n')+'this.create=createFlatArrowPicker;',c);
  const picker=c.create({mount,value:'A',items:[{value:'A',label:'First'},{value:'B',label:'Second'}],onChange:value=>selected=value});
  assert.equal(images,0);
  bar.dataset.currentMenu='guideArrowConfig';window.SignMakerEditorRuntime.ensure();assert.equal(images,1);
  const trigger=picker.element.children[0],popover=picker.element.children[1],list=popover.children[0];
  const click=node=>node.events.find(([type])=>type==='click')[1]({preventDefault(){},stopPropagation(){}});
  assert.equal(list.childElementCount,0);click(trigger);assert.equal(list.childElementCount,2);assert.equal(images,3);
  const first=list.children[0];click(list.children[1]);assert.equal(selected,'B');assert.equal(picker.getValue(),'B');assert.equal(list.children[0],first);assert.equal(images,4);
  click(trigger);assert.equal(list.children[0],first);assert.equal(images,4);
  events.find(([type])=>type==='click')[1]({target:new Element()});assert.equal(picker.element.classList.contains('open'),false);
  picker.destroy();assert.equal(picker.element.isConnected,false);assert.equal(popover.isConnected,false);
});

test('color classification caches label discovery without hiding label text changes',()=>{
  let discoveries=0;const label={isConnected:true,htmlFor:'choice',textContent:'Color'};
  const select={tagName:'SELECT',id:'choice',name:'',className:'',dataset:{},classList:new Classes(),getAttribute(){return null;},get labels(){discoveries++;return[label];}};
  const c=context({document:{},CSS:{escape:x=>x}});
  vm.runInContext('let colorSelectLabels=new WeakMap();'+['getColorSelectLabelText','isColorSelectElement'].map(name=>declaration('public/js/form.js',name)).join('\n')+'this.classify=isColorSelectElement;',c);
  for(let n=0;n<20;n++)assert.equal(c.classify(select),true);assert.equal(discoveries,1);
  label.textContent='Alignment';assert.equal(c.classify(select),false);assert.equal(discoveries,1);
  select.id='backgroundColor';assert.equal(c.classify(select),true);assert.equal(discoveries,1);
  select.classList.add('fontPickerNativeSelect');assert.equal(c.classify(select),false);
});

test('hidden icon previews do not request or crop their default artwork',()=>{
  const modal=new Element('sMModal subPanelConfig'),image=new Element('','IMG');modal.appendChild(image);
  const bar={dataset:{currentMenu:''}},label={};let prepared=0;
  const document={getElementById:id=>({sMConfigBar:bar,sdIcon_previewImage:image,sdIcon_selectedLabel:label}[id])};
  const c=context({document,window:{},getSdIconDefinition:()=>({key:'A',definition:{label:'Airport',src:'airport.svg'}}),setPreparedIconImageSource:()=>prepared++});
  vm.runInContext(read('public/js/EditorRuntime.js'),c);vm.runInContext(declaration('public/js/form.js','updateSdIconPreview')+'this.update=updateSdIconPreview;',c);
  c.update();assert.equal(prepared,0);bar.dataset.currentMenu='subPanelConfig';c.window.SignMakerEditorRuntime.ensure();assert.equal(prepared,1);assert.equal(label.textContent,'Current: Airport');
});
