const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('build-manifest.json'));
const sources = ['public/js/MobileSubpanels.js', 'public/' + manifest.assets.find(asset => asset.source === 'js/MobileSubpanels.js').output];
const modelContext = source => {
  const document = { baseURI:'https://example.test/', currentScript:{src:'https://example.test/js/Control.js'},
    addEventListener(){}, getElementById(){return null;}, querySelectorAll(){return[];}, documentElement:{style:{getPropertyValue(){return '';}}} };
  const window = { localStorage:{getItem(){return null;}}, addEventListener(){} };
  const c = vm.createContext({ document, window, console, URL, Image:class{}, requestAnimationFrame:()=>0 });
  for (const file of ['lib','Shield','Sign','ExitTab','Panel','VmsPanel','Post','Arrows','Control','SubPanels']) vm.runInContext(read('public/js/'+file+'.js'),c);
  vm.runInContext(read(source),c); vm.runInContext('const mobile=window.SignMakerMobileSubpanels;',c);
  return c;
};
class Node {
  constructor(tag='div', id='', classes='') {
    this.tagName=tag.toUpperCase();this.id=id;this.classes=new Set(classes.split(' ').filter(Boolean));
    this.children=[];this.parentElement=null;this.dataset={};this.attrs=new Map();this.events=new Map();this.hidden=false;this.isConnected=true;this.textContent='';this.title='';
    this.classList={contains:key=>this.classes.has(key),add:(...keys)=>keys.forEach(key=>this.classes.add(key)),remove:(...keys)=>keys.forEach(key=>this.classes.delete(key)),toggle:(key,value)=>{value=value??!this.classes.has(key);value?this.classes.add(key):this.classes.delete(key);return value;}};
    this.style={setProperty(){},removeProperty(){}};this.rect={left:0,right:100,top:100,bottom:160,width:100,height:60};
  }
  set className(value){this.classes=new Set(value.split(' '));}
  get className(){return [...this.classes].join(' ');}
  setAttribute(key,value){this.attrs.set(key,String(value));}
  getAttribute(key){return this.attrs.get(key)??null;}
  matches(selector){
    return selector.split(',').some(part=>{
      const chain=part.trim().split(/\s+/), simple=(node,query)=>{
        const attr=query.match(/\[data-jiggle-action="([^"]+)"\]/);if(attr&&node.dataset.jiggleAction!==attr[1])return false;
        query=query.replace(/\[[^\]]+\]/g,'');
        const tag=query.match(/^[a-z]+/i)?.[0];if(tag&&node.tagName!==tag.toUpperCase())return false;
        return [...query.matchAll(/([.#])([\w-]+)/g)].every(([,kind,value])=>kind==='#'?node.id===value:node.classes.has(value));
      };
      let node=this;if(!simple(node,chain.pop()))return false;
      while(chain.length){const wanted=chain.pop();do{node=node.parentElement;}while(node&&!simple(node,wanted));if(!node)return false;}
      return true;
    });
  }
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentElement=this;}}
  prepend(node){node.remove();this.children.unshift(node);node.parentElement=this;}
  after(node){node.remove();const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this)+1,0,node);node.parentElement=parent;}
  remove(){if(this.parentElement){const list=this.parentElement.children;list.splice(list.indexOf(this),1);this.parentElement=null;}}
  addEventListener(type,callback){this.events.set(type,callback);}
  getBoundingClientRect(){return this.rect;}
}
function ui(source) {
  const rootNode=new Node('html'),editor=new Node('section','mobileEditor'),header=new Node('div','','mobileEditorHeader');
  const bar=new Node('nav','sMConfigBar'),list=new Node('div','sMSPTextList'),tabs=new Node('div','subPanelList');
  bar.dataset.currentMenu='subPanelConfig';rootNode.append(editor,bar);editor.append(header,tabs,list);
  const control={rows:[[{type:'ControlTextElement',name:'A'},{type:'ControlTextElement',name:'B'}],[{type:'ControlTextElement',name:'C'}]],blockProperties:[{},{}],
    cloneElement:element=>({...element}),cloneBlockProperties:properties=>({...properties})};
  const sign={subPanels:[{blockElements:control},{blockElements:{rows:[[]]}}]};
  const rows=[],blocks=[],tabNodes=[];
  control.rows.forEach((row,r)=>{
    const node=new Node('div','','sMControlRow');node.dataset.dataRow=String(r);node.rect={left:0,right:300,top:100+r*90,bottom:170+r*90,width:300,height:70};rows.push(node);list.append(node);
    row.forEach((element,b)=>{const block=new Node('div','','textEditorBlock');block.dataset.row=String(r);block.dataset.block=String(b);
      block.rect={left:50+b*100,right:130+b*100,top:110+r*90,bottom:160+r*90,width:80,height:50};node.append(block);blocks.push(block);});
  });
  for(let i=0;i<2;i++){const node=new Node('div','','subPanelTabGroup');node.dataset.subpanelIndex=String(i);node.rect={left:i*130,right:i*130+120,top:0,bottom:50,width:120,height:50};tabs.append(node);tabNodes.push(node);}
  const listeners=new Map(),timers=new Map(),moves=[],copies=[];let timer=0,starts=0,ends=0;
  const document={documentElement:rootNode,activeElement:null,getElementById:id=>rootNode.querySelector('#'+id),querySelector:s=>rootNode.querySelector(s),querySelectorAll:s=>rootNode.querySelectorAll(s),
    createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag),addEventListener:(type,fn)=>listeners.set(type,fn)};
  const vars={currentlySelectedPanelIndex:0,currentlySelectedSubPanelIndex:0};
  const bridge={vars,getActiveBlockElements:()=>control,getCurrentPanel:()=>({sign}),beginUndoableChange:()=>starts++,endUndoableChange:()=>ends++,
    setSelectedRowAndBlock(){},redraw(){},changeEditingSubPanel:index=>{vars.currentlySelectedSubPanelIndex=index;},
    moveControlElem:(...args)=>moves.push(['block',...args]),moveRow:(...args)=>moves.push(['row',...args]),moveSubPanel:(...args)=>moves.push(['subpanel',...args]),
    copySubpanelClipboard:payload=>{copies.push(payload);return{copied:true,copiedBlockCount:payload.selectedBlockCount};}};
  const window={SignMakerMobile:{active:true},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),innerHeight:852,scrollBy(){},addEventListener(){}};
  const c=vm.createContext({window,document,console,MutationObserver:class{observe(){}},app:{exposeToFormHandler:bridge},formHandler:{updateForm(){}},
    Control:{prototype:{blockToClassElems:{getElem:element=>element.type},blockElements:{ControlTextElement:'Control Text'}}}});
  vm.runInContext(read(source),c);const api=window.SignMakerMobileSubpanels;api.init();api.refresh();
  const fire=(type,target,options={})=>{
    const event={target,pointerId:1,pointerType:'touch',button:0,clientX:80,clientY:130,cancelable:true,
      preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...options};listeners.get(type)?.(event);return event;
  };
  return{api,document,window,editor,control,rows,blocks,tabNodes,moves,copies,fire,hold(){for(const fn of [...timers.values()])fn();timers.clear();},history:()=>[starts,ends]};
}
for(const source of sources){
  const name=source===sources[0]?'source':'production';
  test(`${name}: full names expand into free row space and give way to icons only as needed`,()=>{
    const h=ui(source);
    assert.deepEqual(Array.from(h.api.chooseLabels(300,[110,140],[68,68])),[true,true]);
    assert.deepEqual(Array.from(h.api.chooseLabels(200,[110,160],[68,68])),[true,false]);
    assert.deepEqual(Array.from(h.api.chooseLabels(140,[180,110],[68,68])),[false,false]);
    assert.ok(h.blocks[0].classes.has('mobileFullLabel'));assert.ok(h.blocks[1].classes.has('mobileFullLabel'));
    h.rows[0].rect.width=160;h.api.refresh();
    assert.equal(h.blocks[0].classes.has('mobileFullLabel'),false);assert.equal(h.blocks[1].classes.has('mobileFullLabel'),false);
    h.rows[0].rect.width=400;h.api.refresh();
    assert.ok(h.blocks[0].classes.has('mobileFullLabel'));assert.ok(h.blocks[1].classes.has('mobileFullLabel'));
  });
  test(`${name}: element type symbols use the exact Material Symbols names from the supplied mobile ZIP`,()=>{
    const h=ui(source);
    for(const [kind,icon] of Object.entries({ControlTextElement:'text_fields',ActionMessageElement:'campaign',AdvisoryMessageElement:'warning',DividerElement:'horizontal_rule',BeaconElement:'lightbulb',ElectronicSignElement:'display_settings',GroupedBlockElement:'folder'})){
      const visual=h.api.makeVisual({},kind,{}),symbol=visual.querySelector('.material-symbols-outlined');
      assert.equal(symbol.textContent,icon);assert.equal(visual.querySelector('svg'),null);
    }
  });
  test(`${name}: duplicate selected elements preserves real shield types, nested groups, and row properties`,()=>{
    const c=modelContext(source);
    const result=vm.runInContext(`(()=>{
      const shield=new ShieldElement({shieldBase:'I',routeNumber:'29',numberStyle:'legacy'});
      const group=new GroupedBlockElement({label:'Group',blockElements:new Control({rows:[[shield]],blockProperties:[new Block()]})});
      const control=new Control({rows:[[group],[new ControlTextElement({textContent:'Keep'})]],blockProperties:[new Block({edgePlacement:'header'}),new Block()]});
      mobile.editBlocks(control,new Set([group]),'duplicate');
      control.rows[1][0].blockElements.rows[0][0].routeNumber='100';
      return JSON.stringify({rows:control.rows.length,original:control.rows[0][0].blockElements.rows[0][0].routeNumber,
        copy:control.rows[1][0].blockElements.rows[0][0].routeNumber,legacy:control.rows[1][0].blockElements.rows[0][0].numberStyle,
        placement:control.blockProperties[1].edgePlacement,isGroup:control.rows[1][0] instanceof GroupedBlockElement});
    })()`,c);
    assert.deepEqual(JSON.parse(result),{rows:3,original:'29',copy:'100',legacy:'legacy',placement:'header',isGroup:true});
  });
  test(`${name}: noncontiguous deletion keeps row properties aligned and supports an empty final element`,()=>{
    const c=modelContext(source);
    const result=vm.runInContext(`(()=>{
      const a=new ControlTextElement({textContent:'A'}),b=new ControlTextElement({textContent:'B'}),c=new ControlTextElement({textContent:'C'});
      const control=new Control({rows:[[a,b],[c]],blockProperties:[new Block({edgePlacement:'header'}),new Block({edgePlacement:'footer'})]});
      mobile.editBlocks(control,new Set([a,c]),'delete');
      const kept={rows:control.rows.length,text:control.rows[0][0].textContent,placement:control.blockProperties[0].edgePlacement};
      mobile.editBlocks(control,new Set([b]),'delete',()=>{const empty=new ControlTextElement();empty.textContent='';return empty;});
      return JSON.stringify({kept,lastRows:control.rows.length,lastText:control.rows[0][0].textContent,properties:control.blockProperties.length});
    })()`,c);
    assert.deepEqual(JSON.parse(result),{kept:{rows:1,text:'B',placement:'header'},lastRows:1,lastText:'',properties:1});
  });
  test(`${name}: subpanel duplication retains independence and arrow ownership, deletion retains one subpanel`,()=>{
    const c=modelContext(source);
    const result=vm.runInContext(`(()=>{
      const sign=new Sign({});sign.subPanels=[new SubPanels(),new SubPanels()];
      const first=sign.subPanels[0],second=sign.subPanels[1];sign.aplArrows=[{placement:'subpanel',subPanelIndex:1}];
      mobile.editSubpanels(sign,new Set([first]),'duplicate');
      sign.subPanels[1].blockElements.rows[0][0].textContent='Clone';
      const independent=first.blockElements.rows[0][0].textContent!=='Clone';const arrowIndex=sign.aplArrows[0].subPanelIndex;
      mobile.editSubpanels(sign,new Set(sign.subPanels),'delete');
      return JSON.stringify({independent,arrowIndex,count:sign.subPanels.length,arrows:sign.aplArrows.length});
    })()`,c);
    assert.deepEqual(JSON.parse(result),{independent:true,arrowIndex:2,count:1,arrows:0});
  });
  test(`${name}: a vertical swipe leaves normal element editing intact without entering jiggle mode`,()=>{
    const h=ui(source);h.fire('pointerdown',h.blocks[0]);h.fire('pointermove',h.blocks[0],{clientY:180});h.hold();h.fire('pointerup',h.blocks[0]);
    assert.equal(h.api.mode,'');assert.deepEqual(h.moves,[]);
  });
  test(`${name}: holding reveals element and row checkboxes, selection reveals working copy and delete actions`,()=>{
    const h=ui(source);h.fire('pointerdown',h.blocks[0]);h.hold();h.fire('pointerup',h.blocks[0]);
    assert.equal(h.api.mode,'blocks');
    const first=h.blocks[0].querySelector('.mobileJiggleCheck'),row=h.rows[0].querySelector('.mobileJiggleCheck');
    assert.ok(first);assert.ok(row);
    assert.equal(h.document.querySelector('.mobileJiggleActions').hidden,true);
    const click=h.fire('click',first);assert.equal(click.stopped,true);assert.equal(click.prevented,undefined,'A checkbox still performs its native toggle immediately after a hold');
    first.checked=true;first.events.get('change')();
    assert.equal(h.document.querySelector('.mobileJiggleActions').hidden,false);
    h.api.perform('copy');assert.equal(h.copies[0].selectedBlockCount,1);assert.deepEqual(Array.from(h.copies[0].rows[0].selectedBlockIndices),[0]);
    h.api.perform('delete');assert.deepEqual(h.control.rows[0].map(x=>x.name),['B']);assert.deepEqual(h.history(),[1,1]);
    h.api.exit();assert.equal(h.editor.dataset.jiggle,undefined);
  });
  test(`${name}: a row checkbox duplicates the complete row without replacing neighboring rows`,()=>{
    const h=ui(source);h.api.enter('row');const box=h.rows[0].querySelector('.mobileJiggleCheck');box.checked=true;box.events.get('change')();
    h.api.perform('duplicate');assert.deepEqual(h.control.rows.map(row=>row.map(element=>element.name)),[['A','B'],['A','B'],['C']]);
    assert.notEqual(h.control.rows[0][0],h.control.rows[1][0]);assert.deepEqual(h.history(),[1,1]);
  });
  test(`${name}: held elements, rows, and subpanel labels use the existing reorder methods`,()=>{
    for(const [kind,select,start,end,expected] of [
      ['block',h=>h.blocks[0],{clientX:80,clientY:130},{clientX:280,clientY:130},['block',0,0,0,2]],
      ['row',h=>h.rows[0],{clientX:10,clientY:130},{clientX:10,clientY:280},['row',0,2]],
      ['subpanel',h=>h.tabNodes[0],{clientX:50,clientY:20},{clientX:280,clientY:20},['subpanel',0,2]],
    ]){
      const h=ui(source),node=select(h);h.fire('pointerdown',node,start);h.hold();h.fire('pointermove',node,end);h.fire('pointerup',node,end);
      assert.deepEqual(h.moves,[expected],kind);assert.equal(h.fire('click',node).stopped,true);
    }
  });
  test(`${name}: asset labels show the chosen artwork without copying shield route-number text`,()=>{
    const h=ui(source),rendered=new Node(),image=new Node('img');image.setAttribute('src','img/shields/Florida.svg');rendered.append(image);
    image.classes.add('shieldImg');const number=new Node('span');number.textContent='219';rendered.append(number);
    const visual=h.api.makeVisual({createElement:()=>rendered},'ShieldElement',{});
    assert.equal(visual.querySelector('img').src,'img/shields/Florida.svg');assert.equal(visual.querySelectorAll('span').length,0);
    const arrow=h.api.makeVisual({rotation:90,flip:true,createElement:()=>rendered},'ArrowElement',{});
    assert.equal(arrow.querySelector('img').style.rotate,'90deg');
    assert.equal(arrow.querySelector('img').style.scale,'-1 1');
  });
}
