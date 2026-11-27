const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {Node:BaseNode,Event:BaseEvent,parse:parseFixture}=require('./mobile-dom.cjs');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
class DomEvent extends BaseEvent {
  stopImmediatePropagation(){this.immediate=true;this.stopPropagation();}
}
class Node extends BaseNode {
  dispatchEvent(event){
    event.target=this;
    const listeners=this.events.get(event.type)||[];
    for(const {handler} of [...listeners.filter(item=>item.capture),...listeners.filter(item=>!item.capture)]){
      handler.call(this,event);
      if(event.immediate)return !event.defaultPrevented;
    }
    this['on'+event.type]?.call(this,event);
    if(event.bubbles&&!event.stopped)this.parentElement?.bubble(event);
    return !event.defaultPrevented;
  }
}
const parse=source=>{
  const root=parseFixture(source);
  const adapt=node=>{Object.setPrototypeOf(node,Node.prototype);node.childNodes.forEach(adapt);};
  adapt(root);
  return root;
};
const proto=Node.prototype;
Object.defineProperties(proto,{
  options:{get(){return this.children.filter(node=>node.tagName==='OPTION');}},
  parentNode:{get(){return this.parentElement;}},
  valueAsNumber:{get(){return Number(this.value);}},
  firstElementChild:{get(){return this.children[0];}},
  innerHTML:{get(){return this.textContent;},set(text){
    const tree=parse(text);this.replaceChildren(...tree.childNodes.slice());
    for(const node of this.querySelectorAll('select'))node.value=node.options[0]?.value??'';
  }}
});
Object.assign(proto,{
  replaceChildren(...nodes){this.childNodes.slice().forEach(node=>node.remove());this.append(...nodes);},
  prepend(...nodes){nodes.reverse().forEach(node=>{node.remove();this.childNodes.unshift(node);node.parentElement=this;});},
  replaceWith(node){this.before(node);this.remove();},
  appendChild(node){this.append(node);return node;},
  attachShadow(){const shadow=new Node('html');shadow.getElementById=id=>shadow.querySelector('#'+id);return this.shadowRoot=shadow;},
  getBoundingClientRect(){const w=this.classList.contains('diagrammaticMeasuring')?this.textContent.length*9+4:800;return {left:0,top:0,width:w,height:500,right:w,bottom:500};},
  getClientRects(){return this.hidden?[]:[this.getBoundingClientRect()];},
  setPointerCapture(id){this.capture=id;},
  hasPointerCapture(id){return this.capture===id;},
  releasePointerCapture(){delete this.capture;},
  focus(){},
  click(){this.dispatchEvent(new DomEvent('click',{bubbles:true}));},
  cloneNode(deep){const copy=new Node(this.tagName.toLowerCase(),this._text);copy.className=this.className;copy.attrs=new Map(this.attrs);copy.dataset={...this.dataset};if(deep)this.childNodes.forEach(n=>copy.append(n.cloneNode(true)));return copy;}
});
Object.assign(proto,{clientWidth:800,clientHeight:500,offsetWidth:800,offsetHeight:500});
const make=tag=>{const node=new Node(tag);node.style.setProperty=(key,value)=>node.style[key]=value;return node;};
module.exports=function createDiagrammaticEditor({withStarter=false}={}){
  const html=parse('<body><main><div id="postContainer"><div id="panelContainer"></div></div></main><div id="diagrammaticRoadControls"></div><div id="sMDiagrammatics"></div><div id="sMConfigBar"></div></body>');
  if(withStarter){
    const markup=read('scripts/index.source.html');
    const editorMarkup=markup.slice(markup.indexOf('<div id="sMDiagrammatics"'),markup.indexOf('<div id="sMRoundabout"'));
    const tab=parse(editorMarkup).querySelector('#sMDiagrammatics');
    tab.classList.remove('tabHidden');
    html.querySelector('#diagrammaticRoadControls').remove();
    html.querySelector('#sMDiagrammatics').replaceWith(tab);
  }
  const body=html.querySelector('body');
  const doc={body,documentElement:html,querySelector:s=>html.querySelector(s),getElementById:id=>html.querySelector('#'+id),addEventListener(){},createTextNode:value=>new Node("#text",value),createElement:make,createElementNS:(_,tag)=>make(tag)};
  const sign0={arrowMode:'diagrammatic',subPanels:[],diagrammatic:{width:40,height:25,unitsPerRem:40}};
  let sign=structuredClone(sign0),previous=[],next=[];
  const win={addEventListener(){}};
  const placements=[];
  const panelSize={};
  const bridge={getCurrentPanel:()=>({sign,...panelSize}),getCurrentSubPanel:()=>sign.subPanels[0],addDiagrammaticSubpanel:bounds=>placements.push(bounds),editDiagrammatic(change,{redraw=false}={}){
    const before=structuredClone(sign);
    sign.diagrammatic=win.SignMakerDiagrammatics.normalize(sign.diagrammatic);
    change(sign.diagrammatic,sign);
    if(JSON.stringify(before)!==JSON.stringify(sign)){previous.push(before);next=[];}
    if(redraw)draw();
  }};
  const context=vm.createContext({window:win,document:doc,app:{exposeToFormHandler:bridge},
    Event,EventTarget,structuredClone,setTimeout,clearTimeout,console,getComputedStyle:()=>({fontSize:"20px"}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}},matchMedia:()=>({matches:true}),
    XMLSerializer:class{serializeToString(node){return JSON.stringify(node.querySelectorAll('path').map(n=>n.getAttribute('d')));}}
  });
  vm.runInContext(require('../build-diagrammatics.cjs')(root),context);
  vm.runInContext(read('public/js/Panel.js'),context);
  vm.runInContext(read('public/js/Diagrammatics.js'),context);
  const service=win.SignMakerDiagrammatics;
  const host=make('div');host.className='sign';const panel=make('div');panel.className='panel';panel.dataset.panelIndex='0';panel.append(host);doc.getElementById("panelContainer").append(panel);
  if(withStarter)service.ensureStarter(sign);
  function draw(){
    host.replaceChildren();
    if(withStarter)service.syncEditor(sign);
    service.render(host,sign);
  }
  function restore(from,to){to.push(sign);sign=from.pop();draw();}
  draw();
  const engine=service.engine,roadEditor=engine.app.roadEditor,workspace=engine.live.shadowRoot.getElementById('workspace'),controls=engine.controlsHost.shadowRoot;
  function pointer(node,type,options={}){node.dispatchEvent(new DomEvent(type,{button:0,pointerId:1,isPrimary:true,clientX:0,clientY:0,...options}));}
  function setPanelSize(width,height){
    panelSize.fixedWidthRem=width;panelSize.fixedHeightRem=height;
    panel.classList.toggle('panelFixedWidth',width!=null);
    panel.classList.toggle('panelFixedHeight',height!=null);
    host.clientWidth=width*20-8;host.clientHeight=height*20-8;
    draw();
  }
  return {service,engine,roadEditor,workspace,controls,previous,placements,host,doc,make,context,pointer,setPanelSize,undo:()=>restore(previous,next),redo:()=>restore(next,previous),get sign(){return sign;}};
};
