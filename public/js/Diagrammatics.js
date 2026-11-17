/* Native adapter: StripeMaker's unmodified road controls and graph edit the
 * actual sign surface. Shadow roots isolate its CSS and IDs, not a second page. */
window.SignMakerDiagrammatics=(()=>{
  const api=()=>typeof app==='undefined'?null:app.exposeToFormHandler;
  const normalize=value=>{
    const width=Math.max(1,Math.min(80,Number(value?.width)||40));
    return {
      version:2,width,
      height:Math.max(1,Math.min(80,Number(value?.height)||width*.625)),
      consistentGapsOnTurns:value?.consistentGapsOnTurns!==false,
      // Retain the existing drawing scale when opening an older sign.
      unitsPerRem:Number(value?.unitsPerRem)||(Number(value?.roadGraph?.width)/width)||40,
      roadGraph:value?.roadGraph?structuredClone(value.roadGraph):null,
      artwork:typeof value?.artwork==='string'?value.artwork:''
    };
  };
  let engine=null,installed=false,activeSubpanelDrag=null;
const SVG='http://www.w3.org/2000/svg';
const svg=(tag,attrs={})=>{const n=document.createElementNS(SVG,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
// Use the right edge's stations for every separator so dash ends line up
// across a turn, rather than drifting with each lane's different arc length.
const alignedDashes=(points,reference,dash)=>{
  let distance=0,d='';
  for(let i=1;i<reference.length;i++){
    const length=Math.hypot(reference[i].x-reference[i-1].x,reference[i].y-reference[i-1].y);
    if(length<1e-9)continue;
    for(let at=0;at<length-1e-9;){
      const phase=(distance+at)%(dash*2),step=Math.min(length-at,(phase<dash?dash:dash*2)-phase);
      if(step<1e-9){at+=1e-8;continue;}
      if(phase<dash){
        const a=points[i-1],b=points[i],t=at/length,u=(at+step)/length;
        d+=`M${a.x+(b.x-a.x)*t},${a.y+(b.y-a.y)*t}L${a.x+(b.x-a.x)*u},${a.y+(b.y-a.y)*u} `;
      }
      at+=step;
    }
    distance+=length;
  }
  return d;
};
const renderer=(sheet,road,shape,layers,className,boundary,terminal)=>{
  const band=svg('g',{'class':`diagrammaticRoad ${className}`,'data-road-id':road.id??''}),group=svg('g');
  const left=boundary(0),right=boundary(road.lanes);
  band.append(svg('path',{d:path([...left,...right.slice().reverse()])+' Z',fill:'white','data-silhouette':''}));
  // 2009 MUTCD Table 2E-4(M): 5-inch graphic lanes, 1x6-inch dashes / 6-inch gaps.
  // StripeMaker's actual lane widths remain in its native road units; the
  // graphic uses their ratio to derive the sign's lane-line scale.
  const lanePx=12*(road.laneWidth||12)/sheet.inchesPerPixel,unit=lanePx/5;
  for(let k=1;k<road.lanes;k++){
    const points=boundary(k),aligned=sheet.consistentGapsOnTurns!==false&&points.length===right.length;
    band.append(svg('path',{d:aligned?alignedDashes(points,right,unit*6):path(points),fill:'none',stroke:'black','stroke-width':unit,...(aligned?{'data-aligned-gaps':''}:{'stroke-dasharray':`${unit*6} ${unit*6}`})}));
  }
  if(terminal&&shape.line.length>1){
    const end=shape.line.at(-1),prev=shape.line.at(-2),a=left.at(-1),b=right.at(-1),width=Math.hypot(b.x-a.x,b.y-a.y);
    const angle=Math.atan2(end.x-prev.x,-(end.y-prev.y))*180/Math.PI;
    // Existing Type D artwork; 13.5 inches of head width per 5-inch lane.
    const scale=width*2.7/641;
    band.append(svg('path',{fill:'white','data-silhouette':'','data-shape-scale':scale,transform:`translate(${(a.x+b.x)/2} ${(a.y+b.y)/2}) rotate(${angle}) scale(${scale}) translate(-320.5 -478)`,d:'M202.043 478 L63.84 521.875 C27.613 533.479 -16.01 488.063 5.888 456.427 L320.543 0 L634.811 458.837 C654.829 489.989 614.017 534.94 572.983 521.875 L444.259 477.78 Z'}));
  }
  layers.pavement.append(band);layers.markings.append(group);
  return {band,group,ring:null};
};
  // Cut transparent clearance out of the lower stem, including its lane lines.
  // Joined ends remain continuous; only independent crossings are separated.
  const layerStems=sheet=>{
    const root=sheet?.roadLayer;if(!root)return;
    root.querySelector('.diagrammaticMasks')?.remove();
    const order=sheet.overlapOrder||[],rank=id=>order.indexOf(id);
    const roads=[...sheet.roads].sort((a,b)=>rank(a.id)-rank(b.id));
    const bands=new Map([...root.querySelectorAll('.diagrammaticRoad[data-road-id]')].filter(n=>n.dataset.roadId).map(n=>[Number(n.dataset.roadId),n]));
    const defs=svg('defs',{class:'diagrammaticMasks'});root.prepend(defs);
    for(let i=0;i<roads.length;i++){
      const road=roads[i],band=bands.get(road.id);if(!band)continue;
      band.removeAttribute('mask');band.parentElement.append(band);
      const upper=roads.slice(i+1).filter(other=>!road.ends.some(end=>other.ends.some(e=>e.joint===end.joint)));
      if(!upper.length)continue;
      const id=`diagrammatic-gap-${sheet.id}-${road.id}`;
      const mask=svg('mask',{id,maskUnits:'userSpaceOnUse',x:-sheet.width,y:-sheet.height,width:sheet.width*3,height:sheet.height*3,'mask-type':'luminance'});
      mask.append(svg('rect',{x:-sheet.width,y:-sheet.height,width:sheet.width*3,height:sheet.height*3,fill:'white'}));
      for(const other of upper)for(const shape of bands.get(other.id)?.querySelectorAll('[data-silhouette]')||[]){
        const cut=shape.cloneNode(true),gap=12*(other.laneWidth||12)/sheet.inchesPerPixel/5;
        cut.setAttribute('fill','black');cut.setAttribute('stroke','black');
        cut.setAttribute('stroke-width',2*gap/(Number(shape.dataset.shapeScale)||1));cut.setAttribute('stroke-linejoin','round');mask.append(cut);
      }
      defs.append(mask);band.setAttribute('mask',`url(#${id})`);
    }
  };
  const attachSubpanel=(frame,sign,index)=>{
    const panel=sign.subPanels[index];
    const apply=b=>Object.assign(frame.style,{left:b.x*100+'%',top:b.y*100+'%',width:b.width*100+'%',height:b.height*100+'%'});
    apply(panel.diagrammaticBounds);
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    for(const [edge,label,x,y]of [['move','Move',.5,0],['nw','Resize top-left',0,0],['n','Resize top',.5,0],['ne','Resize top-right',1,0],['e','Resize right',1,.5],['se','Resize bottom-right',1,1],['s','Resize bottom',.5,1],['sw','Resize bottom-left',0,1],['w','Resize left',0,.5]]){
      const handle=document.createElement('button');handle.type='button';handle.className='diagrammaticSubpanelHandle';handle.dataset.edge=edge;
      handle.setAttribute('aria-label',`${label} Subpanel ${index+1}`);handle.title=handle.getAttribute('aria-label');
      Object.assign(handle.style,{left:x*100+'%',top:y*100+'%',cursor:edge==='move'?'move':edge+'-resize'});
      if(edge==='move'){handle.textContent='✥';handle.classList.add('diagrammaticSubpanelMove');}
      let drag=null;
      const cancel=()=>{
        if(!drag)return;const id=drag.pointerId;apply(drag.original);drag=null;activeSubpanelDrag=null;
        if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);
      };
      handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0||!frame.parentElement?.classList.contains('diagrammaticEditing'))return;
        e.preventDefault();e.stopPropagation();activeSubpanelDrag?.cancel();handle.focus({preventScroll:true});
        const parent=frame.parentElement,rect=parent.getBoundingClientRect();
        drag={pointerId:e.pointerId,original:{...panel.diagrammaticBounds},next:{...panel.diagrammaticBounds},x:e.clientX,y:e.clientY,width:rect.width*parent.clientWidth/parent.offsetWidth,height:rect.height*parent.clientHeight/parent.offsetHeight};
        activeSubpanelDrag={cancel};handle.setPointerCapture(e.pointerId);
      });
      const update=e=>{
        if(!drag||e.pointerId!==drag.pointerId)return;
        const b=drag.original,dx=(e.clientX-drag.x)/drag.width,dy=(e.clientY-drag.y)/drag.height;
        let left=b.x,top=b.y,right=b.x+b.width,bottom=b.y+b.height;
        if(edge==='move')drag.next={...b,x:clamp(b.x+dx,0,1-b.width),y:clamp(b.y+dy,0,1-b.height)};
        else{
          if(edge.includes('w'))left=clamp(left+dx,0,right-.01);
          if(edge.includes('e'))right=clamp(right+dx,left+.01,1);
          if(edge.includes('n'))top=clamp(top+dy,0,bottom-.01);
          if(edge.includes('s'))bottom=clamp(bottom+dy,top+.01,1);
          drag.next={x:left,y:top,width:right-left,height:bottom-top};
        }
        apply(drag.next);
      };
      handle.addEventListener('pointermove',e=>{if(drag){e.preventDefault();e.stopPropagation();update(e);}});
      handle.addEventListener('pointerup',e=>{
        if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();e.stopPropagation();update(e);
        const {next,original}=drag;drag=null;activeSubpanelDrag=null;
        if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);
        if(JSON.stringify(next)!==JSON.stringify(original)&&api()?.getCurrentPanel()?.sign===sign)api().editDiagrammatic((model,current)=>{current.subPanels[index].diagrammaticBounds=next;});
      });
      handle.addEventListener('pointercancel',cancel);handle.addEventListener('lostpointercapture',cancel);
      frame.append(handle);
    }
  };
  const createEngine=()=>{
    const controlsHost=document.createElement('div');controlsHost.className='diagrammaticEngineControls';
    const controls=controlsHost.attachShadow({mode:'open'}),body=document.createElement('div');
    body.innerHTML=window.SignMakerRoadEngineSources.html;
    const css=document.createElement('style');css.textContent=window.SignMakerRoadEngineSources.css+`
      :host { display:block; font:14px Inter,sans-serif; color:var(--textColor); }
      [hidden] { display:none !important; }
      .modals { position:static; width:100%; max-width:none; }
      .modals > :not(#elementsEditor), #configBar, #workspace, dialog, #actionStatus { display:none !important; }
      #elementsEditor { width:100%; min-width:0; max-width:none; background:transparent; }
      .editorBar { display:none; } .editorContent { padding:0; max-height:none; overflow:visible; }
      input,select,button { font:inherit; } .fieldRow { display:flex; min-width:0; } .fieldRow > label { flex:0 0 45%; text-align:left; } .fieldRow > input,.fieldRow > select { min-width:0; } p { white-space:normal; }
      .nodeMenu { font:14px Inter,sans-serif; z-index:999999; }
    `;
    controls.append(css,body);document.getElementById('diagrammaticRoadControls').append(controlsHost);
    body.querySelector('#elementsEditor').hidden=false;
    body.querySelector('#addElement').setAttribute('aria-label','Add arrow stem');
    const live=document.createElement('div');live.className='diagrammaticLiveLayer';
    const canvas=live.attachShadow({mode:'open'}),style=document.createElement('style');
    style.textContent=window.SignMakerRoadEngineSources.css+`
      :host { display:block; position:absolute; inset:0; font:14px Inter,sans-serif; }
      #workspace,#previewStage { position:absolute; inset:0; width:100%; height:100%; display:block; padding:0; }
      .diagrammaticSheet { position:absolute; left:0; top:0; width:100%; height:100%; }
      #workspace { overflow:hidden; }
      :host(.editingInactive) { pointer-events:none; }
      :host(.editingInactive) .roadOverlay,:host(.editingInactive) .diagrammaticPlacement { display:none !important; }
      .roadNode,.laneAdd,.roadTaper { transform:translate(-50%,-50%) rotate(var(--angle,0rad)) scale(var(--handle-scale,1)); }
      button.roadControl { transform:translate(-50%,-50%) scale(var(--handle-scale,1)); }
      .roadControlLine { stroke-width:calc(1.5px * var(--handle-scale,1)); }
      .diagrammaticPlacement { position:absolute; border:1px dashed white; background:#ffffff22; pointer-events:none; z-index:20; }
      #workspace.placingSubpanel { cursor:crosshair; }
      #workspace.placingSubpanel .roadOverlay { visibility:hidden; }
      .roadMarkings { display:none !important; } .roadLayer { width:100%;height:100%; }
    `;
    const workspace=document.createElement('div');workspace.id='workspace';const stage=document.createElement('div');stage.id='previewStage';
    const content=document.createElement('div');content.className='diagrammaticSheet';stage.append(content);workspace.append(stage);canvas.append(style,workspace);
    const popupHost=document.createElement('div');popupHost.className='diagrammaticMenus';
    const popup=popupHost.attachShadow({mode:'open'}),popupStyle=document.createElement('style');
    popupStyle.textContent=window.SignMakerRoadEngineSources.css+' :host{position:fixed;inset:0;pointer-events:none;z-index:999999;} .nodeMenu{pointer-events:auto;} [hidden]{display:none!important;}';
    const nodeMenu=document.createElement('menu');nodeMenu.id='nodeMenu';nodeMenu.className='nodeMenu';nodeMenu.setAttribute('role','menu');nodeMenu.hidden=true;
    popup.append(popupStyle,nodeMenu);document.body.append(popupHost);
    const events=new EventTarget(),ready=[],editKeyHandlers=[];
    let ownsKeyboard=false,placingSubpanel=false,placementStart=null,editingActive=false,movingAssemblies=false,moveDrag=null;
    const inEditor=e=>e.composedPath().some(n=>n===live||n===controlsHost||n===popupHost);
    const wrapEvent=event=>new Proxy(event,{get(e,k){if(k==='target')return e.composedPath()[0];const v=e[k];return typeof v==='function'?v.bind(e):v;}});
    window.addEventListener('pointerdown',e=>{ownsKeyboard=editingActive&&live.isConnected&&inEditor(e);},true);
    window.addEventListener('focusin',e=>{ownsKeyboard=editingActive&&live.isConnected&&inEditor(e);},true);
    window.addEventListener('keydown',e=>{
      if(activeSubpanelDrag&&e.key==='Escape'){activeSubpanelDrag.cancel();e.preventDefault();e.stopImmediatePropagation();return;}
      if(!editingActive||!live.isConnected||(!ownsKeyboard&&!inEditor(e))||!['Escape','Delete','Backspace'].includes(e.key)||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]'))return;
      const target=e.composedPath()[0];
      if(e.key!=='Escape'&&target?.closest?.('input,textarea,select,[contenteditable]')){e.stopImmediatePropagation();return;}
      if(movingAssemblies){if(e.key==='Escape')cancelMove();}
      else if(placingSubpanel){if(e.key==='Escape')cancelPlacement();}
      else for(const handler of editKeyHandlers)handler(wrapEvent(e));
      e.preventDefault();e.stopImmediatePropagation();
    },true);
    const scopedDocument=new Proxy(document,{get(target,key){
      if(key==='body')return body;
      if(key==='activeElement')return popup.activeElement||controls.activeElement||canvas.activeElement;
      if(key==='getElementById')return id=>popup.getElementById(id)||canvas.getElementById(id)||controls.getElementById(id);
      if(key==='querySelector')return selector=>popup.querySelector(selector)||canvas.querySelector(selector)||controls.querySelector(selector);
      if(key==='querySelectorAll')return selector=>[...popup.querySelectorAll(selector),...canvas.querySelectorAll(selector),...controls.querySelectorAll(selector)];
      if(key==='dispatchEvent')return e=>events.dispatchEvent(e);
      if(key==='addEventListener')return (type,fn,options)=>{
        if(type==='DOMContentLoaded'){ready.push(fn);return;}
        if(type.startsWith('sheet')){events.addEventListener(type,fn,options);return;}
        if(type==='keydown')editKeyHandlers.push(fn);
        document.addEventListener(type,event=>{ 
          if(!editingActive||!live.isConnected||!event.composedPath().some(n=>n===controlsHost||n===live||n===popupHost))return;
          fn(wrapEvent(event));
        },options);
      };
      const value=target[key];return typeof value==='function'?value.bind(target):value;
    }});
    const appState={diagrammatic:true,diagrammaticRender:layerStems,traffic:{reversed:false,sign:1,incoming:e=>e,path:p=>p,angle:a=>a},settings:{get:()=>false}};
    const scopedWindow=new Proxy(window,{get(target,key){
      if(key==='StripeMaker')return appState;if(key==='DiagrammaticRoadRenderer')return renderer;
      if(key==='addEventListener')return(type,fn,options)=>{
        if(type==='resize'||type==='blur')window.addEventListener(type,()=>{if(live.isConnected)fn();},options);
        else scopedDocument.addEventListener(type,fn,options);
      };
      const value=target[key];return typeof value==='function'?value.bind(target):value;
    }});
    let sign=null,sheet=null,committing=false,graphKey='',pendingSave=false;
    const snapshot=()=>Object.fromEntries(['width','height','inchesPerPixel','roads','joints','autoTapers','overlapOrder'].map(k=>[k,structuredClone(sheet[k])]));
    const commit=()=>{
      if(!sheet||!sign||committing||api()?.getCurrentPanel()?.sign!==sign)return;
      const graph=snapshot(),key=JSON.stringify(graph);
      graphKey=key;const drawing=sheet.roadLayer.cloneNode(true);drawing.querySelectorAll('.roadSelection,.roadMarkings').forEach(n=>n.remove());
      const artwork=new XMLSerializer().serializeToString(drawing);
      if(key===JSON.stringify(sign.diagrammatic?.roadGraph)&&artwork===sign.diagrammatic?.artwork)return;
      committing=true;
      try { api().editDiagrammatic(model=>{model.roadGraph=graph;model.artwork=artwork;},{redraw:false});
        const image=live.parentElement?.querySelector('.diagrammaticDrawing');if(image){image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artwork);image.style.visibility='';}
      } finally {committing=false;}
    };
    const scheduleCommit=()=>{if(!pendingSave){pendingSave=true;queueMicrotask(()=>{pendingSave=false;commit();});}};
    appState.sheets={get selected(){return sheet;},get all(){return sheet?[sheet]:[];},save:scheduleCommit,addOverlay:el=>stage.append(el),
      toImage(x,y){const r=stage.getBoundingClientRect();return{x:(x-r.left)*sheet.width/r.width,y:(y-r.top)*sheet.height/r.height};},
      toScreen(p){return{x:p.x*stage.clientWidth/sheet.width,y:p.y*stage.clientHeight/sheet.height};}};
    appState.diagrammaticOrder=(id,front)=>{
      if(!sheet?.roads.some(r=>r.id===id))return;
      const ordered=[...sheet.roads].sort((a,b)=>(sheet.overlapOrder||[]).indexOf(a.id)-(sheet.overlapOrder||[]).indexOf(b.id)).map(r=>r.id).filter(n=>n!==id);
      sheet.overlapOrder=front?[...ordered,id]:[id,...ordered];
      appState.roadEditor.render();commit();
    };
    appState.history={record:scheduleCommit,rebase(){},runWithUndo:fn=>{fn();scheduleCommit();}};
    appState.showEditor=()=>{
      const tab=document.getElementById('sMDiagrammatics');
      if(!tab?.getClientRects().length){document.getElementById('guideArrowConfig')?.click();document.querySelector('[data-tab="sMDiagrammatics"]')?.click();}
    };
    const addMenu=body.querySelector('#elementToAdd'),placeOption=document.createElement('option');
    placeOption.value='subpanel';placeOption.textContent='Place subpanel';addMenu.append(placeOption);
    const placeButton=document.createElement('button');placeButton.id='placeDiagrammaticSubpanel';placeButton.type='button';placeButton.hidden=true;body.append(placeButton);
    const box=document.createElement('div');box.className='diagrammaticPlacement';box.hidden=true;workspace.append(box);
    const moveButton=document.createElement('button');moveButton.type='button';moveButton.textContent='Move assemblies';moveButton.setAttribute('aria-pressed','false');
    const cancelMove=()=>{
      if(moveDrag&&moveDrag.sheet===sheet){sheet.joints=moveDrag.joints;sheet.roads=moveDrag.roads;appState.roadEditor.render();}
      if(moveDrag&&workspace.hasPointerCapture(moveDrag.pointerId))workspace.releasePointerCapture(moveDrag.pointerId);
      moveDrag=null;movingAssemblies=false;workspace.classList.remove('movingAssemblies');moveButton.setAttribute('aria-pressed','false');
    };
    moveButton.addEventListener('click',()=>{
      if(movingAssemblies){cancelMove();return;}
      cancelPlacement();
      if(body.querySelector('#addRoad').getAttribute('aria-pressed')==='true')body.querySelector('#addRoad').click();
      appState.roadEditor.focusRoad(null);movingAssemblies=true;ownsKeyboard=true;
      workspace.classList.add('movingAssemblies');moveButton.setAttribute('aria-pressed','true');
      body.querySelector('#elementsHint').textContent='Drag on the sign to move all arrow assemblies together. Escape cancels.';
    });
    workspace.addEventListener('pointerdown',e=>{
      if(!editingActive||!movingAssemblies||e.button!==0||!sheet.roads.length)return;
      e.preventDefault();e.stopImmediatePropagation();workspace.setPointerCapture(e.pointerId);
      moveDrag={sheet,pointerId:e.pointerId,origin:appState.sheets.toImage(e.clientX,e.clientY),joints:structuredClone(sheet.joints),roads:structuredClone(sheet.roads)};
    },true);
    workspace.addEventListener('pointermove',e=>{
      if(!editingActive||!movingAssemblies)return;e.stopImmediatePropagation();if(!moveDrag)return;
      const point=appState.sheets.toImage(e.clientX,e.clientY),dx=point.x-moveDrag.origin.x,dy=point.y-moveDrag.origin.y;
      sheet.joints=moveDrag.joints.map(j=>({...structuredClone(j),x:j.x+dx,y:j.y+dy}));
      sheet.roads=structuredClone(moveDrag.roads);
      for(const road of sheet.roads)for(const end of road.ends){const link=end.curveLink;if(link?.mode==='mirror')link.axis=link.axis.map(p=>({x:p.x+dx,y:p.y+dy}));}
      appState.roadEditor.render();
    },true);
    workspace.addEventListener('pointerup',e=>{
      if(!movingAssemblies||!moveDrag)return;e.preventDefault();e.stopImmediatePropagation();
      moveDrag=null;if(workspace.hasPointerCapture(e.pointerId))workspace.releasePointerCapture(e.pointerId);commit();
    },true);
    workspace.addEventListener('pointercancel',()=>{if(movingAssemblies)cancelMove();},true);
    style.textContent+='#workspace.movingAssemblies{cursor:move} #workspace.movingAssemblies .roadOverlay{visibility:hidden}';
    const cancelPlacement=()=>{placingSubpanel=false;placementStart=null;box.hidden=true;workspace.classList.remove('placingSubpanel');placeButton.setAttribute('aria-pressed','false');body.querySelector('#addElement').setAttribute('aria-pressed','false');};
    placeButton.addEventListener('click',()=>{
      cancelMove();
      if(placingSubpanel){cancelPlacement();return;}
      if(body.querySelector('#addRoad').getAttribute('aria-pressed')==='true')body.querySelector('#addRoad').click();
      appState.roadEditor.focusRoad(null);placingSubpanel=true;ownsKeyboard=true;workspace.classList.add('placingSubpanel');placeButton.setAttribute('aria-pressed','true');
      body.querySelector('#elementsHint').textContent='Drag a box on the sign to place a subpanel. Escape cancels.';
    });
    body.querySelector('#addElement').addEventListener('click',cancelMove,true);
    addMenu.addEventListener('change',()=>{cancelMove();if(addMenu.value!=='subpanel')cancelPlacement();});
    const placementPoint=e=>{const p=appState.sheets.toImage(e.clientX,e.clientY);return{x:Math.max(0,Math.min(sheet.width,p.x)),y:Math.max(0,Math.min(sheet.height,p.y))};};
    workspace.addEventListener('pointerdown',e=>{
      if(!placingSubpanel||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();workspace.setPointerCapture(e.pointerId);placementStart=placementPoint(e);box.hidden=false;
      const p=appState.sheets.toScreen(placementStart);Object.assign(box.style,{left:p.x+'px',top:p.y+'px',width:'0',height:'0'});
    },true);
    workspace.addEventListener('pointermove',e=>{
      if(!placingSubpanel)return;e.stopImmediatePropagation();if(!placementStart)return;
      const a=appState.sheets.toScreen(placementStart),b=appState.sheets.toScreen(placementPoint(e));
      Object.assign(box.style,{left:Math.min(a.x,b.x)+'px',top:Math.min(a.y,b.y)+'px',width:Math.abs(a.x-b.x)+'px',height:Math.abs(a.y-b.y)+'px'});
    },true);
    workspace.addEventListener('pointerup',e=>{
      if(!placingSubpanel||!placementStart)return;e.preventDefault();e.stopImmediatePropagation();
      const a=placementStart,b=placementPoint(e),bounds={x:Math.min(a.x,b.x)/sheet.width,y:Math.min(a.y,b.y)/sheet.height,width:Math.abs(a.x-b.x)/sheet.width,height:Math.abs(a.y-b.y)/sheet.height};
      cancelPlacement();if(workspace.hasPointerCapture(e.pointerId))workspace.releasePointerCapture(e.pointerId);
      if(bounds.width>=.01&&bounds.height>=.01){ownsKeyboard=false;api().addDiagrammaticSubpanel(bounds);}
    },true);
    workspace.addEventListener('pointercancel',()=>{if(placingSubpanel)cancelPlacement();},true);
    for(const factory of window.SignMakerRoadEngineFactories)factory(scopedWindow,scopedDocument,scopedWindow);
    for(const fn of ready)fn();
    // One camera surrounds the complete post; exports clone inside this wrapper.
    const preview=document.querySelector('main'),post=document.getElementById('postContainer');
    let world=document.getElementById('diagrammaticPreviewWorld');
    if(!world){
      world=document.createElement('div');world.id='diagrammaticPreviewWorld';
      Object.assign(world.style,{position:'absolute',inset:'0',display:'flex',alignItems:'center',justifyContent:'center',transformOrigin:'0 0'});
      preview.style.position='relative';preview.style.overflow='hidden';post.before(world);world.append(post);
    }
    let zoom=1,panX=0,panY=0,trackpadScrollUntil=0;
    const refreshHandles=()=>{
      if(!sheet||!live.isConnected)return;
      const screenScale=stage.getBoundingClientRect().width/stage.clientWidth;
      live.style.setProperty('--handle-scale',1/(screenScale||1));
      live.parentElement?.style.setProperty('--diagrammatic-handle-scale',1/(screenScale||1));
      sheet.view={x:0,y:0,scale:stage.getBoundingClientRect().width/sheet.width};
      events.dispatchEvent(new Event('sheetview'));
    };
    const applyView=()=>{
      world.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`;
      zoomLabel.textContent=Math.round(zoom*100)+'%';refreshHandles();
    };
    const zoomAt=(factor,clientX,clientY)=>{
      if(!editingActive)return;
      const r=preview.getBoundingClientRect(),x=(clientX-r.left)*preview.clientWidth/r.width,y=(clientY-r.top)*preview.clientHeight/r.height;
      const next=Math.max(.5,Math.min(16,zoom*factor));panX=x-(x-panX)*next/zoom;panY=y-(y-panY)*next/zoom;zoom=next;applyView();
    };
    const panBy=(dx,dy)=>{if(!editingActive)return;const r=preview.getBoundingClientRect();panX+=dx*preview.clientWidth/r.width;panY+=dy*preview.clientHeight/r.height;applyView();};
    appState.sheets.zoomBy=factor=>{const r=document.getElementById('panelContainer').getBoundingClientRect();zoomAt(factor,r.left+r.width/2,r.top+r.height/2);};
    appState.sheets.recenter=()=>{zoom=1;panX=panY=0;applyView();};
    const toolbar=document.createElement('div');toolbar.className='diagrammaticViewControls';
    toolbar.innerHTML='<button type="button" aria-label="Zoom out">−</button><output aria-label="Zoom level">100%</output><button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Fit sign preview">Fit</button><label>Scroll <select aria-label="Scroll wheel mode"><option value="auto">Automatic</option><option value="zoom">Zoom</option><option value="pan">Pan</option></select></label>';
    const zoomLabel=toolbar.querySelector('output'),mode=toolbar.querySelector('select'),buttons=toolbar.querySelectorAll('button');
    mode.addEventListener('change',()=>{trackpadScrollUntil=0;});
    window.addEventListener('keydown',e=>{
      if(!editingActive||!e.composedPath().some(n=>n===preview||n===controlsHost)||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.composedPath()[0]?.matches?.('input,select,textarea,[contenteditable]'))return;
      if(!['=','+','-','f','F'].includes(e.key))return;
      e.preventDefault();e.stopImmediatePropagation();
      if(e.key.toLowerCase()==='f')appState.sheets.recenter();else appState.sheets.zoomBy(e.key==='-'?.8:1.25);
    },true);
    buttons[0].onclick=()=>appState.sheets.zoomBy(.8);buttons[1].onclick=()=>appState.sheets.zoomBy(1.25);buttons[2].onclick=()=>appState.sheets.recenter();
    toolbar.append(moveButton);
    body.querySelector('.editorContent').prepend(toolbar);
    css.textContent+='.diagrammaticViewControls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px}.diagrammaticViewControls label{display:flex;gap:6px;align-items:center}.diagrammaticViewControls output{min-width:3em;text-align:center}';
    // StripeMaker's scroll-device detection and zoom factors for the entire preview.
    preview.addEventListener('wheel',event=>{
      if(!editingActive||!sheet)return;event.preventDefault();event.stopPropagation();
      const unit=event.deltaMode===1?16:event.deltaMode===2?stage.clientHeight:1,dx=event.deltaX*unit,dy=event.deltaY*unit;
      if(event.ctrlKey)return zoomAt(Math.exp(-dy*.01),event.clientX,event.clientY);
      if(mode.value==='zoom')return zoomAt(Math.exp(-dy*.002),event.clientX,event.clientY);
      if(mode.value==='pan')return panBy(-dx,-dy);
      const legacy=event.wheelDeltaY,now=performance.now(),notch=Number.isFinite(legacy)&&Math.abs(legacy)>=120&&Math.abs(legacy)%120===0;
      const trackpad=event.deltaMode===0&&(now<trackpadScrollUntil||dx!==0||!(notch||(Number.isInteger(event.deltaY)&&Math.abs(event.deltaY)>=40)));
      if(trackpad){trackpadScrollUntil=now+300;panBy(-dx,-dy);}else zoomAt(Math.exp(-dy*.002),event.clientX,event.clientY);
    },{passive:false});
    let gestureScale=1;
    preview.addEventListener('gesturestart',e=>{if(!editingActive)return;e.preventDefault();gestureScale=1;});
    preview.addEventListener('gesturechange',e=>{if(!editingActive)return;e.preventDefault();e.stopPropagation();zoomAt(e.scale/gestureScale,e.clientX,e.clientY);gestureScale=e.scale;});
    preview.addEventListener('gestureend',e=>{if(editingActive)e.preventDefault();});
    const pointers=new Map();let pinchDistance=0;
    for(const surface of [workspace,preview]){
      surface.addEventListener('pointerdown',e=>{
        if(!editingActive||e.button!==0||(surface===preview&&e.target!==preview&&e.target!==world))return;
        e.stopPropagation();surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}
      });
      surface.addEventListener('pointermove',e=>{
        const last=pointers.get(e.pointerId);if(!editingActive||!last)return;e.stopPropagation();
        const current={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,current);
        if(pointers.size===1)panBy(current.x-last.x,current.y-last.y);
        else if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance)zoomAt(distance/pinchDistance,(a.x+b.x)/2,(a.y+b.y)/2);pinchDistance=distance;}
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,e=>{pointers.delete(e.pointerId);pinchDistance=0;});
    }
    const resize=applyView;
    new ResizeObserver(resize).observe(live);
    new MutationObserver(refreshHandles).observe(post,{attributes:true,attributeFilter:['style']});
    post.addEventListener('transitionend',refreshHandles);
    live.addEventListener('pointerdown',e=>e.stopPropagation());live.addEventListener('click',e=>e.stopPropagation());live.addEventListener('dblclick',e=>e.stopPropagation());
    const syncVisibility=()=>{
      const tab=document.getElementById('sMDiagrammatics');
      const active=live.isConnected&&api()?.getCurrentPanel()?.sign?.arrowMode==='diagrammatic'&&!!tab?.getClientRects().length&&!tab.classList.contains('tabHidden');
      live.parentElement?.classList.toggle('diagrammaticEditing',active);
      if(active===editingActive&&body.querySelector('#elementsEditor').hidden===!active)return;
      editingActive=active;live.classList.toggle('editingInactive',!active);
      body.querySelector('#elementsEditor').hidden=!active;
      if(!active){
        activeSubpanelDrag?.cancel();cancelMove();cancelPlacement();ownsKeyboard=false;nodeMenu.hidden=true;
        for(const id of pointers.keys())for(const surface of [workspace,preview])if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
        pointers.clear();pinchDistance=0;gestureScale=1;trackpadScrollUntil=0;
        appState.sheets.recenter();
      }
    };
    const visibilityObserver=new MutationObserver(syncVisibility);
    const watched=new Set([document.getElementById('sMConfigBar'),document.getElementById('mobileEditor')]);
    for(let n=controlsHost.parentElement;n;n=n.parentElement)watched.add(n);
    for(const n of watched)if(n)visibilityObserver.observe(n,{attributes:true,attributeFilter:['style','class','hidden','data-current-menu','inert']});
    window.addEventListener('resize',syncVisibility);
    return {app:appState,live,controlsHost,commit,
      mount(host,nextSign){
        host.append(live);
        const model=normalize(nextSign.diagrammatic);
        if(sign!==nextSign||sheet?.width!==model.width*model.unitsPerRem||sheet?.height!==model.height*model.unitsPerRem||sheet?.consistentGapsOnTurns!==model.consistentGapsOnTurns||JSON.stringify(nextSign.diagrammatic?.roadGraph||null)!==graphKey){
          sign=nextSign;const graph=normalize(sign.diagrammatic).roadGraph;
          sheet={id:1,name:'Diagrammatic sign',width:1600,height:1000,inchesPerPixel:6,roads:[],joints:[],autoTapers:true,overlapOrder:[],...structuredClone(graph||{}),width:model.width*model.unitsPerRem,height:model.height*model.unitsPerRem,consistentGapsOnTurns:model.consistentGapsOnTurns,content,view:{x:0,y:0,scale:stage.getBoundingClientRect().width/1600}};
          content.replaceChildren();graphKey=JSON.stringify(graph||snapshot());events.dispatchEvent(new Event('sheetchange'));
        }
        resize();syncVisibility();scheduleCommit();
      },
      sync(nextSign){syncVisibility();if(!committing&&sign===nextSign&&sheet&&(sheet.consistentGapsOnTurns!==normalize(nextSign.diagrammatic).consistentGapsOnTurns||JSON.stringify(nextSign.diagrammatic?.roadGraph||null)!==graphKey)&&live.isConnected)this.mount(live.parentElement,nextSign);},
      detach(){activeSubpanelDrag?.cancel();cancelMove();cancelPlacement();ownsKeyboard=false;live.parentElement?.classList.remove('diagrammaticEditing');live.remove();nodeMenu.hidden=true;syncVisibility();}
    };
  };
  const ensureEngine=()=>engine||(engine=createEngine());
  const render=(host,sign)=>{
    const model=normalize(sign.diagrammatic);host.style.width=model.width+'rem';host.style.height=model.height+'rem';
    const image=document.createElement('img');image.className='diagrammaticDrawing';image.alt='Diagrammatic guide arrows';
    if(model.artwork)image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(model.artwork);else image.style.visibility='hidden';host.append(image);
    if(api()?.getCurrentPanel()?.sign===sign)ensureEngine().mount(host,sign);
  };
  const syncEditor=sign=>{
    if(!document.getElementById('sMDiagrammatics'))return;
    if(!installed){installed=true;
      document.getElementById('diagrammaticWidth').addEventListener('change',e=>api()?.editDiagrammatic(m=>{m.width=normalize({width:e.target.value}).width;}));
      document.getElementById('diagrammaticHeight').addEventListener('change',e=>api()?.editDiagrammatic(m=>{m.height=normalize({height:e.target.value}).height;}));
      document.getElementById('diagrammaticConsistentGaps').addEventListener('change',e=>api()?.editDiagrammatic(m=>{m.consistentGapsOnTurns=e.target.checked;}));}
    document.getElementById('diagrammaticHeight').value=normalize(sign?.diagrammatic).height;
    document.getElementById('diagrammaticConsistentGaps').checked=normalize(sign?.diagrammatic).consistentGapsOnTurns;
    document.getElementById('diagrammaticWidth').value=normalize(sign?.diagrammatic).width;
    document.getElementById('diagrammaticRoadControls').hidden=sign?.arrowMode!=='diagrammatic';
    if(sign?.arrowMode==='diagrammatic')engine?.sync(sign);else engine?.detach();
  };
  return {normalize,alignedDashes,attachSubpanel,render,syncEditor,get engine(){return engine;}};
})();
