const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {compactJS,compactCSS,minifyJS,parse,normalize} = require('./build.cjs');
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

test('missing panel spacing uses one while saved zero and custom spacing survive',()=>{
  for(const [file,name] of [['public/js/main.js','normalizeDefaultPanelSpacingValue'],['public/js/form.js','normalizePanelSpacingPreference']]){
    const c=context({DEFAULT_PANEL_SPACING:1});
    vm.runInContext(declaration(file,name)+`;this.normalize=${name};`,c);
    for(const value of [null,undefined,'','bad',-1])assert.equal(c.normalize(value),1);
    for(const value of [0,'0'])assert.equal(c.normalize(value),0);
    assert.equal(c.normalize('2.75'),2.75);assert.equal(c.normalize(12),8);
  }
});
test('new posts use Right and one rem spacing while chosen positions stay intact',()=>{
  const c=context({});vm.runInContext(read('public/js/Post.js')+';this.PostClass=Post;',c);
  assert.equal(new c.PostClass().polePosition,'Right');
  assert.equal(new c.PostClass('invalid').polePosition,'Right');
  assert.equal(new c.PostClass().panelSpacing,1);
  for(const position of ['Left','Right','Overhead','Rural','Center'])assert.equal(new c.PostClass(position).polePosition,position);
});
test('post thickness clamps to the control range and keeps saved precision inside it',()=>{
  const c=context({});vm.runInContext(read('public/js/Post.js')+';this.PostClass=Post;',c);
  const post=new c.PostClass();
  for(const [value,expected] of [[-1,0],['0',0],['0.1',0.1],[2.25,2.25],[2.5,2.5],[3,2.5],['bad',1]]) {
    assert.equal(post.normalizeThickness(value),expected);
  }
});
test('built-in presets use current defaults while saved custom templates keep their post settings',()=>{
  const c=context({getTemplateVariant:()=>null,DEFAULT_TEMPLATE_DEFINITIONS:[{id:'default-old',build(){}}],
    createDefaultTemplateData:()=>'{"polePosition":"Right","panelSpacing":1}',normalizeTemplateSnapshot:value=>value});
  vm.runInContext(declaration('public/js/main.js','getTemplateSnapshot')+';this.snapshot=getTemplateSnapshot;',c);
  const old={id:'default-old',data:'{"polePosition":"Left","panelSpacing":0}'};
  assert.equal(c.snapshot(old).polePosition,'Right');assert.equal(c.snapshot(old).panelSpacing,1);
  const custom=c.snapshot({...old,id:'saved-custom'});assert.equal(custom.polePosition,'Left');assert.equal(custom.panelSpacing,0);
});
test('vertical panel offsets normalize old signs and clamp to the movement range',()=>{
  const c=context({});vm.runInContext(read('public/js/Panel.js')+';this.PanelClass=Panel;',c);
  for(const [input,expected] of [[undefined,0],[null,0],['bad',0],[Infinity,0],[-100,-6],[100,6],['2.25',2.25]])assert.equal(c.PanelClass.normalizeVerticalOffset(input),expected);
});
test('vertical snapping finds panel tops, bottoms, centers and adjoining edges',()=>{
  const c=context({window:{}});vm.runInContext(read('public/js/PanelDrag.js'),c);
  const snap=c.window.SignMakerPanelDrag.snapOffset;
  const rect={left:0,right:100,top:100,bottom:140},peer={rect:{left:120,right:220,top:150,bottom:210}};
  const options={startOffset:0,rect,peers:[peer],units:20};
  for(const [offset,expected] of [[2.45,2.5],[3.45,3.5],[3.02,3],[0.55,0.5],[5.55,5.5]]){
    const result=snap({...options,offset});assert.equal(result.offset,expected);assert.ok(result.snap);
  }
  assert.equal(snap({...options,offset:2.45,disabled:true}).offset,2.45);
  assert.equal(snap({...options,offset:2.45,peers:[{rect:{...peer.rect,left:1000,right:1100}}]}).snap,null);
  assert.equal(snap({...options,offset:2.45,peers:[]}).offset,2.45);
});
test('vertical snapping accounts for viewport scaling and rejects unreachable anchors',()=>{
  const c=context({window:{}});vm.runInContext(read('public/js/PanelDrag.js'),c);
  const snap=c.window.SignMakerPanelDrag.snapOffset;
  const rect={left:0,right:50,top:50,bottom:70};
  const peer={rect:{left:60,right:110,top:75,bottom:105}};
  assert.equal(snap({offset:2.45,startOffset:0,rect,peers:[peer],units:10}).offset,2.5);
  const result=snap({offset:100,startOffset:0,rect,peers:[{rect:{...peer.rect,top:500,bottom:520}}],units:10});
  assert.equal(result.offset,6);assert.equal(result.snap,null);
  assert.equal(snap({offset:-100,startOffset:0,rect,peers:[],units:10}).offset,-6);
});
test('vertical snapping lets an aligned panel leave its start and reach the travel limit',()=>{
  const c=context({window:{}});vm.runInContext(read('public/js/PanelDrag.js'),c);
  const snap=c.window.SignMakerPanelDrag.snapOffset;
  const rect={left:0,right:50,top:50,bottom:90};
  const aligned={rect:{...rect,left:60,right:110}};
  const options={startOffset:0,rect,units:20};
  const shortDrag=snap({...options,offset:0.35,peers:[aligned]});
  assert.equal(shortDrag.offset,0.35);
  assert.equal(shortDrag.snap,null);
  const nearLimit={rect:{...aligned.rect,top:165,bottom:205}};
  assert.equal(snap({...options,offset:6,peers:[nearLimit]}).offset,5.75);
  assert.equal(snap({...options,offset:7,peers:[nearLimit]}).offset,6);
});
test('horizontal panel reordering crosses each slot at one third of the distance',()=>{
  const c=context({window:{}});vm.runInContext(read('public/js/PanelDrag.js'),c);
  const drop=c.window.SignMakerPanelDrag.dropPosition;
  const peers=[{index:1,endIndex:3,rect:{left:100,right:200}},{index:4,endIndex:6,rect:{left:210,right:390}}];
  assert.equal(drop(peers,79,0,45),null);
  assert.equal(drop(peers,80,0,45).index,4,'Move past the first stack');
  assert.equal(drop(peers,199,0,45).index,4,'Keep the first slot until the next threshold');
  assert.equal(drop(peers,200,0,45).index,7,'Move past the second stack');
  assert.equal(drop(peers,411,7,465),null);
  assert.equal(drop(peers,410,7,465).index,4,'Move left past the nearest stack');
  assert.equal(drop(peers,250,7,465).index,1,'Move left past both stacks');
  assert.equal(drop([],140,0,45),null);
});
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
test('panel gestures commit their preview and mark only actual horizontal reorders',()=>{
  const view=new EventTarget(),doc=new EventTarget();
  const frames=new Map(),commits=[];
  let nextFrame=0,savedOffset=0;
  Object.assign(view,{
    getComputedStyle:()=>({fontSize:'20px'}),
    requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},
    cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>fn(),
    removeEventListener(type,listener,capture){
      EventTarget.prototype.removeEventListener.call(this,type,listener,{capture:!!capture});
    },
  });
  Object.assign(doc,{
    defaultView:view,documentElement:new Element(),body:new Element(),
    createElement:tag=>new Element('',tag.toUpperCase()),
  });
  const group=new Element(),panel=new Element('panel'),peer=new Element('panel');
  group.append(panel,peer);
  const guideArrows=new Element('guideArrows'),exitTab=new Element('exitTab');
  panel.append(guideArrows,exitTab);
  panel.querySelector=()=>({getBoundingClientRect:()=>panel.rect});
  peer.querySelector=()=>({getBoundingClientRect:()=>peer.rect});
  exitTab.getBoundingClientRect=()=>{throw new Error('Exit tabs must not be measured for panel alignment');};
  panel.ownerDocument=doc;
  panel.removeEventListener=(type,listener)=>{
    panel.events=panel.events.filter(([event,callback])=>event!==type||callback!==listener);
  };
  panel.offsetWidth=100;
  peer.dataset.panelIndex='1';
  peer.rect={...panel.rect,left:220,right:320};
  const c=context({window:{}});vm.runInContext(read('public/js/PanelDrag.js'),c);
  c.window.SignMakerPanelDrag.bind(panel,panel,{
    index:0,getOffset:()=>savedOffset,getEndIndex:index=>index,
    onCommit:(offset,index)=>{savedOffset=offset;commits.push([offset,index]);},
  });
  const down=panel.events.find(([type])=>type==='pointerdown')[1];
  const pointer=(type,x,y,altKey=false)=>Object.assign(new Event(type,{cancelable:true}),{
    pointerId:1,button:0,clientX:x,clientY:y,altKey,
  });
  const move=(x,y)=>{
    view.dispatchEvent(pointer('pointermove',x,y));
    assert.equal(frames.size,1);
    for(const [id,fn] of frames){frames.delete(id);fn();}
  };
  const hasMarker=()=>peer.classList.contains('dropBefore')||peer.classList.contains('dropAfter');
  down({...pointer('pointerdown',198,115),target:panel});
  move(200,122);
  assert.equal(panel.style.top,'0.35rem');
  assert.equal(hasMarker(),false);
  move(345,130);
  assert.equal(panel.style.top,'0.75rem');
  assert.equal(hasMarker(),false);
  view.dispatchEvent(pointer('pointerup',345,130));
  assert.deepEqual(commits.pop(),[0.75,0]);

  down({...pointer('pointerdown',105,115),target:guideArrows});
  move(144,117);
  assert.equal(hasMarker(),false);
  move(145,117);
  assert.equal(peer.classList.contains('dropAfter'),true);
  assert.equal(panel.style.top,'0.75rem');
  view.dispatchEvent(pointer('pointerup',145,117));
  assert.equal(hasMarker(),false);
  assert.deepEqual(commits.pop(),[0.75,2]);

  peer.rect={...peer.rect,top:150,bottom:180};
  down({...pointer('pointerdown',150,115),target:exitTab});
  move(150,160);
  assert.equal(doc.body.querySelector('.panelDragSnapGuide').style.display,'block');
  assert.equal(panel.style.top,'3.25rem');
  view.dispatchEvent(pointer('pointermove',150,115));
  view.dispatchEvent(pointer('pointerup',150,115));
  assert.deepEqual(commits.pop(),[3.25,0],'Release keeps the visible snap even with a newer unpainted sample');
  assert.equal(doc.body.querySelector('.panelDragSnapGuide'),null);

  down({...pointer('pointerdown',150,115),target:panel});
  move(150,160);
  assert.equal(panel.style.top,'5.75rem');
  view.dispatchEvent(pointer('pointerup',150,160,true));
  assert.deepEqual(commits.pop(),[5.5,0],'Alt at release uses the unsnapped position');

  down({...pointer('pointerdown',150,115),target:panel});
  view.dispatchEvent(pointer('pointermove',150,106));
  view.dispatchEvent(pointer('pointerup',150,115));
  assert.deepEqual(commits.pop(),[5.05,0],'Without a guide, release uses the last move');
});
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
test('minification preserves global model names and representative behavior',()=>{
  const source='class SampleElement { constructor(x=4){this.x=x;} value(){return this.x*2;} } const api={name:SampleElement.name,value:new SampleElement().value(),optional:x=>x?.v??3};';
  for(const code of [source,minifyJS(source)]){
    const c=context({});vm.runInContext(code+';this.result=[api.name,api.value,api.optional(null),api.optional({v:7})];',c);
    assert.equal(JSON.stringify(c.result),'["SampleElement",8,3,7]');
  }
});
test('editor resources load once on demand, preserving script execution order',async()=>{
  const added=[];
  const c=context({window:{localStorage:{getItem(){return null;}}},document:{
    currentScript:{dataset:{editorScripts:'["js/a.js","js/b.js"]',editorCss:'css/editor.css'}},
    createElement:tag=>({tag}),head:{appendChild:element=>added.push(element)}
  }});
  vm.runInContext(read('public/js/Startup.js'),c);
  assert.equal(added.length,0,'Fresh visits do not start the editor early');
  const first=c.window.SignMakerBoot.loadEditor(),second=c.window.SignMakerBoot.loadEditor();
  assert.equal(first,second);assert.equal(added.length,3);
  assert.equal(added[0].href,'css/editor.css');
  assert.deepEqual(added.slice(1).map(element=>[element.src,element.async]),[['js/a.js',false],['js/b.js',false]]);
  added.forEach(element=>element.onload());await first;
});
test('returning visits fetch their editor alongside the rendering scripts',async()=>{
  const added=[];
  const c=context({window:{localStorage:{getItem:key=>key==='signMaker.autosave.v1'?'saved':null}},document:{
    currentScript:{dataset:{editorScripts:'["js/editor.js"]'}},createElement:()=>({}),head:{appendChild:element=>added.push(element)}
  }});
  vm.runInContext(read('public/js/Startup.js'),c);assert.equal(added.length,1);
  added[0].onload();await c.window.SignMakerBoot.loadEditor();
});
test('critical CSS and deferred editor assets are complete and independently cached',()=>{
  const manifest=JSON.parse(read('build-manifest.json')),html=read('public/index.html');
  assert.ok(manifest.criticalCSS.gzipBytes<40000);
  assert.ok(manifest.startupJS.gzipBytes<170000);
  for(const source of manifest.deferredEditor){
    assert.ok(fs.existsSync(path.join(root,'public',source)));
    assert.ok(!html.includes('src="'+source+'"'),'Editor must be loaded by the startup coordinator');
  }
  const {criticalCSS}=require('./critical-css.cjs');
  assert.match(criticalCSS(['css/sign-foundation.css','css/form.css'],readFile=>read('public/'+readFile)),/\.bE-textElement/);
  assert.ok(read('public/'+manifest.deferredStyles).includes('.shieldPicker'));
});
test('SEO output allows crawling and provides a standalone dev deployment',()=>{
  assert.match(read('public/index.html'),/<meta name="robots" content="index, follow">/);
  assert.match(read('public/_headers'),/! X-Robots-Tag/);
  assert.ok(!read('wrangler.dev.jsonc').includes('"previews"'));
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
    if(asset.source==='js/Shield.js')source=source.replace('"ShieldFallbacks.js"',JSON.stringify(path.basename(manifest.assets.find(a=>a.source==='js/ShieldFallbacks.js').output)));
    assert.equal(read('public/'+asset.output), minifyJS(source), asset.source+' is stale; run npm run build');
    assert.ok(read('public/_headers').includes('/'+asset.output+'\n  Cache-Control: public, max-age=31536000, immutable'));
  }
});

