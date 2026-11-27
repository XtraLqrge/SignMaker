/* Native adapter: StripeMaker's road controls and graph edit the
 * actual sign surface. Shadow roots isolate its CSS and IDs, not a second page. */
window.SignMakerDiagrammatics=(()=>{
  const api=()=>typeof app==='undefined'?null:app.exposeToFormHandler;
  const headSize=value=>Math.max(50,Math.min(200,Number(value)||100));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const templateNames=new Set(['straight','left','right','split']);
  const normalize=value=>{
    const width=clamp(Number(value?.width)||(value?.roadGraph||value?.artwork?40:24),1,80);
    return {
      version:2,width,
      height:Math.max(1,Math.min(80,Number(value?.height)||width*.625)),
      consistentGapsOnTurns:value?.consistentGapsOnTurns!==false,
      arrowHeadSize:headSize(value?.arrowHeadSize),
      straightenOnShiftClick:value?.straightenOnShiftClick!==false,
      // Retain the existing drawing scale when opening an older sign.
      unitsPerRem:Number(value?.unitsPerRem)||(Number(value?.roadGraph?.width)/width)||40,
      roadGraph:value?.roadGraph?structuredClone(value.roadGraph):null,
      ...(templateNames.has(value?.template)?{template:value.template}:{}),
      artwork:typeof value?.artwork==='string'?value.artwork:''
    };
  };
  const templateGraph=(model,name)=>{
    const width=model.width*model.unitsPerRem,height=model.height*model.unitsPerRem;
    const inchesPerPixel=Math.max(6,3600/Math.min(width,height)),laneWidth=12;
    const laneOffset=laneWidth*12/inchesPerPixel/2;
    const roads=[],joints=[];
    const node=(x,y,root,dir=null)=>{
      const joint={id:joints.length+1,x,y,root,dir,links:[]};
      joints.push(joint);return joint;
    };
    const stem=(start,end,lanes)=>{
      const id=roads.length+1,angle=2*Math.atan2(end.x-start.x,start.y-end.y)*180/Math.PI;
      const road={id,lanes,laneWidth,arcAngle:angle,straightened:angle===0,arcAnchorEnd:null,
        ends:[start,end].map(joint=>({joint:joint.id,sign:1,length:null}))};
      roads.push(road);return road;
    };
    const center=width/2,up={x:0,y:-1};
    const base=node(center,height*.86,1,up);
    if(name==='straight'){
      stem(base,node(center,height*.42,1,up),2);
    }else{
      const fork=node(center,height*.62,1,up),tipY=height*.34;
      const bend=Math.min(width*.21,(fork.y-tipY)*Math.tan(Math.PI/8));
      stem(base,fork,2);
      for(const side of [-1,1]){
        const turns=name==='split'||name===(side<0?'left':'right');
        const start={...fork,x:center+side*laneOffset};
        const end=node(start.x+(turns?side*bend:0),tipY,roads.length+1,turns?null:up);
        const branch=stem(start,end,1);
        fork.links.push({a:1,b:branch.id,ai:side<0?0:1,bi:0});
      }
    }
    return {width,height,inchesPerPixel,roads,joints,autoTapers:true,overlapOrder:[]};
  };
  const useTemplate=(model,name)=>{
    model.template=name;model.roadGraph=templateGraph(model,name);model.artwork='';
  };
  const ensureStarter=sign=>{
    const saved=sign.diagrammatic;
    if(saved?.roadGraph||saved?.artwork)return;
    const model=normalize(saved);
    useTemplate(model,'straight');sign.diagrammatic=model;
  };
  const canUseTemplates=model=>Boolean(model?.template||
    (model?.roadGraph?Array.isArray(model.roadGraph.roads)&&!model.roadGraph.roads.length:!model?.artwork));
  const syncTemplates=(sign,model=sign?.diagrammatic)=>{
    const fieldset=document.getElementById('diagrammaticTemplates');
    if(!fieldset)return;
    fieldset.hidden=sign?.arrowMode!=='diagrammatic'||!canUseTemplates(model);
    for(const button of fieldset.querySelectorAll('[data-diagrammatic-template]'))
      button.setAttribute('aria-pressed',String(button.dataset.diagrammaticTemplate===model?.template));
  };
  // A portable file holds the road graph and the drawing size it was made at;
  // artwork is redrawn from the graph on import.
  const FORMAT='signmaker-diagrammatic';
  const toJSON=value=>{
    const {width,height,unitsPerRem,consistentGapsOnTurns,arrowHeadSize,straightenOnShiftClick,roadGraph}=normalize(value);
    return JSON.stringify({format:FORMAT,version:1,width,height,unitsPerRem,consistentGapsOnTurns,arrowHeadSize,straightenOnShiftClick,roadGraph},null,2);
  };
  const fromJSON=text=>{
    let data;try{data=JSON.parse(text);}catch{throw new Error('The file is not valid JSON.');}
    if(data?.format!==FORMAT)throw new Error('The file is not a diagrammatic export.');
    const graph=data.roadGraph,finite=n=>typeof n==='number'&&Number.isFinite(n);
    if(!graph||!Array.isArray(graph.roads)||!Array.isArray(graph.joints))throw new Error('The file has no road graph.');
    const joints=new Set();
    for(const joint of graph.joints){
      if(!finite(joint?.id)||!finite(joint.x)||!finite(joint.y)||joints.has(joint.id))throw new Error('The file has an invalid node.');
      joints.add(joint.id);joint.links??=[];
    }
    const roads=new Set();
    for(const road of graph.roads)
      if(!finite(road?.id)||roads.has(road.id)||!Number.isInteger(road.lanes)||road.lanes<1||!finite(road.laneWidth)||!Array.isArray(road.ends)||road.ends.length!==2||!road.ends.every(end=>joints.has(end?.joint)))throw new Error('The file has an invalid arrow stem.');
      else roads.add(road.id);
    graph.overlapOrder=Array.isArray(graph.overlapOrder)?graph.overlapOrder.filter(id=>roads.has(id)):[];
    const {roadGraph,...model}=normalize({...data,artwork:''});
    return {...model,roadGraph:graph};
  };
  let engine=null,installed=false,activeBoxDrag=null,selectedAssembly=null;
const SVG='http://www.w3.org/2000/svg';
const svg=(tag,attrs={})=>{const n=document.createElementNS(SVG,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
// Scale the wings and height of the Type D head while keeping its stem joint fixed.
const arrowHeadPath=percent=>{
  const size=headSize(percent)/100;
  const point=(x,y)=>{
    const edge=x<320.5?202.043:444.259;
    const scaledX=x<202.043||x>444.259?edge+(x-edge)*size:x;
    return `${scaledX},${478+(y-478)*size}`;
  };
  return `M${point(202.043,478)} L${point(63.84,521.875)} C${point(27.613,533.479)} ${point(-16.01,488.063)} ${point(5.888,456.427)} L${point(320.543,0)} L${point(634.811,458.837)} C${point(654.829,489.989)} ${point(614.017,534.94)} ${point(572.983,521.875)} L${point(444.259,477.78)} Z`;
};
// Use the right edge's stations for every separator so dash ends line up
// across a turn, rather than drifting with each lane's different arc length.
// `start` continues the pattern from the roads feeding into this one.
const alignedDashes=(points,reference,dash,start=0)=>{
  let distance=start,d='',continuous=false;
  for(let i=1;i<reference.length;i++){
    const length=Math.hypot(reference[i].x-reference[i-1].x,reference[i].y-reference[i-1].y);
    if(length<1e-9)continue;
    for(let at=0;at<length-1e-9;){
      const phase=(distance+at)%(dash*2),step=Math.min(length-at,(phase<dash?dash:dash*2)-phase);
      if(step<1e-9){at+=1e-8;continue;}
      if(phase<dash){
        const a=points[i-1],b=points[i],t=at/length,u=(at+step)/length;
        if(!continuous)d+=`M${a.x+(b.x-a.x)*t},${a.y+(b.y-a.y)*t}`;
        d+=`L${a.x+(b.x-a.x)*u},${a.y+(b.y-a.y)*u} `;
        continuous=phase+step<dash-1e-9;
      }else continuous=false;
      at+=step;
    }
    distance+=length;
  }
  return d;
};
const renderer=(sheet,road,shape,layers,className,boundary,terminal,{joined=[false,false],dashPhase=0}={})=>{
  const band=svg('g',{'class':`diagrammaticRoad ${className}`,'data-road-id':road.id??''});
  const group=svg('g',{class:`diagrammaticLaneLines ${className}`,'data-road-id':road.id??''});
  const left=boundary(0),right=boundary(road.lanes);
  // 2009 MUTCD Table 2E-4(M): 5-inch graphic lanes, 1x6-inch dashes / 6-inch gaps.
  // StripeMaker's actual lane widths remain in its native road units; the
  // graphic uses their ratio to derive the sign's lane-line scale.
  const lanePx=12*(road.laneWidth||12)/sheet.inchesPerPixel,unit=lanePx/5;
  // Joined ends overlap the next road slightly, so anti-aliasing leaves no
  // seam where two white stems meet.
  const extend=(edge,e)=>{
    if(!joined[e]||edge.length<2)return edge;
    // Follow the curve's own end tangent; the last sampled chord of an arc
    // would tilt the overlap off the shared heading.
    const [tip,inner]=e?[edge.at(-1),edge.at(-2)]:[edge[0],edge[1]],tangent=(e?shape.line.at(-1):shape.line[0])?.tangent;
    const out=tangent?{x:tangent.x*(e?1:-1),y:tangent.y*(e?1:-1)}:{x:tip.x-inner.x,y:tip.y-inner.y},length=Math.hypot(out.x,out.y)||1,reach=unit*.25;
    const moved={x:tip.x+out.x/length*reach,y:tip.y+out.y/length*reach};
    return e?[...edge.slice(0,-1),moved]:[moved,...edge.slice(1)];
  };
  const outline=edge=>extend(extend(edge,0),1);
  band.append(svg('path',{d:path([...outline(left),...[...outline(right)].reverse()])+' Z',fill:'white','data-silhouette':''}));
  for(let k=1;k<road.lanes;k++){
    const points=boundary(k),aligned=sheet.consistentGapsOnTurns!==false&&points.length===right.length;
    group.append(svg('path',{d:aligned?alignedDashes(points,right,unit*6,dashPhase):path(points),fill:'none',stroke:'black','stroke-width':unit,
      ...(aligned?{'data-aligned-gaps':''}:{'stroke-dasharray':`${unit*6} ${unit*6}`,'stroke-dashoffset':dashPhase})}));
  }
  if(terminal&&shape.line.length>1){
    const a=left.at(-1),b=right.at(-1),width=Math.hypot(b.x-a.x,b.y-a.y);
    const tangent={x:b.y-a.y,y:a.x-b.x};
    const angle=Math.atan2(tangent.x,-tangent.y)*180/Math.PI;
    // Overlap the cap and stem a little across the whole neck.
    const overlap=Math.min(unit*.4,width*.1)/(width||1);
    const x=(a.x+b.x)/2-tangent.x*overlap,y=(a.y+b.y)/2-tangent.y*overlap;
    // Existing Type D artwork; 13.5 inches of head width per 5-inch lane.
    const scale=width*2.7/641;
    band.append(svg('path',{fill:'white','data-silhouette':'','data-shape-scale':scale,transform:`translate(${x} ${y}) rotate(${angle}) scale(${scale}) translate(-320.5 -478)`,d:arrowHeadPath(road.arrowHeadSize??sheet.arrowHeadSize)}));
  }
  layers.pavement.append(band);layers.markings.append(group);
  return {band,group,ring:null};
};
  // Cut transparent clearance out of the lower stem, including its lane lines.
  // Joined ends remain continuous; only independent crossings are separated.
  const layerStems=sheet=>{
    const root=sheet?.roadLayer;if(!root)return;
    root.querySelector('.diagrammaticMasks')?.remove();
    root.querySelector('.diagrammaticVisibleLaneLines')?.remove();
    const order=sheet.overlapOrder||[],rank=id=>order.indexOf(id);
    const roads=[...sheet.roads].sort((a,b)=>rank(a.id)-rank(b.id));
    const bands=new Map([...root.querySelectorAll('.diagrammaticRoad[data-road-id]')].filter(n=>n.dataset.roadId).map(n=>[Number(n.dataset.roadId),n]));
    const laneLines=new Map([...root.querySelectorAll('.roadMarkings .diagrammaticLaneLines[data-road-id]')].filter(n=>n.dataset.roadId).map(n=>[Number(n.dataset.roadId),n]));
    const defs=svg('defs',{class:'diagrammaticMasks'});root.prepend(defs);
    const layer=svg('g',{class:'diagrammaticVisibleLaneLines'});
    const markings=root.querySelector('.roadMarkings');root.append(layer);
    // Paint connected lane lines over the white junction. Use the same mask
    // as the lower stem wherever a separate arrow passes in front of it.
    for(const road of roads){
      const group=laneLines.get(road.id);
      if(group)layer.append(group.cloneNode(true));
    }
    for(const join of markings?.querySelectorAll('.diagrammaticJointLines')||[])layer.append(join.cloneNode(true));
    const visibleLines=new Map([...layer.querySelectorAll('.diagrammaticLaneLines')].map(n=>[Number(n.dataset.roadId),n]));
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
      visibleLines.get(road.id)?.setAttribute('mask',`url(#${id})`);
    }
  };
  const makeSheet=(model,content,screenWidth)=>({
    id:1,name:'Diagrammatic sign',inchesPerPixel:6,roads:[],joints:[],autoTapers:true,overlapOrder:[],...structuredClone(model.roadGraph||{}),
    width:model.width*model.unitsPerRem,height:model.height*model.unitsPerRem,
    consistentGapsOnTurns:model.consistentGapsOnTurns,arrowHeadSize:model.arrowHeadSize,straightenOnShiftClick:model.straightenOnShiftClick,
    content,view:{x:0,y:0,scale:screenWidth/(model.width*model.unitsPerRem)}
  });
  const serializeArtwork=(layer,model)=>{
    const drawing=layer.cloneNode(true);
    drawing.querySelectorAll('.roadSelection,.roadMarkings,.diagrammaticRoad.preview').forEach(n=>n.remove());
    if(model)drawing.setAttribute('viewBox',`0 0 ${model.width*model.unitsPerRem} ${model.height*model.unitsPerRem}`);
    return new XMLSerializer().serializeToString(drawing);
  };
  const fixedAxes=host=>({
    width:host?.parentElement?.classList.contains('panelFixedWidth'),
    height:host?.parentElement?.classList.contains('panelFixedHeight')
  });
  const viewportModel=(model,host)=>{
    const fixed=fixedAxes(host);
    if(!fixed.width&&!fixed.height)return model;
    const rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
    return {
      ...model,
      width:fixed.width&&host.clientWidth?host.clientWidth/rem:model.width,
      height:fixed.height&&host.clientHeight?host.clientHeight/rem:model.height
    };
  };
  const artworkCache=new WeakMap();
  const setArtwork=(image,artwork)=>{
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artwork);
    image.style.visibility='';
  };
  const fitAssembly=(bounds,needed,manualWidth=0)=>{
    if(needed<=manualWidth||needed<=bounds.width)return bounds;
    const width=Math.min(1,needed);
    return {...bounds,x:Math.min(bounds.x,1-width),width};
  };
  const selectAssembly=(panel,host)=>{
    selectedAssembly=panel;
    host?.querySelectorAll('.diagrammaticSubpanel').forEach(frame=>{
      frame.classList.toggle('diagrammaticAssemblySelected',frame.diagrammaticAssembly===panel);
    });
    engine?.syncAssembly(panel);
  };
  const edges=[['nw','top-left',0,0],['n','top',.5,0],['ne','top-right',1,0],['e','right',1,.5],
    ['se','bottom-right',1,1],['s','bottom',.5,1],['sw','bottom-left',0,1],['w','left',0,.5]];
  const addHandle=(box,edge,label,x,y)=>{
    const handle=document.createElement('button');
    handle.type='button';handle.className='diagrammaticSubpanelHandle';handle.dataset.edge=edge;
    handle.setAttribute('aria-label',label);handle.title=label;
    Object.assign(handle.style,{left:x*100+'%',top:y*100+'%',cursor:edge==='move'?'move':edge+'-resize'});
    box.append(handle);
    return handle;
  };
  const bindBoxDrag=(node,{getDrag,update,finish,restore,fromBody=false})=>{
    let drag=null,suppressClick=false;
    const clear=()=>{
      const prev=drag;drag=null;activeBoxDrag=null;
      if(node.hasPointerCapture(prev.pointerId))node.releasePointerCapture(prev.pointerId);
      return prev;
    };
    const cancel=()=>{
      if(!drag)return;
      const prev=clear();
      if(prev.moved)restore(prev);
    };
    node.addEventListener('click',event=>{
      if(fromBody&&!suppressClick)return;
      suppressClick=false;event.preventDefault();event.stopImmediatePropagation();
    },true);
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.isPrimary===false||(fromBody&&event.target.closest('.diagrammaticSubpanelHandle')))return;
      suppressClick=false;
      const initial=getDrag();if(!initial)return;
      event.stopPropagation();activeBoxDrag?.cancel();
      drag={...initial,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
      activeBoxDrag={cancel};
      if(!fromBody){event.preventDefault();node.focus({preventScroll:true});node.setPointerCapture(event.pointerId);}
    });
    node.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)<(fromBody?4:1))return;
      event.preventDefault();event.stopPropagation();
      if(!drag.moved){drag.moved=true;if(fromBody){suppressClick=true;node.setPointerCapture(event.pointerId);}}
      update(drag,dx,dy,event);
    });
    node.addEventListener('pointerup',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      const prev=clear();
      if(!prev.moved)return;
      event.preventDefault();event.stopPropagation();
      update(prev,event.clientX-prev.x,event.clientY-prev.y,event);
      finish(prev);
    });
    node.addEventListener('pointercancel',cancel);
    node.addEventListener('lostpointercapture',event=>{if(event.target===node)cancel();});
  };
  const applyBounds=(frame,b)=>Object.assign(frame.style,{left:b.x*100+'%',top:b.y*100+'%',width:b.width*100+'%',height:b.height*100+'%'});
  const assemblyBounds=(sign,index)=>{
    const bounds=sign.subPanels[index].diagrammaticBounds;
    if(bounds&&['x','y','width','height'].every(key=>Number.isFinite(bounds[key]))&&bounds.width>0&&bounds.height>0)return bounds;
    const count=sign.subPanels.length,columns=Math.min(count,3),rows=Math.ceil(count/columns);
    const width=Math.min(.36,.89/columns),height=Math.min(.23,.55/rows);
    return {x:(index%columns+.5)/columns-width/2,y:.05+Math.floor(index/columns)*.6/rows,width,height};
  };
  const SNAP_DISTANCE=9;
  const nearestOffset=(anchors,targets,limit,min=-Infinity,max=Infinity)=>{
    let best=null;
    for(const anchor of anchors)for(const target of targets){
      const offset=target-anchor;
      if(offset>=min&&offset<=max&&Math.abs(offset)<=limit&&(!best||Math.abs(offset)<Math.abs(best.offset)))best={offset,target};
    }
    return best;
  };
  const snapBox=(bounds,peers,scale)=>{
    const x=box=>[box.x,box.x+box.width/2,box.x+box.width];
    const y=box=>[box.y,box.y+box.height/2,box.y+box.height];
    const panel={x:0,y:0,width:1,height:1},targets=[panel,...peers];
    const sx=nearestOffset(x(bounds),targets.flatMap(x),SNAP_DISTANCE/scale.width,-bounds.x,1-bounds.width-bounds.x);
    const sy=nearestOffset(y(bounds),targets.flatMap(y),SNAP_DISTANCE/scale.height,-bounds.y,1-bounds.height-bounds.y);
    return {bounds:{...bounds,x:bounds.x+(sx?.offset??0),y:bounds.y+(sy?.offset??0)},guides:{x:sx?.target,y:sy?.target}};
  };
  const frameBounds=frame=>Object.fromEntries([['x','left'],['y','top'],['width','width'],['height','height']].map(([key,property])=>[key,parseFloat(frame.style[property])/100]));
  const attachSubpanel=(frame,sign,index,contents)=>{
    const panel=sign.subPanels[index],initialBounds=assemblyBounds(sign,index);
    frame.diagrammaticAssembly=panel;
    frame.classList.toggle('diagrammaticAssemblySelected',selectedAssembly===panel);
    applyBounds(frame,initialBounds);
    let intrinsicWidth=0,bounds=initialBounds;
    const fit=()=>{
      if(!frame.isConnected||!frame.parentElement.clientWidth||activeBoxDrag)return;
      const parent=frame.parentElement;
      const scale=parent.getBoundingClientRect().width/parent.offsetWidth;
      if(!scale)return;
      contents.classList.add('diagrammaticMeasuring');
      intrinsicWidth=Math.ceil(contents.getBoundingClientRect().width/scale+frame.offsetWidth-frame.clientWidth)/parent.clientWidth;
      contents.classList.remove('diagrammaticMeasuring');
      bounds=fitAssembly(initialBounds,intrinsicWidth,panel.diagrammaticManualWidth);
      applyBounds(frame,bounds);
    };
    fit();
    if(document.fonts?.status==='loading')document.fonts.ready.then(fit);
    const bind=(node,edge,fromBody=false)=>bindBoxDrag(node,{
      fromBody,
      getDrag(){
        const parent=frame.parentElement;
        if(!parent?.classList.contains('diagrammaticEditing')||(!fromBody&&selectedAssembly!==panel))return null;
        const rect=parent.getBoundingClientRect();
        return {original:bounds,next:bounds,width:rect.width*parent.clientWidth/parent.offsetWidth,
          height:rect.height*parent.clientHeight/parent.offsetHeight,
          peers:[...parent.querySelectorAll('.diagrammaticSubpanel')].filter(other=>other!==frame).map(frameBounds)};
      },
      update(drag,dx,dy,event){
        const b=drag.original;
        dx/=drag.width;dy/=drag.height;
        let left=b.x,top=b.y,right=b.x+b.width,bottom=b.y+b.height;
        if(edge==='move'){
          drag.next={...b,x:clamp(b.x+dx,0,1-b.width),y:clamp(b.y+dy,0,1-b.height)};
          if(engine.snapping&&!event.altKey){
            const snapped=snapBox(drag.next,drag.peers,drag);
            drag.next=snapped.bounds;engine.showGuides(snapped.guides);
          }else engine.showGuides();
        }else{
          if(edge.includes('w'))left=clamp(left+dx,0,right-.01);
          if(edge.includes('e'))right=clamp(right+dx,left+.01,1);
          if(edge.includes('n'))top=clamp(top+dy,0,bottom-.01);
          if(edge.includes('s'))bottom=clamp(bottom+dy,top+.01,1);
          drag.next={x:left,y:top,width:right-left,height:bottom-top};
        }
        applyBounds(frame,drag.next);
      },
      restore(drag){engine.showGuides();applyBounds(frame,drag.original);},
      finish({next,original}){
        engine.showGuides();
        if(JSON.stringify(next)===JSON.stringify(original)||api()?.getCurrentPanel()?.sign!==sign)return;
        api().editDiagrammatic((model,current)=>{
          const subpanel=current.subPanels[index];
          subpanel.diagrammaticBounds=next;
          if(next.width!==original.width)subpanel.diagrammaticManualWidth=next.width<intrinsicWidth?intrinsicWidth:0;
        });
      }
    });
    bind(frame,'move',true);
    for(const [edge,label,x,y]of edges)bind(addHandle(frame,edge,`Resize ${label} Subpanel ${index+1}`,x,y),edge);
    const move=addHandle(frame,'move',`Move Subpanel ${index+1}`,.5,0);
    move.textContent='✥';move.classList.add('diagrammaticSubpanelMove');bind(move,'move');
  };
  const translateGraph=(graph,dx,dy,jointIds=null,roadIds=null)=>{
    for(const joint of graph?.joints||[])if(!jointIds||jointIds.has(joint.id)){joint.x+=dx;joint.y+=dy;}
    for(const road of graph?.roads||[])if(!roadIds||roadIds.has(road.id))for(const end of road.ends){
      const link=end.curveLink;
      if(link?.mode==='mirror')link.axis=link.axis.map(p=>({x:p.x+dx,y:p.y+dy}));
    }
  };
  const resizeAssembly=(b,original,next)=>{
    const width=Math.min(1,b.width*original.width/next.width),height=Math.min(1,b.height*original.height/next.height);
    return {width,height,x:clamp((b.x*original.width+next.dx)/next.width,0,1-width),
      y:clamp((b.y*original.height+next.dy)/next.height,0,1-height)};
  };
  const resizePanel=(model,sign,next)=>{
    const original={width:model.width,height:model.height};
    translateGraph(model.roadGraph,next.dx*model.unitsPerRem,next.dy*model.unitsPerRem);
    for(const [index,panel] of sign.subPanels.entries()){
      panel.diagrammaticBounds=resizeAssembly(assemblyBounds(sign,index),original,next);
      if(panel.diagrammaticManualWidth)panel.diagrammaticManualWidth*=original.width/next.width;
    }
    model.width=next.width;model.height=next.height;
  };
  const attachPanelHandles=(host,sign)=>{
    const fixed=fixedAxes(host);
    for(const [edge,label,x,y]of edges){
      if((x!==.5&&fixed.width)||(y!==.5&&fixed.height))continue;
      const handle=addHandle(host,edge,`Resize panel ${label}`,x,y);handle.classList.add('diagrammaticPanelHandle');
      const restore=drag=>{
        const {original,live,frames}=drag;
        Object.assign(host.style,{width:original.width+'rem',height:original.height+'rem'});
        Object.assign(live.style,{width:'',height:'',left:'',top:''});
        for(const [frame,bounds] of frames)Object.assign(frame.style,bounds);
      };
      bindBoxDrag(handle,{
        getDrag(){
          if(!host.classList.contains('diagrammaticEditing')||api()?.getCurrentPanel()?.sign!==sign)return null;
          const original={width:parseFloat(host.style.width),height:parseFloat(host.style.height)},rect=host.getBoundingClientRect();
          const frames=[...host.querySelectorAll('.diagrammaticSubpanel')].map(frame=>[frame,
            Object.fromEntries(['left','top','width','height'].map(key=>[key,frame.style[key]]))]);
          const rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
          return {original,next:original,scale:rect.width/host.offsetWidth*rem,live:engine.live,frames};
        },
        update(drag,dx,dy){
          const original=drag.original,west=edge.includes('w'),north=edge.includes('n');
          const size=(start,delta)=>clamp(Math.round((start+delta/drag.scale)*4)/4,1,80);
          const width=edge.includes('e')||west?size(original.width,west?-dx:dx):original.width;
          const height=edge.includes('s')||north?size(original.height,north?-dy:dy):original.height;
          const next=drag.next={width,height,dx:west?width-original.width:0,dy:north?height-original.height:0};
          Object.assign(host.style,{width:width+'rem',height:height+'rem'});
          Object.assign(drag.live.style,{width:fixed.width?'':original.width+'rem',height:fixed.height?'':original.height+'rem',left:next.dx+'rem',top:next.dy+'rem'});
          for(const [frame,props] of drag.frames){
            const bounds=frameBounds({style:props});
            applyBounds(frame,resizeAssembly(bounds,original,next));
          }
        },
        restore,
        finish(drag){
          restore(drag);
          if(drag.next.width===drag.original.width&&drag.next.height===drag.original.height)return;
          engine.editSettings((model,current)=>resizePanel(model,current,drag.next),{resize:true});
        }
      });
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
      #roadArrowHeadSize { flex:1; }
      #roadArrowHeadSizeValue { min-width:3.25em; text-align:right; }
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
      .roadMarkings > .diagrammaticLaneLines:not(.preview),.roadMarkings > .diagrammaticJointLines { display:none !important; } .roadLayer { width:100%;height:100%; }
    `;
    const workspace=document.createElement('div');workspace.id='workspace';const stage=document.createElement('div');stage.id='previewStage';
    const content=document.createElement('div');content.className='diagrammaticSheet';stage.append(content);workspace.append(stage);canvas.append(style,workspace);
    const guides=['x','y'].map(axis=>{
      const guide=document.createElement('div');guide.className='diagrammaticGuide '+axis;guide.hidden=true;stage.append(guide);
      return [axis,guide];
    });
    const showGuides=(points={})=>{
      for(const [axis,guide] of guides){
        const value=points[axis];guide.hidden=!Number.isFinite(value);
        if(!guide.hidden)guide.style[axis==='x'?'left':'top']=value*100+'%';
      }
    };
    style.textContent+=`
      .diagrammaticGuide { position:absolute; pointer-events:none; background:#66dcff; z-index:24; }
      .diagrammaticGuide.x { inset-block:0; width:calc(1px * var(--guide-scale,1)); }
      .diagrammaticGuide.y { inset-inline:0; height:calc(1px * var(--guide-scale,1)); }
      .diagrammaticGuide[hidden], :host(.editingInactive) .diagrammaticGuide { display:none; }
    `;
    const popupHost=document.createElement('div');popupHost.className='diagrammaticMenus';
    const popup=popupHost.attachShadow({mode:'open'}),popupStyle=document.createElement('style');
    popupStyle.textContent=window.SignMakerRoadEngineSources.css+' :host{position:fixed;inset:0;pointer-events:none;z-index:999999;} .nodeMenu{pointer-events:auto;} [hidden]{display:none!important;}';
    const nodeMenu=document.createElement('menu');nodeMenu.id='nodeMenu';nodeMenu.className='nodeMenu';nodeMenu.setAttribute('role','menu');nodeMenu.hidden=true;
    popup.append(popupStyle,nodeMenu);document.body.append(popupHost);
    const events=new EventTarget(),ready=[],editKeyHandlers=[];
    const snap=document.createElement('input');snap.type='checkbox';snap.checked=true;
    snap.addEventListener('change',()=>showGuides());
    let ownsKeyboard=false,placingSubpanel=false,placementStart=null,editingActive=false,movingAssemblies=false,moveDrag=null,suppressAssemblyClick=false;
    const inEditor=e=>e.composedPath().some(n=>n===live||n===controlsHost||n===popupHost);
    const wrapEvent=event=>new Proxy(event,{get(e,k){if(k==='target')return e.composedPath()[0];const v=e[k];return typeof v==='function'?v.bind(e):v;}});
    window.addEventListener('pointerdown',e=>{ownsKeyboard=editingActive&&live.isConnected&&inEditor(e);},true);
    window.addEventListener('focusin',e=>{ownsKeyboard=editingActive&&live.isConnected&&inEditor(e);},true);
    window.addEventListener('keydown',e=>{
      if(activeBoxDrag&&e.key==='Escape'){activeBoxDrag.cancel();e.preventDefault();e.stopImmediatePropagation();return;}
      if(!editingActive||!live.isConnected||(!ownsKeyboard&&!inEditor(e))||!['Escape','Delete','Backspace'].includes(e.key)||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]'))return;
      const target=e.composedPath()[0];
      if(e.key!=='Escape'&&target?.closest?.('input,textarea,select,[contenteditable]')){e.stopImmediatePropagation();return;}
      if(movingAssemblies||moveDrag){if(e.key==='Escape')cancelMove();}
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
    const appState={diagrammatic:true,diagrammaticRender:layerStems,
      get diagrammaticSnapping(){return snap.checked;},
      alignmentGuides:(point={})=>showGuides({x:point.x/sheet.width,y:point.y/sheet.height}),
      traffic:{reversed:false,sign:1,incoming:e=>e,path:p=>p,angle:a=>a},settings:{get:()=>false}};
    const scopedWindow=new Proxy(window,{get(target,key){
      if(key==='StripeMaker')return appState;if(key==='DiagrammaticRoadRenderer')return renderer;
      if(key==='addEventListener')return(type,fn,options)=>{
        if(type==='resize'||type==='blur')window.addEventListener(type,()=>{if(live.isConnected)fn();},options);
        else scopedDocument.addEventListener(type,fn,options);
      };
      const value=target[key];return typeof value==='function'?value.bind(target):value;
    }});
    const assemblyLabel=body.querySelector('#selectedDiagrammaticAssembly');
    const syncAssembly=panel=>{
      const index=sign?.subPanels?.indexOf(panel)??-1;
      assemblyLabel.hidden=index<0;
      if(index>=0)assemblyLabel.textContent=`Subpanel ${index+1} assembly selected. Click it again to edit its contents.`;
    };
    let sign=null,sheet=null,committing=false,modelKey='',graphKey='',panelIndex=null;
    const snapshot=()=>Object.fromEntries(['width','height','inchesPerPixel','roads','joints','autoTapers','overlapOrder','stemDefaults','independentCurves'].map(k=>[k,structuredClone(sheet[k])]));
    const drawArtwork=model=>serializeArtwork(sheet.roadLayer,model);
    const modelSignature=model=>{
      const viewport=viewportModel(model,live.parentElement);
      return JSON.stringify([model.width,model.height,viewport.width,viewport.height,model.unitsPerRem,model.consistentGapsOnTurns,model.arrowHeadSize,model.straightenOnShiftClick,model.roadGraph]);
    };
    const updateArtwork=model=>{
      const image=live.parentElement?.querySelector('.diagrammaticDrawing');
      if(image)setArtwork(image,model.artwork);
    };
    const saveDrawing=model=>{
      const graph=snapshot();
      graphKey=JSON.stringify(graph);
      // The override changes the viewport, so keep portable drawings at their
      // own dimensions when the panel is resized or the override is cleared.
      model.roadGraph={...graph,width:model.width*model.unitsPerRem,height:model.height*model.unitsPerRem};
      const resized=graph.width!==model.roadGraph.width||graph.height!==model.roadGraph.height;
      const artwork=drawArtwork();
      model.artwork=resized?drawArtwork(model):artwork;
      modelKey=modelSignature(model);
      updateArtwork({artwork});
      syncTemplates(sign,model);
    };
    const commit=()=>{
      if(!sheet||!sign||committing||api()?.getCurrentPanel()?.sign!==sign)return;
      if(JSON.stringify(snapshot())===graphKey)return;
      committing=true;
      try { api().editDiagrammatic(model=>{delete model.template;saveDrawing(model);},{redraw:false}); }
      finally {committing=false;}
    };
    const loadDrawing=(model,event)=>{
      sheet=makeSheet(viewportModel(model,live.parentElement),content,stage.getBoundingClientRect().width);
      content.replaceChildren();
      events.dispatchEvent(new Event(event));
      modelKey=modelSignature(model);
      graphKey=JSON.stringify(snapshot());
    };
    const editSettings=(update,{resize=false}={})=>{
      if(!sheet||!sign||api()?.getCurrentPanel()?.sign!==sign)return;
      api()?.editDiagrammatic((model,current)=>{
        update(model,current);
        if(resize)loadDrawing(model,'sheethistory');
        else{
          Object.assign(sheet,{arrowHeadSize:model.arrowHeadSize,consistentGapsOnTurns:model.consistentGapsOnTurns,straightenOnShiftClick:model.straightenOnShiftClick});
          appState.roadEditor.render();
        }
        saveDrawing(model);
      },{redraw:resize});
    };
    appState.sheets={get selected(){return sheet;},get all(){return sheet?[sheet]:[];},addOverlay:el=>stage.append(el),
      toImage(x,y){const r=stage.getBoundingClientRect();return{x:(x-r.left)*sheet.width/r.width,y:(y-r.top)*sheet.height/r.height};},
      toScreen(p){return{x:p.x*stage.clientWidth/sheet.width,y:p.y*stage.clientHeight/sheet.height};}};
    appState.diagrammaticOrder=(id,front)=>{
      if(!sheet?.roads.some(r=>r.id===id))return;
      const ordered=[...sheet.roads].sort((a,b)=>(sheet.overlapOrder||[]).indexOf(a.id)-(sheet.overlapOrder||[]).indexOf(b.id)).map(r=>r.id).filter(n=>n!==id);
      sheet.overlapOrder=front?[...ordered,id]:[id,...ordered];
      appState.roadEditor.render();commit();
    };
    appState.history={record:commit};
    appState.onRoadSelection=(road,drawing)=>{
      if(selectedAssembly&&(road||drawing))selectAssembly(null,live.parentElement);
    };
    appState.showEditor=()=>{
      const tab=document.getElementById('sMDiagrammatics');
      if(!tab?.getClientRects().length){document.getElementById('guideArrowConfig')?.click();document.querySelector('[data-tab="sMDiagrammatics"]')?.click();}
    };
    const addMenu=body.querySelector('#elementToAdd'),placeOption=document.createElement('option');
    placeOption.value='subpanel';placeOption.textContent='Place subpanel';addMenu.append(placeOption);
    const placeButton=document.createElement('button');placeButton.id='placeDiagrammaticSubpanel';placeButton.type='button';placeButton.hidden=true;body.append(placeButton);
    const box=document.createElement('div');box.className='diagrammaticPlacement';box.hidden=true;workspace.append(box);
    const moveButton=document.createElement('button');moveButton.type='button';moveButton.textContent='Move assemblies';moveButton.setAttribute('aria-pressed','false');
    const endMove=()=>{
      const drag=moveDrag;
      moveDrag=null;
      workspace.classList.remove('draggingAssembly');
      showGuides();
      if(drag&&workspace.hasPointerCapture(drag.pointerId))workspace.releasePointerCapture(drag.pointerId);
      return drag;
    };
    const cancelMove=()=>{
      const drag=endMove();
      movingAssemblies=false;workspace.classList.remove('movingAssemblies');moveButton.setAttribute('aria-pressed','false');
      if(drag?.moved&&drag.sheet===sheet){sheet.joints=drag.joints;sheet.roads=drag.roads;appState.roadEditor.renderAfterTranslation();}
    };
    moveButton.addEventListener('click',()=>{
      if(movingAssemblies){cancelMove();return;}
      cancelPlacement();
      if(body.querySelector('#addRoad').getAttribute('aria-pressed')==='true')body.querySelector('#addRoad').click();
      appState.roadEditor.focusRoad(null);movingAssemblies=true;ownsKeyboard=true;
      workspace.classList.add('movingAssemblies');moveButton.setAttribute('aria-pressed','true');
      body.querySelector('#elementsHint').textContent='Drag anywhere on the sign to move all arrow assemblies. Escape cancels.';
    });
    const assemblyMembers=(road,roads)=>{
      const members=new Set([road.id]),joints=new Set(),mirrors=new Set();
      for(let grew=true;grew;){
        const count=members.size;
        for(const item of roads)if(members.has(item.id))for(const end of item.ends){
          joints.add(end.joint);if(end.curveLink?.mode==='mirror')mirrors.add(end.curveLink.id);
        }
        for(const item of roads)if(item.ends.some(end=>joints.has(end.joint)||mirrors.has(end.curveLink?.id)))members.add(item.id);
        grew=members.size!==count;
      }
      return members;
    };
    workspace.addEventListener('pointerdown',event=>{
      if(!editingActive||event.button!==0||event.isPrimary===false||placingSubpanel||!sheet.roads.length)return;
      suppressAssemblyClick=false;
      const origin=appState.sheets.toImage(event.clientX,event.clientY);
      const road=!movingAssemblies&&appState.roadEditor.draggableRoadAt(origin,event.target);
      if(!movingAssemblies&&!road)return;
      const members=road?assemblyMembers(road,sheet.roads):new Set(sheet.roads.map(item=>item.id));
      const jointIds=new Set(sheet.roads.filter(item=>members.has(item.id)).flatMap(item=>item.ends.map(end=>end.joint)));
      const joints=structuredClone(sheet.joints),points=joints.filter(joint=>jointIds.has(joint.id));
      const min=axis=>Math.min(...points.map(p=>p[axis])),max=axis=>Math.max(...points.map(p=>p[axis]));
      const x=min('x'),y=min('y'),width=max('x')-x,height=max('y')-y;
      moveDrag={sheet,pointerId:event.pointerId,origin,x:event.clientX,y:event.clientY,joints,roads:structuredClone(sheet.roads),
        members,jointIds,center:{x:x+width/2,y:y+height/2},moved:false};
      if(movingAssemblies){event.preventDefault();event.stopImmediatePropagation();workspace.setPointerCapture(event.pointerId);}
    },true);
    workspace.addEventListener('pointermove',event=>{
      if(!editingActive||moveDrag?.pointerId!==event.pointerId)return;
      if(!moveDrag.moved&&Math.hypot(event.clientX-moveDrag.x,event.clientY-moveDrag.y)<4)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!moveDrag.moved){
        moveDrag.moved=true;ownsKeyboard=true;suppressAssemblyClick=true;
        workspace.setPointerCapture(event.pointerId);workspace.classList.add('draggingAssembly');
      }
      const point=appState.sheets.toImage(event.clientX,event.clientY);
      let dx=point.x-moveDrag.origin.x,dy=point.y-moveDrag.origin.y;
      if(snap.checked&&!event.altKey){
        const limit=SNAP_DISTANCE/sheet.view.scale,center=moveDrag.center;
        const sx=nearestOffset([center.x+dx],[sheet.width/2],limit),sy=nearestOffset([center.y+dy],[sheet.height/2],limit);
        dx+=sx?.offset??0;dy+=sy?.offset??0;
        appState.alignmentGuides({x:sx?.target,y:sy?.target});
      }else showGuides();
      sheet.joints=structuredClone(moveDrag.joints);sheet.roads=structuredClone(moveDrag.roads);
      translateGraph(sheet,dx,dy,moveDrag.jointIds,moveDrag.members);
      appState.roadEditor.renderAfterTranslation();
    },true);
    workspace.addEventListener('pointerup',event=>{
      if(moveDrag?.pointerId!==event.pointerId)return;
      const finished=endMove();
      if(!finished.moved)return;
      event.preventDefault();event.stopImmediatePropagation();commit();
    },true);
    workspace.addEventListener('click',event=>{
      // A drag's synthetic click has no placement or selection action.
      if(!suppressAssemblyClick)return;
      suppressAssemblyClick=false;event.preventDefault();event.stopImmediatePropagation();
    },true);
    for(const type of ['pointercancel','lostpointercapture'])workspace.addEventListener(type,event=>{
      if(moveDrag?.pointerId===event.pointerId)cancelMove();
    },true);
    style.textContent+='#workspace.movingAssemblies,#workspace.draggingAssembly{cursor:move} #workspace.movingAssemblies .roadOverlay{visibility:hidden}';
    const cancelPlacement=()=>{placingSubpanel=false;placementStart=null;box.hidden=true;workspace.classList.remove('placingSubpanel');live.classList.remove('placingSubpanel');placeButton.setAttribute('aria-pressed','false');body.querySelector('#addElement').setAttribute('aria-pressed','false');};
    placeButton.addEventListener('click',()=>{
      cancelMove();
      if(placingSubpanel){cancelPlacement();return;}
      if(body.querySelector('#addRoad').getAttribute('aria-pressed')==='true')body.querySelector('#addRoad').click();
      appState.roadEditor.focusRoad(null);placingSubpanel=true;ownsKeyboard=true;workspace.classList.add('placingSubpanel');live.classList.add('placingSubpanel');placeButton.setAttribute('aria-pressed','true');
      body.querySelector('#elementsHint').textContent='Click to place a subpanel or drag to set its size. Escape cancels.';
    });
    body.querySelector('#addElement').addEventListener('click',cancelMove,true);
    addMenu.addEventListener('change',()=>{cancelMove();if(addMenu.value!=='subpanel')cancelPlacement();});
    const placementPoint=e=>{const p=appState.sheets.toImage(e.clientX,e.clientY);return{x:Math.max(0,Math.min(sheet.width,p.x)),y:Math.max(0,Math.min(sheet.height,p.y))};};
    workspace.addEventListener('pointerdown',e=>{
      if(!placingSubpanel||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();workspace.setPointerCapture(e.pointerId);placementStart={point:placementPoint(e),x:e.clientX,y:e.clientY};box.hidden=false;
      const p=appState.sheets.toScreen(placementStart.point);Object.assign(box.style,{left:p.x+'px',top:p.y+'px',width:'0',height:'0'});
    },true);
    workspace.addEventListener('pointermove',e=>{
      if(!placingSubpanel)return;e.stopImmediatePropagation();if(!placementStart)return;
      const a=appState.sheets.toScreen(placementStart.point),b=appState.sheets.toScreen(placementPoint(e));
      Object.assign(box.style,{left:Math.min(a.x,b.x)+'px',top:Math.min(a.y,b.y)+'px',width:Math.abs(a.x-b.x)+'px',height:Math.abs(a.y-b.y)+'px'});
    },true);
    workspace.addEventListener('pointerup',e=>{
      if(!placingSubpanel||!placementStart)return;e.preventDefault();e.stopImmediatePropagation();
      const a=placementStart.point,b=placementPoint(e);
      const isClick=Math.hypot(e.clientX-placementStart.x,e.clientY-placementStart.y)<4;
      let bounds={x:Math.min(a.x,b.x)/sheet.width,y:Math.min(a.y,b.y)/sheet.height,width:Math.abs(a.x-b.x)/sheet.width,height:Math.abs(a.y-b.y)/sheet.height};
      if(isClick||bounds.width<.01||bounds.height<.01){
        const model=normalize(sign.diagrammatic);
        const width=Math.min(1,6/model.width),height=Math.min(1,3/model.height);
        bounds={x:clamp(b.x/sheet.width-width/2,0,1-width),y:clamp(b.y/sheet.height-height/2,0,1-height),width,height};
      }
      cancelPlacement();if(workspace.hasPointerCapture(e.pointerId))workspace.releasePointerCapture(e.pointerId);
      ownsKeyboard=false;api().addDiagrammaticSubpanel(bounds);
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
      if(!sheet||!live.isConnected||!stage.clientWidth)return;
      const screenScale=stage.getBoundingClientRect().width/stage.clientWidth;
      const iconScale=Math.min(1,Math.pow(Math.max(1,zoom),-.35));
      live.style.setProperty('--handle-scale',iconScale/(screenScale||1));
      live.style.setProperty('--guide-scale',1/(screenScale||1));
      live.parentElement?.style.setProperty('--diagrammatic-handle-scale',1/(screenScale||1));
      sheet.view={x:0,y:0,scale:stage.getBoundingClientRect().width/sheet.width};
      events.dispatchEvent(new Event('sheetview'));
    };
    const applyView=()=>{
      world.style.transform=editingActive?`translate(${panX}px,${panY}px) scale(${zoom})`:'translate(0px,0px) scale(1)';
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
    const snapLabel=document.createElement('label');snapLabel.append(snap,document.createTextNode('Snap to align'));
    toolbar.append(snapLabel,moveButton);
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
        if(!editingActive||e.pointerType!=='touch'||e.button!==0||(surface===preview&&e.target!==preview&&e.target!==world))return;
        e.stopPropagation();surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}
      });
      surface.addEventListener('pointermove',e=>{
        const last=pointers.get(e.pointerId);if(!editingActive||!last)return;e.stopPropagation();
        const current={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,current);
        if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance)zoomAt(distance/pinchDistance,(a.x+b.x)/2,(a.y+b.y)/2);pinchDistance=distance;}
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,e=>{pointers.delete(e.pointerId);pinchDistance=0;});
    }
    const resize=()=>{if(live.isConnected)applyView();};
    new ResizeObserver(resize).observe(live);
    new MutationObserver(refreshHandles).observe(post,{attributes:true,attributeFilter:['style']});
    post.addEventListener('transitionend',refreshHandles);
    live.addEventListener('pointerdown',e=>e.stopPropagation());live.addEventListener('click',e=>e.stopPropagation());live.addEventListener('dblclick',e=>e.stopPropagation());
    const syncVisibility=()=>{
      const tab=document.getElementById('sMDiagrammatics');
      const active=live.isConnected&&sign?.arrowMode==='diagrammatic'&&api()?.getCurrentPanel()?.sign===sign&&!!tab?.getClientRects().length&&!tab.classList.contains('tabHidden');
      live.parentElement?.classList.toggle('diagrammaticEditing',active);
      if(active===editingActive&&body.querySelector('#elementsEditor').hidden===!active)return;
      editingActive=active;live.classList.toggle('editingInactive',!active);
      body.querySelector('#elementsEditor').hidden=!active;
      if(!active){
        activeBoxDrag?.cancel();cancelMove();cancelPlacement();showGuides();ownsKeyboard=false;nodeMenu.hidden=true;
        for(const id of pointers.keys())for(const surface of [workspace,preview])if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
        pointers.clear();pinchDistance=0;gestureScale=1;trackpadScrollUntil=0;
      }
      applyView();
    };
    const visibilityObserver=new MutationObserver(syncVisibility);
    const watched=new Set([document.getElementById('sMConfigBar'),document.getElementById('mobileEditor')]);
    for(let n=controlsHost.parentElement;n;n=n.parentElement)watched.add(n);
    for(const n of watched)if(n)visibilityObserver.observe(n,{attributes:true,attributeFilter:['style','class','hidden','data-current-menu','inert']});
    window.addEventListener('resize',syncVisibility);
    return {app:appState,live,controlsHost,commit,editSettings,syncAssembly,showGuides,get snapping(){return snap.checked;},
      previewHeadSize(value){if(sheet){sheet.arrowHeadSize=value;appState.roadEditor.render();}},
      mount(host,nextSign){
        if(live.parentElement!==host)activeBoxDrag?.cancel();
        host.append(live);
        const model=normalize(nextSign.diagrammatic);
        const nextPanelIndex=host.closest('.panel')?.dataset.panelIndex;
        if(sign!==nextSign||modelSignature(model)!==modelKey){
          cancelMove();cancelPlacement();
          if(sign!==nextSign&&!nextSign.subPanels.includes(selectedAssembly)){
            const assemblyIndex=sign?.subPanels.indexOf(selectedAssembly)??-1;
            selectAssembly(panelIndex===nextPanelIndex?nextSign.subPanels[assemblyIndex]??null:null,host);
          }
          sign=nextSign;
          loadDrawing(model,panelIndex===nextPanelIndex?'sheethistory':'sheetchange');
        }
        panelIndex=nextPanelIndex;
        syncVisibility();resize();syncAssembly(selectedAssembly);
        if(sheet?.roads.length)updateArtwork({artwork:drawArtwork()});
      },
      sync(){syncVisibility();},
      detach(){activeBoxDrag?.cancel();cancelMove();cancelPlacement();ownsKeyboard=false;live.parentElement?.classList.remove('diagrammaticEditing');live.remove();nodeMenu.hidden=true;syncVisibility();world.style.transform='translate(0px,0px) scale(1)';}
    };
  };
  const ensureEngine=()=>engine||(engine=createEngine());
  const openAssembly=({frame,sign,index,panelIndex,selectRenderedPanelArea})=>{
    const panel=sign.subPanels[index], current=api();
    const sameSign=current?.getCurrentPanel()?.sign===sign;
    const menu=document.getElementById('sMConfigBar')?.dataset.currentMenu;
    if(!sameSign&&menu!=='guideArrowConfig')return false;
    const subpanelEditorOpen=menu==='subPanelConfig'&&current?.getCurrentSubPanel()===panel;
    if(sameSign&&selectedAssembly===panel&&(frame.parentElement.classList.contains('diagrammaticEditing')||subpanelEditorOpen))return false;
    engine?.app.roadEditor.clearSelection();
    selectAssembly(panel,frame.parentElement);
    selectRenderedPanelArea({panelIndex,subPanelIndex:index,menu:'guideArrows',guideMode:'diagrammatic',suppressRedraw:sameSign});
    return true;
  };
  const render=(host,sign)=>{
    const model=normalize(sign.diagrammatic);host.style.width=model.width+'rem';host.style.height=model.height+'rem';
    const viewport=viewportModel(model,host);
    const sizeKey=`${viewport.width}:${viewport.height}`;
    const resized=viewport.width!==model.width||viewport.height!==model.height;
    const image=document.createElement('img');image.className='diagrammaticDrawing';image.alt='Diagrammatic guide arrows';
    if(model.artwork)setArtwork(image,model.artwork);else image.style.visibility='hidden';
    host.append(image);
    if(api()?.getCurrentPanel()?.sign===sign){ensureEngine().mount(host,sign);attachPanelHandles(host,sign);}
    else if(model.roadGraph?.roads?.length&&(resized||!model.artwork.includes('diagrammaticVisibleLaneLines'))){
      let cached=artworkCache.get(sign.diagrammatic);
      if(cached?.sizeKey!==sizeKey){
        const sheet=makeSheet(viewport,document.createElement('div'),viewport.width*model.unitsPerRem);
        ensureEngine().app.roadEditor.renderArtwork(sheet);
        cached={sizeKey,artwork:serializeArtwork(sheet.roadLayer)};
        artworkCache.set(sign.diagrammatic,cached);
      }
      setArtwork(image,cached.artwork);
    }
  };
  const applyTemplate=name=>{
    const sign=api()?.getCurrentPanel()?.sign;
    if(sign?.arrowMode!=='diagrammatic'||!templateNames.has(name)||!canUseTemplates(sign.diagrammatic)||sign.diagrammatic?.template===name)return;
    engine?.editSettings(model=>useTemplate(model,name),{resize:true});
  };
  const syncEditor=sign=>{
    if(!document.getElementById('sMDiagrammatics'))return;
    if(!installed){installed=true;
      document.getElementById('diagrammaticTemplates')?.addEventListener('click',event=>{
        const button=event.target.closest('[data-diagrammatic-template]');
        if(button)applyTemplate(button.dataset.diagrammaticTemplate);
      });
      document.getElementById('diagrammaticWidth').addEventListener('change',e=>{if(!e.target.disabled)engine?.editSettings((m,current)=>resizePanel(m,current,{width:normalize({width:e.target.value}).width,height:m.height,dx:0,dy:0}),{resize:true});});
      document.getElementById('diagrammaticHeight').addEventListener('change',e=>{if(!e.target.disabled)engine?.editSettings((m,current)=>resizePanel(m,current,{width:m.width,height:clamp(Number(e.target.value)||15,1,80),dx:0,dy:0}),{resize:true});});
      document.getElementById('diagrammaticConsistentGaps').addEventListener('change',e=>engine?.editSettings(m=>{m.consistentGapsOnTurns=e.target.checked;}));
      document.getElementById('diagrammaticStraightenOnShiftClick').addEventListener('change',e=>engine?.editSettings(m=>{m.straightenOnShiftClick=e.target.checked;}));
      const size=document.getElementById('diagrammaticHeadSize'),label=document.getElementById('diagrammaticHeadSizeValue');
      size.addEventListener('input',e=>{e.stopPropagation();label.textContent=size.value+'%';engine?.previewHeadSize(headSize(size.value));});
      size.addEventListener('change',e=>{e.stopPropagation();engine?.editSettings(m=>{m.arrowHeadSize=headSize(size.value);});});
      document.getElementById('diagrammaticExportJSON').addEventListener('click',()=>{
        const sign=api()?.getCurrentPanel()?.sign;if(!sign)return;
        engine?.commit();
        const url=URL.createObjectURL(new Blob([toJSON(sign.diagrammatic)],{type:'application/json'})),link=document.createElement('a');
        link.href=url;link.download='diagrammatic.json';document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      });
      const importInput=document.getElementById('diagrammaticImportFile');
      document.getElementById('diagrammaticImportJSON').addEventListener('click',()=>importInput.click());
      importInput.addEventListener('change',async()=>{
        const file=importInput.files?.[0];if(!file)return;
        // Draw the artwork inside the same edit so one undo removes the import.
        const sign=api()?.getCurrentPanel()?.sign;
        try{
          const imported=fromJSON(await file.text());
          if(api()?.getCurrentPanel()?.sign===sign&&sign?.arrowMode==='diagrammatic')engine?.editSettings(m=>{
            delete m.template;
            Object.assign(m,imported);
          },{resize:true});
        }
        catch(error){window.alert('Unable to import diagrammatic: '+error.message);}
        finally{importInput.value='';}
      });}
    const model=normalize(sign?.diagrammatic);
    const panel=api()?.getCurrentPanel();
    const width=Panel.fixedDimension(panel?.fixedWidthRem),height=Panel.fixedDimension(panel?.fixedHeightRem);
    const widthInput=document.getElementById('diagrammaticWidth'),heightInput=document.getElementById('diagrammaticHeight');
    widthInput.disabled=width!==null;
    heightInput.disabled=height!==null;
    widthInput.value=width??model.width;
    heightInput.value=height??model.height;
    document.getElementById('diagrammaticFixedSizeNote').hidden=width===null&&height===null;
    syncTemplates(sign,model);
    document.getElementById('diagrammaticConsistentGaps').checked=model.consistentGapsOnTurns;
    document.getElementById('diagrammaticStraightenOnShiftClick').checked=model.straightenOnShiftClick;
    document.getElementById('diagrammaticHeadSize').value=model.arrowHeadSize;
    document.getElementById('diagrammaticHeadSizeValue').textContent=model.arrowHeadSize+'%';
    document.getElementById('diagrammaticRoadControls').hidden=sign?.arrowMode!=='diagrammatic';
    if(sign?.arrowMode==='diagrammatic')engine?.sync(sign);else engine?.detach();
  };
  return {normalize,ensureStarter,toJSON,fromJSON,alignedDashes,snapBox,arrowHeadPath,fitAssembly,assemblyBounds,attachSubpanel,openAssembly,selectAssembly,render,syncEditor,get engine(){return engine;}};
})();
