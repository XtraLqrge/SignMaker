const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {Node,Event}=require('./fixtures/mobile-dom.cjs');
const {parse,minifyJS}=require('./build.cjs');
const {cascade}=require('./fixtures/css-cascade.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const records=JSON.parse(read('scripts/fixtures/oc-highway-fonts.json')),manifest=JSON.parse(read('build-manifest.json'));
const form=read('public/js/form.js'),ast=parse(form);
function declaration(name){const stack=[ast];while(stack.length){const node=stack.pop();if(node.type==='VariableDeclarator'&&node.id.name===name)return 'const '+form.slice(node.start,node.end)+';';for(const value of Object.values(node))if(Array.isArray(value))stack.push(...value.filter(n=>n?.type));else if(value?.type)stack.push(value);}throw Error(name);}
function fixture({mobile=false,minified=false,preferences=new Map(),keyboard=false}={}){
 const html=new Node('html'),body=new Node('body');html.append(body);if(mobile)html.setAttribute('data-mobile-ui','');
 const document={documentElement:html,body,activeElement:null,createElement:tag=>make(tag),getElementById:id=>html.querySelector('#'+id),querySelectorAll:s=>html.querySelectorAll(s),querySelector:s=>html.querySelector(s),addEventListener:(...args)=>html.addEventListener(...args),removeEventListener:(...args)=>html.removeEventListener(...args)};
 function make(tag){const n=new Node(tag);n.style.setProperty=(key,value)=>n.style[key]=value;n.style.removeProperty=key=>delete n.style[key];n.scrollTop=0;n.scrollIntoView=()=>{};n.focus=()=>{document.activeElement=n;};n.click=()=>n.dispatchEvent(new Event('click',{bubbles:true}));n.prepend=(...children)=>{for(const child of children.reverse()){child.remove();n.childNodes.unshift(child);child.parentElement=n;}};n.insertAdjacentElement=(position,other)=>{assert.equal(position,'afterend');n.after(other);};n.replaceWith=other=>{n.before(other);n.remove();};Object.defineProperty(n,'childElementCount',{get:()=>n.children.length});return n;}
 const window={SignMakerMobile:{active:mobile},localStorage:{getItem:key=>preferences.get(key)??null,setItem:(key,value)=>preferences.set(key,value)},sessionStorage:{getItem:()=>null,setItem(){}},SignMakerDropdowns:{refresh(){},prepareMenu(){},positionMenu(){}},addEventListener(){},removeEventListener(){}};
 const c=vm.createContext({window,document,console,Event,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn(),MutationObserver:class{observe(){}disconnect(){}}});
 c.TextElement=class{};c.ExitTab=class{};c.TextElement.prototype.fontFamily=['Series E','Series EM','Series C','Series 4','Arial','Arial Bold'];c.ExitTab.prototype.fontFamilies=['Series E','Series EM'];
 const checkbox=make('input');checkbox.id='appHighwayVarFonts';checkbox.type='checkbox';body.append(checkbox);
 c.LEGACY_FONT_TO_DISPLAY_ALIAS={};
 vm.runInContext(read('public/js/HighwayVarFonts.js'),c);
 for(const file of ['PickerSearch','MobileDropdowns'])vm.runInContext(minified?minifyJS(read('public/js/'+file+'.js')):read('public/js/'+file+'.js'),c);
 if(keyboard){
  Object.assign(window,{innerWidth:1024,innerHeight:768});
  c.AbortController=AbortController;
  c.getComputedStyle=()=>({fontSize:'16px',getPropertyValue:()=>''});
  c.Event=class extends Event{stopImmediatePropagation(){this.stopPropagation();}};
  const create=document.createElement;
  document.createElement=tag=>{
   const node=create(tag);
   node.getBoundingClientRect=()=>({left:50,top:60,bottom:100,width:200});
   node.getClientRects=()=>[node.getBoundingClientRect()];
   node.scrollHeight=300;
   node.style.getPropertyValue=key=>node.style[key]||'';
   node.style.getPropertyPriority=()=>'';
   node.setSelectionRange=(start,end)=>{node.selectionStart=start;node.selectionEnd=end;};
   return node;
  };
  const theme=read('public/js/DropdownTheme.js');
  vm.runInContext(minified?minifyJS(theme):theme,c);
 }
 const choices=[],select=make('select');select.id='sdCtrlText_fontFamily';select.value='Series EM';body.append(select);
 Object.assign(c,{syncFontSelectOptionLabels(){},getUiFontDisplayName:value=>value,resolveFontPickerPreviewFont:value=>value,getFontPickerDisplaySize:()=>'.9rem',isMotorwayFont:()=>false,isHighwayGothicUiFont:value=>/^Series [A-Z]/.test(value),
  setNativeFontSelectValue:(node,value)=>{node.value=value;choices.push(value);},closeAllFontPickers:()=>{},syncAllFontPickers:()=>select._fontPickerApi?.sync()});
 for(const name of ['getFontPickerFamilies','getFontsForPickerFamily','getFontPickerPreviewFontForFamily','createFontPicker'])vm.runInContext(declaration(name),c);
 vm.runInContext('this.makeFont=createFontPicker;this.families=getFontPickerFamilies;',c);
 return {html,body,document,window,c,make,select,choices,checkbox,fire:(node,type,opts={})=>node.dispatchEvent(new c.Event(type,{bubbles:true,...opts}))};
}
test('existing font bytes are preserved and only the 27 supplied upright font files are added',()=>{
 for(const [file,sha]of Object.entries(JSON.parse(read('scripts/fixtures/existing-font-checksums.json'))))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public',file))).digest('hex'),sha,file);
 assert.equal(records.length,27);assert.equal(new Set(records.map(r=>r.family)).size,27);
 const files=fs.readdirSync(path.join(root,'public/fonts/oc-highway-var2')).filter(name=>/\.(woff2|woff|ttf|otf)$/i.test(name));assert.equal(files.length,27);
 for(const record of records){assert.ok(!/oblique/i.test(record.file));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/fonts/oc-highway-var2',record.file))).digest('hex'),record.sha256);}
});
test('the additional family is last, keeps all existing choices and registers on exit tabs as well',()=>{
 const h=fixture(),fonts=Array.from(h.c.TextElement.prototype.fontFamily),exits=Array.from(h.c.ExitTab.prototype.fontFamilies);
 assert.deepEqual(fonts.slice(0,6),['Series E','Series EM','Series C','Series 4','Arial','Arial Bold']);assert.deepEqual(exits.slice(0,2),['Series E','Series EM']);
 assert.deepEqual(fonts.slice(-27),records.map(r=>r.family));assert.deepEqual(exits.slice(-27),records.map(r=>r.family));
 const family=h.c.families().at(-1);assert.equal(family.family,'Highway VAR');assert.equal(family.fonts.length,27);
 vm.runInContext(read('public/js/HighwayVarFonts.js'),h.c);assert.equal(h.c.TextElement.prototype.fontFamily.length,fonts.length);
});
test('Highway VAR starts off for new and existing users, persists opt-in, and leaves saved selections readable',()=>{
 const key='signMaker.highwayVarFonts';
 for(const preferences of [new Map(),new Map([['signMaker.restoreOnRefresh','always'],['signMaker.settingsDefaults','{}']])]){
  const h=fixture({preferences}),picker=h.c.makeFont({selectEl:h.select,mode:'allFontsGrouped'});
  assert.equal(h.checkbox.checked,false);
  assert.equal(h.c.LEGACY_FONT_TO_DISPLAY_ALIAS['OC Highway VAR2 Series 9 G-2'],'Highway VAR Series 9 G-2');
  const trigger=picker.wrapper.querySelector('button');
  const hasFamily=()=>picker.menu.querySelectorAll('.fontPickerFamilyHeader').some(node=>node.textContent==='Highway VAR');
  trigger.click();
  assert.equal(hasFamily(),false);
  const input=picker.menu.querySelector('.pickerSearchInput');
  input.value='Highway VAR';h.fire(input,'input');
  assert.equal(hasFamily(),false);assert.equal(picker.menu.querySelector('.pickerSearchEmpty').hidden,false);
  trigger.click();h.checkbox.checked=true;h.fire(h.checkbox,'change');trigger.click();
  assert.equal(hasFamily(),true);assert.equal(preferences.get(key),'true');
  assert.equal(fixture({preferences}).checkbox.checked,true);
  const choice=picker.menu.querySelectorAll('.fontPickerFontItem').find(item=>item.dataset.fontValue==='Highway VAR Series 9 G-2');
  choice.click();
  h.checkbox.checked=false;h.fire(h.checkbox,'change');trigger.click();
  assert.equal(hasFamily(),false);
  assert.equal(h.select.value,'Highway VAR Series 9 G-2');
  assert.equal(preferences.get(key),'false');
 }
});
test('font registration can arrive before core scripts and installs after the models become available',()=>{
 let ready;const c=vm.createContext({window:{},document:{addEventListener:(name,callback)=>{assert.equal(name,'DOMContentLoaded');ready=callback;}}});
 assert.doesNotThrow(()=>vm.runInContext(read('public/js/HighwayVarFonts.js'),c));assert.ok(ready);
 c.TextElement=class{};c.TextElement.prototype.fontFamily=['Series EM'];c.ExitTab=class{};c.ExitTab.prototype.fontFamilies=['Series E'];
 ready();assert.equal(c.TextElement.prototype.fontFamily.length,28);assert.equal(c.ExitTab.prototype.fontFamilies.length,28);
 assert.equal(c.TextElement.prototype.fontFamily[0],'Series EM');
});
test('saved Highway VAR choices are prepared on demand and the files are available for image and SVG exports',async()=>{
 const links=[],loads=[],samples=[],c=vm.createContext({window:{},URL,setTimeout,clearTimeout,localStorage:{getItem:()=>null},document:{baseURI:'https://signmaker.test/',createElement:()=>({}),head:{appendChild:node=>links.push(node.href)},fonts:{load:(font,sample)=>{loads.push(font);samples.push(sample);return Promise.resolve([]);}}}});
 vm.runInContext(read('public/js/FontLoader.js'),c);assert.ok(!links.some(link=>link.includes('oc-highway')));
 await c.window.SignMakerFonts.preparePost({rows:records.map((r,i)=>({fontFamily:i===0?r.family.replace('Highway VAR','OC Highway VAR2'):r.family}))});assert.equal(loads.filter(font=>font.includes('Highway VAR')).length,27);
 assert.ok(samples.filter(sample=>sample==='0A½').length===27);
 for(const record of records)assert.ok(links.some(link=>link.endsWith('/oc-highway-var2/'+record.file)));
 const asset=manifest.assets.find(a=>a.source==='js/ExportAssets.js'),exportContext=vm.createContext({window:{},URL,document:{currentScript:{src:'file:///SignMaker/js/export.js'}}});
 vm.runInContext(read('public/'+asset.output),exportContext);
 const faces=exportContext.window.SignMakerExportAssets.fontFaces;
 for(const record of records){
  assert.ok(faces.some(face=>face.family===record.family&&face.cssText.includes(record.file)&&/font-style:\s*normal/.test(face.cssText)));
  assert.ok(faces.some(face=>face.family===record.family&&/Roadgeek.*\.woff2/.test(face.cssText)&&face.cssText.includes('unicode-range: U+00BC-00BE, U+2044, U+2150-215E')));
 }
});
for(const minified of [false,true])for(const mobile of [false,true]){
 const label=(minified?'minified':'source')+' '+(mobile?'mobile':'desktop');
 test(label+': typing on a closed font trigger opens and filters its search box',()=>{
  const h=fixture({minified,mobile,keyboard:true}),picker=h.c.makeFont({selectEl:h.select,mode:'allFontsGrouped'});
  const trigger=picker.wrapper.querySelector('button'),input=picker.menu.querySelector('.pickerSearchInput');
  trigger.focus();
  h.fire(trigger,'keydown',{key:'a',ctrlKey:true});
  assert.equal(picker.menu.classList.contains('open'),false);
  h.fire(trigger,'keydown',{key:'a'});
  assert.equal(picker.menu.classList.contains('open'),true);
  assert.equal(h.document.activeElement,input);
  assert.equal(input.value,'a');
  assert.equal(input.selectionStart,1);
  h.fire(input,'keydown',{key:'ArrowDown'});
  const result=h.document.activeElement;
  assert.ok(result.classList.contains('fontPickerItem'));
  h.fire(result,'keydown',{key:'r'});
  assert.equal(h.document.activeElement,input);
  assert.equal(input.value,'ar');
  input.value+='i';h.fire(input,'input');
  assert.deepEqual(picker.menu.querySelectorAll('.fontPickerFontItem').filter(item=>!item.hidden).map(item=>item.dataset.fontValue),['Arial','Arial Bold']);
  assert.equal(h.select.value,'Series EM');
  h.fire(input,'keydown',{key:'Enter'});
  assert.equal(h.select.value,'Arial');
 });
 test(label+': font search finds the bottom family, keeps focus while typing, and selects only on request',()=>{
  const h=fixture({minified,mobile,preferences:new Map([['signMaker.highwayVarFonts','true']])}),picker=h.c.makeFont({selectEl:h.select,mode:'allFontsGrouped'}),trigger=picker.wrapper.querySelector('button');trigger.click();
  const input=picker.menu.querySelector('.pickerSearchInput');assert.ok(input);input.focus();input.value='highway var 9 g-2';h.fire(input,'input');
  assert.equal(h.document.activeElement,input);assert.equal(input.isConnected,true);assert.equal(h.select.value,'Series EM');
  const visible=picker.menu.querySelectorAll('.fontPickerFontItem').filter(item=>!item.hidden);assert.equal(visible.length,1);assert.equal(visible[0].dataset.fontValue,'Highway VAR Series 9 G-2');
  assert.equal(picker.menu.querySelectorAll('.fontPickerFamilyBlock').filter(group=>!group.hidden).length,1);
  h.fire(input,'keydown',{key:'ArrowDown'});assert.equal(h.document.activeElement,visible[0]);h.fire(visible[0],'keydown',{key:'Enter'});
  assert.equal(h.select.value,'Highway VAR Series 9 G-2');assert.equal(picker.wrapper.classList.contains('open'),false);
  trigger.click();assert.equal(input.value,'');assert.equal(picker.menu.querySelector('.pickerSearchInput'),input);
  input.value='no-such-font';h.fire(input,'input');assert.equal(picker.menu.querySelector('.pickerSearchEmpty').hidden,false);
  h.fire(input,'keydown',{key:'Escape'});assert.equal(input.value,'');assert.equal(picker.wrapper.classList.contains('open'),true);
  h.fire(input,'keydown',{key:'Escape'});assert.equal(picker.wrapper.classList.contains('open'),false);assert.equal(h.select.value,'Highway VAR Series 9 G-2');
 });
 test(label+': shield search reveals nested matches without changing the tree or value and clears back to its original expansion',()=>{
  const h=fixture({minified,mobile}),nodes=[{id:'us',label:'United States',children:[{id:'co',label:'Colorado',children:[{id:'co-main',label:'Colorado',value:'CO'},{id:'e470',label:'E-470',value:'CO-E470'},{id:'nwp',label:'Northwest Parkway',value:'CO-NWP'}]},{id:'tx',label:'Texas',value:'TX'}]}];
  const before=JSON.stringify(nodes),selected=[],mount=h.make('select');h.body.append(mount);
  Object.assign(h.c,{SHIELD_PICKER_TREE:nodes,STORAGE_KEYS:{shieldPickerScrollTop:'scroll'},getStoredItem:()=>null,setStoredItem(){},activeShieldPickerApis:new Set(),SHIELD_DROPDOWN_PLACEHOLDER_ICON:'blank.svg',SHIELD_PICKER_CUSTOM_MAKER_VALUE:'custom-maker',buildShieldPickerTriggerLabel:node=>node.label,buildShieldPickerIconSrc:()=>'',setShieldPickerButtonIcon(){},exposed:null});
  for(const name of ['findShieldPickerEntryByValue','findFirstSelectableShieldEntry','updateShieldPickerTreeState','createShieldPickerRow','renderShieldPickerTree','createShieldPicker'])vm.runInContext(declaration(name),h.c);
  vm.runInContext('this.makeShield=createShieldPicker;',h.c);const picker=h.c.makeShield({mount,value:'TX',rootNodes:nodes,onChange:value=>selected.push(value)});
  const trigger=picker.element.querySelector('.shieldPickerTrigger');trigger.click();const menu=picker.element.querySelector('.shieldPickerPopover'),input=menu.querySelector('.pickerSearchInput');
  assert.equal(menu.querySelector('[data-node-value="CO-NWP"]'),null);input.value='northwest parkway';h.fire(input,'input');assert.ok(menu.querySelector('[data-node-value="CO-NWP"]'));assert.equal(picker.getValue(),'TX');assert.deepEqual(selected,[]);assert.equal(JSON.stringify(nodes),before);
  input.value='';h.fire(input,'input');assert.equal(menu.querySelector('[data-node-value="CO-NWP"]'),null);
  input.value='E470';h.fire(input,'input');assert.ok(menu.querySelector('[data-node-value="CO-E470"]'));h.fire(input,'keydown',{key:'Enter'});assert.equal(picker.getValue(),'CO-E470');assert.deepEqual(selected,['CO-E470']);
  trigger.click();assert.equal(input.value,'');input.value='unfindable';h.fire(input,'input');assert.equal(menu.querySelector('.pickerSearchEmpty').hidden,false);assert.equal(picker.getValue(),'CO-E470');
 });
 test(label+': variant dropdowns search their labels while retaining the current variant until selection',()=>{
  const h=fixture({minified,mobile}),mount=h.make('select');h.body.append(mount);
  Object.assign(h.c,{ShieldElement:{prototype:{defaultShieldBase:'I'}},SHIELD_DROPDOWN_PLACEHOLDER_ICON:'blank.svg',getSdShieldAutoVariantValue:()=>'Auto',getSdShieldVariantPreview:()=>({src:'blank.svg',resolvedVariant:'2-digit'}),setShieldPickerButtonIcon(){},fitShieldPickerTriggerLabelText(){}});
  vm.runInContext(declaration('createSdShieldVariantPicker')+'this.makeVariants=createSdShieldVariantPicker;',h.c);
  const values=[],picker=h.c.makeVariants({mount,onChange:value=>values.push(value)});picker.setState({unavailable:false,options:['Auto','Standard','Wide','Alternate'],variants:['Standard','Wide','Alternate'],value:'Standard'});
  const trigger=picker.element.querySelector('button');trigger.click();const menu=picker.element.querySelector('.shieldPickerPopover'),input=menu.querySelector('.pickerSearchInput');
  input.value='wide';h.fire(input,'input');assert.equal(picker.getValue(),'Standard');assert.equal(menu.querySelectorAll('.shieldPickerItem').filter(item=>!item.hidden).length,1);
  h.fire(input,'keydown',{key:'Enter'});assert.equal(picker.getValue(),'Wide');assert.deepEqual(values,['Wide']);trigger.click();assert.equal(input.value,'');
 });

}

test('the guide-arrow picker matches a multiword label from its trigger',()=>{
 const h=fixture({keyboard:true}),mount=h.make('select'),editor=h.make('div');
 editor.className='guideArrowConfig';editor.append(mount);h.body.append(editor);
 h.c.findArrowPickerEntryByValue=(value,items)=>items.find(item=>item.value===value);
 vm.runInContext(declaration('createFlatArrowPicker')+'this.makeArrow=createFlatArrowPicker;',h.c);
 const items=[{value:'DOWN',label:'Down'},{value:'TYPE_A',label:'Type A'},{value:'TYPE_A_EXTENDED',label:'Type A Extended'},{value:'TYPE_B',label:'Type B'}];
 const picker=h.c.makeArrow({mount,value:'DOWN',items,createPreviewNode:()=>null});
 const trigger=picker.element.querySelector('.shieldPickerTrigger');
 trigger.focus();
 Array.from('type a ext').forEach((key,index)=>h.fire(trigger,'keydown',{key,timeStamp:index*100}));
 assert.equal(h.body.querySelector('.keyboardActive .shieldPickerItemLabel').textContent,'Type A Extended');
 assert.equal(picker.getValue(),'DOWN');
 h.fire(trigger,'keydown',{key:'Enter'});
 assert.equal(picker.getValue(),'TYPE_A_EXTENDED');
});

for(const [name,css]of [['source',[...read('scripts/index.source.html').matchAll(/<link\b[^>]*href="(css\/[^"]+)"/g)].map(m=>read('public/'+m[1].split('?')[0])).join('\n')],['production',read('public/'+manifest.deferredStyles)]])test(name+': search remains bounded and hidden filtered rows stay hidden through the full picker cascade',()=>{
 const h=fixture(),picker=h.c.makeFont({selectEl:h.select,mode:'allFontsGrouped'});picker.wrapper.querySelector('button').click();
 const input=picker.menu.querySelector('.pickerSearchInput');input.value='not-a-font';h.fire(input,'input');const style=cascade(css,{respectLayers:true});
 assert.equal(style(input,'width'),'100%');assert.equal(style(input,'max-width'),'100%');
 for(const item of picker.menu.querySelectorAll('.fontPickerFontItem'))assert.equal(style(item,'display'),'none');
});