test('CSS compaction preserves declarations, cascade order and custom-property tokens',()=>{
  const tree=require('./vendor/css-tree.cjs');
  const normalizeCSS=source=>JSON.stringify(tree.toPlainObject(tree.parse(source)));
  for(const source of ['/* comment */ :root { --gap: calc(100% - 2px); --label: "a b"; } .a .b { width: var(--gap); }',
    '@layer appearance { .a { color: red !important; color: rgb(1, 2, 3) !important; } } @media (width < 500px) { .b {display:flex} }',
    '@font-face { font-family: "Font Name"; src: url("../fonts/Font Name.woff2"); } .a::before { content: "A\\00003c B" }',
    '.a /deep/ .b { color: red } @keyframes turn { from {transform:rotate(0deg)} to {transform:rotate(180deg)} }']){
    assert.equal(normalizeCSS(compactCSS(source)),normalizeCSS(source));
  }
  const asset=JSON.parse(read('build-manifest.json')).assets.find(asset=>asset.sources);
  const source=asset.sources.map(file=>read('public/'+file)).join('\n');
  assert.equal(normalizeCSS(read('public/'+asset.output)),normalizeCSS(source));
  assert.ok(asset.optimized.bytes<asset.original.bytes*0.9);
});

test('font hints run inline without another blocking request and cover only used fonts',async()=>{
  const html=read('public/index.html');
  assert.ok(!html.includes('src="js/FontLoader'));
  const inline=html.match(/<script data-font-loader>([\s\S]*?)<\/script>/)[1];
  assert.equal(normalize(parse(inline)),normalize(parse(read('public/js/FontLoader.js'))));
  const preloads=[],loads=[];
  const c=context({window:{},localStorage:{getItem(){return null;}},document:{baseURI:'https://signmaker.test/',createElement:()=>({}),head:{appendChild:node=>preloads.push(node.href)},fonts:{load:name=>{loads.push(name);return Promise.resolve([]);}}}});
  vm.runInContext(read('public/js/FontLoader.js'),c);
  assert.equal(preloads.length,1);assert.match(preloads[0],/SeriesEM\.woff2$/);
  await c.window.SignMakerFonts.preparePost({panels:[{sign:{fontFamily:'Series D',guideArrow:'None',exitTextFont:'Series E'},exitTabs:[{variant:'Default',number:'',fontFamily:'Series EEM'}]}],exitTabProfiles:{unused:{fontFamily:'Series C',bannerFontFamily:'Series F'}}});
  assert.equal(loads.length,1);assert.match(loads[0],/"Series D"/);
  await c.window.SignMakerFonts.preparePost({panels:[{sign:{guideArrow:'Exit Only',exitTextFont:'Series E'},exitTabs:[{variant:'Default',number:'42',fontFamily:'Series EEM'}]}]});
  assert.equal(loads.length,3);assert.match(loads[1],/"Series E"/);assert.match(loads[2],/"Series EEM"/);
});

