(() => {
  // Roads are one-way groups of parallel lanes, stored in sheet image pixels. Every
  // lane has its own line with a node at each end, and a road's lanes move together.
  // Roads connect lane to lane: one lane's end node joins another lane's start node.
  //
  // Each road end sits on a joint: a point and a direction of travel shared by every
  // road end connected there. Lane-to-lane links fix each road's sideways position
  // on the joint, so joined ends line up and move together. A road joined in the
  // opposite direction sits beside the other road, left edge to left edge, making
  // a two-way road with a double yellow centerline (or a median between them). A
  // two-way road's joints sit on its centerline, so lane changes grow outward.
  //
  // Right-clicking a lane node opens a small popover of actions for that road end
  // (curve, straighten, taper, detach, delete), pointing at the node.
  //
  // Trimmed for SignMaker's diagrammatic arrows: SignMaker draws the roads
  // (DiagrammaticRoadRenderer), so StripeMaker's markings, bike lanes, medians,
  // gores, intersections, and levels are not included. Dimensions follow FDOT
  // Standard Plans Index 711-001 (FY 2025-26).
  const LINE_INCHES = 6;              // edge lines, lane lines, and centerlines
  const DOUBLE_GAP_INCHES = 4;        // gap between double solid lines
  const PAVEMENT_MARGIN_INCHES = 8;   // edge of traveled way to edge of pavement
  const MAX_LANES = 999;
  const MIN_LANE_WIDTH = 8;
  // Editable geometry limit, independent of standard lane-width defaults.
  const MAX_LANE_WIDTH = 50;
  const CURVE_SEGMENTS = 96;
  const SNAP_PIXELS = 14;
  const NODE_INSET_PIXELS = 13;       // nodes sit just inside their road's end
  const NODE_STACK_PIXELS = 40;       // and step this much farther in where another road's nodes are
  const TAPER_BADGE_PIXELS = 22;      // taper badges sit just past their node
  const AIM_FEET = 120;               // a node's arrow aims this far along its lane (at most a third of it)
  const DEFAULT_TAPER_FEET = 300;
  const MIN_TAPER_FEET = 10;
  const MAX_TAPER_FEET = 2000;
  const LEFT_EDGE = -0.5;             // lane "index" of a road's left edge
  const SVG = "http://www.w3.org/2000/svg";

  document.addEventListener("DOMContentLoaded", () => {
    const sheets = window.StripeMaker.sheets;
    const workspace = document.getElementById("workspace");
    const editor = document.getElementById("elementsEditor");
    const addButton = document.getElementById("addRoad");
    const elementToAdd=document.getElementById('elementToAdd'),addElement=document.getElementById('addElement');
    const elementCommands={subpanel:'placeDiagrammaticSubpanel',road:'addRoad'};
    function updateAddElement(){
      for(const option of elementToAdd.options)option.disabled=Boolean(document.getElementById(elementCommands[option.value]).disabled);
      const command=document.getElementById(elementCommands[elementToAdd.value]);
      addElement.disabled=command.disabled;
      addElement.setAttribute('aria-pressed',command.getAttribute('aria-pressed')??'false');
    }
    const deleteButton = document.getElementById("deleteRoad");
    const hint = document.getElementById("elementsHint");
    const lanesInput = document.getElementById("roadLanes");
    const widthInput = document.getElementById("roadLaneWidth");
    const laneFields = document.getElementById("laneFields");
    const laneTitle = document.getElementById("laneTitle");
    const taperSelect = document.getElementById("laneTaper");
    const taperLength = document.getElementById("laneTaperLength");
    const taperState = document.getElementById("laneTaperState");
    const autoTapersInput = document.getElementById("autoTapers");
    const independentInput = document.getElementById("independentCurves");
    const defaults = { lanes: 1, laneWidth: 12 };
    const openCurves = new Set();
    const nodeButtons = new Map();
    let selectedRoad = null;
    let selectedLane = null;
    let drawing = null;
    let drag = null;
    let snapTarget = null;
    let menuNode = null;
    const curveLinks = window.StripeMaker.curveLinks;
    let curvePick = null;
    const curveFields = document.getElementById("curveLinkFields");
    const curveStatus = document.getElementById("curveLinkStatus");
    const keepSymmetric = document.getElementById("keepSymmetric");
    const curveRotation = document.getElementById("curveRotation");
    const applyMirrorButton = document.getElementById("applyCurveMirror");
    const editAxisButton = document.getElementById("editCurveAxis");
    const unlinkCurveButton = document.getElementById("unlinkCurve");
    const cancelCurveButton = document.getElementById("cancelCurveLink");

    const overlay = document.createElement("div");
    overlay.className = "roadOverlay";
    overlay.hidden = true;
    overlay.innerHTML = `<svg aria-hidden="true"><line class="roadControlLine"/><line class="roadControlLine"/>
      <circle class="roadSnap" r="15"/></svg>
      <span class="roadNode preview" aria-hidden="true"></span>
      <button type="button" class="roadControl" title="Drag to curve. Hold Shift to change length along the original direction." aria-label="Start curve handle" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"></button>
      <button type="button" class="roadControl" title="Drag to curve. Hold Shift to change length along the original direction." aria-label="End curve handle" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"></button>`;
    const controlLines = [...overlay.querySelectorAll("line")];
    const snapRing = overlay.querySelector(".roadSnap");
    const startMarker = overlay.querySelector(".roadNode.preview");
    const controlButtons = [...overlay.querySelectorAll(".roadControl")];
    const arcHandles=['angle','radius'].map(kind=>{
      const button=document.createElement('button');button.type='button';button.className=`roadControl arc${kind==='angle'?'Angle':'Radius'}Handle`;button.hidden=true;
      button.setAttribute('aria-label',kind==='angle'?'Curve angle handle':'Arc radius handle');
      button.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown');
      button.title=kind==='angle'?'Drag to change the curve angle':'Drag the circle center to change the radius';
      const line=document.createElementNS(SVG,'line');line.setAttribute('class','roadControlLine');line.setAttribute('stroke-dasharray','4 4');line.setAttribute('visibility','hidden');
      overlay.querySelector('svg').append(line);overlay.append(button);return {button,line,kind};
    });
    const curveGuide = document.createElementNS(SVG, "g");
    curveGuide.setAttribute("class", "curveGuide");
    overlay.querySelector("svg").append(curveGuide);
    sheets.addOverlay(overlay);
    const nodeMenu = document.getElementById("nodeMenu");

    const active = () => !editor.hidden;
    const inchesToPixels = (sheet, inches) => inches / sheet.inchesPerPixel;
    const feetToPixels = (sheet, feet) => inchesToPixels(sheet, feet * 12);
    const nextId = items => items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const unit = v => {
      const length = Math.hypot(v.x, v.y) || 1;
      return { x: v.x / length, y: v.y / length };
    };
    const rightOf = v => ({ x: -v.y, y: v.x });
    const dot = (a, b) => a.x * b.x + a.y * b.y;
    const jointOf = (sheet, id) => sheet.joints.find(joint => joint.id === id);
    const roadOf = (sheet, id) => sheet.roads.find(road => road.id === id);
    const attachments = (sheet, joint, solved) => solved?.byJoint ? (solved.byJoint.get(joint.id)??[]) : sheet.roads.flatMap(road => road.ends
      .map((end, e) => ({ road, e, end }))).filter(({ end }) => end.joint === joint.id);
    // Sideways position of a lane's center (or the left edge), right of travel.
    const endWidth = (sheet, road, e) => e == null ? road.laneWidth : window.StripeMaker.roadWidths.endWidth(sheet, road, e);
    const lateralSection = (sheet, road, e) => {
      const widths = Array.from({ length: road.lanes }, (_, i) => e == null
        ? window.StripeMaker.roadWidths.laneWidth(road, i) : window.StripeMaker.roadWidths.endWidth(sheet, road, e, i));
      const gaps=e==null?widths.map(()=>0):window.StripeMaker.roadWidths.endGaps(sheet,road,e).map(g=>g.width);
      return { widths, gaps };
    };
    const laneLateral = (sheet, road, lane, e, section = lateralSection(sheet, road, e)) => {
      const { widths, gaps } = section;
      const index = Math.min(lane, road.lanes - 1);
      const before = widths.slice(0, Math.max(0, Math.ceil(index))).reduce((a, b) => a + b, 0)+gaps.slice(0,Math.max(0,index+1)).reduce((a,b)=>a+b,0);
      return feetToPixels(sheet, before + (index < 0 ? 0 : widths[index] / 2) - (widths.reduce((a,b) => a+b, 0)+gaps.reduce((a,b)=>a+b,0)) / 2);
    };
    // A link names a lane by index, or a road's left ("L") or right ("R") edge line,
    // so roads can be joined edge to edge as well as lane to lane.
    const linkLateral = (sheet, road, index, e) => (index === "L" || index === "R"
      ? (index === "R" ? 1 : -1) * feetToPixels(sheet,road.lanes*endWidth(sheet,road,e)+window.StripeMaker.roadWidths.endGaps(sheet,road,e).reduce((sum,g)=>sum+g.width,0))/2
      : laneLateral(sheet, road, index, e));
    const pairOf = (sheet, road) => road && sheet.roads.find(other => other !== road
      && other.ends[0].joint === road.ends[1].joint && other.ends[1].joint === road.ends[0].joint);
    const pairLinks = (sheet, road, pair) => road.ends.flatMap(end => jointOf(sheet, end.joint).links)
      .filter(link => link.pair && [link.a, link.b].includes(road.id) && [link.a, link.b].includes(pair.id));

    function save() {
      if (sheets.selected) sheets.save(sheets.selected);
    }
    function layerFor(sheet) {
      if (!sheet.roadLayer) {
        sheet.roads = (sheet.roads ?? []).filter(road => road.ends);
        sheet.joints ??= [];
        delete sheet.connectors;
        sheet.roadLayer = document.createElementNS(SVG, "svg");
        sheet.roadLayer.classList.add("roadLayer");
        sheet.roadLayer.setAttribute("viewBox", `0 0 ${sheet.width} ${sheet.height}`);
        sheet.roadLayer.setAttribute("aria-hidden", "true");
        sheet.content.append(sheet.roadLayer);
      }
      return sheet.roadLayer;
    }

    // Road centers at each end. The joint's root road is centered on the joint;
    // links place the rest sideways so their linked lanes coincide.
    function solve(sheet) {
      layerFor(sheet);
      const key=solveKey(sheet),cached=solveCache.get(sheet);
      if(cached?.key===key && cached.roads===sheet.roads && cached.joints===sheet.joints &&
        cached.roadRefs.every((entry,i)=>entry.road===sheet.roads[i]&&entry.ends.every((end,e)=>end===sheet.roads[i].ends[e])) &&
        cached.jointRefs.every((joint,i)=>joint===sheet.joints[i]))return copySolved(cached.solved);
      const read=window.StripeMaker.roadWidths.withSnapshot??((_sheet,fn)=>fn());
      const solved=read(sheet,()=>computeSolved(sheet));
      // Attachment lists and shape maps retain object identities. Equal JSON
      // after undo/import is insufficient when roads or ends were replaced.
      solveCache.set(sheet,{key,solved,roads:sheet.roads,joints:sheet.joints,
        roadRefs:sheet.roads.map(road=>({road,ends:[...road.ends]})),jointRefs:[...sheet.joints]});
      return copySolved(solved);
    }
    const solveCache=new WeakMap();
    const solveKey=sheet=>JSON.stringify([sheet.inchesPerPixel,sheet.autoTapers,sheet.roads,sheet.joints]);
    // Only road geometry is shared. Render-local state gets fresh ownership
    // on every query.
    const copySolved=base=>Object.assign(new Map(base),{auto:base.auto,shapes:base.shapes,byJoint:base.byJoint,stacks:base.stacks??=new Map(),
      arcFits:base.arcFits,arcLaneMouths:base.arcLaneMouths,arcLaneExtensions:base.arcLaneExtensions,arcPavementMouths:base.arcPavementMouths});
    function arcJoinGroup(sheet, road) {
      if(!sheet||road?.arcAngle==null||road.arcLoop||pairOf(sheet,road))return [];
      return sheet.roads.filter(other=>other.arcAngle!=null&&!other.arcLoop&&!pairOf(sheet,other)&&
        other.ends.every((end,e)=>end.joint===road.ends[e].joint&&end.sign===road.ends[e].sign));
    }
    function setArcJoinFit(road, enabled) {
      const group=arcJoinGroup(sheets.selected,road);
      if(group.length<2)return;
      for(const member of group)member.arcJoinFit=enabled;
      changed();
    }
    function computeSolved(sheet) {
      // End widths/gaps are constant during a solve. Keep the original lateral
      // arithmetic, but evaluate each road/lane/end once instead of inside
      // every lane-continuation comparison. Never retain this across edits.
      const laterals = new Map(), sections = new Map();
      const solvedLateral = (sheet, road, lane, e) => {
        const endKey = `${road.id}:${e}`, key = `${endKey}:${lane}`;
        if (!laterals.has(key)) {
          if (!sections.has(endKey)) sections.set(endKey, lateralSection(sheet, road, e));
          laterals.set(key, laneLateral(sheet, road, lane, e, sections.get(endKey)));
        }
        return laterals.get(key);
      };
      const solvedLinkLateral = (sheet, road, lane, e) => lane === "L" || lane === "R"
        ? linkLateral(sheet, road, lane, e) : solvedLateral(sheet, road, lane, e);
      const byJoint = new Map();
      for (const road of sheet.roads) road.ends.forEach((end, e) => {
        if (!byJoint.has(end.joint)) byJoint.set(end.joint, []);
        byJoint.get(end.joint).push({ road, e, end });
      });
      const solved = Object.assign(new Map(), { byJoint, auto: new Set(), shapes: new Map() });
      const separation = inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES);
      for (const joint of sheet.joints) {
        const here = byJoint.get(joint.id) ?? [];
        if (!here.length) continue;
        const byRoad = new Map(here.map(item => [item.road.id, item]));
        const root = byRoad.has(joint.root) ? joint.root : here[0].road.id;
        const offsets = new Map([[root, 0]]);
        for (let grew = true; grew;) {
          grew = false;
          for (const link of joint.links) {
            for (const [from, fromLane, to, toLane] of [[link.a, link.ai, link.b, link.bi], [link.b, link.bi, link.a, link.ai]]) {
              const a = byRoad.get(from);
              const b = byRoad.get(to);
              if (!a || !b || !offsets.has(from) || offsets.has(to)) continue;
              const reference = link.pair
                ? offsets.get(from) + a.end.sign * (solvedLateral(sheet, a.road, LEFT_EDGE, a.e) - separation - feetToPixels(sheet, link.median ?? 0))
                : offsets.get(from) + a.end.sign * solvedLinkLateral(sheet, a.road, fromLane, a.e);
              offsets.set(to, reference - b.end.sign * (link.pair ? solvedLateral(sheet, b.road, LEFT_EDGE, b.e) : solvedLinkLateral(sheet, b.road, toLane, b.e)));
              grew = true;
            }
          }
        }
        // A two-way road's joint sits on its centerline: midway between the two
        // yellow lines (across the median, if any).
        const pairLink = joint.links.find(link => link.pair && offsets.has(link.a) && offsets.has(link.b));
        if (pairLink) {
          const half = byRoad.get(pairLink.a);
          const gap = separation + feetToPixels(sheet, pairLink.median ?? 0);
          const center = offsets.get(pairLink.a) + half.end.sign * (solvedLateral(sheet, half.road, LEFT_EDGE, half.e) - gap / 2);
          for (const [id, value] of offsets) offsets.set(id, value - center);
        }
        // Lanes that don't continue across a joint taper automatically: ending
        // lanes drop, starting lanes are added.
        const lateral = (item, lane) => (offsets.get(item.road.id) ?? 0) + item.end.sign * (solvedLateral(sheet, item.road, lane, item.e));
        for (const item of here) {
          const across = here.filter(other => other.e !== item.e && other.end.sign === item.end.sign);
          if (!across.length) continue;
          for (let lane = 0; lane < item.road.lanes; lane++) {
            const at = lateral(item, lane);
            const continues = across.some(other => Array.from({ length: other.road.lanes }, (_, j) => j).some(j =>
              Math.abs(lateral(other, j) - at) < feetToPixels(sheet, Math.min(item.road.laneWidth, other.road.laneWidth)) / 2));
            if (!continues) solved.auto.add(`${item.road.id}:${item.e}:${lane}`);
          }
        }
        const normal = joint.dir ? rightOf(joint.dir) : { x: 0, y: 0 };
        for (const { road, e, end } of here) {
          const offset = offsets.get(road.id) ?? 0;
          solved.set(`${road.id}:${e}`, {
            x: joint.x + normal.x * offset, y: joint.y + normal.y * offset,
            // An end curved on its own keeps its own direction (end.dir, along
            // its road's travel); otherwise it leaves along the joint's.
            travel: end.dir ?? (joint.dir && { x: joint.dir.x * end.sign, y: joint.dir.y * end.sign }),
            jointTravel: joint.dir && { x: joint.dir.x * end.sign, y: joint.dir.y * end.sign },
          });
        }
      }
      // Lane-split circles are tangent to the approaching/departing lanes,
      // not forced onto one common transverse cut. Keep the hosts untouched.
      solved.arcFits = new Map();
      for(const road of sheet.roads) {
        if(road.arcAngle==null||road.arcLoop||road.arcJoinFit===false||pairOf(sheet,road))continue;
        if(arcJoinGroup(sheet,road).length<2)continue;
        const hosts=road.ends.map((end,e)=>{
          const joint=jointOf(sheet,end.joint);
          return (byJoint.get(end.joint)??[]).find(item=>item.e!==e&&item.end.sign===end.sign&&curveAngle(item.road)==null&&
            joint.links.some(l=>!l.pair&&!l.beside&&Number.isInteger(l.ai)&&Number.isInteger(l.bi)&&
              ((l.a===road.id&&l.b===item.road.id)||(l.b===road.id&&l.a===item.road.id))));
        });
        if(hosts.some(host=>!host))continue;
        const a=solved.get(`${road.id}:0`),b=solved.get(`${road.id}:1`);
        const directions=hosts.map(host=>solved.get(`${host.road.id}:${host.e}`).travel);
        if(directions.some(d=>!d))continue;
        const radius=road.arcJoinRadius!=null?feetToPixels(sheet,road.arcJoinRadius):window.StripeMaker.circularArc.geometry(a,b,road.arcAngle).radius;
        const G=window.StripeMaker.circularArc;
        const hostCurves=hosts.map((host,e)=>{
          const c=curveOf(sheet,host.road,solved),at=solved.get(`${host.road.id}:${host.e}`),anchor=e?b:a,n=rightOf(directions[e]);
          return {...c,lateral:(anchor.x-at.x)*n.x+(anchor.y-at.y)*n.y};
        });
        const fit=G.fitCurves(...hostCurves.map(G.laneCurve),radius,road.arcAngle);
        if(!fit)continue;
        solved.arcFits.set(road.id,{...fit,hostCurves,anchors:[{...a},{...b}],hosts:hosts.map(h=>({road:h.road.id,e:h.e}))});
        for(const e of [0,1])solved.set(`${road.id}:${e}`,{...(e?b:a),...(e?fit.end:fit.start),travel:(e?fit.end:fit.start).tangent,fittedAngle:fit.degrees});
      }
      // Each group starts at its earliest tangent and ends at its latest.
      // Lead-ins follow the unchanged host lane, so a large setback cannot
      // leave a gap between a tangent extension and a curved receiving road.
      const fittedGroups=new Map();
      for(const [id,fit] of solved.arcFits){
        const road=roadOf(sheet,id),key=road.ends.map(e=>`${e.joint}:${e.sign}`).join('|');
        if(!fittedGroups.has(key))fittedGroups.set(key,[]);
        fittedGroups.get(key).push([id,fit]);
      }
      for(const group of fittedGroups.values()){
        const start=Math.min(1,...group.map(([,f])=>f.parameters[0])),end=Math.max(0,...group.map(([,f])=>f.parameters[1]));
        for(const [,fit] of group){
          const G=window.StripeMaker.circularArc,curves=fit.hostCurves.map(G.laneCurve);
          fit.mouthParameters=[start,end];
          fit.mouths=[curves[0](start),curves[1](end)];
          fit.leads=[G.sampleCurve(curves[0],start,fit.parameters[0]),G.sampleCurve(curves[1],fit.parameters[1],end)];
        }
      }
      solved.arcLaneMouths=new Map();
      const hostLeads=new Map();
      for(const [id,fit] of solved.arcFits){
        const road=roadOf(sheet,id);
        for(const e of [0,1]){
          const host=roadOf(sheet,fit.hosts[e].road),joint=jointOf(sheet,road.ends[e].joint);
          const link=laneLinks(sheet,joint).find(l=>e?l.from===road&&l.to===host:l.to===road&&l.from===host);
          if(!link)continue;
          const shift=e?link.toLane-link.fromLane:link.fromLane-link.toLane,n=rightOf(fit.mouths[e].tangent);
          for(let lane=0;lane<road.lanes;lane++)if(lane+shift>=0&&lane+shift<host.lanes){
            const offset=solvedLateral(sheet,road,lane,e),p=fit.mouths[e],key=`${host.id}:${1-e}:${lane+shift}`;
            solved.arcLaneMouths.set(key,{x:p.x+n.x*offset,y:p.y+n.y*offset,tangent:p.tangent});
            const G=window.StripeMaker.circularArc,c=fit.hostCurves[e];
            hostLeads.set(key,G.sampleCurve(G.laneCurve({...c,lateral:c.lateral+offset}),e?0:fit.mouthParameters[e],e?fit.mouthParameters[e]:1));
          }
        }
      }
      // A through road can share the receiving lanes with the ramps. Keep its
      // pavement intact; only exclusive approach/departure tails are replaced
      // by the fitted arcs and their lead-ins.
      solved.arcPavementMouths=new Map();
      solved.arcLaneExtensions=new Map();
      for(const [key,mouth] of [...solved.arcLaneMouths]){
        const [id,e,lane]=key.split(':').map(Number),host=roadOf(sheet,id),joint=jointOf(sheet,host.ends[e].joint);
        let through=false;
        for(const link of laneLinks(sheet,joint)){
          const other=e?link.to:link.from,own=e?link.from:link.to;
          const otherLane=lane+(e?link.toLane-link.fromLane:link.fromLane-link.toLane);
          if(own!==host||solved.arcFits.has(other.id)||otherLane<0||otherLane>=other.lanes)continue;
          through=true;
          // A through lane shares the shifted merge/split point. Extend its
          // simulator path along the existing host lane, without reshaping
          // either Bézier or moving their saved joint/control points.
          const otherKey=`${other.id}:${1-e}:${otherLane}`;
          solved.arcLaneMouths.set(otherKey,mouth);
          solved.arcLaneExtensions.set(otherKey,hostLeads.get(key));
        }
        if(!through)solved.arcPavementMouths.set(key,mouth);
      }
      return solved;
    }


    // A cubic Bézier between the road's end centers, leaving each end along its
    // joint's direction; a free end with no direction pulls straight.
    function centerline(road, solved) {
      const { a, c0, c1, b } = controls(solved.get(`${road.id}:0`), solved.get(`${road.id}:1`), road.ends.map(end => end.length));
      const points=sampleRoadCurve(road,a,c0,c1,b),fit=solved.arcFits?.get(road.id);
      if(fit){
        if(Math.hypot(points[0].x-fit.mouths[0].x,points[0].y-fit.mouths[0].y)>1e-7)points.unshift(...fit.leads[0].slice(0,-1));
        if(Math.hypot(points.at(-1).x-fit.mouths[1].x,points.at(-1).y-fit.mouths[1].y)>1e-7)points.push(...fit.leads[1].slice(1));
      }
      return points;
    }
    const curveAngle = road => road.arcAngle ?? (road.clothoid ? (road.clothoid.start+road.clothoid.end)/2 : null);
    function sampleRoadCurve(road,a,c0,c1,b) {
      if(road.clothoid)return window.StripeMaker.clothoid.sample(a,b,road.clothoid);
      return road.arcAngle != null ? window.StripeMaker.circularArc.sample(a,b,a.fittedAngle??road.arcAngle,road.arcLoop) : bezier(a,c0,c1,b);
    }
    function curveGeometry(road,a,b) {
      return road.clothoid?window.StripeMaker.clothoid.geometry(a,b,road.clothoid):window.StripeMaker.circularArc.geometry(a,b,a.fittedAngle??road.arcAngle,road.arcLoop);
    }
    function fitCurve(road,mode) {
      const {a,c0,c1,b}=curveOf(sheets.selected,road,solve(sheets.selected));
      return window.StripeMaker.circularArc.fit(sampleRoadCurve(road,a,c0,c1,b),mode==='clothoid'?(a,b,angle)=>window.StripeMaker.clothoid.geometry(a,b,{start:0,end:2*angle}):null);
    }
    // BEGIN SIGNMAKER ATTACHED ARC CONSTRAINTS
    function diagrammaticArcAnchor(sheet,road,solved=null) {
      if(!window.StripeMaker.diagrammatic||road.arcAngle==null||road.arcLoop||pairOf(sheet,road))return null;
      solved ||= solve(sheet);
      const neighbors=road.ends.map(end=>attachments(sheet,jointOf(sheet,end.joint),solved).filter(item=>item.road!==road));
      const e=neighbors[0].length&&!neighbors[1].length?0:neighbors[1].length&&!neighbors[0].length?1:null;
      if(e==null)return null;
      const host=neighbors[e].find(item=>item.e!==e&&item.end.sign===road.ends[e].sign);
      if(!host)return null;
      const at=solved.get(`${road.id}:${e}`),free=solved.get(`${road.id}:${1-e}`);
      let direction=solved.get(`${host.road.id}:${host.e}`).travel;
      if(curveAngle(host.road)!=null){const c=curveOf(sheet,host.road,solved);direction=curveGeometry(host.road,c.a,c.b).point(host.e).tangent;}
      if(!direction||Math.hypot(direction.x,direction.y)<1e-9)return null;
      return {e,at,free,direction:unit(direction)};
    }
    function diagrammaticSetArc(sheet,road,angle,radius,anchor=diagrammaticArcAnchor(sheet,road)) {
      if(!anchor||!Number.isFinite(angle)||Math.abs(angle)>=359.9)return false;
      const chord=Math.hypot(anchor.free.x-anchor.at.x,anchor.free.y-anchor.at.y);
      if(!Number.isFinite(radius))radius=chord/2;
      const min=feetToPixels(sheet,road.lanes*road.laneWidth/2+1/12);
      radius=Math.max(min,radius);
      const {e,at,direction:t}=anchor,n=rightOf(t),radians=angle*Math.PI/180;
      const along=angle?radius*Math.sin(Math.abs(radians)):chord,across=radius*(1-Math.cos(radians))*Math.sign(angle);
      const target={x:at.x+(e?-1:1)*t.x*along+n.x*across,y:at.y+(e?-1:1)*t.y*along+n.y*across};
      const joint=jointOf(sheet,road.ends[1-e].joint);
      // The solved center can be offset from its joint for a lane-to-lane join.
      const current=solve(sheet).get(`${road.id}:${1-e}`);
      joint.x+=target.x-current.x;joint.y+=target.y-current.y;road.arcAngle=angle;
      return true;
    }
    function diagrammaticSyncArcJoins(sheet) {
      if(!window.StripeMaker.diagrammatic)return;
      for(const road of sheet.roads){
        const anchor=diagrammaticArcAnchor(sheet,road);if(!anchor)continue;
        const {e,at,free,direction:t}=anchor,v=e?{x:at.x-free.x,y:at.y-free.y}:{x:free.x-at.x,y:free.y-at.y};
        if(Math.hypot(v.x,v.y)<1e-6)continue;
        // A circle through the endpoints has a unique sweep for this tangent.
        // Recompute it after a free endpoint is dragged instead of opening a seam.
        road.arcAngle=2*Math.atan2((e?-1:1)*(t.x*v.y-t.y*v.x),dot(t,v))*180/Math.PI;
      }
    }
    // END SIGNMAKER ATTACHED ARC CONSTRAINTS
    function syncRoadCurves(sheet) {
      if (!sheet?.roads?.some(r=>curveAngle(r)!=null)) return;
      // Full loops keep their two logical ends at the same physical point.
      for(const road of sheet.roads)if(road.arcLoop && (!pairOf(sheet,road)||road.id<pairOf(sheet,road).id)) {
        const a=jointOf(sheet,road.ends[0].joint),b=jointOf(sheet,road.ends[1].joint);b.x=a.x;b.y=a.y;
      }
      /* SIGNMAKER */ diagrammaticSyncArcJoins(sheet);
      const solved=solve(sheet);
      for (const road of sheet.roads) {
        const partner=pairOf(sheet,road);
        if(curveAngle(road)==null || partner && partner.id<road.id)continue;
        const {a,b}=curveOf(sheet,road,solved),arc=curveGeometry(road,a,b);
        const pull=road.clothoid||road.arcLoop?arc.length/3:Number.isFinite(arc.radius)?4/3*arc.radius*Math.tan(Math.abs(arc.angle)/4):Math.hypot(b.x-a.x,b.y-a.y)/3;
        road.ends.forEach((end,e)=>{
          const tangent=arc.point(e).tangent,joint=jointOf(sheet,end.joint);
          const hasFreeformNeighbor=attachments(sheet,joint,solved).some(item=>item.road!==road&&item.road!==partner&&curveAngle(item.road)==null);
          // Fitting an exact curve must not rewrite a neighboring Bézier's
          // shared heading or sideways placement. Only the exact curve bends.
          if(hasFreeformNeighbor){
            end.dir={...tangent};
            if(partner)partner.ends[1-e].dir={x:-tangent.x,y:-tangent.y};
          }else{
            joint.dir={x:tangent.x*end.sign,y:tangent.y*end.sign};
            delete end.dir;if(partner)delete partner.ends[1-e].dir;
          }
          end.length=pull;
          if(partner)partner.ends[1-e].length=pull;
        });
        if(partner){
          if(road.arcAngle!=null)partner.arcAngle=-road.arcAngle;
          if(road.clothoid)partner.clothoid={start:-road.clothoid.end,end:-road.clothoid.start};
          if(road.arcLoop)partner.arcLoop={radius:road.arcLoop.radius,heading:{x:-road.arcLoop.heading.x,y:-road.arcLoop.heading.y}};
        }
      }
    }
    function setRoadCurve(road,angle,record=true,mode='arc') {
      if(!road)return;
      const sheet=sheets.selected,partner=pairOf(sheet,road),solved=solve(sheet),{a,b}=curveOf(sheet,road,solved);
      /* SIGNMAKER */ if(mode==='arc'&&road.arcAngle!=null&&angle!=null)diagrammaticSetArc(sheet,road,angle,curveGeometry(road,a,b).radius);
      const spiral=road.clothoid&&curveAngle(road)?{start:road.clothoid.start*angle/curveAngle(road),end:road.clothoid.end*angle/curveAngle(road)}:{start:0,end:2*angle};
      // A closed loop needs two cubics when returning to freeform; a single
      // cubic with matching endpoints and tangents would collapse to a line.
      if(road.arcLoop&&(angle==null||mode==='clothoid')){const split=cutRoad(sheet,road,.5);syncRoadCurves(sheet);setRoadCurve(road,angle==null?null:fitCurve(road,mode),false,mode);setRoadCurve(split.after,angle==null?null:fitCurve(split.after,mode),false,mode);if(record)changed();return;}
      if(road.arcLoop && (mode!=='arc'||Math.abs(angle)!==360)) {
        const loop=window.StripeMaker.circularArc.geometry(a,b,Math.sign(angle||road.arcAngle)*360,road.arcLoop),end=loop.point(Math.min(359.9,Math.abs(angle??180))/360),joint=jointOf(sheet,road.ends[1].joint);
        joint.x+=end.x-b.x;joint.y+=end.y-b.y;
      }
      let loop=null;
      if(mode==='arc'&&Math.abs(angle)===360){
        const old=curveAngle(road)!=null?curveGeometry(road,a,b):null;
        loop=road.arcLoop??{radius:old&&Number.isFinite(old.radius)?old.radius:Math.max(Math.hypot(b.x-a.x,b.y-a.y)/2,feetToPixels(sheet,road.laneWidth*2)),heading:old?.point(0).tangent??a.travel??unit({x:b.x-a.x,y:b.y-a.y})};
        const start=jointOf(sheet,road.ends[0].joint),end=jointOf(sheet,road.ends[1].joint);end.x=start.x;end.y=start.y;
      }
      for(const r of [road,partner].filter(Boolean)) {
        delete r.arcAngle;delete r.clothoid;delete r.arcLoop;
        if(angle==null||mode!=='arc'){delete r.arcJoinFit;delete r.arcJoinRadius;}
        if(angle!=null && mode==='clothoid')r.clothoid=r===road?{...spiral}:{start:-spiral.end,end:-spiral.start};
        else if(angle!=null){r.arcAngle=r===road?angle:-angle;if(loop)r.arcLoop=r===road?structuredClone(loop):{radius:loop.radius,heading:{x:-loop.heading.x,y:-loop.heading.y}};}
        r.ends.forEach((end,e)=>{curveLinks.unlink(sheet,end.curveLink);openCurves.delete(`${r.id}:${e}`);});
      }
      selectedRoad=road;
      syncRoadCurves(sheet);
      if(record)changed();else render();
    }
    // A Bézier's control points from its end centers (with their travel) and pulls;
    // an end without a travel direction doesn't pull.
    function controls(a, b, lengths) {
      const chord = Math.hypot(b.x - a.x, b.y - a.y);
      const [l0, l1] = lengths.map((length, e) => ((e ? b : a).travel ? length ?? chord / 3 : 0));
      return {
        a, b,
        c0: { x: a.x + (a.travel?.x ?? 0) * l0, y: a.y + (a.travel?.y ?? 0) * l0 },
        c1: { x: b.x - (b.travel?.x ?? 0) * l1, y: b.y - (b.travel?.y ?? 0) * l1 },
      };
    }
    // Samples a cubic Bézier: enough for smooth curves and tapers (about one per 12 px).
    function bezier(a, c0, c1, b, fine = false) {
      const reach = Math.hypot(c0.x - a.x, c0.y - a.y) + Math.hypot(c1.x - c0.x, c1.y - c0.y) + Math.hypot(b.x - c1.x, b.y - c1.y);
      // Width changes need true curve samples. Subdividing the resulting
      // polyline leaves corners in its position while its normals keep turning.
      const segments = fine
        ? Math.min(2000, Math.max(128, Math.ceil(reach / 2)))
        : Math.min(400, Math.max(CURVE_SEGMENTS / 4, Math.ceil(reach / 12)));
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const u = 1 - t;
        const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        // The exact tangent, so joined curves meet square at their shared joint.
        const d = [3 * u * u, 6 * u * t, 3 * t * t];
        const tangent = {
          x: d[0] * (c0.x - a.x) + d[1] * (c1.x - c0.x) + d[2] * (b.x - c1.x),
          y: d[0] * (c0.y - a.y) + d[1] * (c1.y - c0.y) + d[2] * (b.y - c1.y),
        };
        points.push({
          x: w[0] * a.x + w[1] * c0.x + w[2] * c1.x + w[3] * b.x,
          y: w[0] * a.y + w[1] * c0.y + w[2] * c1.y + w[3] * b.y,
          tangent: Math.hypot(tangent.x, tangent.y) > 1e-6 ? unit(tangent) : null,
        });
      }
      return points;
    }
    // Positive distances offset to the right of travel (start → end).
    function offset(points, distance) {
      return points.map((point, i) => {
        const d = typeof distance === "function" ? distance(i) : distance;
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const normal = rightOf(point.tangent ?? unit({ x: next.x - prev.x, y: next.y - prev.y }));
        return { x: point.x + normal.x * d, y: point.y + normal.y * d };
      });
    }
    const endOf = (points, e) => points[e ? points.length - 1 : 0];
    function travelAt(road, e, solved) {
      const line = centerline(road, solved);
      const [a, b] = e ? line.slice(-2) : line.slice(0, 2);
      return unit({ x: b.x - a.x, y: b.y - a.y });
    }
    // Lane boundaries along the road. A tapering lane's width runs from zero at its
    // tapered end to full over the taper length; the first untapered lane holds its
    // place and the others pack against it.
    function buildShape(sheet, road, line, tapers, shift = 0, shiftByWidthOnly = false) {
      let along = [0];
      for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y));
      const total = along[along.length - 1];

      // Include the exact full-width station of every taper. Otherwise short
      // tapers on coarse-scale sheets finish at the next curve sample, beyond
      // the entered length (including when several lanes widen together).
      const stops = [...new Set([...tapers].map(([key, length]) => key.startsWith("0:")
        ? Math.min(length, total) : total - Math.min(length, total)))].filter(s => s > 0 && s < total).sort((a, b) => a - b);
      if (stops.length) {
        const points = [line[0]], stations = [0];
        let next = 0;
        for (let i = 1; i < line.length; i++) {
          while (next < stops.length && stops[next] < along[i] - 1e-7) {
            const s = stops[next++];
            if (s <= along[i - 1] + 1e-7) continue;
            const a = line[i - 1], b = line[i], f = (s - along[i - 1]) / (along[i] - along[i - 1]);
            const tangent = a.tangent && b.tangent
              ? unit({ x: a.tangent.x + (b.tangent.x - a.tangent.x) * f, y: a.tangent.y + (b.tangent.y - a.tangent.y) * f })
              : unit({ x: b.x - a.x, y: b.y - a.y });
            points.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tangent });
            stations.push(s);
          }
          points.push(line[i]);
          stations.push(along[i]);
        }
        line = points;
        along = stations;
      }

      const tapered = lane => tapers.has(`0:${lane}`) || tapers.has(`1:${lane}`);
      let anchor = 0;
      while (anchor < road.lanes - 1 && tapered(anchor)) anchor++;
      const roadWidths = window.StripeMaker.roadWidths;
      const ends = Array.from({ length: road.lanes }, (_, lane) => [0, 1].map(e => roadWidths.endWidth(sheet, road, e, lane)));
      const gapEnds=[0,1].map(e=>roadWidths.endGaps(sheet,road,e)),laneBounds=[];
      const taperEnds = Array.from({ length: road.lanes }, (_, lane) => [tapers.get(`0:${lane}`), tapers.get(`1:${lane}`)]);
      // With no tapers or width profiles, an unchanged cross section has the
      // same arithmetic result at every station. Copy it instead of sampling
      // every lane's smoothstep again along a long curve.
      const uniform = !road.centerlineTransition && !tapers.size && (typeof shift !== 'function' || shiftByWidthOnly) && !road.widthProfiles && !road.gapProfiles &&
        ends.every(([a,b],lane) => a === b && a === roadWidths.laneWidth(road,lane)) &&
        gapEnds[0].every((g,k) => g.width === gapEnds[1][k].width);
      let crossSection;
      const bounds = along.map(s => {
        if (uniform && crossSection) {
          laneBounds.push(crossSection.lanes.map(lane => lane.slice()));
          return crossSection.bounds.slice();
        }
        const full = Array.from({length: road.lanes}, (_, lane) => feetToPixels(sheet,
          roadWidths.laneAt(sheet, road, lane, total ? s / total : 0, ends[lane])));
        const gaps=gapEnds[0].map((g,k)=>feetToPixels(sheet,roadWidths.gapAt(road,k,total?s/total:0,g.width,gapEnds[1][k].width)));
        const totalWidth = full.reduce((a,b) => a+b, 0)+gaps.reduce((a,b)=>a+b,0);
        const anchorLeft = full.slice(0, anchor).reduce((a,b) => a+b, 0) - totalWidth / 2
          + (typeof shift === "function" ? shift(totalWidth / road.lanes, total ? s / total : 0) : shift);
        const widths = Array.from({ length: road.lanes }, (_, lane) => {
          const [start, end] = taperEnds[lane];
          let fraction = 1;
          if (start) fraction = Math.min(fraction, s / Math.min(start, total));
          if (end) fraction = Math.min(fraction, (total - s) / Math.min(end, total));
          return full[lane] * Math.max(0, Math.min(1, fraction || 0));
        });
        const lanes=Array.from({length:road.lanes},()=>[]);
        lanes[anchor][0]=anchorLeft+(full[anchor]-widths[anchor])/2;
        lanes[anchor][1]=lanes[anchor][0]+widths[anchor];
        for(let k=anchor+1;k<road.lanes;k++){lanes[k][0]=lanes[k-1][1]+gaps[k];lanes[k][1]=lanes[k][0]+widths[k];}
        for(let k=anchor-1;k>=0;k--){lanes[k][1]=lanes[k+1][0]-gaps[k+1];lanes[k][0]=lanes[k][1]-widths[k];}
        laneBounds.push(lanes);
        const bounds = [lanes[0][0],...lanes.slice(1).map((l,k)=>(lanes[k][1]+l[0])/2),lanes.at(-1)[1]];
        if (uniform) crossSection = { lanes, bounds };
        return bounds;
      });
      return { line, bounds, laneBounds, gapEnds, tapers };
    }
    // Taper settings per lane end: Auto (only where a lane doesn't continue across
    // a joint), Taper, or None.
    function tapersOf(sheet, road, solved) {
      const tapers = new Map();
      if (road.centerlineTransition) return tapers;
      for (const e of [0, 1]) {
        for (let lane = 0; lane < road.lanes; lane++) {
          const key = `${e}:${lane}`;
          const setting = road.tapers?.[key];
          const mode = setting?.mode ?? "auto";
          const id = `${road.id}:${key}`;
          // Auto tapers only when the sheet's Auto tapers setting is on (off by default).
          if (mode === "taper" || (mode === "auto" && sheet.autoTapers && solved.auto.has(id))) {
            tapers.set(key, feetToPixels(sheet, setting?.length ?? DEFAULT_TAPER_FEET));
          }
        }
      }
      return tapers;
    }
    // Both sides of a two-way road are offsets of one shared centerline curve, so
    // the double yellow (or median) stays parallel through curves. Lane bounds are
    // shifted right of that centerline by half the gap plus half this side's width.
    const roadShapeCache=new WeakMap();
    function shapeOf(sheet, road, solved) {
      if (solved.shapes.has(road)) return solved.shapes.get(road);
      const read=window.StripeMaker.roadWidths.withSnapshot??((_sheet,fn)=>fn());
      return read(sheet,()=>{
        // A road's sampled shape depends on its solved ends, cross sections,
        // taper decisions and paired curve. Unrelated edits need not resample
        // it.
        const widths=window.StripeMaker.roadWidths,partner=pairOf(sheet,road);
        const key=JSON.stringify([sheet.inchesPerPixel,road,partner,
          partner&&pairLinks(sheet,road,partner)[0]?.median,
          [0,1].map(e=>solved.get(`${road.id}:${e}`)),[...tapersOf(sheet,road,solved)],
          [0,1].map(e=>[Array.from({length:road.lanes},(_,lane)=>widths.endWidth(sheet,road,e,lane)),widths.endGaps(sheet,road,e)]),
          solved.arcFits?.get(road.id),road.arcAngle!=null&&sheet.roads.map(r=>[r.id,r.arcAngle,r.ends.map(e=>e.joint)])]);
        const cached=roadShapeCache.get(road);
        const shape=cached?.sheet===sheet&&cached.key===key?cached.shape:buildRoadShape(sheet,road,solved);
        solved.shapes.set(road,shape);roadShapeCache.set(road,{sheet,key,shape});return shape;
      });
    }
    function buildRoadShape(sheet, road, solved) {
      const partner = pairOf(sheet, road);
      const tapers = tapersOf(sheet, road, solved);
      let shape;
      if (partner) {
        const gap = inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES) + feetToPixels(sheet, pairLinks(sheet, road, partner)[0]?.median ?? 0);
        const transition = road.centerlineTransition && partner.centerlineTransition;
        const oppositeWidth = f => feetToPixels(sheet, Array.from({length: partner.lanes}, (_, lane) =>
          window.StripeMaker.roadWidths.laneAt(sheet, partner, lane, 1 - f)).reduce((a,b) => a+b, 0));
        // Transition sections follow the pavement axis; only the division of
        // that fixed-width pavement between directions changes along its length.
        const shift = [0, 1].map(e => transition ? gap / 2 + oppositeWidth(e) / 2 : gap / 2 - laneLateral(sheet, road, LEFT_EDGE, e));
        const { a, c0, c1, b } = sharedControls(road, partner, solved, shift);
        shape = buildShape(sheet, road, sampleRoadCurve(road,a,c0,c1,b), tapers,
          transition ? (_width, f) => gap / 2 + oppositeWidth(f) / 2 : width => gap / 2 + road.lanes * width / 2, !transition);
      } else {
        shape=buildShape(sheet,road,centerline(road,solved),tapers);
      }
      solved.shapes.set(road, shape);
      return shape;
    }
    // The two-way centerline, from this side's point of view: its end centers moved
    // left by `shift`, with the same Bézier pull both sides share.
    function sharedControls(road, partner, solved, shift) {
      const [a, b] = [0, 1].map(e => {
        const at = solved.get(`${road.id}:${e}`);
        const travel = at.travel ?? travelAt(road, e, solved);
        // Exact curves can turn independently while their anchor stays in the joint frame.
        const right = rightOf(curveAngle(road)!=null ? at.jointTravel ?? travel : travel);
        return { x: at.x - right.x * shift[e], y: at.y - right.y * shift[e], travel: at.travel };
      });
      // The lower-id side's pulls drive both sides, so they can't drift apart.
      return controls(a, b, road.id < partner.id ? road.ends.map(end => end.length) : [partner.ends[1].length, partner.ends[0].length]);
    }
    // The curve a road is drawn along: its own centerline, or a two-way road's
    // shared centerline.
    function curveOf(sheet, road, solved) {
      const partner = pairOf(sheet, road);
      if (!partner) return controls(solved.get(`${road.id}:0`), solved.get(`${road.id}:1`), road.ends.map(end => end.length));
      const gap = inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES) + feetToPixels(sheet, pairLinks(sheet, road, partner)[0]?.median ?? 0);
      return sharedControls(road, partner, solved, [0, 1].map(e => road.centerlineTransition && partner.centerlineTransition
        ? gap / 2 + feetToPixels(sheet, partner.lanes * endWidth(sheet, partner, 1-e)) / 2
        : gap / 2 - laneLateral(sheet, road, LEFT_EDGE, e)));
    }
    // Where a lane node is drawn: just inside the road, so the end nodes of one road
    // and the start nodes of the next don't cover each other at a joint.
    // The direction from a road's end into the road.
    const inwardAt = (line, e) => unit(e ? { x: line[line.length - 2].x - line[line.length - 1].x, y: line[line.length - 2].y - line[line.length - 1].y }
      : { x: line[1].x - line[0].x, y: line[1].y - line[0].y });
    // Roads leaving (or reaching) a joint in the same lanes, like a lane split,
    // would draw their nodes on top of each other: each later road's nodes step
    // farther into it.
    function nodeStack(sheet, road, e, lane, solved) {
      const key = `${road.id}:${e}:${lane}`;
      solved.stacks ??= new Map();
      if (!solved.stacks.has(key)) solved.stacks.set(key, countStack(sheet, road, e, lane, solved));
      return solved.stacks.get(key);
    }
    function countStack(sheet, road, e, lane, solved) {
      const end = road.ends[e], joint = jointOf(sheet, end.joint), here = lanePoint(sheet, road, e, lane, solved), close = feetToPixels(sheet, 1);
      // The road continuing straight through (lined up with the most lanes of
      // the roads across the joint) keeps its place; a road split off it steps aside.
      const here0 = attachments(sheet, joint, solved);
      const across = here0.filter(item => item.e !== e && item.end.sign === end.sign)
        .flatMap(item => Array.from({ length: item.road.lanes }, (_, j) => lanePoint(sheet, item.road, item.e, j, solved)));
      const shared = r => Array.from({ length: r.lanes }, (_, j) => lanePoint(sheet, r, e, j, solved))
        .filter(p => across.some(q => Math.hypot(p.x - q.x, p.y - q.y) < close)).length;
      const mine = shared(road);
      const before = item => shared(item.road) > mine || (shared(item.road) === mine && item.road.id < road.id);
      return here0.filter(item => item.e === e && item.road !== road && before(item)
        && item.end.sign === end.sign && Array.from({ length: item.road.lanes }, (_, j) => lanePoint(sheet, item.road, item.e, j, solved))
          .some(p => Math.hypot(p.x - here.x, p.y - here.y) < close)).length;
    }
    function nodePoint(sheet, road, e, lane, solved) {
      const { line } = shapeOf(sheet, road, solved);
      const at = lanePoint(sheet, road, e, lane, solved);
      const inward = inwardAt(line, e);
      const inset = (NODE_INSET_PIXELS + nodeStack(sheet, road, e, lane, solved) * NODE_STACK_PIXELS) / sheet.view.scale;
      return { x: at.x + inward.x * inset, y: at.y + inward.y * inset };
    }
    const shapeOffset=(shape,distance)=>shape.widthNormal
      ? shape.line.map((p,i)=>{const d=typeof distance==="function"?distance(i):distance;return {x:p.x+shape.widthNormal.x*d,y:p.y+shape.widthNormal.y*d,tangent:p.tangent};})
      : offset(shape.line,distance);
    const boundaryCache = new WeakMap();
    const boundary = (shape, k, extra = 0) => {
      const cached=shape.pavementEdges?.[k];
      // Polygon consumers reverse the returned edge to close an outline.
      // Always return a fresh array, just as shapeOffset does, so that cannot
      // corrupt cached white curves for subsequent draws.
      if (cached) return extra ? offset(cached,extra) : cached.slice();
      // A solved shape's samples stay fixed. Share offset calculations while
      // returning independent points/arrays for callers that reverse or edit.
      let memo = boundaryCache.get(shape);
      if (!memo || memo.line !== shape.line || memo.bounds !== shape.bounds || memo.normal !== shape.widthNormal) {
        memo = { line: shape.line, bounds: shape.bounds, normal: shape.widthNormal, edges: new Map() };
        boundaryCache.set(shape, memo);
      }
      let extras = memo.edges.get(k);
      if (!extras) memo.edges.set(k, extras = new Map());
      if (!extras.has(extra)) extras.set(extra, shapeOffset(shape, i => shape.bounds[i][k] + extra));
      return extras.get(extra).map(p => ({ ...p }));
    };
    function lanePoint(sheet, road, e, lane, solved) {
      const target=solved.arcLaneMouths?.get(`${road.id}:${e}:${lane}`);if(target)return target;
      const shape=shapeOf(sheet,road,solved);
      const { line, bounds, laneBounds } = shape;
      const i = e ? line.length - 1 : 0;
      if(shape.widthNormal)return shapeOffset(shape,k=>(laneBounds[k][lane][0]+laneBounds[k][lane][1])/2)[i];
      return offset([line[e ? i - 1 : 0], line[e ? i : 1]], (laneBounds[i][lane][0] + laneBounds[i][lane][1]) / 2)[e];
    }
    const pathData = points => `M${points.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("L")}`;

    const polylineLength = points => points.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0), 0);
    // One longitudinal clock for both edges, buffer and colored blocks. Using
    // centerline stations keeps transverse ends aligned even on curved lanes.
    function lanePhase(sheet, road, lane, solved, visiting = new Set()) {
      const key = `${road.id}:${lane}`;
      if (visiting.has(key)) return 0;
      visiting.add(key);
      const joint = jointOf(sheet, road.ends[0].joint);
      const before = joint && laneLinks(sheet, joint).filter(l => l.to === road && l.toLane === lane)
        .sort((a,b) => a.from.id - b.from.id)[0];
      return before ? lanePhase(sheet, before.from, before.fromLane, solved, visiting) + polylineLength(shapeOf(sheet, before.from, solved).line) : 0;
    }
    // Yellow left edge, white right edge, and white skip lines between lanes.
    // SignMaker's diagrammatic renderer draws every road.
    function drawRoad(sheet, road, shape, layers, className = "", solved = null) {
      const others = e => road.ends ? attachments(sheet, jointOf(sheet, road.ends[e].joint)).filter(item => item.road !== road) : [];
      return window.DiagrammaticRoadRenderer(sheet,road,shape,layers,className,
        k=>boundary(shape,k), !others(1).some(item=>item.e===0),
        { joined: [others(0).length > 0, others(1).length > 0], dashPhase: solved ? dashPhase(sheet, road, solved) : 0 });
    }
    // How far lane-line dashes have already run when this road starts: the
    // right-edge length of the roads feeding into it, so the dash pattern
    // carries on through joined nodes instead of restarting at each one.
    function dashPhase(sheet, road, solved, seen = new Set()) {
      if (!road.ends || seen.has(road.id)) return 0;
      seen.add(road.id);
      const joint = jointOf(sheet, road.ends[0].joint);
      const from = joint && laneLinks(sheet, joint).find(link => link.to === road)?.from;
      if (!from) return 0;
      return dashPhase(sheet, from, solved, seen) + polylineLength(boundary(shapeOf(sheet, from, solved), from.lanes));
    }


    function resample(points, count, total, stations = null) {
      const out = [];
      let i = 0;
      let walked = 0;
      const segment = k => Math.hypot(points[k + 1].x - points[k].x, points[k + 1].y - points[k].y);
      for (let n = 0; n <= count; n++) {
        const s = stations ? stations[n] : total * n / count;
        while (i < points.length - 2 && walked + segment(i) < s) walked += segment(i++);
        const f = Math.min(1, Math.max(0, (s - walked) / (segment(i) || 1)));
        out.push({ x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f });
      }
      return out;
    }

    function pointAtFraction(points, f) {
      const [, at] = resample(points, 1, polylineLength(points) * Math.max(0, Math.min(1, f)));
      return at;
    }




    // Where a road end is curved on its own (end.dir), it meets the road joined
    // to it at an angle: each end is cut square to its own direction, leaving a
    // wedge open on the outside of the bend. Pave that wedge as a rounded corner
    // about the point where the two end cuts cross, and carry each line round it.
    function drawKinks(sheet, solved, layers) {
      const margin = inchesToPixels(sheet, PAVEMENT_MARGIN_INCHES);
      for (const joint of sheet.joints) {
        const here = attachments(sheet, joint, solved);
        for (const a of here) for (const b of here) {
          if (a.e !== 1 || b.e !== 0 || a.road === b.road || a.end.sign !== b.end.sign) continue;
          const link = joint.links.find(link => !link.pair && !link.beside &&
            Number.isInteger(link.ai) && Number.isInteger(link.bi) &&
            ((link.a === a.road.id && link.b === b.road.id) || (link.b === a.road.id && link.a === b.road.id)));
          if (!link) continue;
          if(solved.arcFits?.get(a.road.id)?.hosts[1].road===b.road.id||
            solved.arcFits?.get(b.road.id)?.hosts[0].road===a.road.id)continue;
          // A branch only continues its matching lane span, not the full width
          // of the highway feeding it. Links may be stored in either order.
          const shift = link.a === a.road.id ? link.ai - link.bi : link.bi - link.ai;
          const first = Math.max(0, shift), last = Math.min(a.road.lanes, b.road.lanes + shift);
          if (first >= last) continue;
          const sa = shapeOf(sheet, a.road, solved), sb = shapeOf(sheet, b.road, solved);
          const da = unit(sa.line.at(-1).tangent ?? travelAt(a.road, 1, solved)), db = unit(sb.line[0].tangent ?? travelAt(b.road, 0, solved));
          const turn = Math.atan2(da.x * db.y - da.y * db.x, dot(da, db));
          if (Math.abs(turn) < 0.01) continue;
          // The two end cuts, and where they cross.
          const ends = [boundary(sa, first, first === 0 ? -margin : 0).at(-1), boundary(sa, last, last === a.road.lanes ? margin : 0).at(-1)];
          const starts = [boundary(sb, first - shift, first === shift ? -margin : 0)[0], boundary(sb, last - shift, last - shift === b.road.lanes ? margin : 0)[0]];
          const na = rightOf(da), nb = rightOf(db);
          const den = na.x * nb.y - na.y * nb.x;
          if (Math.abs(den) < 1e-9) continue;
          const w = { x: starts[0].x - ends[0].x, y: starts[0].y - ends[0].y };
          const t = (w.x * nb.y - w.y * nb.x) / den;
          const center = { x: ends[0].x + na.x * t, y: ends[0].y + na.y * t };
          // The open side is away from the turn: right of travel for a left turn.
          const side = turn < 0 ? 1 : -1;
          const reach = p => side * dot({ x: p.x - center.x, y: p.y - center.y }, na);
          const [r1, r2] = [Math.max(0, Math.min(...ends.map(reach))), Math.max(...ends.map(reach))];
          if (r2 <= 0) continue;
          const steps = Math.max(4, Math.ceil(Math.abs(turn) / 0.08));
          const arc = r => Array.from({ length: steps + 1 }, (_, i) => {
            const angle = turn * i / steps, c = Math.cos(angle), sn = Math.sin(angle);
            const v = { x: na.x * side * r, y: na.y * side * r };
            return { x: center.x + v.x * c - v.y * sn, y: center.y + v.x * sn + v.y * c };
          });
          const band = document.createElementNS(SVG, "path");
          band.setAttribute("class", "roadBand");
          band.setAttribute("fill", "white");
          band.setAttribute("d", `${pathData([...arc(r2), ...(r1 > 0 ? arc(r1).reverse() : [center])])}Z`);
          layers.pavement.append(band);
        }
      }
    }

    // Drags draw at most once a frame, and only the roads they change: the roads
    // at each moved joint plus the roads joined to them (whose lines trim against
    // them). Everything else catches up REFRESH_DELAY after the last such change;
    // another change before then pushes it back. render() redraws everything at
    // once and takes over anything pending.
    const REFRESH_DELAY = 5000;
    let renderFrame = 0, previewFrame = 0, pendingChange = null, refreshTimer = 0;
    // A change is { joints, roads } (ids): the joints that moved and any other
    // roads to redraw, such as ones whose selection changed.
    const mergeChange = (a, b) => ({ joints: [...a?.joints ?? [], ...b?.joints ?? []], roads: [...a?.roads ?? [], ...b?.roads ?? []] });
    function renderSoon(change = {}) {
      pendingChange = mergeChange(pendingChange, change);
      renderFrame ||= requestAnimationFrame(() => {
        renderFrame = 0;
        drawSheet(null);
      });
    }
    function render() {
      pendingChange = null;
      drawSheet(null);
    }
    function renderPreviewSoon() {
      previewFrame ||= requestAnimationFrame(() => {
        previewFrame=0;
        const sheet=sheets.selected;
        if(drawing&&!drawing.start&&!drawing.end&&drawn?.sheet===sheet&&!renderFrame&&!pendingChange){drawDrawingCursor();return;}
        if(renderFrame||pendingChange||drawn?.sheet!==sheet||!drawn.preview||!drawing?.cursor||
          drawn.preview.some(nodes=>nodes.some(node=>!sheet.roadLayer.contains(node))))return render();
        const next=groups();drawPreview(sheet,next);
        for(const [i,name] of LAYERS.entries()){
          const old=drawn.preview[i],nodes=[...next[name].childNodes],parent=drawn.layers[name];
          // Keep the preview's original position in its layer.
          if(!old.length&&nodes.length)return render();
          for(const node of nodes)parent.insertBefore(node,old[0]);
          const parts=drawn.parts[name].after,index=parts.indexOf(old[0]);
          if(old.length)parts.splice(index,old.length,...nodes);
          old.forEach(node=>node.remove());drawn.preview[i]=nodes;
        }
        drawDrawingCursor();
      });
    }
    function refreshLater() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => (drag ? refreshLater() : render()), REFRESH_DELAY);
    }
    function changedRoads(sheet, change) {
      const ids = new Set(change.roads);
      const joints = new Set(change.joints);
      const touched = new Set(sheet.roads.filter(road => road.ends.some(end => joints.has(end.joint)))
        .flatMap(road => road.ends.map(end => end.joint)));
      for (const road of sheet.roads) if (road.ends.some(end => touched.has(end.joint))) ids.add(road.id);
      // Roads downstream take their dash phase from these, so redraw them too.
      for (let grew = true; grew;) {
        grew = false;
        for (const road of sheet.roads) if (!ids.has(road.id) && sheet.roads.some(up => ids.has(up.id) && up.ends[1].joint === road.ends[0].joint)) { ids.add(road.id); grew = true; }
      }
      for (const id of [...ids]) {
        const partner = pairOf(sheet, roadOf(sheet, id));
        if (partner) ids.add(partner.id);
      }
      return ids;
    }
    // The last render's solved roads, so panning and zooming (which don't change
    // them) only move the overlay.
    let lastSolved = null;
    // What the last render drew: each layer's group, the nodes in it after the
    // roads (kinks, the drawing preview), and each road's nodes, so a partial
    // render can replace just its roads.
    let drawn = null;
    const LAYERS = ["pavement", "markings", "selection"];
    const groups = () => Object.fromEntries(LAYERS.map(name => [name, document.createElementNS(SVG, "g")]));
    function swapNode(old, next, parent) {
      if (old && next) old.replaceWith(next);
      else if (old) old.remove();
      else if (next) parent.append(next);
    }
    function drawSheet(change) {
      cancelAnimationFrame(renderFrame);
      cancelAnimationFrame(previewFrame);previewFrame=0;
      renderFrame = 0;
      if (pendingChange) change = change && mergeChange(pendingChange, change) || pendingChange;
      pendingChange = null;
      const sheet = sheets.selected;
      if(sheet?.roads?.some(r=>curveAngle(r)!=null)){syncRoadCurves(sheet);change=null;}
      let partial = change && drawn?.sheet === sheet && sheet.inchesPerPixel && drawn.layers.pavement.parentNode === sheet.roadLayer
        ? changedRoads(sheet, change) : null;
      if (!partial) {
        clearTimeout(refreshTimer);
        refreshTimer = 0;
      } else if (partial.size || refreshTimer) refreshLater();
      let solved = null;
      if (sheet) {
        const layer = layerFor(sheet);
        window.StripeMaker.roadWidths.withSnapshot(sheet,()=>{
        solved = solve(sheet);
        const after = groups();
        let preview=null;
        const roads = partial ? drawn.layers : groups();
        const nodes = partial ? drawn.roads : new Map();
        if (sheet.inchesPerPixel) {
          const partner = pairOf(sheet, selectedRoad);
          for (const road of sheet.roads) {
            if (partial && !partial.has(road.id)) continue;
            const className = road === selectedRoad || road === partner ? "selected" : "";
            const next = drawRoad(sheet, road, shapeOf(sheet, road, solved), partial ? groups() : roads, className, solved);
            const old = partial && nodes.get(road.id);
            if (partial) for (const [key, name] of [["band", "pavement"], ["group", "markings"], ["ring", "selection"]]) swapNode(old?.[key], next[key], roads[name]);
            nodes.set(road.id, next);
          }
          drawKinks(sheet, solved, after);
          if ((drawing?.start || drawing?.end) && drawing.cursor) {
            const counts=LAYERS.map(name=>after[name].childNodes.length);
            drawPreview(sheet, after);
            preview=LAYERS.map((name,i)=>[...after[name].childNodes].slice(counts[i]));
          }
        }
        // Each layer's group holds the roads, then the rest.
        const parts = Object.fromEntries(LAYERS.map(name => [name, { after: [...after[name].childNodes] }]));
        for (const name of LAYERS) {
          const group = roads[name];
          if (partial) drawn.parts[name].after.forEach(node => {if(node.parentNode===group)node.remove();});
          else group.setAttribute("class", `road${name[0].toUpperCase()}${name.slice(1)}`);
          group.append(...parts[name].after);
        }
        if (!partial) layer.replaceChildren(...LAYERS.map(name => roads[name]));
        drawn = { sheet, layers: roads, parts, roads: nodes, preview };
        });
      }
      lastSolved = solved && { sheet, solved };
      drawOverlay(solved, partial);
      updatePanel(solved);
      window.StripeMaker.diagrammaticRender?.(sheet);
    }
    function drawPreview(sheet, layers) {
      const line = drawing.end ? [drawing.cursor, drawing.end] : [drawing.start, drawing.cursor];
      drawRoad(sheet, defaults, buildShape(sheet, defaults, line, new Map()), layers, "preview");
    }
    function changed(change = null) {
      // A lane-count edit replaces the automatic cross-section with an
      // ordinary road; never retain profiles with missing lane entries.
      for (const road of sheets.selected?.roads ?? []) if (road.centerlineTransition &&
          [road.centerlineTransition.start, road.centerlineTransition.end].some(widths => widths.length !== road.lanes)) {
        const partner = pairOf(sheets.selected, road);
        delete road.centerlineTransition;
        if (partner) delete partner.centerlineTransition;
      }
      curveLinks.prune(sheets.selected);
      if(change && sheets.selected?.roads.some(r=>r.ends.some(e=>e.curveLink)))change=null;
      if (change) drawSheet(change);
      else render();
      save();
      window.StripeMaker.history.record();
    }

    function place(element, point) {
      const screen = sheets.toScreen(point);
      element.style.left = `${screen.x}px`;
      element.style.top = `${screen.y}px`;
      return screen;
    }
    function nodeButton(key) {
      let button = nodeButtons.get(key);
      if (button) return button;
      const [road, end, lane] = key.split(":").map(Number);
      button = document.createElement("button");
      button.type = "button";
      button.className = "roadNode";
      Object.assign(button.dataset, { road, end, lane });
      button.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Shift+F10");
      button.setAttribute("aria-haspopup", "menu");
      bindNode(button);
      // A badge just past the node when the lane end tapers.
      button.taper = Object.assign(document.createElement("span"), { className: "roadTaper" });
      button.taper.setAttribute("aria-hidden", "true");
      nodeButtons.set(key, button);
      overlay.append(button.taper, button);
      return button;
    }
    // The way a lane heads from its end: toward a point AIM_FEET along it (or from
    // one before it), so a lane splitting off another points where it goes, not
    // along the road it leaves.
    function laneHeading(sheet, shape, e, lane) {
      const center = offset(shape.line, i => (shape.laneBounds[i][lane][0] + shape.laneBounds[i][lane][1]) / 2);
      const points = e ? [...center].reverse() : center, reach = Math.min(feetToPixels(sheet, AIM_FEET), polylineLength(points) / 3);
      let walked = 0, target = points.at(-1);
      for (let i = 1; i < points.length; i++) {
        walked += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        if (walked >= reach) { target = points[i]; break; }
      }
      const away = unit({ x: target.x - points[0].x, y: target.y - points[0].y });
      return e ? { x: -away.x, y: -away.y } : away;
    }
    // Every lane of every road shows a node at each end: a circle with an arrow
    // in its direction of travel.
    // Each road's nodes share a color, so you can tell which nodes are whose:
    // red for the first road, then on up through the hues. Both sides of a
    // two-way road match.
    function nodeColors(sheet) {
      const colors = new Map(), byRoad = new Map();
      let next = 0;
      for (const road of sheet.roads) {
        const partner = pairOf(sheet, road);
        let color = partner && byRoad.get(partner.id);
        if (!color) {
          color = `hsl(${(next++ * 23) % 360} 95% 55%)`;
          byRoad.set(road.id, color);
        }
        for (let lane = 0; lane < road.lanes; lane++) for (const e of [0, 1]) colors.set(`${road.id}:${e}:${lane}`, color);
      }
      return colors;
    }
    // The node (css/menus.css .roadNode) in its road's color.
    const nodeIcons = new Map();
    function nodeIcon(color) {
      if (!nodeIcons.has(color)) {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='#252628' fill-opacity='.55' stroke='#252628' stroke-width='4'/><circle cx='12' cy='12' r='10' fill='none' stroke='${color}' stroke-width='2'/><path d='M6.5 12h10M12.5 7.5L17 12l-4.5 4.5' fill='none' stroke='${color}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
        nodeIcons.set(color, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      }
      return nodeIcons.get(color);
    }
    // Only the given road ids' nodes, when only those roads changed.
    function drawOverlay(solved = sheets.selected && solve(sheets.selected), only = null) {
      const sheet=sheets.selected;
      if(!sheet)return drawRoadOverlay(solved,only);
      return window.StripeMaker.roadWidths.withSnapshot(sheet,()=>drawRoadOverlay(solved,only));
    }
    function drawRoadOverlay(solved, only) {
      const sheet = sheets.selected;
      overlay.hidden = !sheet || !active() || !sheet.inchesPerPixel;
      overlay.classList.toggle("drawing", Boolean(drawing));
      const seen = new Set();
      const colors = overlay.hidden ? new Map() : nodeColors(sheet);
      workspace.style.setProperty("--roadColor", (selectedRoad && colors.get(`${selectedRoad.id}:0:0`)) || "#ffdf00");
      if (!overlay.hidden) {
        for (const road of sheet.roads) {
          if (only && !only.has(road.id)) continue;
          for (let lane = 0; lane < road.lanes; lane++) {
            for (const e of [0, 1]) {
              const key = `${road.id}:${e}:${lane}`;
              const button = nodeButton(key);
              seen.add(key);
              button.classList.toggle("selected", road === selectedRoad || road === pairOf(sheet, selectedRoad));
              button.classList.toggle("laneSelected", road === selectedRoad && selectedLane?.e === e && selectedLane.lane === lane);
              const shape = shapeOf(sheet, road, solved);
              const tapered = shape.tapers.has(`${e}:${lane}`);
              button.setAttribute("aria-label", `Road ${road.id}, lane ${lane + 1} ${window.StripeMaker.traffic.incoming(Boolean(e)) ? "end" : "start"}${tapered ? (window.StripeMaker.traffic.incoming(Boolean(e)) ? ", lane drop taper" : ", lane add taper") : ""}`);
              button.setAttribute("aria-expanded", String(button === menuNode?.button));
              const color = colors.get(key);
              button.style.backgroundImage = color ? nodeIcon(color) : "";
              const at = place(button, nodePoint(sheet, road, e, lane, solved));
              const inward = inwardAt(shape.line, e);
              const travel = laneHeading(sheet, shape, e, lane);
              const angle = Math.atan2(travel.y, travel.x) + (window.StripeMaker.traffic.reversed ? Math.PI : 0);
              button.style.setProperty("--angle", `${angle}rad`);
              // The wedge sits past the arrow and narrows toward the lane's zero-width end.
              button.taper.hidden = !tapered;
              button.taper.style.left = `${at.x + inward.x * TAPER_BADGE_PIXELS}px`;
              button.taper.style.top = `${at.y + inward.y * TAPER_BADGE_PIXELS}px`;
              button.taper.style.setProperty("--angle", `${angle - (window.StripeMaker.traffic.reversed ? Math.PI : 0) + (e ? 0 : Math.PI)}rad`);
            }
          }
        }
      }
      for (const [key, button] of nodeButtons) {
        if (only || seen.has(key)) continue;
        button.remove();
        button.taper.remove();
        nodeButtons.delete(key);
      }
      drawLaneAdds(sheet, solved);
      positionMenu();
      drawArcHandles(sheet,solved);
      if (overlay.hidden) return;
      drawDrawingCursor();
      drawCurveGuides(sheet, solved);
      controlButtons.forEach((button, e) => {
        const handle = selectedRoad && curveAngle(selectedRoad)==null && !drawing && openCurves.has(`${selectedRoad.id}:${e}`) ? handlePoint(sheet, selectedRoad, e, solved) : null;
        button.hidden = !handle;
        controlLines[e].setAttribute("visibility", handle ? "visible" : "hidden");
        if (!handle) return;
        const from = sheets.toScreen(handle.from);
        const to = place(button, handle.at);
        controlLines[e].setAttribute("x1", from.x);
        controlLines[e].setAttribute("y1", from.y);
        controlLines[e].setAttribute("x2", to.x);
        controlLines[e].setAttribute("y2", to.y);
      });
    }
    function arcHandleState(road=selectedRoad) {
      if(!road||curveAngle(road)==null||!sheets.selected)return null;
      const solved=solve(sheets.selected),fit=solved.arcFits?.get(road.id);
      const {a,b}=curveOf(sheets.selected,road,solved),geo=curveGeometry(road,a,b),chord=Math.hypot(b.x-a.x,b.y-a.y);
      const normal=chord?{x:-(b.y-a.y)/chord,y:(b.x-a.x)/chord}:rightOf(geo.point(0).tangent);
      return {road,a,b,geo,chord,normal,fit,/* SIGNMAKER */ anchor:diagrammaticArcAnchor(sheets.selected,road,solved),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},angle:fit?.degrees??curveAngle(road),profile:road.clothoid&&structuredClone(road.clothoid),loop:road.arcLoop&&structuredClone(road.arcLoop)};
    }
    function drawArcHandles(sheet,solved) {
      const state=!overlay.hidden&&!drawing&&arcHandleState();
      for(const {button,line,kind} of arcHandles) {
        const point=state&&(kind==='angle'?(!state.fit&&state.geo.point(.5)):!state.road.clothoid&&state.geo.center);
        button.hidden=!point;line.setAttribute('visibility',point?'visible':'hidden');
        if(!point)continue;
        const at=place(button,point),from=sheets.toScreen(kind==='angle'?state.mid:state.geo.point(0));
        for(const [key,value]of Object.entries({x1:from.x,y1:from.y,x2:at.x,y2:at.y}))line.setAttribute(key,value);
      }
    }
    function moveArcHandle(state,kind,point) {
      const {road,a,b,chord,normal,mid}=state,sheet=sheets.selected,sign=Math.sign(state.angle)||1;
      // BEGIN SIGNMAKER ARC RADIUS HANDLE
      if(kind==='radius'&&state.anchor){
        const n=rightOf(state.anchor.direction),at=state.anchor.at;
        const radius=((point.x-at.x)*n.x+(point.y-at.y)*n.y)*sign;
        if(diagrammaticSetArc(sheet,road,state.angle,radius,state.anchor)){syncRoadCurves(sheet);render();}
        return;
      }
      // END SIGNMAKER ARC RADIUS HANDLE
      if(kind==='radius'&&state.fit){
        const fit=state.fit,G=window.StripeMaker.circularArc;
        const curves=fit.hostCurves.map(G.laneCurve),step=Math.max(.001,fit.radius*.01);
        const next=G.fitCurves(...curves,fit.radius+step,road.arcAngle,fit.parameters);if(!next)return;
        const v={x:(next.center.x-fit.center.x)/step,y:(next.center.y-fit.center.y)/step},squared=v.x*v.x+v.y*v.y;
        if(squared<1e-10)return;
        const radius=Math.max(feetToPixels(sheet,road.lanes*road.laneWidth/2+1/12),fit.radius+((point.x-fit.center.x)*v.x+(point.y-fit.center.y)*v.y)/squared);
        if(!G.fitCurves(...curves,radius,road.arcAngle))return;
        road.arcJoinRadius=radius*sheet.inchesPerPixel/12;
        render();return;
      }
      if(kind==='angle'&&state.fit)return;
      if(kind==='radius'&&state.loop){
        const normal=rightOf(state.loop.heading),radius=Math.max(1,((point.x-a.x)*normal.x+(point.y-a.y)*normal.y)*sign);
        road.arcLoop.radius=radius;syncRoadCurves(sheet);render();return;
      }
      let angle;
      if(state.loop){
        const c=state.geo.center,start=Math.atan2(a.y-c.y,a.x-c.x),at=Math.atan2(point.y-c.y,point.x-c.x);
        const sweep=((at-start)*sign+Math.PI*4)%(Math.PI*2);angle=sign*Math.min(360,sweep*360/Math.PI);
      }else if(kind==='radius'){
        const distance=((point.x-mid.x)*normal.x+(point.y-mid.y)*normal.y)*sign;
        angle=sign*Math.min(359.9,2*Math.atan2(chord/2,distance)*180/Math.PI);
      }else{
        const sagitta=(point.x-mid.x)*normal.x+(point.y-mid.y)*normal.y;
        if(road.clothoid){
          const score=value=>{const profile=state.angle?{start:state.profile.start*value/state.angle,end:state.profile.end*value/state.angle}:{start:0,end:2*value},p=window.StripeMaker.clothoid.geometry(a,b,profile).point(.5);return ((p.x-point.x)**2+(p.y-point.y)**2)/Math.max(1,chord*chord)+1e-9*(value-state.angle)**2;};
          let best=state.angle,error=score(best);for(let value=-360;value<=360;value+=10){const next=score(value);if(next<error){best=value;error=next;}}
          let lo=Math.max(-360,best-10),hi=Math.min(360,best+10);for(let i=0;i<20;i++){const x=lo+(hi-lo)/3,y=hi-(hi-lo)/3;if(score(x)<score(y))hi=y;else lo=x;}angle=(lo+hi)/2;
        }else angle=-4*Math.atan2(2*sagitta,chord)*180/Math.PI;
      }
      setRoadCurve(road,Math.max(-360,Math.min(360,angle)),false,road.clothoid?'clothoid':'arc');
    }
    for(const {button,kind}of arcHandles){
      let drag=null;
      button.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;const state=arcHandleState();if(!state)return;
        event.stopPropagation();event.preventDefault();button.focus({preventScroll:true});
        drag={state,before:structuredClone({roads:sheets.selected.roads,joints:sheets.selected.joints}),moved:false};button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('pointermove',event=>{if(!drag||!button.hasPointerCapture(event.pointerId))return;drag.moved=true;moveArcHandle(drag.state,kind,sheets.toImage(event.clientX,event.clientY));});
      const finish=event=>{if(!drag)return;const current=drag;drag=null;if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
        if(event.type==='pointercancel'){Object.assign(sheets.selected,current.before);selectedRoad=roadOf(sheets.selected,current.state.road.id);render();}
        else if(current.moved)changed();
      };
      button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',finish);
      button.addEventListener('dblclick',event=>event.stopPropagation());
      nudgeKeys(button,(dx,dy)=>{const state=arcHandleState();if(!state)return false;const p=kind==='angle'?state.geo.point(.5):state.geo.center;if(!p)return false;moveArcHandle(state,kind,{x:p.x+dx,y:p.y+dy});});
    }
    function drawDrawingCursor() {
      const anchor=drawing?.start??drawing?.end;
      startMarker.hidden=!anchor;
      if(anchor)place(startMarker,anchor);
      snapRing.setAttribute("visibility",snapTarget?"visible":"hidden");
      if(snapTarget){const at=sheets.toScreen(snapTarget);snapRing.setAttribute("cx",at.x);snapRing.setAttribute("cy",at.y);}
    }

    // Add-lane buttons: a small + triangle just outside each outer edge of the
    // selected road, halfway along it (both edges of a one-way road; each side's
    // outer edge of a two-way road). Clicking one adds a lane on that edge.
    const LANE_ADD_PIXELS = 16;
    const laneAddButtons = [];
    function laneAddButton(i) {
      if (laneAddButtons[i]) return laneAddButtons[i];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "laneAdd";
      button.addEventListener("pointerdown", event => event.stopPropagation());
      button.addEventListener("dblclick", event => event.stopPropagation());
      button.addEventListener("click", event => {
        event.stopPropagation();
        if (event.ctrlKey) return openLaneAddMenu(button);
        if (button.target) addLane(sheets.selected, button.target.road, button.target.side, null, event.shiftKey);
      });
      button.setAttribute("aria-haspopup", "menu");
      button.setAttribute("aria-expanded", "false");
      const context = event => { event.preventDefault(); event.stopPropagation(); openLaneAddMenu(button); };
      button.addEventListener("contextmenu", context);
      button.addEventListener("keydown", event => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) context(event);
      });
      overlay.append(button);
      return (laneAddButtons[i] = button);
    }
    function drawLaneAdds(sheet, solved) {
      const road = !overlay.hidden && !drawing && selectedRoad && sheet?.roads.includes(selectedRoad) ? selectedRoad : null;
      const partner = road && pairOf(sheet, road);
      const targets = !road ? [] : partner ? [[road, "R"], [partner, "R"]] : [[road, "L"], [road, "R"]];
      laneAddButtons.forEach((button, i) => { button.hidden = i >= targets.length; });
      const margin = sheet?.inchesPerPixel ? inchesToPixels(sheet, PAVEMENT_MARGIN_INCHES) : 0;
      targets.forEach(([r, side], i) => {
        const shape = shapeOf(sheet, r, solved);
        const left = pointAtFraction(boundary(shape, 0, -margin), 0.5), right = pointAtFraction(boundary(shape, r.lanes, margin), 0.5);
        const [edge, other] = side === "R" ? [right, left] : [left, right];
        const out = unit({ x: edge.x - other.x, y: edge.y - other.y }), gap = LANE_ADD_PIXELS / sheet.view.scale;
        const button = laneAddButton(i);
        button.target = { road: r, side };
        button.hidden = r.lanes >= MAX_LANES;
        place(button, { x: edge.x + out.x * gap, y: edge.y + out.y * gap });
        button.style.setProperty("--angle", `${Math.atan2(out.y, out.x)}rad`);
        const label = `Add a lane on the ${side === "R" ? "right" : "left"}${partner ? ` of road ${r.id}` : ""}`;
        button.setAttribute("aria-label", label);
        button.title = label;
      });
    }
    // A lane added on an edge. A one-way road keeps its other edge and every
    // lane in place: each end that positions its joint (the joint's root) moves
    // the joint half a lane toward the new lane. A two-way side already grows
    // outward from its centerline.
    function addLane(sheet, road, side) {
      if (!sheet || road.lanes >= MAX_LANES) return;
      growRoad(sheet, road, side);
      changed();
    }
    function growRoad(sheet, road, side) {
      const solved = solve(sheet);
      const width = road.laneWidth;
      if (!pairOf(sheet, road)) {
        const shift = (side === "R" ? 1 : -1) * feetToPixels(sheet, width) / 2;
        for (const e of [0, 1]) {
          const joint = jointOf(sheet, road.ends[e].joint), here = attachments(sheet, joint);
          const root = here.some(item => item.road.id === joint.root) ? joint.root : here[0]?.road.id;
          if (root !== road.id) continue;
          const right = rightOf(travelAt(road, e, solved));
          joint.x += right.x * shift;
          joint.y += right.y * shift;
        }
      }
      // The new lane's index: renumber the lanes from it on.
      const at = side === "L" ? 0 : road.lanes;
      if (at < road.lanes) {
        renumberLanes(sheet, road, at);
        if (selectedLane && selectedRoad === road && selectedLane.lane >= at) selectedLane = { ...selectedLane, lane: selectedLane.lane + 1 };
      }
      road.lanes += 1;
    }
    // Head-on lane links at a joint: { from, fromLane, to, toLane }, `from`
    // ending there and `to` starting there.
    function laneLinks(sheet, joint) {
      const out = [];
      for (const link of joint.links) {
        if (link.pair || link.beside || typeof link.ai !== "number" || typeof link.bi !== "number") continue;
        let [from, fromLane, to, toLane] = [roadOf(sheet, link.a), link.ai, roadOf(sheet, link.b), link.bi];
        if (!from || !to) continue;
        if (from.ends[0].joint === joint.id && to.ends[1].joint === joint.id) [from, fromLane, to, toLane] = [to, toLane, from, fromLane];
        if (from.ends[1].joint === joint.id && to.ends[0].joint === joint.id) out.push({ link, from, fromLane, to, toLane });
      }
      return out;
    }
    // Lanes count from the left, so a lane added on the left renumbers the road's
    // lanes and everything that refers to them.
    function renumberLanes(sheet, road, from = 0) {
      const up = lane => (Number(lane) >= from ? Number(lane) + 1 : Number(lane));
      const bump = key => key.replace(/:(\d+)$/, (_, lane) => `:${up(lane)}`);
      for (const field of ["tapers"]) {
        if (road[field]) road[field] = Object.fromEntries(Object.entries(road[field]).map(([key, value]) => [bump(key), value]));
      }
      for (const field of ["gapProfiles"]) {
        if (road[field]) road[field] = Object.fromEntries(Object.entries(road[field]).map(([lane, value]) => [up(lane), value]));
      }
      if (road.widthProfiles) road.widthProfiles = [...road.widthProfiles.slice(0, from), null, ...road.widthProfiles.slice(from)];
      for (const joint of sheet.joints) for (const link of joint.links) {
        if (link.a === road.id && typeof link.ai === "number") link.ai = up(link.ai);
        if (link.b === road.id && typeof link.bi === "number") link.bi = up(link.bi);
      }
    }


    function updatePanel(solved) {
      const sheet = sheets.selected;
      const ready = Boolean(sheet?.inchesPerPixel);
      addButton.disabled = !ready;
      addButton.setAttribute("aria-pressed", String(Boolean(drawing)));
      deleteButton.disabled = !selectedRoad;
      document.getElementById('roadCurveFields').hidden=!selectedRoad;
      document.getElementById('roadArcFields').hidden=!selectedRoad||curveAngle(selectedRoad)==null;
      document.getElementById('roadCurveType').value=selectedRoad?.clothoid?'clothoid':selectedRoad?.arcAngle!=null?'arc':'freeform';
      const fitted=solved?.arcFits?.get(selectedRoad?.id),fitGroup=arcJoinGroup(sheet,selectedRoad);
      const fitToggle=document.getElementById('roadArcFit'),fitHint=document.getElementById('roadArcFitHint');
      document.getElementById('roadArcFitRow').hidden=fitGroup.length<2;
      fitToggle.checked=fitGroup.length>1&&fitGroup.every(road=>road.arcJoinFit!==false);
      fitToggle.indeterminate=fitGroup.length>1&&!fitToggle.checked&&fitGroup.some(road=>road.arcJoinFit!==false);
      fitHint.hidden=fitGroup.length<2;
      fitHint.textContent=fitted
        ? 'Applies to all arcs in this split/merge. The joined roads determine the angle; adjust Radius to change the bend. Turn fitting off to edit the angle freely.'
        : fitToggle.checked
          ? 'Fitting needs compatible road connections at both ends.'
          : 'Turn on to stagger the circular entries and exits along the joined roads. Applies to all arcs in this split/merge.';
      for(const id of ['roadArcAngle','roadArcAngleValue'])document.getElementById(id).disabled=Boolean(fitted);
      if(selectedRoad&&curveAngle(selectedRoad)!=null) {
        for(const id of ['roadArcAngle','roadArcAngleValue'])if(document.activeElement!==document.getElementById(id))document.getElementById(id).value=Number((fitted?.degrees??curveAngle(selectedRoad)).toFixed(2));
        const {a,b}=curveOf(sheet,selectedRoad,solved),arc=curveGeometry(selectedRoad,a,b);
        const radius=document.getElementById('roadArcRadius'),feet=sheet.inchesPerPixel/12;
        radius.min=fitted?selectedRoad.lanes*selectedRoad.laneWidth/2+1/12:selectedRoad.arcLoop?0:Math.hypot(b.x-a.x,b.y-a.y)*feet/2;
        document.getElementById('roadArcRadiusRow').hidden=Boolean(selectedRoad.clothoid);
        if(document.activeElement!==radius)radius.value=Number.isFinite(arc.radius)?Number((arc.radius*feet).toFixed(3)):'';
      }
      const values = selectedRoad ?? drawingDefaults();
      updateAddElement();
      if (document.activeElement !== lanesInput) lanesInput.value = values.lanes;
      if (document.activeElement !== widthInput) widthInput.value = values.laneWidth;
      updateCurveFields();
      const lane = selectedRoad && selectedLane?.lane < selectedRoad.lanes ? selectedLane : null;
      laneFields.hidden = !lane || !solved;
      if (!laneFields.hidden) {
        const key = `${lane.e}:${lane.lane}`;
        const setting = selectedRoad.tapers?.[key];
        laneTitle.textContent = `Lane ${lane.lane + 1} ${lane.e ? "end" : "start"}`;
        if (document.activeElement !== taperSelect) taperSelect.value = setting?.mode ?? "auto";
        if (document.activeElement !== taperLength) taperLength.value = setting?.length ?? DEFAULT_TAPER_FEET;
        const tapering = shapeOf(sheet, selectedRoad, solved).tapers.has(key);
        const autoOff = (setting?.mode ?? "auto") === "auto" && !sheet.autoTapers && solved.auto.has(`${selectedRoad.id}:${key}`);
        taperState.textContent = autoOff ? "Auto tapers are off, so this lane stays full width. Choose Taper to taper it."
          : !tapering ? "No taper here."
          : lane.e ? "This lane narrows to nothing at its end (lane drop)." : "This lane widens from nothing at its start (lane add).";
      }
      autoTapersInput.disabled = !ready;
      autoTapersInput.checked = Boolean(sheet?.autoTapers);
      workspace.classList.toggle("drawing", Boolean(drawing));
      workspace.classList.toggle("elementsActive", active());
      if (!sheet || !ready) hint.textContent = "";
      else if(drawing&&snapTarget?.edge)hint.textContent=snapTarget.direct
        ? "Direct lane connection. Click to join the edge lane; release Shift to add beside it."
        : "Click to add beside this stem. Hold Shift to connect directly to its edge lane.";
      else if (drawing && (drawing.start || drawing.end) && !drawingAlongTraffic()) hint.textContent = "Click where the new stem starts; it ends at the chosen lane's start. Esc cancels.";
      else if (drawing && !drawing.start && !drawing.end) hint.textContent = "Click the stem's start point, a lane's end node to continue from it, or a stem's edge to branch off it.";
      else if (drawing) hint.textContent = drawing.last
        ? "Click to add the next node, or a lane's start node or edge to join it. Double-click or press Esc to finish."
        : "Click the next node, a lane's start node to join it, or a stem's edge to merge into it. Keep clicking to continue; double-click or press Esc to finish.";
      else if (lane) hint.textContent = "Lane end selected. Set its taper below, drag the node to move the stem end, or right-click it for more actions.";
      else if (selectedRoad) hint.textContent = "Drag a lane node to move the stem end, onto another stem's node to join them, or onto a stem's edge to feed its edge lane. Hold Shift while dragging a node or curve handle to keep its original direction.";
      else hint.textContent = "Add an arrow stem, or click one to edit it. Right-click a lane node for curves, tapers, and overlap order.";
    }

    function selectRoad(road) {
      selectedRoad = road;
      selectedLane = null;
      render();
      // SignalMaker's flashSelection timing and pulse, applied to the actual
      // SVG outline while retaining the persistent yellow selection beneath it.
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        workspace.querySelectorAll(".roadOutline").forEach(outline => {
          const flash = outline.cloneNode();
          outline.after(flash);
          const zoom = sheets.selected?.view.scale ?? 1;
          flash.animate([
            { strokeWidth: `${8 / zoom}px`, opacity: 1, offset: 0 },
            { strokeWidth: `${18 / zoom}px`, opacity: 1, offset: 0.15 },
            { strokeWidth: `${8 / zoom}px`, opacity: 1, offset: 0.25 },
            { strokeWidth: `${8 / zoom}px`, opacity: 0, offset: 1 }
          ], { duration: 500, easing: "ease-in", fill: "forwards" }).onfinish = () => flash.remove();
        });
      }
    }
    // Drawing anchors use canonical ends; visible traffic runs the other way
    // in left-hand mode. Keep that distinction at input, so saved lane links
    // and the rest of the road model stay canonical.
    const drawingAlongTraffic = () => Boolean(window.StripeMaker.traffic.reversed ? drawing?.end : drawing?.start);
    const drawingDefaults = () => defaults;
    function startDrawing({ start = null, end = null } = {}) {
      drawingPointer=null;
      drawing = { start, end, cursor: null };
      selectedRoad = null;
      selectedLane = null;
      render();
    }
    // Finishing a chain of road segments selects the last one.
    function stopDrawing() {
      if (drawing?.last) selectedRoad = roadOf(sheets.selected, drawing.last) ?? null;
      drawing = null;
      snapTarget = null;
      render();
    }

    // The nearest lane node within snapping distance that an end of `road` can join:
    // ends join starts, and never a joint the road already uses.
    function snapLane(sheet, solved, point, e, road = null, movingLane = 0) {
      let best = null;
      let bestDistance = SNAP_PIXELS / sheet.view.scale;
      for (const other of sheet.roads) {
        if (other === road) continue;
        const f = 1 - e;
        if (road && road.ends.some(end => end.joint === other.ends[f].joint)) continue;
        for (let lane = 0; lane < other.lanes; lane++) {
          // Either the lane's true end or its drawn node counts.
          const at = lanePoint(sheet, other, f, lane, solved);
          const shown = nodePoint(sheet, other, f, lane, solved);
          const distance = Math.min(Math.hypot(at.x - point.x, at.y - point.y), Math.hypot(shown.x - point.x, shown.y - point.y));
          if (distance <= bestDistance) {
            best = { road: other, e: f, lane, x: at.x, y: at.y };
            bestDistance = distance;
          }
        }
      }
      // A visible start node may already continue an incoming lane. Dropping
      // another start on it means branch from that incoming lane, not a
      // start-to-start lane link (which has no direction of travel).
      if(road) for(const other of sheet.roads) {
        if(other===road || road.ends.some(end=>end.joint===other.ends[e].joint))continue;
        const joint=jointOf(sheet,other.ends[e].joint),links=joint?laneLinks(sheet,joint):[];
        for(let lane=0;lane<other.lanes;lane++) {
          const at=lanePoint(sheet,other,e,lane,solved),shown=nodePoint(sheet,other,e,lane,solved);
          const distance=Math.min(Math.hypot(at.x-point.x,at.y-point.y),Math.hypot(shown.x-point.x,shown.y-point.y));
          if(distance>bestDistance)continue;
          const continuing=links.find(l=>e?l.from===other&&l.fromLane===lane:l.to===other&&l.toLane===lane);
          if(!continuing)continue;
          const targetRoad=e?continuing.to:continuing.from;
          let targetLane=e?continuing.toLane:continuing.fromLane;
          if(road.ends.some(end=>end.joint===targetRoad.ends[1-e].joint))continue;
          const goal=lanePoint(sheet,targetRoad,1-e,targetLane,solved);
          best={road:targetRoad,e:1-e,lane:targetLane,x:goal.x,y:goal.y};
          bestDistance=distance;
        }
      }
      return best;
    }
    function insidePolygon(point, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    }
    // The road on top at a point: the one drawn last.
    function roadAt(sheet, point) {
      const solved = solve(sheet);
      const slop = 6 / sheet.view.scale;
      for (const road of [...sheet.roads].reverse()) {
        const shape = shapeOf(sheet, road, solved);
        if (insidePolygon(point, [...boundary(shape, 0, -slop), ...boundary(shape, road.lanes, slop).reverse()])) return road;
      }
      return null;
    }

    function newJoint(sheet, point, root, dir = null) {
      const joint = { id: nextId(sheet.joints), x: point.x, y: point.y, dir, root, links: [] };
      sheet.joints.push(joint);
      return joint;
    }
    // Joins lane `lane` at end `e` of `road` to the target lane. The road's end (and
    // anything already joined to it) moves onto the target's joint, turning to its
    // direction so the ends line up. Opposite directions join left edge to left edge.
    function centerlineTransitionCandidate(sheet, road, e, target) {
      const partner = pairOf(sheet, road), other = target.road, opposite = pairOf(sheet, other);
      if (!partner || !opposite || target.e === e || road.lanes === other.lanes ||
          road.lanes + partner.lanes !== other.lanes + opposite.lanes) return null;
      const four = [road, partner, other, opposite];
      // Only simple, undivided, uniform-width travel roads. Branches and
      // explicit tapers retain their normal lane-to-lane joins.
      if (four.some(r => r.centerlineTransition || r.widthProfiles?.some(p => p && [p.start,p.end,p.width].some(w => w !== r.laneWidth)) || r.gapProfiles ||
          r.laneWidth !== road.laneWidth ||
          Object.values(r.tapers ?? {}).some(t => t.mode === 'taper')) ||
          [road, other].some(r => pairLinks(sheet, r, pairOf(sheet, r)).some(l => l.median > 0)) ||
          attachments(sheet, jointOf(sheet, road.ends[e].joint)).length !== 2 ||
          attachments(sheet, jointOf(sheet, other.ends[target.e].joint)).length !== 2) return null;
      const before = solve(sheet);
      if (dot(travelAt(road, e, before), travelAt(other, target.e, before)) < .95) return null;
      return {partner, other, opposite};
    }
    function prepareCenterlineTransition(sheet, road, e, target) {
      const candidate = centerlineTransitionCandidate(sheet, road, e, target);
      if (!candidate) return null;
      const {partner, other, opposite} = candidate;
      // Half of the joining segment becomes the transition. This is editable
      // geometry, not a speed-based design taper length.
      const count = road.lanes, backCount = partner.lanes;
      const cut = cutRoad(sheet, road, .5);
      const section = e ? cut.after : road, back = pairOf(sheet, section);
      const baseline = solve(sheet);
      const configure = (r, start, end) => {
        const added = Math.max(start, end) - r.lanes;
        for (const joint of sheet.joints) for (const link of joint.links) {
          if (link.a === r.id && typeof link.ai === 'number') link.ai += added;
          if (link.b === r.id && typeof link.bi === 'number') link.bi += added;
        }
        r.lanes = Math.max(start, end);
        r.centerlineTransition = Object.fromEntries([['start', start], ['end', end]].map(([key, n]) =>
          [key, Array.from({length:r.lanes}, (_, lane) => lane < r.lanes - n ? 0 : r.laneWidth)]));
        delete r.widthProfiles;
      };
      configure(section, e ? count : other.lanes, e ? other.lanes : count);
      configure(back, e ? opposite.lanes : backCount, e ? backCount : opposite.lanes);
      reanchor(sheet, baseline, [cut.joint]);
      return section;
    }
    function connect(sheet, road, e, lane, target) {
      const host = jointOf(sheet, target.road.ends[target.e].joint);
      if (road.ends[e].joint === host.id || road.ends[1 - e].joint === host.id) return;
      const transition = prepareCenterlineTransition(sheet, road, e, target);
      if (transition) {
        road = transition; lane = road.lanes - 1;
        target = {...target, lane: target.road.lanes - 1};
        selectedRoad = road;
      }
      const moving = jointOf(sheet, road.ends[e].joint);
      // A physical lane join supersedes a separate curve constraint.
      curveLinks.unlink(sheet,road.ends[e].curveLink);
      curveLinks.unlink(sheet,target.road.ends[target.e].curveLink);
      const solved = solve(sheet);
      const pair = dot(travelAt(road, e, solved), travelAt(target.road, target.e, solved)) < 0;
      host.dir ??= travelAt(target.road, target.e, solved);
      for (const item of attachments(sheet, moving)) {
        item.end.sign = dot(travelAt(item.road, item.e, solved), host.dir) < 0 ? -1 : 1;
        item.end.joint = host.id;
      }
      host.links.push(...moving.links, { a: target.road.id, ai: target.lane, b: road.id, bi: lane, pair, feed: !pair });
      sheet.joints.splice(sheet.joints.indexOf(moving), 1);
      reanchor(sheet, solved, [host]);
    }
    // Moves each joint so its root road ends up where it was before a change.
    function reanchor(sheet, before, joints) {
      const after = solve(sheet);
      for (const joint of joints) {
        const here = attachments(sheet, joint);
        const item = here.find(i => i.road.id === joint.root && before.has(`${i.road.id}:${i.e}`))
          ?? here.find(i => before.has(`${i.road.id}:${i.e}`));
        if (!item) continue;
        const was = before.get(`${item.road.id}:${item.e}`);
        const now = after.get(`${item.road.id}:${item.e}`);
        joint.x += was.x - now.x;
        joint.y += was.y - now.y;
      }
    }
    // After links or roads leave a joint, each still-linked group keeps its own
    // joint, left where it was.
    function regroup(sheet, joint, before) {
      const here = attachments(sheet, joint);
      if (!here.length) {
        sheet.joints.splice(sheet.joints.indexOf(joint), 1);
        return;
      }
      const results = [joint];
      const remaining = new Map(here.map(item => [item.road.id, item]));
      let first = true;
      while (remaining.size) {
        const rootId = remaining.has(joint.root) ? joint.root : remaining.keys().next().value;
        const group = new Set([rootId]);
        remaining.delete(rootId);
        for (let grew = true; grew;) {
          grew = false;
          for (const { a, b } of joint.links) {
            for (const [from, to] of [[a, b], [b, a]]) {
              if (group.has(from) && remaining.has(to)) {
                group.add(to);
                remaining.delete(to);
                grew = true;
              }
            }
          }
        }
        const rootItem = here.find(item => item.road.id === rootId);
        const at = before.get(`${rootId}:${rootItem.e}`);
        const target = first ? joint : newJoint(sheet, at, rootId, joint.dir && { ...joint.dir });
        if (!first) results.push(target);
        Object.assign(target, { x: at.x, y: at.y, root: rootId });
        if (!first) {
          here.filter(item => group.has(item.road.id)).forEach(item => { item.end.joint = target.id; });
          target.links = joint.links.filter(link => group.has(link.a) && group.has(link.b));
          joint.links = joint.links.filter(link => !target.links.includes(link));
        }
        first = false;
      }
      // An end left on its own with no curve set goes back to pulling straight.
      for (const result of results) {
        const alone = attachments(sheet, result);
        if (alone.length === 1 && alone[0].end.length == null) {
          result.dir = null;
          alone[0].end.sign = 1;
        }
      }
      reanchor(sheet, before, results);
    }
    function detach(sheet, road, e) {
      const joint = jointOf(sheet, road.ends[e].joint);
      if (attachments(sheet, joint).length < 2) return;
      const before = solve(sheet);
      const at = before.get(`${road.id}:${e}`);
      joint.links = joint.links.filter(link => link.a !== road.id && link.b !== road.id);
      road.ends[e] = { ...road.ends[e], joint: newJoint(sheet, at, road.id, at.travel).id, sign: 1 };
      regroup(sheet, joint, before);
    }

    const nodeRef = (road, e) => ({ road: road.id, e });
    function curveEnd(ref) {
      const road = roadOf(sheets.selected, ref?.road);
      return road && { road, e: ref.e, end: road.ends[ref.e] };
    }
    function curveLinkFor(road,e) {
      return road.ends[e].curveLink ?? pairOf(sheets.selected,road)?.ends[1-e].curveLink;
    }
    function selectedCurveLink() {
      if (!selectedRoad) return null;
      return selectedLane ? curveLinkFor(selectedRoad,selectedLane.e) : curveLinkFor(selectedRoad,0) ?? curveLinkFor(selectedRoad,1);
    }
    function curveState(ref, solved = solve(sheets.selected), exact = false) {
      const item = curveEnd(ref);
      if (!item) return null;
      const handle = handlePoint(sheets.selected, item.road, item.e, solved);
      const travel = solved.get(`${ref.road}:${ref.e}`).travel ?? travelAt(item.road, item.e, solved);
      return { point: handle.from, travel, length: exact && !solved.get(`${ref.road}:${ref.e}`).travel ? 0 : Math.hypot(handle.at.x-handle.from.x,handle.at.y-handle.from.y) };
    }
    function putCurve(ref, state, movePoint = false) {
      const sheet=sheets.selected, item=curveEnd(ref);
      if (!item) return;
      // An explicit direction applies to this road end and its two-way partner;
      // it does not merge unrelated joints or move a linked node for parallel handles.
      item.end.dir={...state.travel}; item.end.length=state.length;
      const pair=pairOf(sheet,item.road);
      if (pair) {
        pair.ends[1-item.e].dir={x:-state.travel.x,y:-state.travel.y};
        pair.ends[1-item.e].length=state.length;
      }
      if (movePoint) {
        const at=solve(sheet).get(`${ref.road}:${ref.e}`), joint=jointOf(sheet,item.end.joint);
        joint.x+=state.point.x-at.x; joint.y+=state.point.y-at.y;
      }
    }
    function syncCurve(ref, movePoint = false) {
      const sheet=sheets.selected;
      let item=curveEnd(ref), link=item?.end.curveLink;
      if(!link&&item) {
        const partner=pairOf(sheet,item.road);
        if(partner){ref=nodeRef(partner,1-item.e);item=curveEnd(ref);link=item.end.curveLink;}
      }
      if (!curveLinks.valid(link) || (movePoint && link.mode!=="mirror")) return;
      const peer=curveLinks.members(sheet,link.id).find(p=>p.end!==item.end);
      if (!peer) return;
      const state=curveState(ref,solve(sheet),link.mode==="mirror"), sign=link.mode==="mirror"?(ref.e===peer.e?1:-1):link.polarity*peer.end.curveLink.polarity;
      const reflected=link.mode === "mirror" || link.rotation === "opposite";
      const travel=reflected ? curveLinks.reflectVector(state.travel,link.axis) : state.travel;
      putCurve(nodeRef(peer.road,peer.e), {
        point:link.mode === "mirror" ? curveLinks.reflectPoint(state.point,link.axis) : state.point,
        travel:{x:travel.x*sign,y:travel.y*sign}, length:state.length
      },link.mode === "mirror");
    }
    function beginCurvePick(node, mode) {
      drawing=null; snapTarget=null;
      selectedRoad=node.road; selectedLane={e:node.e,lane:node.lane};
      curvePick={source:nodeRef(node.road,node.e),mode};
      keepSymmetric.checked=true;
      curveRotation.value="same";
      render();
    }
    function cancelCurvePick() { curvePick=null; render(); }
    function pickCurveNode(node) {
      if (!curvePick || curvePick.target) return;
      const source=curveEnd(curvePick.source), sheet=sheets.selected;
      if (!source) return cancelCurvePick();
      if (source.road===node.road && source.e===node.e) {
        curveStatus.textContent="Choose a different road end."; return;
      }
      if (pairOf(sheet,source.road)===node.road) {
        curveStatus.textContent="These ends already belong to the same two-way road."; return;
      }
      if (curvePick.mode === "mirror") {
        if (source.road===node.road || source.road.ends.some(a=>node.road.ends.some(b=>a.joint===b.joint))) {
          curveStatus.textContent="Choose a separate road without a shared joint to mirror onto."; return;
        }
        curvePick.target=nodeRef(node.road,node.e);
        curvePick.axis=[];
        render(); return;
      }
      const target=nodeRef(node.road,node.e), a=curveState(curvePick.source), b=curveState(target);
      curveLinks.unlink(sheet,source.end.curveLink); curveLinks.unlink(sheet,node.road.ends[node.e].curveLink);
      const id=crypto.randomUUID(), polarity=a.travel.x*b.travel.x+a.travel.y*b.travel.y<0?-1:1;
      const rotation=curveRotation.value, axis=[{x:0,y:0},{...a.travel}];
      source.end.curveLink={id,mode:"parallel",polarity:1,rotation,axis};
      node.road.ends[node.e].curveLink={id,mode:"parallel",polarity,rotation,axis:structuredClone(axis)};
      openCurves.add(`${source.road.id}:${source.e}`);
      syncCurve(curvePick.source);
      curvePick=null; changed();
    }
    function snapCurveAxis(p, q) {
      const dx=Math.abs(p.x-q.x),dy=Math.abs(p.y-q.y);
      if (dx<dy*.12) return {x:q.x,y:p.y};
      if (dy<dx*.12) return {x:p.x,y:q.y};
      return p;
    }
    function editCurveAxis(ref) {
      let item=curveEnd(ref), link=item?.end.curveLink;
      if(!link&&item){const partner=pairOf(sheets.selected,item.road);if(partner){ref=nodeRef(partner,1-item.e);item=curveEnd(ref);link=item.end.curveLink;}}
      if (link?.mode!=="mirror") return;
      const peer=curveLinks.members(sheets.selected,link.id).find(p=>p.end!==item.end);
      if (!peer) return;
      selectedRoad=item.road;
      const ids=new Set();
      const refs=[];
      for(const road of sheets.selected.roads)for(const [e,end]of road.ends.entries()) {
        if(!end.curveLink || (link.set ? end.curveLink.set!==link.set : end.curveLink.id!==link.id) || ids.has(end.curveLink.id))continue;
        ids.add(end.curveLink.id);
        const members=curveLinks.members(sheets.selected,end.curveLink.id);
        const driver=members.find(p=>p.end.curveLink.role===link.role)??members.find(p=>p.road===item.road)??members[0];
        const other=members.find(p=>p!==driver);
        if(driver&&other)refs.push({source:nodeRef(driver.road,driver.e),target:nodeRef(other.road,other.e)});
      }
      curvePick={source:ref,target:nodeRef(peer.road,peer.e),refs,mode:"mirror",axis:structuredClone(link.axis)};
      keepSymmetric.checked=true;
      render();
    }
    function mirrorRefs(pick) {
      if(pick.refs)return pick.refs;
      return [0,1].map(e=>({source:{road:pick.source.road,e},target:{road:pick.target.road,e:pick.target.e===pick.source.e?e:1-e}}));
    }
    function applyCurveMirror() {
      if (!curvePick?.target || curvePick.axis?.length!==2) return;
      const pick=curvePick, sheet=sheets.selected, axis=structuredClone(pick.axis);
      const refs=mirrorRefs(pick), solved=solve(sheet);
      // Capture both source controls before changing any destination joint.
      const states=refs.map(({source})=>curveState(source,solved,true));
      for (const {source,target} of refs) {
        curveLinks.unlink(sheet,curveEnd(source)?.end.curveLink);
        curveLinks.unlink(sheet,curveEnd(target)?.end.curveLink);
      }
      const set=crypto.randomUUID();
      refs.forEach(({source,target},i)=>{
        const state=states[i], polarity=source.e===target.e?1:-1;
        const travel=curveLinks.reflectVector(state.travel,axis);
        putCurve(target,{point:curveLinks.reflectPoint(state.point,axis),travel:{x:travel.x*polarity,y:travel.y*polarity},length:state.length},true);
        if (keepSymmetric.checked) {
          const id=crypto.randomUUID();
          curveEnd(source).end.curveLink={id,set,role:"a",mode:"mirror",polarity:1,axis:structuredClone(axis)};
          curveEnd(target).end.curveLink={id,set,role:"b",mode:"mirror",polarity,axis:structuredClone(axis)};
        }
      });
      curvePick=null; changed();
    }
    function updateCurveFields() {
      const link=selectedCurveLink();
      curveFields.hidden=!curvePick && !link;
      const mirror=curvePick?.mode==="mirror";
      document.getElementById("curveRotationRow").hidden=curvePick ? curvePick.mode!=="parallel" : link?.mode!=="parallel";
      if (!curvePick && link?.mode==="parallel") curveRotation.value=link.rotation??"same";
      document.getElementById("keepSymmetricRow").hidden=!mirror;
      applyMirrorButton.hidden=!mirror;
      applyMirrorButton.disabled=!curvePick?.target || curvePick.axis?.length!==2;
      editAxisButton.hidden=Boolean(curvePick) || link?.mode!=="mirror";
      unlinkCurveButton.hidden=Boolean(curvePick) || !link;
      cancelCurveButton.hidden=!curvePick;
      curveStatus.textContent=curvePick ? (!curvePick.target
        ? (mirror ? "Choose the corresponding end of the road to mirror onto." : "Choose another node to link its curve handle. Escape cancels.")
        : curvePick.axis?.length===2 ? "Preview ready. Apply Mirror or press Enter. Click two new points to change the symmetry line."
          : curvePick.axis?.length===1 ? "Click the second point of the symmetry line. Horizontal and vertical lines snap." : "Click two points to set the symmetry line. Escape cancels.")
        : link?.mode==="mirror" ? "Symmetric curves. Editing either side updates the other." : link?.rotation==="opposite" ? "Linked handles turn in opposite directions and share length. Nodes move independently." : "Linked handles turn together and share length. Nodes move independently.";
    }
    function drawCurveGuides(sheet, solved) {
      curveGuide.replaceChildren();
      if (!sheet || !solved) return;
      const line=(points,cls="roadControlLine")=>{
        const el=document.createElementNS(SVG,"polyline"); el.setAttribute("class",cls);
        el.setAttribute("points",points.map(p=>{const q=sheets.toScreen(p);return `${q.x},${q.y}`;}).join(" "));
        el.setAttribute("fill","none");el.setAttribute("stroke-dasharray","6 5");curveGuide.append(el);
      };
      const link=selectedCurveLink();
      if (!curvePick && curveLinks.valid(link)) {
        const peers=curveLinks.members(sheet,link.id);
        line(peers.map(p=>handlePoint(sheet,p.road,p.e,solved).at));
        if (link.mode==="mirror") line(link.axis);
      }
      if (!curvePick?.target) return;
      const axis=curvePick.axis?.length===1 && curvePick.cursor ? [curvePick.axis[0],curvePick.cursor] : curvePick.axis;
      if (axis?.length!==2 || Math.hypot(axis[1].x-axis[0].x,axis[1].y-axis[0].y)<1) return;
      line(axis);
      const source=curveEnd(curvePick.source);
      if (source) line(centerline(source.road,solved).map(p=>curveLinks.reflectPoint(p,axis)));
    }
    curveRotation.addEventListener("change",()=>{
      if (curvePick) return;
      const link=selectedCurveLink();
      if (link?.mode!=="parallel") return;
      const members=curveLinks.members(sheets.selected,link.id);
      if (members.length!==2) return;
      const a=curveState(nodeRef(members[0].road,members[0].e)),b=curveState(nodeRef(members[1].road,members[1].e));
      const sign=members[0].end.curveLink.polarity*members[1].end.curveLink.polarity;
      const sum={x:a.travel.x+b.travel.x*sign,y:a.travel.y+b.travel.y*sign};
      const bisector=Math.hypot(sum.x,sum.y)>1e-6?unit(sum):{x:-a.travel.y,y:a.travel.x};
      for (const {end} of members) { end.curveLink.rotation=curveRotation.value; end.curveLink.axis=[{x:0,y:0},bisector]; }
      changed();
    });
    applyMirrorButton.addEventListener("click",applyCurveMirror);
    cancelCurveButton.addEventListener("click",cancelCurvePick);
    unlinkCurveButton.addEventListener("click",()=>{curveLinks.unlink(sheets.selected,selectedCurveLink());changed();});
    editAxisButton.addEventListener("click",()=>{
      const link=selectedCurveLink(), member=curveLinks.members(sheets.selected,link?.id).find(p=>p.road===selectedRoad||pairOf(sheets.selected,p.road)===selectedRoad);
      if (member) editCurveAxis(nodeRef(member.road,member.e));
    });

    function handlePoint(sheet, road, e, solved) {
      const line = centerline(road, solved);
      const from = endOf(line, e);
      const other = endOf(line, 1 - e);
      const travel = solved.get(`${road.id}:${e}`).travel ?? travelAt(road, e, solved);
      const length = road.ends[e].length ?? Math.hypot(other.x - from.x, other.y - from.y) / 3;
      const away = e ? -1 : 1;
      return { from, at: { x: from.x + travel.x * length * away, y: from.y + travel.y * length * away } };
    }

    addButton.addEventListener("click", () => (drawing ? stopDrawing() : startDrawing()));
    elementToAdd.addEventListener('change',updateAddElement);
    addElement.addEventListener('click',()=>{
      document.getElementById(elementCommands[elementToAdd.value]).click();
      updateAddElement();
    });
    deleteButton.addEventListener("click", deleteRoad);
    autoTapersInput.addEventListener("change", () => {
      if (!sheets.selected) return;
      sheets.selected.autoTapers = autoTapersInput.checked;
      changed();
    });
    // Deleting a two-way road deletes both sides.
    function deleteRoad() {
      const sheet = sheets.selected;
      if (!sheet?.roads || !selectedRoad) return;
      removeRoads(sheet, [selectedRoad, pairOf(sheet, selectedRoad)].filter(Boolean));
      selectedRoad = null;
      selectedLane = null;
      changed();
    }
    function removeRoads(sheet, roads) {
      const before = solve(sheet);
      const ids = roads.map(road => road.id);
      sheet.vehicleSpawns = (sheet.vehicleSpawns ?? []).filter(spawn => !ids.includes(spawn.road));
      for (const spawn of sheet.vehicleSpawns) spawn.routes = (spawn.routes ?? []).filter(route => !ids.includes(route.exit.road));
      sheet.roads = sheet.roads.filter(road => !ids.includes(road.id));
      const joints = new Set(roads.flatMap(road => road.ends.map(end => jointOf(sheet, end.joint))).filter(Boolean));
      for (const joint of joints) {
        joint.links = joint.links.filter(link => !ids.includes(link.a) && !ids.includes(link.b));
        regroup(sheet, joint, before);
      }
    }
    function setTaper(changes) {
      if (!selectedRoad || !selectedLane) return;
      const key = `${selectedLane.e}:${selectedLane.lane}`;
      const keys = [key];
      // Adjacent lanes tapering at the same end share the length edit. Keep
      // mode changes per lane, and stop at any lane that stays full width.
      if (changes.length != null) {
        const sheet = sheets.selected;
        const tapers = tapersOf(sheet, selectedRoad, solve(sheet));
        if (tapers.has(key)) {
          for (const step of [-1, 1]) {
            for (let lane = selectedLane.lane + step; lane >= 0 && lane < selectedRoad.lanes; lane += step) {
              const adjacent = `${selectedLane.e}:${lane}`;
              if (!tapers.has(adjacent)) break;
              keys.push(adjacent);
            }
          }
        }
      }
      selectedRoad.tapers ??= {};
      for (const taperKey of keys) {
        selectedRoad.tapers[taperKey] = { mode: "auto", length: DEFAULT_TAPER_FEET, ...selectedRoad.tapers[taperKey], ...changes };
      }
      changed();
    }
    taperSelect.addEventListener("change", () => setTaper({ mode: taperSelect.value }));
    taperLength.addEventListener("input", () => {
      const feet = Number(taperLength.value);
      if (feet >= MIN_TAPER_FEET && feet <= MAX_TAPER_FEET) setTaper({ length: feet });
    });
    taperLength.addEventListener("change", () => {
      taperLength.value = selectedRoad?.tapers?.[`${selectedLane?.e}:${selectedLane?.lane}`]?.length ?? DEFAULT_TAPER_FEET;
    });
    document.getElementById('roadCurveType').addEventListener('change',event=>{if(selectedRoad){delete selectedRoad.arcJoinFit;delete selectedRoad.arcJoinRadius;}setRoadCurve(selectedRoad,event.target.value==='freeform'?null:fitCurve(selectedRoad,event.target.value),true,event.target.value);});
    document.getElementById('roadArcFit').addEventListener('change',event=>setArcJoinFit(selectedRoad,event.target.checked));
    for(const id of ['roadArcAngle','roadArcAngleValue'])document.getElementById(id).addEventListener('input',event=>{
      const value=event.target.valueAsNumber;
      if(selectedRoad&&Number.isFinite(value)&&Math.abs(value)<=360){
        if(solve(sheets.selected).arcFits?.has(selectedRoad.id))return;
        setRoadCurve(selectedRoad,value,true,selectedRoad.clothoid?'clothoid':'arc');
      }
    });
    document.getElementById('roadArcRadius').addEventListener('input',event=>{
      const radius=event.target.valueAsNumber,sheet=sheets.selected;
      if(!selectedRoad||!Number.isFinite(radius)||radius<=0)return;
      const solved=solve(sheet);
      if(solved.arcFits?.has(selectedRoad.id)){
        if(radius<selectedRoad.lanes*selectedRoad.laneWidth/2+1/12)return;
        const G=window.StripeMaker.circularArc,fit=solved.arcFits.get(selectedRoad.id);
        if(!G.fitCurves(...fit.hostCurves.map(G.laneCurve),feetToPixels(sheet,radius),selectedRoad.arcAngle))return;
        selectedRoad.arcJoinRadius=radius;changed();return;
      }
      /* SIGNMAKER */ if(diagrammaticSetArc(sheet,selectedRoad,selectedRoad.arcAngle,feetToPixels(sheet,radius))){syncRoadCurves(sheet);changed();return;}
      const {a,b}=curveOf(sheet,selectedRoad,solved),half=Math.hypot(b.x-a.x,b.y-a.y)*sheet.inchesPerPixel/24;
      if(selectedRoad.arcLoop){selectedRoad.arcLoop.radius=feetToPixels(sheet,radius);syncRoadCurves(sheet);changed();return;}
      if(radius<half)return;
      let angle=2*Math.asin(Math.min(1,half/radius))*180/Math.PI;
      if(Math.abs(selectedRoad.arcAngle)>180)angle=360-angle;
      setRoadCurve(selectedRoad,(selectedRoad.arcAngle<0?-1:1)*angle);
    });
    document.getElementById('roadArcRadius').addEventListener('change',event=>{
      const fit=selectedRoad&&solve(sheets.selected).arcFits?.get(selectedRoad.id);
      if(fit)event.target.value=Number((fit.radius*sheets.selected.inchesPerPixel/12).toFixed(3));
    });
    function bindNumber(input, key, min, max, round) {
      input.addEventListener("input", () => {
        const value = round(Number(input.value));
        if (!(value >= min && value <= max)) return;
        defaults[key] = value;
        if (selectedRoad) {
          const oldWidth = selectedRoad.laneWidth;
          selectedRoad[key] = value;
          // Both sides of a two-way road share a lane width.
          const partner = key === "laneWidth" && pairOf(sheets.selected, selectedRoad);
          if (partner) partner.laneWidth = value;
          if (key === "laneWidth") for (const road of [selectedRoad, partner].filter(Boolean)) {
            if (road.centerlineTransition) for (const key of ['start','end'])
              road.centerlineTransition[key] = road.centerlineTransition[key].map(width => width * value / oldWidth);
            delete road.widthProfiles;
          }
          changed();
        } else render();
      });
      input.addEventListener("change", () => {
        input.value = (selectedRoad ?? defaults)[key];
      });
    }
    bindNumber(lanesInput, "lanes", 1, MAX_LANES, Math.round);
    bindNumber(widthInput, "laneWidth", MIN_LANE_WIDTH, MAX_LANE_WIDTH, value => Math.round(value * 2) / 2);

    // The nearest point on a road's edge line within `radius`, away from the road's
    // ends (where lane nodes are). A new road started or ended there branches off
    // the road as a split or merge.
    function snapEdge(sheet, solved, point, radius, exclude = []) {
      let best = null;
      for (const road of sheet.roads) {
        if (exclude.includes(road)) continue;
        const shape = shapeOf(sheet, road, solved);
        const clear = feetToPixels(sheet, road.laneWidth);
        // A two-way road's left edges are its centerline, so only its outer edges snap.
        for (const [side, k] of pairOf(sheet, road) ? [["R", road.lanes]] : [["L", 0], ["R", road.lanes]]) {
          const edge = boundary(shape, k);
          const total = polylineLength(edge);
          let walked = 0;
          for (let i = 0; i < edge.length - 1; i++) {
            const p = edge[i];
            const q = edge[i + 1];
            const length = Math.hypot(q.x - p.x, q.y - p.y);
            const f = length ? Math.max(0, Math.min(1, ((point.x - p.x) * (q.x - p.x) + (point.y - p.y) * (q.y - p.y)) / (length * length))) : 0;
            const at = { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
            const distance = Math.hypot(at.x - point.x, at.y - point.y);
            const along = walked + length * f;
            walked += length;
            if (distance > radius || along < clear || along > total - clear || (best && distance >= best.distance)) continue;
            // The center of the lane along this edge, for lanes fed straight into it.
            const lane = side === "R" ? road.lanes - 1 : 0;
            const centers = offset(shape.line, n => (shape.laneBounds[n][lane][0] + shape.laneBounds[n][lane][1]) / 2);
            const center = { x: centers[i].x + (centers[i + 1].x - centers[i].x) * f,
              y: centers[i].y + (centers[i + 1].y - centers[i].y) * f };
            best = { road, side, t: (i + f) / (edge.length - 1), x: at.x, y: at.y, center, distance, edge: true };
          }
        }
      }
      return best;
    }
    // Cuts a road in two at curve parameter `t`, keeping its shape (de Casteljau),
    // on a new joint where the two parts stay joined lane to lane. A two-way road is
    // cut on both sides. Returns the joint and the part after the cut.
    function cutRoad(sheet, road, t) {
      const solved = solve(sheet);
      const partner = pairOf(sheet, road);
      // Widths use arc length, while the Bézier split uses its parameter.
      const line = shapeOf(sheet, road, solved).line;
      const lengths = [0];
      for (let i = 1; i < line.length; i++) lengths.push(lengths[i-1] + Math.hypot(line[i].x-line[i-1].x, line[i].y-line[i-1].y));
      const pos = t * (line.length - 1), lo = Math.floor(pos), hi = Math.min(line.length - 1, lo + 1);
      const fraction = lengths.at(-1) ? (lengths[lo] + (lengths[hi]-lengths[lo]) * (pos-lo)) / lengths.at(-1) : t;
      const widths = window.StripeMaker.roadWidths.splitWidths(sheet, road, fraction);
      const gaps=window.StripeMaker.roadWidths.splitGaps(sheet,road,fraction);
      const oppositeGaps=partner&&window.StripeMaker.roadWidths.splitGaps(sheet,partner,1-fraction);
      const oppositeWidths = partner && window.StripeMaker.roadWidths.splitWidths(sheet, partner, 1-fraction);
      const { a, c0, c1, b } = curveOf(sheet, road, solved);
      const lerp = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      const p01 = lerp(a, c0);
      const p12 = lerp(c0, c1);
      const p23 = lerp(c1, b);
      const p012 = lerp(p01, p12);
      const p123 = lerp(p12, p23);
      const arc=curveAngle(road)!=null?curveGeometry(road,a,b):null;
      const m = arc?arc.point(t):lerp(p012, p123);
      const distance = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
      const pulls = { start: a.travel ? distance(a, p01) : null, before: distance(p012, m), after: distance(m, p123), end: b.travel ? distance(p23, b) : null };
      const direction = arc?arc.point(t).tangent:unit(distance(p012, p123) > 1e-6 ? { x: p123.x - p012.x, y: p123.y - p012.y } : { x: b.x - a.x, y: b.y - a.y });
      let jointPoint = m;
      if (road.centerlineTransition && partner?.centerlineTransition) {
        const width = (r, f) => Array.from({length:r.lanes}, (_, lane) => window.StripeMaker.roadWidths.laneAt(sheet,r,lane,f)).reduce((a,b)=>a+b,0);
        const shift = feetToPixels(sheet, (width(partner,1-fraction)-width(road,fraction))/2), normal = rightOf(direction);
        jointPoint = {x:m.x+normal.x*shift,y:m.y+normal.y*shift};
      }
      const joint = newJoint(sheet, jointPoint, road.id, direction);
      const rename = (at, from, to) => {
        for (const spawn of sheet.vehicleSpawns ?? []) {
          for (const route of spawn.routes ?? []) if (route.exit.road === from && (route.exit.e ?? 1) === 1) route.exit.road = to;
          if (spawn.road === from && (spawn.e ?? 0) === 1) spawn.road = to;
        }
        const far = jointOf(sheet, at);
        far.links.forEach(link => {
          if (link.a === from) link.a = to;
          if (link.b === from) link.b = to;
        });
        if (far.root === from) far.root = to;
        openCurves.delete(`${from}:1`);
      };
      // The far end's tapers travel with the part after the cut.
      const split = (from, to) => {
        if(from.arcAngle!=null){const f=from===road?t:1-t,angle=from.arcAngle;from.arcAngle=angle*f;to.arcAngle=angle*(1-f);delete from.arcLoop;delete to.arcLoop;}
        if(from.clothoid)[from.clothoid,to.clothoid]=window.StripeMaker.clothoid.split(from.clothoid,from===road?t:1-t);
        if (from.centerlineTransition) {
          const profile = from.centerlineTransition, f = from === road ? fraction : 1-fraction;
          const middle = profile.start.map((w, lane) => w + (profile.end[lane] - w) * f);
          to.centerlineTransition = {start: middle.slice(), end: profile.end.slice()};
          from.centerlineTransition = {start: profile.start.slice(), end: middle};
        }
        to.tapers = Object.fromEntries(Object.entries(from.tapers ?? {}).filter(([key]) => key.startsWith("1:")));
        from.tapers = Object.fromEntries(Object.entries(from.tapers ?? {}).filter(([key]) => !key.startsWith("1:")));
      };
      const piece = (from, ends) => {
        const made = { id: nextId(sheet.roads), lanes: from.lanes, laneWidth: from.laneWidth, ends };
        sheet.roads.push(made);
        return made;
      };
      const after = piece(road, [{ joint: joint.id, sign: 1, length: pulls.after }, { ...road.ends[1], length: pulls.end }]);
      rename(road.ends[1].joint, road.id, after.id);
      split(road, after);
      [road.widthProfiles, after.widthProfiles] = widths;
      if(Object.keys(gaps[0]).length)[road.gapProfiles,after.gapProfiles]=gaps;
      road.ends[0].length = pulls.start;
      road.ends[1] = { joint: joint.id, sign: 1, length: pulls.before };
      joint.links.push({ a: road.id, ai: 0, b: after.id, bi: 0 });
      let back = null;
      if (partner) {
        const median = pairLinks(sheet, road, partner)[0]?.median ?? 0;
        back = piece(partner, [{ joint: joint.id, sign: -1, length: pulls.before }, { ...partner.ends[1], length: pulls.start }]);
        rename(partner.ends[1].joint, partner.id, back.id);
        split(partner, back);
        [partner.widthProfiles, back.widthProfiles] = oppositeWidths;
        if(Object.keys(oppositeGaps[0]).length)[partner.gapProfiles,back.gapProfiles]=oppositeGaps;
        partner.ends[0].length = pulls.end;
        partner.ends[1] = { joint: joint.id, sign: -1, length: pulls.after };
        joint.links.push({ a: partner.id, ai: 0, b: back.id, bi: 0 }, { a: road.id, ai: 0, b: back.id, bi: 0, pair: true, median });
      }
      return { joint, after };
    }
    // Joins end `e` of a new road to the edge line it was drawn onto: the edge's road
    // is cut there, and the new road sits beside it, edge line on edge line.
    function attachToEdge(sheet, road, e, point) {
      const target = snapEdge(sheet, solve(sheet), point, 1 / sheet.view.scale + 0.5, [road]);
      if (!target) return;
      const { joint, after } = cutRoad(sheet, target.road, target.t);
      const own = jointOf(sheet, road.ends[e].joint);
      const solved = solve(sheet);
      const sign = dot(travelAt(road, e, solved), joint.dir) < 0 ? -1 : 1;
      road.ends[e] = { ...road.ends[e], joint: joint.id, sign };
      if (!attachments(sheet, own).length) sheet.joints.splice(sheet.joints.indexOf(own), 1);
      // The new road's edge that faces the cut road: its left edge when it's on the
      // right going the same way, and so on.
      const facing = (target.side === "R") === (sign === 1) ? "L" : "R";
      joint.links.push({ a: after.id, ai: target.side, b: road.id, bi: facing });
    }
    // Joins a dragged lane end head-on to the lane along an edge line: the edge's
    // road is cut there and the dragged lane carries straight into (or out of) its
    // outermost lane, like a ramp feeding the edge lane. Everything joined at the
    // dragged end comes along, as with lane-to-lane joins.
    function feedEdge(sheet, road, e, lane, edgePoint) {
      const moving = jointOf(sheet, road.ends[e].joint);
      const target = snapEdge(sheet, solve(sheet), edgePoint, 1 / sheet.view.scale + 0.5, attachments(sheet, moving).map(item => item.road));
      if (!target) return;
      const { joint, after } = cutRoad(sheet, target.road, target.t);
      const solved = solve(sheet);
      for (const item of attachments(sheet, moving)) {
        item.end.sign = dot(travelAt(item.road, item.e, solved), joint.dir) < 0 ? -1 : 1;
        item.end.joint = joint.id;
      }
      joint.links.push(...moving.links, { a: after.id, ai: target.side === "R" ? after.lanes - 1 : 0, b: road.id, bi: lane, feed: true });
      sheet.joints.splice(sheet.joints.indexOf(moving), 1);
    }

    // While drawing, points snap to lane nodes so the new road joins them, or to a
    // road's edge line to branch off it (one-way roads only).
    let drawingPointer=null;
    function drawingPoint(sheet, clientX, clientY, direct=false) {
      drawingPointer={clientX,clientY};
      const point = sheets.toImage(clientX, clientY);
      // BEGIN SIGNMAKER DRAWING DIRECTION
      const anchor=window.StripeMaker.diagrammatic&&(drawing.start||drawing.end);
      if(anchor){
        const dx=point.x-anchor.x,dy=point.y-anchor.y;
        const angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,length=Math.hypot(dx,dy);
        point.x=anchor.x+Math.cos(angle)*length;point.y=anchor.y+Math.sin(angle)*length;
      }
      // END SIGNMAKER DRAWING DIRECTION
      const solved = solve(sheet);
      const e = drawing.start ? 1 : drawing.end ? 0 : window.StripeMaker.traffic.reversed ? 1 : 0;
      snapTarget = snapLane(sheet, solved, point, e);
      snapTarget ??= drawingDefaults().opposite ? null : snapEdge(sheet, solved, point, SNAP_PIXELS / sheet.view.scale);
      if(snapTarget?.edge&&direct)snapTarget={...snapTarget,direct:true,
        edgePoint:{x:snapTarget.x,y:snapTarget.y},x:snapTarget.center.x,y:snapTarget.center.y};
      // BEGIN SIGNMAKER DRAWING TARGET
      if(anchor&&snapTarget?.edge&&!snapTarget.direct){
        const edge=boundary(shapeOf(sheet,snapTarget.road,solved),snapTarget.side==='R'?snapTarget.road.lanes:0);
        const ray={x:point.x-anchor.x,y:point.y-anchor.y},cross=(a,b)=>a.x*b.y-a.y*b.x;
        let best=null;
        for(let i=1;i<edge.length;i++){
          const p=edge[i-1],v={x:edge[i].x-p.x,y:edge[i].y-p.y},den=cross(ray,v);
          if(Math.abs(den)<1e-9)continue;
          const delta={x:p.x-anchor.x,y:p.y-anchor.y},t=cross(delta,v)/den,u=cross(delta,ray)/den;
          if(t<0||u<0||u>1)continue;
          const at={x:anchor.x+ray.x*t,y:anchor.y+ray.y*t},distance=Math.hypot(at.x-point.x,at.y-point.y);
          if(distance<=SNAP_PIXELS/sheet.view.scale&&(!best||distance<best.distance))best={...at,distance};
        }
        if(best)snapTarget=snapEdge(sheet,solved,best,1e-5);
      }
      if(anchor&&snapTarget){
        const dx=point.x-anchor.x,dy=point.y-anchor.y,length=Math.hypot(dx,dy);
        const tx=snapTarget.x-anchor.x,ty=snapTarget.y-anchor.y;
        // Joining must not pull the endpoint away from the chosen 45-degree ray.
        if(length<1e-9||Math.abs(dx*ty-dy*tx)/length>1e-6||dx*tx+dy*ty<0)snapTarget=null;
      }
      // END SIGNMAKER DRAWING TARGET
      return snapTarget ? { x: snapTarget.x, y: snapTarget.y, target: snapTarget } : point;
    }

    for(const type of ["keydown","keyup"])window.addEventListener(type,event=>{
      if(event.key!=="Shift"||!drawing||!drawingPointer||!active()||!sheets.selected?.inchesPerPixel)return;
      const point=drawingPoint(sheets.selected,drawingPointer.clientX,drawingPointer.clientY,type==="keydown");
      if(drawing.start||drawing.end)drawing.cursor=point;
      render();
    });

    // A click (not a pan) places road points while drawing, otherwise selects a road.
    let press = null;
    workspace.addEventListener("pointerdown", event => {
      if (event.isPrimary) press = { x: event.clientX, y: event.clientY };
    });
    workspace.addEventListener("pointermove", event => {
      const sheet = sheets.selected;
      if (!drawing || event.buttons || !sheet?.inchesPerPixel || !active()) return;
      const point = drawingPoint(sheet, event.clientX, event.clientY, event.shiftKey);
      if (drawing.start || drawing.end) drawing.cursor = point;
      renderPreviewSoon();
    });
    workspace.addEventListener("contextmenu", event => {
      const sheet = sheets.selected;
      if (!active() || drawing || !sheet?.inchesPerPixel || event.defaultPrevented) return;
      const point = sheets.toImage(event.clientX, event.clientY);
      const road = roadAt(sheet, point);
      if (!road) return;
      const button = nodeButtons.get(`${road.id}:0:0`);
      if (!button) return;
      event.preventDefault();
      openMenu(button, point);
    });
    workspace.addEventListener("click", event => {
      if (!curvePick || event.target.closest("button, input, select")) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!curvePick.target) return;
      if (press && Math.hypot(event.clientX-press.x,event.clientY-press.y)>4) return;
      const p = sheets.toImage(event.clientX, event.clientY);
      if (!curvePick.axis?.length || curvePick.axis.length === 2) curvePick.axis = [p];
      else {
        const q = snapCurveAxis(p, curvePick.axis[0]);
        if (Math.hypot(q.x-curvePick.axis[0].x,q.y-curvePick.axis[0].y)<1) return;
        curvePick.axis.push(q);
      }
      render();
    }, true);
    workspace.addEventListener("pointermove", event => {
      if (!curvePick?.target || curvePick.axis?.length !== 1) return;
      curvePick.cursor = snapCurveAxis(sheets.toImage(event.clientX,event.clientY),curvePick.axis[0]);
      drawCurveGuides(sheets.selected, solve(sheets.selected));
    });
    workspace.addEventListener("click", event => {
      const sheet = sheets.selected;
      if (!active() || !sheet?.inchesPerPixel || !press || event.target.closest(".roadNode, .roadControl")) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) return;
      if (!drawing) return selectRoad(roadAt(sheet, sheets.toImage(event.clientX, event.clientY)));
      layerFor(sheet);
      const point = drawingPoint(sheet, event.clientX, event.clientY, event.shiftKey);
      if (!drawing.start && !drawing.end) {
        drawing[window.StripeMaker.traffic.reversed ? 'end' : 'start'] = point;
        drawing.cursor = point;
        return render();
      }
      const [start, end] = drawing.start ? [drawing.start, point] : [point, drawing.end];
      if (Math.hypot(end.x - start.x, end.y - start.y) * sheet.view.scale < 4) return;
      const values = drawingDefaults();
      // Stems start as circular arcs (straight until bent).
      const road = { id: nextId(sheet.roads), lanes: values.lanes, laneWidth: values.laneWidth, arcAngle: 0, ends: [] };
      road.ends = [start, end].map(p => ({ joint: newJoint(sheet, p, road.id).id, sign: 1, length: null }));
      sheet.roads.push(road);
      // A new road lines its matching lane up with the lane it was drawn from or to.
      [start, end].forEach((p, e) => {
        if(p.target?.edge&&p.target.direct)feedEdge(sheet,road,e,
          Math.min(p.target.side==="R"?p.target.road.lanes-1:0,road.lanes-1),p.target.edgePoint);
        else if (p.target?.edge) attachToEdge(sheet, road, e, p);
        else if (p.target) connect(sheet, road, e, Math.min(p.target.lane, road.lanes - 1), p.target);
      });
      snapTarget = null;
      // Like Cities: Skylines, each click adds a node: the road carries on from the
      // segment just drawn until a double-click or Esc, or until it joins a lane
      // or edge line. A two-way road carries on from its centerline.
      const nextEnd=drawing.start?1:0,nextPoint=nextEnd?end:start;
      if (drawingAlongTraffic() && !nextPoint.target) {
        const solved = solve(sheet);
        const joint = jointOf(sheet, road.ends[nextEnd].joint);
        const at = solved.get(`${road.id}:${nextEnd}`);
        const anchor = { x: at.x, y: at.y, target: { road, e: nextEnd, lane: 0 } };
        drawing = { start:null,end:null,[nextEnd?'start':'end']:anchor,cursor:anchor,last:road.id };
        selectedRoad = null;
      } else {
        drawing = null;
        selectedRoad = road;
      }
      changed();
    });
    // A double-click finishes the road being drawn (its first click has
    // already placed the last node), and must not trigger the refit.
    workspace.addEventListener("dblclick", event => {
      if (!drawing) return;
      event.preventDefault();
      stopDrawing();
    }, true);
    // Double-clicking a road selects it. With Elements open, double-clicking
    // the road that's already selected splits it in two there.
    workspace.addEventListener("dblclick", event => {
      const sheet = sheets.selected;
      if (event.defaultPrevented || !sheet?.inchesPerPixel || drawing) return;
      if (event.target.closest("button, .roadOverlay *")) return;
      const point = sheets.toImage(event.clientX, event.clientY);
      const road = roadAt(sheet, point);
      if (!road) return;
      event.preventDefault();
      if (active() && road && road === selectedRoad) {
        // Split the road in two where it was double-clicked; the pieces stay joined.
        const line = shapeOf(sheet, road, solve(sheet)).line;
        let best = null;
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i], dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
          const f = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
          const d = Math.hypot(point.x - a.x - dx * f, point.y - a.y - dy * f);
          if (!best || d < best.d) best = { d, t: (i - 1 + f) / (line.length - 1) };
        }
        if (best.t < 0.02 || best.t > 0.98) { hint.textContent = "Double-click farther from the road's ends to split it."; return; }
        const { after } = cutRoad(sheet, road, best.t);
        selectedRoad = after;
        changed();
        hint.textContent = "Road split in two. Drag the new nodes to adjust either part.";
        return;
      }
      window.StripeMaker.showEditor("elementsEditor");
      selectRoad(road);
    }, true);

    // Lane nodes: dragging moves the road's whole end (and everything joined to it);
    // dropping onto another lane's node joins them.
    function nudgeKeys(button, move) {
      button.addEventListener("keydown", event => {
        const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!moves[event.key] || !sheets.selected) return;
        event.preventDefault();
        event.stopPropagation();
        const step = (event.shiftKey ? 10 : 1) / sheets.selected.view.scale;
        if (move(moves[event.key][0] * step, moves[event.key][1] * step) !== false) changed();
      });
    }
    function nodeTarget(button) {
      const sheet = sheets.selected;
      const road = sheet && roadOf(sheet, Number(button.dataset.road));
      return road && { sheet, road, e: Number(button.dataset.end), lane: Number(button.dataset.lane) };
    }
    // Freeze the axis at pointer-down, so Shift can be pressed or released
    // during the gesture without the constraint chasing the edited geometry.
    function alongDragAxis(point,origin,axis,min=-Infinity) {
      const length=Math.max(min,(point.x-origin.x)*axis.x+(point.y-origin.y)*axis.y);
      return {x:origin.x+axis.x*length,y:origin.y+axis.y*length};
    }
    function bindNode(button) {
      button.addEventListener("pointerdown", event => {
        const node = nodeTarget(button);
        if (!node || drawing) return;
        event.stopPropagation();
        // Right-click (or Control-click) opens the node menu instead of dragging.
        if (event.button !== 0 || event.ctrlKey) return;
        closeMenu();
        if (curvePick) { pickCurveNode(node); return; }
        button.setPointerCapture(event.pointerId);
        const was = selectedRoad?.id;
        selectedRoad = node.road;
        selectedLane = { e: node.e, lane: node.lane };
        // Option/Alt-drag gives this road's end its own joint, pulling it free.
        if (event.altKey) detach(node.sheet, node.road, node.e);
        const solved = solve(node.sheet);
        const dir = jointOf(node.sheet, node.road.ends[node.e].joint).dir;
        drag = { ...node, from: lanePoint(node.sheet, node.road, node.e, node.lane, solved), pointer: sheets.toImage(event.clientX, event.clientY),
          // A fitted mouth moves along its host curve when the joint moves.
          // Reusing that projected point as the next correction feeds fitting
          // back into the drag and moves the road even at a stationary pointer.
          jointOrigin:solved.arcFits?.has(node.road.id)||solved.arcLaneMouths?.has(`${node.road.id}:${node.e}:${node.lane}`)
            ? {x:jointOf(node.sheet,node.road.ends[node.e].joint).x,y:jointOf(node.sheet,node.road.ends[node.e].joint).y}:null,
          axis: unit(node.road.ends[node.e].dir ?? (dir && {x:dir.x*node.road.ends[node.e].sign,y:dir.y*node.road.ends[node.e].sign}) ?? travelAt(node.road,node.e,solved)),
          dir: dir && { ...dir } };
        // Detaching changes the joints, so it redraws everything.
        if (event.altKey) render();
        else drawSheet({ roads: [was, node.road.id] });
        });
      button.addEventListener("pointermove", event => {
        if (!drag || !button.hasPointerCapture(event.pointerId)) return;
        const { sheet, road, e, lane } = drag;
        const pointer = sheets.toImage(event.clientX, event.clientY);
        let wanted = { x: drag.from.x + (pointer.x - drag.pointer.x), y: drag.from.y + (pointer.y - drag.pointer.y) };
        if(event.shiftKey)wanted=alongDragAxis(wanted,drag.from,drag.axis);
        // Lane nodes first, then edge lines, which pull the dragged lane onto
        // the center of the edge lane it will feed.
        const joint = jointOf(sheet, road.ends[e].joint);
        if (drag.dir) joint.dir = { ...drag.dir };
        else delete joint.dir;
        if(drag.jointOrigin){
          joint.x=drag.jointOrigin.x+(wanted.x-drag.from.x);
          joint.y=drag.jointOrigin.y+(wanted.y-drag.from.y);
        }
        const solved = solve(sheet);
        const moving = attachments(sheet, joint).map(item => item.road);
        snapTarget = event.shiftKey ? null : snapLane(sheet, solved, wanted, e, road, lane);
        drag.moved = true;
        const edge = !event.shiftKey && !snapTarget && snapEdge(sheet, solved, wanted, SNAP_PIXELS / sheet.view.scale, [...moving, road]);
        if (edge) snapTarget = { ...edge, x: edge.center.x, y: edge.center.y, edgePoint: { x: edge.x, y: edge.y } };
        const transition = snapTarget?.road && !snapTarget.edge && centerlineTransitionCandidate(sheet, road, e, snapTarget);
        const goal = transition ? lanePoint(sheet, snapTarget.road, snapTarget.e, snapTarget.road.lanes - 1, solved) : snapTarget ?? wanted;
        if(!drag.jointOrigin||snapTarget){
          const current = lanePoint(sheet, road, e, transition ? road.lanes - 1 : lane, solve(sheet));
          joint.x += goal.x - current.x;
          joint.y += goal.y - current.y;
        }
        syncCurve(nodeRef(road, e), true);
        renderSoon({ joints: [joint.id] });
      });
      const finish = event => {
        if (!drag || !button.hasPointerCapture(event.pointerId)) return;
        button.releasePointerCapture(event.pointerId);
        if (snapTarget?.edge && event.type === "pointerup") feedEdge(drag.sheet, drag.road, drag.e, drag.lane, snapTarget.edgePoint);
        else if (snapTarget && event.type === "pointerup") connect(drag.sheet, drag.road, drag.e, drag.lane, snapTarget);
        // Joining roads changes the sheet's structure, so it redraws everything;
        // a plain move redraws the moved roads now and the rest shortly after.
        const moved = !snapTarget && { joints: [drag.road.ends[drag.e].joint] };
        drag = null;
        snapTarget = null;
        changed(moved || null);
      };
      button.addEventListener("pointerup", finish);
      button.addEventListener("pointercancel", finish);
      nudgeKeys(button, (dx, dy) => {
        const node = nodeTarget(button);
        if (!node) return false;
        selectedRoad = node.road;
        const joint = jointOf(node.sheet, node.road.ends[node.e].joint);
        joint.x += dx;
        joint.y += dy;
        syncCurve(nodeRef(node.road, node.e), true);
      });
      button.addEventListener("keydown", event => {
        if (curvePick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault(); event.stopPropagation();
          const node = nodeTarget(button); if (node) pickCurveNode(node);
        }
      });
      // Double-clicking a node shows or hides the curve handle at that end.
      button.addEventListener("dblclick", () => {
        const node = nodeTarget(button);
        if (!node) return;
        if (openCurves.has(`${node.road.id}:${node.e}`)) hideCurve(node);
        else showCurve(node);
      });
      button.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
        const preferred = [...nodeButtons.values()].find(candidate => {
          const target = nodeTarget(candidate);
          const rect = candidate.getBoundingClientRect();
          return target?.road === selectedRoad &&
            (!selectedLane || (target.e === selectedLane.e && target.lane === selectedLane.lane)) &&
            event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        openMenu(preferred ?? button);
      });
      button.addEventListener("keydown", event => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          openMenu(button);
        }
      });
    }
    function showCurve(node) {
      if(curveAngle(node.road)!=null){selectedRoad=node.road;render();document.getElementById('roadArcAngleValue').focus();return;}
      openCurves.add(`${node.road.id}:${node.e}`);
      const solved = solve(node.sheet);
      const joint = jointOf(node.sheet, node.road.ends[node.e].joint);
      const handle = handlePoint(node.sheet, node.road, node.e, solved);
      joint.dir ??= travelAt(node.road, node.e, solved);
      node.road.ends[node.e].length ??= Math.hypot(handle.at.x - handle.from.x, handle.at.y - handle.from.y);
      selectedRoad = node.road;
      syncCurve(nodeRef(node.road,node.e));
      changed();
    }
    function hideCurve(node) {
      openCurves.delete(`${node.road.id}:${node.e}`);
      render();
    }
    // Returns a road end to its default pull; a free end goes straight again.
    function straighten(sheet, road, e) {
      if(curveAngle(road)!=null){setRoadCurve(road,0,true,road.clothoid?'clothoid':'arc');return;}
      const end = road.ends[e];
      curveLinks.unlink(sheet, end.curveLink);
      end.length = null;
      delete end.dir;
      const pair = pairOf(sheet, road);
      if (pair) delete pair.ends[1 - e].dir;
      if (attachments(sheet, jointOf(sheet, end.joint)).length === 1) jointOf(sheet, end.joint).dir = null;
      openCurves.delete(`${road.id}:${e}`);
      changed();
    }

    // Right-clicking a lane node opens a popover of actions for that road end,
    // with a pointer to the node, like a macOS popover.
    function reverseRoad(sheet, road) {
      // Freeze both ends before changing their travel direction. Existing lane
      // links cannot remain end-to-start links after this operation.
      detach(sheet, road, 0);
      detach(sheet, road, 1);
      road.ends.reverse();
      if(road.arcAngle!=null)road.arcAngle=-road.arcAngle;
      if(road.clothoid)road.clothoid={start:-road.clothoid.end,end:-road.clothoid.start};
      if(road.arcLoop)road.arcLoop.heading={x:-road.arcLoop.heading.x,y:-road.arcLoop.heading.y};
      if(road.gapProfiles)road.gapProfiles=Object.fromEntries(Object.entries(road.gapProfiles).map(([k,p])=>[road.lanes-Number(k),{...p,start:p.end,end:p.start,from:1-p.to,to:1-p.from}]));
      road.ends.forEach(end => { end.sign *= -1; });
      road.tapers = Object.fromEntries(Object.entries(road.tapers ?? {}).map(([key, value]) => {
        const [e, lane] = key.split(":").map(Number);
        return [`${1 - e}:${road.lanes - 1 - lane}`, value];
      }));
      openCurves.delete(`${road.id}:0`);
      openCurves.delete(`${road.id}:1`);
      selectedLane = null;
      changed();
    }
    function menuItems(node) {
      const { sheet, road, e, lane } = node;
      const end = road.ends[e];
      const partner = pairOf(sheet, road);
      // A two-way road's own opposite side doesn't count as something to pull free from.
      const joined = attachments(sheet, jointOf(sheet, end.joint)).some(item => item.road !== road && item.road !== partner);
      const curveOpen = openCurves.has(`${road.id}:${e}`);
      const here = { ...lanePoint(sheet, road, e, lane, solve(sheet)), target: { road, e, lane } };
      const taper = road.tapers?.[`${e}:${lane}`]?.mode ?? "auto";
      const setTaperMode = mode => () => {
        selectedRoad = road;
        selectedLane = { e, lane };
        setTaper({ mode });
      };
      return [
        ...(window.StripeMaker.diagrammaticOrder ? [
          {label:'Bring Stem to Front',run:()=>window.StripeMaker.diagrammaticOrder(road.id,true)},
          {label:'Send Stem to Back',run:()=>window.StripeMaker.diagrammaticOrder(road.id,false)},
          'separator',
        ] : []),
        { label: curveAngle(road)!=null ? "Use Freeform Curve" : "Make Circular Arc", run: () => {setRoadCurve(road,curveAngle(road)!=null?null:fitCurve(road,'arc'));if(road.arcAngle!=null)document.getElementById('roadArcAngleValue').focus();} },
        arcJoinGroup(sheet,road).length>1&&{label:"Fit Split/Merge Arcs",checked:arcJoinGroup(sheet,road).every(r=>r.arcJoinFit!==false),run:()=>{
          setArcJoinFit(road,!arcJoinGroup(sheet,road).every(r=>r.arcJoinFit!==false));
        }},
        curveAngle(road)==null && { label: curveOpen ? "Hide Curve Handle" : "Curve This End", run: () => (curveOpen ? hideCurve(node) : showCurve(node)) },
        end.length != null && { label: "Straighten", run: () => straighten(sheet, road, e) },
        curveAngle(road)==null && { label: "Link Curve Handles…", run: () => beginCurvePick(node, "parallel") },
        curveAngle(road)==null && { label: "Mirror Curve…", run: () => beginCurvePick(node, "mirror") },
        curveLinkFor(road,e) && { label: "Unlink Curve Handles", run: () => { curveLinks.unlink(sheet, curveLinkFor(road,e)); changed(); } },
        curveLinkFor(road,e)?.mode === "mirror" && { label: "Edit Symmetry Line…", run: () => editCurveAxis(nodeRef(road, e)) },
        { label: window.StripeMaker.traffic.incoming(Boolean(e)) ? "Continue Road From Here" : "Draw Road Into Here", run: () => startDrawing({ [e ? "start" : "end"]: here }) },
        joined && { label: "Pull End Free", run: () => { detach(sheet, road, e); changed(); } },
        "separator",
        { label: "Auto Taper", checked: taper === "auto", run: setTaperMode("auto") },
        { label: e ? "Taper (Lane Drop)" : "Taper (Lane Add)", checked: taper === "taper", run: setTaperMode("taper") },
        { label: "No Taper", checked: taper === "none", run: setTaperMode("none") },
        "separator",
        road.lanes < MAX_LANES && { label: "Add Travel Lane on Left", run: () => addLane(sheet, road, "L") },
        road.lanes < MAX_LANES && { label: "Add Travel Lane on Right", run: () => addLane(sheet, road, "R") },
        "separator",
        { label: "Reverse Direction", run: () => reverseRoad(sheet, road) },
        { label: "Delete Road", run: deleteRoad },
      ].filter(Boolean);
    }
    function openMenu(button, point = null) {
      const node = nodeTarget(button);
      if (!node || drawing) return;
      closeMenu();
      selectedRoad = node.road;
      selectedLane = { e: node.e, lane: node.lane };
      menuNode = { button, point, key: `${node.road.id}:${node.e}:${node.lane}` };
      nodeMenu.setAttribute("aria-label", `Road ${node.road.id}, lane ${node.lane + 1} ${node.e ? "end" : "start"}`);
      const items = point ? [...menuItems(node).filter(item => item !== "separator" && /^(Make |Split |Delete |Reverse )/.test(item.label))] : menuItems(node);
      showMenuItems(items);
      render();
      nodeMenu.querySelector("button")?.focus({ preventScroll: true });
    }
    function openLaneAddMenu(button) {
      const { road, side } = button.target ?? {};
      if (!road || drawing || !sheets.selected?.roads.includes(road)) return;
      closeMenu();
      menuNode = { button, laneAdd: true };
      button.setAttribute("aria-expanded", "true");
      nodeMenu.setAttribute("aria-label", "Add lane");
      showMenuItems([
        { label: `Add Travel Lane on ${side === "R" ? "Right" : "Left"}`, run: () => addLane(sheets.selected, road, side) },
      ]);
      positionMenu();
      nodeMenu.querySelector("button")?.focus({ preventScroll: true });
    }
    function showMenuItems(items) {
      nodeMenu.replaceChildren(...items.map(item => {
        const li = document.createElement("li");
        li.setAttribute("role", item === "separator" ? "separator" : "presentation");
        if (item === "separator") return li;
        const entry = document.createElement("button");
        entry.type = "button";
        entry.textContent = item.label;
        entry.setAttribute("role", "checked" in item ? "menuitemradio" : "menuitem");
        if ("checked" in item) entry.setAttribute("aria-checked", String(item.checked));
        entry.addEventListener("click", () => {
          closeMenu(true);
          item.run();
        });
        li.append(entry);
        return li;
      }));
      nodeMenu.hidden = false;
    }
    function closeMenu(restoreFocus = false) {
      if (!menuNode) return;
      const { button } = menuNode;
      menuNode = null;
      nodeMenu.hidden = true;
      nodeMenu.replaceChildren();
      button.setAttribute("aria-expanded", "false");
      if (restoreFocus && button.isConnected) button.focus({ preventScroll: true });
    }
    // Sits beside its node (right, or left if there's no room) with the pointer
    // aimed at the node, and follows it while the sheet pans or zooms.
    function positionMenu() {
      if (!menuNode) return;
      const button = menuNode.laneAdd ? menuNode.button : nodeButtons.get(menuNode.key);
      if (!button || button.hidden || overlay.hidden) return closeMenu();
      const node = button.getBoundingClientRect();
      const screen = menuNode.point && sheets.toScreen(menuNode.point);
      const x = screen ? screen.x : node.left + node.width / 2;
      const y = screen ? screen.y : node.top + node.height / 2;
      const gap = node.width / 2 + 10;
      const margin = 8;
      const { width, height } = nodeMenu.getBoundingClientRect();
      const right = x + gap + width + margin <= innerWidth || x - gap - width < margin;
      const top = Math.min(Math.max(y - 22, margin), Math.max(margin, innerHeight - height - margin));
      nodeMenu.dataset.side = right ? "right" : "left";
      nodeMenu.style.left = `${right ? x + gap : x - gap - width}px`;
      nodeMenu.style.top = `${top}px`;
      nodeMenu.style.setProperty("--pointer-y", `${Math.min(Math.max(y - top, 12), height - 12)}px`);
    }
    nodeMenu.addEventListener("keydown", event => {
      if (event.key === "Tab") return closeMenu(true);
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = [...nodeMenu.querySelectorAll("button")];
      const index = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    document.addEventListener("pointerdown", event => {
      if (menuNode && !nodeMenu.contains(event.target)) closeMenu();
    }, true);
    window.addEventListener("resize", positionMenu);

    // Curve handles turn the joint, so every road joined there stays lined up.
    // A curve handle turns its joint, and every road joined there with it; held
    // with Option/Alt (or with "Curve joined ends independently" on) it turns
    // only this road's end, leaving the others as they are.
    function moveHandle(e, to, independent = independentInput.checked) {
      const sheet = sheets.selected;
      const road = selectedRoad;
      const { from } = handlePoint(sheet, road, e, solve(sheet));
      const away = { x: to.x - from.x, y: to.y - from.y };
      const length = Math.hypot(away.x, away.y);
      if (length < 1) return;
      const travel = unit(e ? { x: -away.x, y: -away.y } : away);
      const end = road.ends[e];
      const pair = pairOf(sheet, road);
      const joint = jointOf(sheet, end.joint);
      if (independent && attachments(sheet, joint).some(item => item.road !== road && item.road !== pair)) {
        end.dir = travel;
        if (pair) pair.ends[1 - e].dir = { x: -travel.x, y: -travel.y };
      } else {
        joint.dir = { x: travel.x * end.sign, y: travel.y * end.sign };
        delete end.dir;
        if (pair) delete pair.ends[1 - e].dir;
      }
      end.length = length;
      if (pair) pair.ends[1 - e].length = length;
      syncCurve(nodeRef(road, e));
    }
    controlButtons.forEach((button, e) => {
      let constraint=null;
      button.addEventListener("pointerdown", event => {
        if (!selectedRoad || event.button!==0) return;
        const sheet=sheets.selected,road=selectedRoad;
        const {from,at}=handlePoint(sheet,road,e,solve(sheet));
        const joint=jointOf(sheet,road.ends[e].joint),pair=pairOf(sheet,road);
        constraint={from,axis:unit({x:at.x-from.x,y:at.y-from.y}),joint,dir:joint.dir&&{...joint.dir},
          road,endDir:road.ends[e].dir&&{...road.ends[e].dir},pair,pairDir:pair?.ends[1-e].dir&&{...pair.ends[1-e].dir}};
        event.stopPropagation();
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener("pointermove", event => {
        if (!button.hasPointerCapture(event.pointerId) || !selectedRoad) return;
        let point=sheets.toImage(event.clientX,event.clientY);
        if(event.shiftKey&&constraint) {
          const c=constraint;
          point=alongDragAxis(point,c.from,c.axis,1);
          if(c.dir)c.joint.dir={...c.dir};else delete c.joint.dir;
          if(c.endDir)c.road.ends[e].dir={...c.endDir};else delete c.road.ends[e].dir;
          if(c.pair){if(c.pairDir)c.pair.ends[1-e].dir={...c.pairDir};else delete c.pair.ends[1-e].dir;}
          const length=Math.hypot(point.x-c.from.x,point.y-c.from.y);
          c.road.ends[e].length=length;
          if(c.pair)c.pair.ends[1-e].length=length;
          syncCurve(nodeRef(c.road,e));
        } else moveHandle(e,point,independentInput.checked||event.altKey);
        renderSoon({ joints: [selectedRoad.ends[e].joint] });
      });
      const finishHandle=event=>{
        if (!button.hasPointerCapture(event.pointerId)) return;
        button.releasePointerCapture(event.pointerId);
        constraint=null;
        changed();
      };
      button.addEventListener("pointerup",finishHandle);
      button.addEventListener("pointercancel",finishHandle);
      nudgeKeys(button, (dx, dy) => {
        if (!selectedRoad) return false;
        const { at } = handlePoint(sheets.selected, selectedRoad, e, solve(sheets.selected));
        moveHandle(e, { x: at.x + dx, y: at.y + dy });
      });
      // Double-clicking a handle returns that end to its default pull; a free end
      // goes straight again.
      button.addEventListener("dblclick", () => {
        const sheet = sheets.selected;
        if (!selectedRoad) return;
        straighten(sheet, selectedRoad, e);
      });
    });

    window.addEventListener("keydown", event => {
      if (!active() || document.querySelector("dialog[open]")) return;
      const typing = event.target.closest?.("input, select, textarea");
      if (curvePick && !typing && (event.key === "Escape" || event.key === "Enter")) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Escape") cancelCurvePick();
        else if (curvePick.axis?.length === 2 && curvePick.target) applyCurveMirror();
        else if (event.target.closest?.(".roadNode")) { const node = nodeTarget(event.target.closest(".roadNode")); if (node) pickCurveNode(node); }
        return;
      }
      if (menuNode && (event.key === "Escape" || nodeMenu.contains(event.target))) {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        closeMenu(true);
      } else if (event.key === "Escape" && (drawing || selectedRoad)) {
        event.stopPropagation();
        // One level at a time: a selected lane end first, then the road.
        if (drawing) stopDrawing();
        else if (selectedLane && selectedRoad) { selectedLane = null; render(); }
        else selectRoad(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && !typing && !deleteButton.disabled) {
        event.preventDefault();
        deleteRoad();
      }
    }, true);

    new MutationObserver(() => {
      if (!active()) {
        curvePick = null;
        drawing = null;
        snapTarget = null;
        closeMenu();
      }
      render();
    }).observe(editor, { attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("sheetview", () => {
      if (active()) drawOverlay(lastSolved?.sheet === sheets.selected ? lastSolved.solved : undefined);
    });
    // Undo and redo replace the sheet's roads, so selection follows by id.
    document.addEventListener("sheethistory", () => {
      curvePick = null;
      const sheet = sheets.selected;
      selectedRoad = sheet?.roads && selectedRoad ? roadOf(sheet, selectedRoad.id) ?? null : null;
      if (!(selectedRoad && selectedLane?.lane < selectedRoad.lanes)) selectedLane = null;
      for (const key of openCurves) if (!sheet?.roads?.some(road => key.startsWith(`${road.id}:`))) openCurves.delete(key);
      drawing = null;
      drag = null;
      snapTarget = null;
      closeMenu();
      render();
    });
    document.addEventListener("sheetchange", () => {
      curvePick = null;
      curveLinks.prune(sheets.selected);
      if (!sheets.selected?.roads?.includes(selectedRoad)) {
        selectedRoad = null;
        selectedLane = null;
      }
      drawing = null;
      snapTarget = null;
      closeMenu();
      render();
    });
    window.StripeMaker.roadEditor = { render,
      diagnostics: () => structuredClone({selectedRoad,selectedLane,defaults,openCurves:[...openCurves]}),
      // Opens a road in the Elements panel, selected.
      focusRoad: road => { window.StripeMaker.showEditor("elementsEditor"); selectRoad(road); } };
    render();
  });
})();
