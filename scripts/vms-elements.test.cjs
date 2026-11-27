const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parse:parseJS}=require('./build.cjs'),{Node}=require('./fixtures/mobile-dom.cjs'),{cascade}=require('./fixtures/css-cascade.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),manifest=JSON.parse(read('build-manifest.json'));
function declaration(name){const source=read('public/js/main.js'),nodes=[parseJS(source)];while(nodes.length){const node=nodes.pop();if(node.type==='VariableDeclarator'&&node.id.name===name)return 'let '+source.slice(node.start,node.end)+';';for(const value of Object.values(node))if(Array.isArray(value))nodes.push(...value.filter(item=>item?.type));else if(value?.type)nodes.push(value);}throw Error(name);}
function fixture(file='public/js/VmsElement.js'){
  let nextId=0,captures=[],fills=[],fontCalls=0;const warnings=[],frames=[];
  const make=tag=>{
    const node=new Node(tag);node.style.setProperty=(key,value)=>{node.style[key]=value;};node.style.removeProperty=key=>delete node.style[key];node.style.getPropertyValue=key=>node.style[key]||'';
    node.replaceChildren=(...children)=>{node.textContent='';node.append(...children);};node.replaceWith=next=>{node.before(next);node.remove();};
    node.offsetWidth=160;node.offsetHeight=48;node.getBoundingClientRect=()=>({width:node.offsetWidth*.5,height:node.offsetHeight*.5});
    node.cloneNode=(deep=false)=>{const copy=make(tag);copy.className=node.className;copy._text=node._text;copy.src=node.src;copy.offsetWidth=node.offsetWidth;copy.offsetHeight=node.offsetHeight;Object.assign(copy.style,node.style);if(deep)copy.append(...node.childNodes.map(child=>child.cloneNode(true)));return copy;};
    if(tag==='img')node.decode=async()=>{};
    if(tag==='canvas'){node.width=node.height=1;const context={imageSmoothingEnabled:true,clearRect(){},drawImage(){},fillRect(...args){fills.push({args,color:this.fillStyle});}};node.getContext=()=>context;const id=++nextId;node.toDataURL=()=> 'data:image/png;base64,'+id;}
    return node;
  };
  const html=make('html'),body=make('body');html.append(body);
  const style=Object.assign(['font-family','font-size','--fontSize'],{fontSize:'16px',fontFamily:'"Modern VMS"',fontStyle:'normal',fontWeight:'400',getPropertyValue:key=>key==='font-family'?'"Modern VMS"':key==='font-size'?'16px':'2rem'});
  const document={baseURI:'https://signmaker.test/',currentScript:{src:'https://signmaker.test/js/Control.js'},documentElement:html,body,createElement:make,addEventListener(){},getElementById(){return null;},querySelectorAll(){return[];}};
  const window={devicePixelRatio:2,localStorage:{getItem(){return null;}},addEventListener(){},getComputedStyle:()=>style};
  const c=vm.createContext({document,window,URL,Image:class{},console:{warn:(...args)=>warnings.push(args),log(){},error(){}},getComputedStyle:()=>style,setTimeout,clearTimeout,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){}});
  for(const name of ['lib','Shield','Sign','ExitTab','Panel','VmsPanel','Post','Arrows','Control','SubPanels'])vm.runInContext(read('public/js/'+name+'.js'),c,{filename:name+'.js'});
  vm.runInContext(read(file),c,{filename:file});const api=c.window.VmsElement;
  api.setProviders(async()=>{fontCalls++;return 'embedded-fonts';},async(source,options)=>{captures.push({source,options});const canvas=make('canvas');canvas.width=options.canvasWidth;canvas.height=options.canvasHeight;return canvas;});
  const panel=make('div');panel.className='panel';body.append(panel);
  const message=(model={realisticLED:true,textContent:'VARIABLE'},vms=false)=>{const element=make('div');element.className='bE-electronicSign';const text=make('span');text.textContent=model.textContent;element.append(text);panel.append(element);api.configure(element,model,{isVms:vms});return element;};
  return {c,api,make,panel,document,message,captures,fills,warnings,frames,get fontCalls(){return fontCalls;}};
}
test('new variable messages opt into LEDs, while legacy signs, nested templates, and explicit choices retain their setting',()=>{
  const h=fixture();
  assert.equal(vm.runInContext('new ElectronicSignElement().realisticLED',h.c),true);
  const result=vm.runInContext(`(()=>{
    const old={_elementType:'ElectronicSignElement',textContent:'OLD',glow:true};
    const rows=Control.fromData({rows:[[old,{...old,realisticLED:true},{...old,realisticLED:false},{_elementType:'GroupedBlockElement',blockElements:{rows:[[old]]}}]]}).rows;
    return [rows[0][0].realisticLED,rows[0][1].realisticLED,rows[0][2].realisticLED,rows[0][3].blockElements.rows[0][0].realisticLED];
  })()`,h.c);
  assert.deepEqual(Array.from(result),[false,true,false,false]);
  vm.runInContext(declaration('reconstructPostFromSnapshot')+'this.restore=reconstructPostFromSnapshot;',h.c);
  const old={_elementType:'ElectronicSignElement',textContent:'OLD',glow:true};
  const snapshot={panels:[{color:'Green',sign:{subPanels:[{blockElements:{rows:[[old,{...old,realisticLED:true}]]}}],globalTopBlockElements:{rows:[[old]]},globalBottomBlockElements:{rows:[[old]]}},exitTabs:[]}]};
  const restored=h.c.restore(snapshot),sign=restored.panels[0].sign;
  assert.equal(sign.subPanels[0].blockElements.rows[0][0].realisticLED,false);assert.equal(sign.subPanels[0].blockElements.rows[0][1].realisticLED,true);
  assert.equal(sign.globalTopBlockElements.rows[0][0].realisticLED,false);assert.equal(sign.globalBottomBlockElements.rows[0][0].realisticLED,false);
  const again=h.c.restore(JSON.parse(JSON.stringify(restored)));assert.equal(again.panels[0].sign.subPanels[0].blockElements.rows[0][1].realisticLED,true);
});
test('old block clipboards and element duplication preserve legacy appearance',()=>{
  const h=fixture();vm.runInContext(declaration('reviveSubpanelClipboardValue')+'this.revive=reviveSubpanelClipboardValue;',h.c);
  const old={_elementType:'ElectronicSignElement',textContent:'OLD',glow:false};
  assert.equal(h.c.revive(old).realisticLED,false);assert.equal(h.c.revive({...old,realisticLED:true}).realisticLED,true);
  assert.deepEqual(Array.from(vm.runInContext(`(()=>{const old=new ElectronicSignElement();delete old.realisticLED;return [Control.prototype.cloneElement(old).realisticLED,Control.prototype.cloneElement(new ElectronicSignElement()).realisticLED];})()`,h.c)),[false,true]);
});
const assets=['public/js/VmsElement.js'];const built=manifest.assets.find(asset=>asset.source==='js/VmsElement.js');if(built)assets.push('public/'+built.output);
for(const file of assets){
  test(`${file}: an individual screen uses the shared pixel renderer, retains its box, and caches unchanged text`,async()=>{
    const h=fixture(file),model={realisticLED:true,textContent:'VARIABLE\\nVARIABLE',fontFamily:'Modern VMS',glow:true},element=h.message(model);
    const original=element.firstElementChild||element.children[0];await h.api.mount(h.panel);
    assert.equal(h.captures.length,1);assert.equal(h.fontCalls,1);assert.ok(element.classList.contains('ledElementReady'));
    assert.equal(element.offsetWidth,160);assert.equal(element.offsetHeight,48);assert.equal(original.textContent,model.textContent);assert.equal(original.style.visibility,undefined);
    const display=element.querySelector('.ledElementDisplay');assert.ok(display.querySelector('.ledElementImage'));assert.ok(display.querySelector('.ledElementPreview'));
    assert.equal(element.getAttribute('aria-label'),'VARIABLE\nVARIABLE');assert.equal(display.getAttribute('aria-hidden'),'true');
    assert.ok(h.fills.some(fill=>fill.color==='#000000'),'The panel renderer paints black dividers');
    assert.equal(h.captures[0].options.canvasWidth,320);assert.equal(h.captures[0].options.canvasHeight,96);assert.equal(h.captures[0].options.fontEmbedCSS,'embedded-fonts');
    assert.equal(h.captures[0].source.classList.contains('bE-realisticLED'),false);assert.equal(h.captures[0].source.querySelector('.ledElementDisplay'),null);
    await h.api.refresh(h.panel);assert.equal(h.captures.length,1);
    model.textContent='CHANGED';await h.api.refresh(h.panel);assert.equal(h.captures.length,2);
    assert.equal(h.document.body.children.filter(child=>child!==h.panel).length,0,'Capture hosts are removed');
    h.api.disconnect();
  });
  test(`${file}: element resolution uses each panel density and rejects invalid names`,async()=>{
    for(const [resolution,density] of Object.entries({'extra-low':8,low:12,medium:16,high:24,'extra-high':32,'__proto__':16,invalid:16})){
      const h=fixture(file);h.message({realisticLED:true,textContent:'VARIABLE',ledResolution:resolution});await h.api.refresh(h.panel);
      assert.equal(h.captures[0].options.canvasWidth,160*density/16*2);h.api.disconnect();
    }
  });
  test(`${file}: VMS panels and disabled elements perform no individual LED calculations`,async()=>{
    const h=fixture(file),model={realisticLED:true,textContent:'VARIABLE'};
    const inVms=h.message(model,true),off=h.message({...model,realisticLED:false});assert.equal(inVms.classList.contains('bE-realisticLED'),false);assert.equal(off.classList.contains('bE-realisticLED'),false);
    await h.api.refresh(h.panel);assert.equal(h.captures.length,0);assert.equal(h.fontCalls,0);assert.equal(h.fills.length,0);assert.equal(model.realisticLED,true);
    const regular=h.message(model);h.panel.classList.add('vmsPanel');await h.api.refresh(h.panel);assert.equal(h.captures.length,0);assert.equal(regular.querySelector('.ledElementDisplay'),null);
    h.panel.classList.remove('vmsPanel');await h.api.refresh(h.panel);assert.equal(h.captures.length,1);assert.equal(model.realisticLED,true);h.api.disconnect();
  });
  test(`${file}: panels retained during an unrelated redraw reactivate without resampling or duplicate displays`,async()=>{
    const h=fixture(file),model={realisticLED:true,textContent:'VARIABLE'},element=h.message(model);await h.api.mount(h.panel);
    h.api.disconnect();await h.api.mount(h.panel);assert.equal(h.captures.length,1);assert.equal(element.querySelectorAll('.ledElementDisplay').length,1);
    model.textContent='UPDATED';await h.api.refresh(h.panel);assert.equal(h.captures.length,2);assert.equal(element.querySelectorAll('.ledElementDisplay').length,1);
    h.api.configure(element,{...model,realisticLED:false},{});await h.api.refresh(h.panel);
    assert.equal(element.classList.contains('ledElementReady'),false);assert.equal(element.querySelector('.ledElementDisplay'),null);assert.equal(h.captures.length,2);h.api.disconnect();
  });
  test(`${file}: stale queued renders cannot replace an edited or removed element`,async()=>{
    const h=fixture(file);let release;h.api.setProviders(()=>new Promise(resolve=>{release=resolve;}),async()=>{throw Error('Cancelled capture must not start');});
    const element=h.message(),pending=h.api.mount(h.panel);await new Promise(setImmediate);h.api.disconnect();release('font');await pending;
    assert.equal(element.querySelector('.ledElementDisplay'),null);assert.equal(h.warnings.length,0);assert.equal(h.document.body.children.length,1);
  });
  test(`${file}: failed pixel capture leaves the editable text visible and rejects a strict download`,async()=>{
    const h=fixture(file),element=h.message();h.api.setProviders(async()=>'',async()=>{throw Error('capture failed');});
    await h.api.mount(h.panel);assert.equal(element.classList.contains('ledElementReady'),false);assert.equal(element.children[0].textContent,'VARIABLE');
    await assert.rejects(h.api.refresh(h.panel),/capture failed/);assert.equal(h.document.body.children.length,1);h.api.disconnect();
  });
}
test('LED export artwork is shown only on the export clone, while VMS panels always show the original text',()=>{
  for(const css of [read('public/css/signs.css'),read('public/'+manifest.deferredStyles)]){
    const style=cascade(css,{respectLayers:true}),wrapper=new Node('div'),panel=new Node('div'),element=new Node('div'),text=new Node('span'),display=new Node('div'),image=new Node('img'),preview=new Node('canvas');
    panel.className='panel';element.className='bE-realisticLED ledElementReady';display.className='ledElementDisplay';image.className='ledElementImage';preview.className='ledElementPreview';wrapper.append(panel);panel.append(element);element.append(text,display);display.append(image,preview);
    assert.equal(style(text,'visibility'),'hidden');assert.equal(style(image,'display'),'none');assert.equal(style(preview,'display'),'block');
    wrapper.classList.add('exportStaticCaptureWrapper');assert.equal(style(image,'display'),'block');assert.equal(style(preview,'display'),'none');
    panel.classList.add('vmsPanel');assert.equal(style(text,'visibility'),'visible');assert.equal(style(display,'display'),'none');
  }
});
test('desktop and mobile expose one Realistic LED checkbox and downloads wait for individual screens',()=>{
  const html=read('scripts/index.source.html');assert.equal((html.match(/id="sdElectronicSign_realisticLED"/g)||[]).length,1);assert.match(html,/<input type="checkbox" id="sdElectronicSign_realisticLED" checked>/);
  assert.match(read('public/js/MobileForms.js'),/\['realisticLED', 'Realistic LED'\]/);assert.match(read('public/js/main.js'),/const prepareElementDisplays = \(\) => [\s\S]*?VmsElement\.refresh\(element\)/);assert.match(read('public/js/main.js'),/withFullLayout\(prepareElementDisplays\)/);
});

test('variable-message foreground follows every selected text color, independently of glow',()=>{
  const h=fixture();for(const color of ['Orange','White','Yellow','Red'])for(const glow of [true,false]){
    h.c.color=color;h.c.glow=glow;
    const result=vm.runInContext('new ElectronicSignElement({textColor:color,glow,realisticLED:false}).createElement({color:"Green"})',h.c);
    const expected=vm.runInContext('lib.colors[color].toLowerCase()',h.c);
    assert.equal(result.style.color,expected);assert.equal(result.style['--textColor'],expected);assert.equal(Boolean(result.style['--textShadow']),glow);
  }
});
test('the element and panel expose identical LED resolution values and labels',()=>{
  const html=read('scripts/index.source.html');
  const options=id=>[...html.match(new RegExp('<select[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/select>'))[1].matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(match=>[match[1],match[2]]);
  assert.deepEqual(options('sdElectronicSign_ledResolution'),options('vmsResolution'));
});