test('image preparation ignores unused exit profiles and handles real nested icons',async()=>{
  const sources=[];
  const c=context({IconElement:{prototype:{icons:{AIRPORT:{src:'airport.svg'},ACTIVE:{src:'active.svg'}}}},prepareTightImageSource:source=>{sources.push(source);return Promise.resolve();}});
  vm.runInContext(declaration('public/js/Control.js','prepareIconImagesForPost')+'this.prepare=prepareIconImagesForPost;',c);
  await c.prepare({panels:[{sign:{exitTabs:[{variant:'Default',icon:'AIRPORT'}]}}],exitTabProfiles:{unused:{variant:'Icon',icon:'AIRPORT'}}});
  assert.deepEqual(sources,[]);
  const icon={icon:'ACTIVE'},post={panels:[{sign:{rows:[{elements:[icon,{blockElements:{rows:[{elements:[icon]}]}}]}],exitTabs:[{variant:'Icon',icon:'AIRPORT'}]}}]};
  post.circular=post;await c.prepare(post);assert.deepEqual(sources,['active.svg','airport.svg']);
});

test('asset value inputs keep their value without creating invalid option children',()=>{
  const c=context({document:{createElement:tag=>new Element('',tag.toUpperCase()),createTextNode:text=>({textContent:text})}});
  vm.runInContext(read('public/js/lib.js')+'this.options=lib;',c);
  const hidden=new Element('','INPUT');hidden.value='AIRPORT';
  for(let n=0;n<321;n++)c.options.appendOption(hidden,String(n));
  assert.equal(hidden.childElementCount,0);assert.equal(hidden.value,'AIRPORT');
  const select=new Element('','SELECT');c.options.appendOption(select,'Blue',{selected:true,text:'Blue sign'});
  assert.equal(select.childElementCount,1);assert.equal(select.children[0].value,'Blue');assert.equal(select.children[0].selected,true);
});

