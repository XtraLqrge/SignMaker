const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parse:parseJS}=require('./build.cjs');
const {Node}=require('./fixtures/mobile-dom.cjs');
const {cascade}=require('./fixtures/css-cascade.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const manifest=JSON.parse(read('build-manifest.json'));
const assets=['public/js/SignMigrations.js'];
const built=manifest.assets.find(asset=>asset.source==='js/SignMigrations.js');
if(built)assets.push('public/'+built.output);
const clone=value=>JSON.parse(JSON.stringify(value));
function declaration(file,name){
  const source=read(file),nodes=[parseJS(source)];
  while(nodes.length){const node=nodes.pop();
    if(node.type==='VariableDeclarator'&&node.id.name===name)return 'let '+source.slice(node.start,node.end)+';';
    for(const value of Object.values(node))if(Array.isArray(value))nodes.push(...value.filter(item=>item?.type));else if(value?.type)nodes.push(value);
  }
  throw Error('Missing '+name);
}
function load(file=assets[0],window={}){const c=vm.createContext({window});vm.runInContext(read(file),c);return c.window.SignMakerMigrations;}
const text=(type,fontFamily='Series EEM')=>({_elementType:type,textContent:'Series EEM',fontFamily});
function documentData(){return {panels:[{sign:{subPanels:[{blockElements:{rows:[[
  text('ControlTextElement'),text('AdvisoryMessageElement'),text('ActionMessageElement'),
  {_elementType:'GroupedBlockElement',blockElements:{rows:[[text('ControlTextElement'),{_elementType:'ShieldElement',bannerType:'None',bannerType2:' none ',bannerFontFamily:'Series EEM',bannerFontFamily1:'Series EEM',roadNameFontFamily:'Series EEM'}]]}},
]]}}]},exitTabs:[{fontFamily:'Series EEM',nestedExitTabs:[{fontFamily:'Series EEM'}]}]}],exitTabProfiles:{profiles:[{settings:{fontFamily:'Series EEM'}}]}};}
for(const asset of assets){
  const label=asset===assets[0]?'source':'production';
  test(`${label}: typed and nested control text migrates to EM while banners, messages, and exit tabs migrate to E`,()=>{
    const m=load(asset),data=documentData();assert.equal(m.migrate(data),true);
    const row=data.panels[0].sign.subPanels[0].blockElements.rows[0];
    assert.equal(row[0].fontFamily,'Series EM');assert.equal(row[0].textContent,'Series EEM');
    assert.equal(row[1].fontFamily,'Series E');assert.equal(row[2].fontFamily,'Series E');
    const inner=row[3].blockElements.rows[0];assert.equal(inner[0].fontFamily,'Series EM');
    assert.equal(inner[1].bannerType,'');assert.equal(inner[1].bannerType2,'');assert.equal(inner[1].bannerFontFamily,'Series E');assert.equal(inner[1].roadNameFontFamily,'Series E');
    assert.equal(data.panels[0].exitTabs[0].fontFamily,'Series E');assert.equal(data.panels[0].exitTabs[0].nestedExitTabs[0].fontFamily,'Series E');
    assert.equal(data.exitTabProfiles.profiles[0].settings.fontFamily,'Series E');assert.equal(m.migrate(data),false);
  });
  test(`${label}: old undo tags, untyped control rows, and stored default fields keep the control-text exception`,()=>{
    const m=load(asset),data={a:{__undoType:'ControlTextElement',fontFamily:'Series EEM'},b:{textContent:'City',spacing:0,fontFamily:'Series EEM'},
      c:{textContent:'Notice',spacing:0,horizPadding:.2,fontFamily:'Series EEM'},settingsDefaultsControlTextFontFamily:'Series EEM',settingsDefaultsAdvisoryFontFamily:'Series EEM'};
    m.migrate(data);assert.equal(data.a.fontFamily,'Series EM');assert.equal(data.b.fontFamily,'Series EM');assert.equal(data.c.fontFamily,'Series E');
    assert.equal(data.settingsDefaultsControlTextFontFamily,'Series EM');assert.equal(data.settingsDefaultsAdvisoryFontFamily,'Series E');
    assert.equal(m.preference('signMaker.controlTextFont','Series EEM'),'Series EM');assert.equal(m.preference('signMaker.bannerFontFamily','Series EEM'),'Series E');
  });
  test(`${label}: other fonts, text content, quoted None, and intentional blank banner slots are preserved`,()=>{
    const m=load(asset),data={fontFamily:'Series EM',bannerFontFamily:'Series D',label:'None',textContent:'None',bannerType:'"None"',bannerType2:'   ',choices:['Series EEM']};
    const before=clone(data);assert.equal(m.migrate(data),false);assert.deepEqual(data,before);
    assert.equal(m.serialized('not JSON'),'not JSON');data.circular=data;assert.equal(m.migrate(data),false);
  });
  test(`${label}: all saved template versions are converted without changing their identity or dates`,()=>{
    const m=load(asset),record={id:'saved',name:'My template',dateCreated:'old',dateModified:'unchanged',data:JSON.stringify(documentData()),variants:[{id:'v1',name:'Alternate',data:JSON.stringify(documentData()),fontFamily:''}]};
    assert.equal(m.template(record),true);
    for(const raw of [record.data,record.variants[0].data])assert.equal(JSON.parse(raw).panels[0].sign.subPanels[0].blockElements.rows[0][0].fontFamily,'Series EM');
    assert.equal(record.id,'saved');assert.equal(record.name,'My template');assert.equal(record.dateModified,'unchanged');assert.equal(record.variants[0].id,'v1');
    assert.equal(m.template(record),false);
  });
  test(`${label}: an EEM template-version override is baked into per-element fonts instead of forcing control text to E`,()=>{
    const m=load(asset),data=documentData();data.panels[0].sign.subPanels[0].blockElements.rows[0][0].fontFamily='Series 5WR';
    const record={data:JSON.stringify(data),variants:[{id:'eem',fontFamily:'Series EEM',data:JSON.stringify(data)}]};m.template(record);
    const row=JSON.parse(record.variants[0].data).panels[0].sign.subPanels[0].blockElements.rows[0];
    assert.equal(row[0].fontFamily,'Series EM');assert.equal(row[1].fontFamily,'Series E');assert.equal(record.variants[0].fontFamily,'');
    const session={templateEditor:{draft:clone(record),editorData:documentData(),formState:{variantFont:'Series EEM'}}};m.migrate(session);
    assert.equal(session.templateEditor.formState.variantFont,'');assert.equal(session.templateEditor.editorData.panels[0].exitTabs[0].fontFamily,'Series E');
  });
}

function migrationStartup(){
  const storage=new Map([['signMaker.migrations.shieldBannerNoneToBlank.v1','1']]),persistent=new Map();
  let snapshot=JSON.stringify({post:documentData()}),reads=0,preferences=0,commits=0,fail=false;
  const templates=[{id:'saved',data:JSON.stringify(documentData()),variants:[]}];
  const local={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  const m=load(assets[0],{localStorage:local,indexedDB:{}});
  const c=vm.createContext({window:{SignMakerMigrations:m,localStorage:local,indexedDB:{}},console:{warn(){}},APP_STORAGE_KEY:'signMaker.autosave.v1',
    getPersistentValue:async key=>persistent.get(key)||null,setPersistentValue:async(key,value)=>{if(fail===true)throw Error('storage failed');persistent.set(key,value);},
    readSavedAppStateSnapshot:async()=>{reads++;return storage.get('signMaker.autosave.v1')||snapshot;},
    formHandler:{migrateSavedTypographyPreferences:async()=>{preferences++;}},
    initTemplateDB:async()=>({migrateTemplates:async transform=>{if(fail)throw Error('aborted');for(const record of templates)transform(record);commits++;}})});
  vm.runInContext(declaration('public/js/main.js','migrateSavedSignTypographyOnce')+';this.run=migrateSavedSignTypographyOnce;',c);
  return {m,c,storage,persistent,templates,counts:()=>({reads,preferences,commits}),fail:value=>{fail=value;},snapshot:value=>{snapshot=value;}};
}
test('startup migrates saved signs and templates once, even when the earlier banner migration already ran',async()=>{
  const h=migrationStartup();const result=await h.c.run();assert.equal(JSON.parse(result).post.panels[0].exitTabs[0].fontFamily,'Series E');
  assert.equal(h.storage.get(h.m.key),'1');assert.equal(h.persistent.get(h.m.key),'1');assert.deepEqual(h.counts(),{reads:1,preferences:1,commits:1});
  assert.equal(h.storage.get('signMaker.autosave.v1'),h.persistent.get('signMaker.autosave.v1'));
  const later={post:documentData()};h.storage.set('signMaker.autosave.v1',JSON.stringify(later));
  assert.equal(await h.c.run(),null);assert.deepEqual(h.counts(),{reads:1,preferences:1,commits:1});
  assert.equal(JSON.parse(h.storage.get('signMaker.autosave.v1')).post.panels[0].exitTabs[0].fontFamily,'Series EEM','Later explicit font choices must remain available');
});
test('failed storage leaves no completion marker and the next load retries all durable stores',async()=>{
  const h=migrationStartup();h.fail(true);await h.c.run();assert.equal(h.storage.has(h.m.key),false);assert.equal(h.persistent.has(h.m.key),false);
  h.fail(false);await h.c.run();assert.equal(h.storage.get(h.m.key),'1');assert.equal(h.counts().commits,1);
  assert.equal(JSON.parse(h.persistent.get('signMaker.autosave.v1')).post.panels[0].exitTabs[0].fontFamily,'Series E');
});
test('an IndexedDB completion marker prevents repeating the upgrade when localStorage is unavailable',async()=>{
  const h=migrationStartup();h.persistent.set(h.m.key,'1');assert.equal(await h.c.run(),null);assert.equal(h.counts().reads,0);
});
test('a failed template transaction leaves the upgrade incomplete after the sign has been saved',async()=>{
  const h=migrationStartup();h.fail('templates');await h.c.run();assert.ok(h.persistent.has('signMaker.autosave.v1'));
  assert.equal(h.storage.has(h.m.key),false);assert.equal(h.persistent.has(h.m.key),false);
  h.fail(false);await h.c.run();assert.equal(h.persistent.get(h.m.key),'1');
});
test('template migration waits for transaction completion and rejects an aborted commit',async()=>{
  const c=vm.createContext({console});vm.runInContext(read('public/js/IndexDB.js')+';this.Type=IndexDB;',c);
  const db=Object.create(c.Type.prototype);db.dbInitialized=Promise.resolve();db.templatesStoreName='templates';
  let tx,request,puts=[];db.db={transaction(){tx={objectStore:()=>({getAll(){request={};return request;},put:value=>puts.push(value)})};return tx;}};
  let done=false;const pending=db.migrateTemplates(load().template).then(()=>{done=true;});await new Promise(setImmediate);
  request.result=[{id:'saved',data:JSON.stringify(documentData())}];request.onsuccess();await Promise.resolve();assert.equal(done,false);assert.equal(puts.length,1);
  tx.oncomplete();await pending;assert.equal(done,true);
  const aborted=db.migrateTemplates(()=>false);await new Promise(setImmediate);tx.onabort();await assert.rejects(aborted,/aborted/);
});
test('stored defaults and custom shield fonts are upgraded in both preference backends and the live registry',async()=>{
  const m=load(),keys={controlTextFont:'signMaker.controlTextFont',bannerFontFamily:'signMaker.bannerFontFamily',customShieldMakerShields:'signMaker.customShieldMaker.shields.v1'};
  const records=[{id:'custom',routeStyle:{fontFamily:'Series EEM'},routeStyleByVariant:{2:{fontFamily:'Series EEM'}}}];
  const local=new Map([[keys.controlTextFont,'Series EEM'],[keys.bannerFontFamily,'Series EEM'],['signMaker.settingsDefaults',JSON.stringify({settingsDefaultsControlTextFontFamily:'Series EEM',settingsDefaultsActionFontFamily:'Series EEM',settingsDefaultsShieldSize:2.7})],[keys.customShieldMakerShields,JSON.stringify(records)]]);
  const persistent=new Map([[keys.controlTextFont,'Series EEM'],[keys.bannerFontFamily,'Series EEM']]);let synced=0;
  const c=vm.createContext({window:{SignMakerMigrations:m,localStorage:{get length(){return local.size;},key:index=>[...local.keys()][index]}},STORAGE_KEYS:keys,
    getStoredItem:key=>local.get(key)||null,setStoredItem:(key,value)=>{local.set(key,value);return true;},getPersistentFormValue:async key=>persistent.get(key)||null,
    setPersistentFormValue:async(key,value)=>persistent.set(key,value),customShieldMakerLoadPromise:Promise.resolve(),customShieldMakerRecords:records,syncCustomShieldMakerConfigs:()=>synced++});
  vm.runInContext(declaration('public/js/form.js','migrateSavedTypographyPreferences')+';this.run=migrateSavedTypographyPreferences;',c);await c.run();
  assert.equal(local.get(keys.controlTextFont),'Series EM');assert.equal(persistent.get(keys.controlTextFont),'Series EM');assert.equal(local.get(keys.bannerFontFamily),'Series E');
  const defaults=JSON.parse(local.get('signMaker.settingsDefaults'));assert.equal(defaults.settingsDefaultsActionFontFamily,'Series E');assert.equal(defaults.settingsDefaultsControlTextFontFamily,'Series EM');assert.equal(defaults.settingsDefaultsShieldSize,2.7);
  assert.equal(records[0].routeStyle.fontFamily,'Series E');assert.equal(synced,1);assert.equal(JSON.parse(persistent.get(keys.customShieldMakerShields))[0].routeStyle.fontFamily,'Series E');
});
test('editor plaques retain their original padding and line boxes in source and production CSS',()=>{
  for(const css of [read('public/css/shields.css'),read('public/'+manifest.deferredStyles)]){
    const style=cascade(css,{respectLayers:true}),wrapper=new Node('div'),plaque=new Node('p');wrapper.className='bE-shieldElement';plaque.className='bannerA specialShieldPlaque';wrapper.append(plaque);
    assert.equal(style(plaque,'text-box-trim'),undefined);assert.equal(style(plaque,'text-box-edge'),undefined);
    assert.equal(style(plaque,'padding'),'0.10em 0.18em 0.005em 0.18em');assert.equal(style(plaque,'line-height'),'0.8');
  }
});
function bannerExportHarness(file,letterSpacing=true){
  const drawn=[],created=[],context={font:'',fillStyle:'',scale(){},measureText:()=>({fontBoundingBoxAscent:72}),fillText(...args){drawn.push({args,font:this.font,color:this.fillStyle});}};
  if(letterSpacing){context.letterSpacing='0px';context.wordSpacing='0px';}
  const styles={fontStyle:'normal',fontWeight:'400',fontSize:'100px',fontFamily:'"Series E"',color:'black',fontKerning:'auto',fontVariantCaps:'normal',fontStretch:'normal',letterSpacing:'2px',wordSpacing:'0px',textTransform:'none',visibility:'visible',display:'inline-block'};
  const document={
    createElement(tag){const node=new Node(tag);node.replaceChildren=(...children)=>{node.textContent='';node.append(...children);};node.style.setProperty=(key,value,priority)=>{node.style[key]=value;node.style[key+'Priority']=priority;};
      if(tag==='canvas'){node.getContext=()=>context;node.toDataURL=()=> 'data:image/png;base64,painted';}created.push(node);return node;},
    createTreeWalker(source){const text=source.childNodes.filter(node=>node.nodeType===3);let i=0;return {nextNode:()=>text[i++]||null};},
    createRange(){let offset=0;return {selectNodeContents(){offset=0;},setStart(node,value){offset=value;},setEnd(){},getBoundingClientRect:()=>({left:120+offset*35,top:28})};},
  };
  const c=vm.createContext({window:{getComputedStyle:()=>styles},document,NodeFilter:{SHOW_TEXT:4}});vm.runInContext(read(file),c);
  return {freeze:c.window.SignMakerBannerExport.freeze,drawn,created,context,styles,document};
}
const bannerExports=['public/js/BannerExport.js'];
const builtBannerExport=manifest.assets.find(asset=>asset.source==='js/BannerExport.js');if(builtBannerExport)bannerExports.push('public/'+builtBannerExport.output);
for(const file of bannerExports){
  test(`${file}: colored plaque exports preserve the editor baseline, dimensions, and live text`,()=>{
    for(const label of ['TOLL','TRUCKS','NO TRUCKS','DETOUR']){
      const h=bannerExportHarness(file),source=new Node('div'),target=new Node('div');
      const plaque=h.document.createElement('p'),clone=h.document.createElement('p');plaque.className=clone.className='bannerA specialShieldPlaque';
      plaque.getBoundingClientRect=()=>({left:100,top:20,width:200,height:50});plaque.append(new Node('#text',label));clone.append(new Node('#text',label));source.append(plaque);target.append(clone);
      h.freeze(source,target,.5);
      assert.equal(clone.style.width,'400px');assert.equal(clone.style.height,'100px');assert.equal(clone.style.heightPriority,'important');
      assert.deepEqual(h.drawn[0].args,[label,40,88]);assert.equal(h.drawn[0].font,'normal 400 100px "Series E"');
      assert.equal(h.context.letterSpacing,'2px');assert.equal(clone.children[0].style.visibility,'hidden');assert.equal(clone.children[1].tagName,'IMG');
      assert.equal(clone.children[1].src,'data:image/png;base64,painted');assert.equal(plaque.textContent,label);assert.equal(plaque.style.height,undefined);assert.equal(plaque.children.length,0);
    }
  });
  test(`${file}: custom backgrounds keep their text and uncolored banners are untouched`,()=>{
    const h=bannerExportHarness(file),source=new Node('div'),target=new Node('div');
    for(const kind of ['customBannerBackground','plain']){
      const plaque=h.document.createElement('p'),clone=h.document.createElement('p');plaque.className=clone.className='bannerB '+kind;
      plaque.getBoundingClientRect=()=>({left:0,top:0,width:100,height:40});plaque.append(new Node('#text','NORTH'));clone.append(new Node('#text','NORTH'));source.append(plaque);target.append(clone);
    }
    h.freeze(source,target);assert.equal(target.children[0].style.height,'40px');assert.equal(target.children[1].style.height,undefined);assert.equal(target.children[0].textContent,'NORTH');assert.equal(h.drawn.length,0);
  });
  test(`${file}: older canvases use measured character positions for spacing`,()=>{
    const h=bannerExportHarness(file,false),source=h.document.createElement('p'),target=h.document.createElement('p');source.className=target.className='bannerA specialShieldPlaque';
    source.getBoundingClientRect=()=>({left:100,top:20,width:200,height:100});source.append(new Node('#text','TO'));target.append(new Node('#text','TO'));h.freeze(source,target);
    assert.deepEqual(h.drawn.map(item=>item.args),[['T',20,80],['O',55,80]]);
  });
}
test('full-post and selected-panel exports capture banners before clone descendants are changed',()=>{
  const main=read('public/js/main.js');
  assert.match(main,/const clone = element\.cloneNode\(true\);\s+window\.SignMakerBannerExport\.freeze\(element, clone, layoutScale, getExportPixelRatio\(\)\);/);
  assert.match(main,/const clone = sourceElement\.cloneNode\(true\);\s+freezeStaticCloneLayoutMetrics\(sourceElement, clone\);\s+window\.SignMakerBannerExport\.freeze\(sourceElement, clone, layoutScale, getExportPixelRatio\(\)\);/);
});