test('shield backup artwork loads only on demand, deduplicates requests and retains exact SVG bytes',async()=>{
  const crypto=require('node:crypto'),scripts=[];
  const document={baseURI:'https://signmaker.test/',currentScript:{src:'https://signmaker.test/js/Shield.js'},createElement:()=>({remove(){}}),head:{appendChild:node=>scripts.push(node)}};
  const c=context({window:{},document});vm.runInContext(read('public/js/lib.js'),c);vm.runInContext(read('public/js/Shield.js'),c);
  assert.equal(scripts.length,0);assert.equal(Object.keys(c.window.SIGNMAKER_ASSET_FALLBACKS).length,0);
  const first=c.window.loadSignMakerAssetFallbacks(),second=c.window.loadSignMakerAssetFallbacks();assert.equal(first,second);assert.equal(scripts.length,1);
  vm.runInContext(read('public/js/ShieldFallbacks.js'),c);scripts[0].onload();await first;
  for(const record of JSON.parse(read('scripts/shield-artwork.json'))){
    const bytes=fs.readFileSync(path.join(root,'public',record.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256);
    const fallback=c.window.getSignMakerAssetFallback('https://signmaker.test/'+encodeURI(record.path));
    assert.ok(Buffer.from(fallback.split(',')[1],'base64').equals(bytes));
  }
  const assetPath=JSON.parse(read('scripts/shield-artwork.json'))[0].path;
  const image={src:assetPath,dataset:{},getAttribute(){return this.src;}};
  c.window.applySignMakerAssetFallback(image,assetPath);const pending=image.onerror();image.src='new-choice.svg';await pending;
  assert.equal(image.src,'new-choice.svg','An older failed request must not replace a newer selection');
});

test('startup yielding allows a browser turn with a scheduler and timer fallback',async()=>{
  let scheduled=0;const c=context({window:{scheduler:{yield(){scheduled++;return Promise.resolve();}}},document:{}});
  vm.runInContext(read('public/js/EditorRuntime.js'),c);await c.window.SignMakerEditorRuntime.yieldToMain();assert.equal(scheduled,1);
  delete c.window.scheduler;let completed=false;
  const pending=c.window.SignMakerEditorRuntime.yieldToMain().then(()=>completed=true);
  await Promise.resolve();assert.equal(completed,false);await pending;assert.equal(completed,true);
});

test('hashed UI fonts have a separate cache rule within Cloudflare header limits',()=>{
  const headers=read('public/_headers'),patterns=headers.split('\n').filter(line=>line.startsWith('/'));
  assert.ok(patterns.length<=100);assert.ok(!patterns.includes('/fonts/*'));
  assert.ok(headers.includes('/fonts/:font\n  Cache-Control: public, max-age=86400'));
  assert.ok(headers.includes('/fonts/ui/*\n  Cache-Control: public, max-age=31536000, immutable'));
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

test('closed shield triggers defer their artwork until their editor is active',()=>{
  const modal=new Element('sMModal subPanelConfig'),image=new Element('shieldPickerTriggerIcon','IMG');modal.appendChild(image);
  const bar={dataset:{currentMenu:''}};let requests=0,source='';
  Object.defineProperty(image,'src',{get:()=>source,set:value=>{source=value;requests++;}});
  const c=context({document:{getElementById:()=>bar},window:{},SHIELD_DROPDOWN_PLACEHOLDER_ICON:'placeholder'});
  vm.runInContext(read('public/js/EditorRuntime.js'),c);
  vm.runInContext(declaration('public/js/form.js','setShieldPickerButtonIcon')+'this.setIcon=setShieldPickerButtonIcon;',c);
  c.setIcon(image,'shield.svg');assert.equal(requests,0);
  bar.dataset.currentMenu='subPanelConfig';c.window.SignMakerEditorRuntime.ensure();assert.equal(source,'shield.svg');assert.equal(requests,1);
});
