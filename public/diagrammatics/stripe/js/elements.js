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
  // (curve, straighten, taper, detach, two-way, delete), pointing at the node.
  //
  // Markings follow FDOT Standard Plans Index 711-001 (FY 2025-26). Dimensions are
  // to the centerline of markings.
  const LINE_INCHES = 6;              // edge lines, lane lines, and centerlines
  const DOUBLE_GAP_INCHES = 4;        // gap between double solid lines
  const PAVEMENT_MARGIN_INCHES = 8;   // edge of traveled way to edge of pavement
  const YELLOW = "#ffc72c";
  const WHITE = "#ffffff";
  const MAX_LANES = 999;
  const MIN_LANE_WIDTH = 8;
  // Audited against the latest posted FDM chapter (2027) and FY 2026-27 plans:
  // https://www.fdot.gov/roadway/fdm/default.shtm (Chapter 223)
  // https://www.fdot.gov/design/standardplans/current (711-001, 711-002)
  // Bike lanes (FDOT Design Manual 223.2.2.1, January 1, 2027): a 7-ft buffered
  // bicycle lane for new construction; 4 to 5 ft unbuffered. Width is measured
  // from the edge of the travel lane to the edge of pavement.
  // Two-way bike tracks (separated, FDM 223.2.3.3): 12 ft preferred, 8 ft
  // minimum (Table 223.2.2). FDOT gives no center line for them, so the MUTCD's
  // applies (11th Edition Part 9): a yellow broken line between the directions,
  // here the 3 ft line, 9 ft gap pattern.
  const BIKE_LANE = { bike: { width: 5, min: 4 }, bufferedBike: { width: 7, min: 6 }, twoWayBike: { width: 12, min: 8 }, max: 14 };
  // Buffered bike lane striping: two 6" white solid lines 8" apart (Standard
  // Plans 711-002 sheet 2, Standard Buffered Bike Lane Striping), so the second
  // line's center is 14" into the bike lane.
  const BIKE_BUFFER_INCHES = 14;
  // Keyholes: the turn-side line is dotted where turning traffic crosses the bike
  // lane (Standard Plans 711-001 sheets 5-6, 2'-4' dotted; FDM 223.5.2, 150 ft).
  const KEYHOLE_DOTTED_FEET = 150;
  // Editable geometry limit, independent of standard lane-width defaults.
  const MAX_LANE_WIDTH = 50;
  const MAX_MEDIAN_FEET = 200;
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
  // Gores and traffic separation, FDOT 711-001 sheet 8. "Traffic Channelization at
  // Gore" (same-direction roads): 8" white gore lines, 18" white chevrons at 45°,
  // 20' apart. "Markings for Traffic Separation" (opposite directions): 18" yellow
  // diagonals at 45°, Y apart by posted speed.
  const GORE_LINE_INCHES = 8;
  const GORE_STRIPE_INCHES = 18;
  const GORE_SPACING_FEET = 20;
  const SEPARATION_SPACING = [[30, 10], [40, 20], [45, 30], [Infinity, 40]];  // [up to mph, Y ft]
  const MIN_GORE_SPACING_FEET = 10;
  const MAX_GORE_SPACING_FEET = 40;
  const GORE_ICON_PIXELS = 26;        // gore icons rest this far along from the gore point
  // Medians, FDOT Design Manual 210.3. Grass medians are turf; concrete medians are
  // raised and curbed (Standard Plans Index 520-001, Type F curb, 6" top drawn at
  // the median's edge); painted medians carry the 711-001 sheet 8 traffic
  // separation markings: a 6" yellow line 10" inside the road's yellow edge line
  // (a double yellow) and 18" yellow diagonals at 45°, spaced Y by posted speed.
  const MEDIAN_TYPES = { grass: "Grass", concrete: "Concrete", painted: "Painted" };
  const GRASS = "#5e7f3c";
  const CONCRETE = "#bdbbb4";
  const CURB = "#dedcd5";
  const CURB_INCHES = 6;
  const MEDIAN_SPACING_FEET = 20;
  const SVG = "http://www.w3.org/2000/svg";

  document.addEventListener("DOMContentLoaded", () => {
    const sheets = window.StripeMaker.sheets;
    const workspace = document.getElementById("workspace");
    const editor = document.getElementById("elementsEditor");
    const addButton = document.getElementById("addRoad");
    const addStandaloneBikeButton = document.getElementById("addStandaloneBikeLane");
    const standaloneBikeTypeInput=document.getElementById("standaloneBikeType");
    let standaloneBikeType='bike';
    const elementToAdd=document.getElementById('elementToAdd'),addElement=document.getElementById('addElement');
    const elementCommands={subpanel:'placeDiagrammaticSubpanel',road:'addRoad',median:'addMedian',bike:'addStandaloneBikeLane',track:'addStandaloneBikeLane',roadBike:'addBikeLane',roadTrack:'addBikeTrack',match:'openMatchLines'};
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
    const oppositeInput = document.getElementById("roadOpposite");
    const medianRow = document.getElementById("medianRow");
    const medianInput = document.getElementById("roadMedian");
    const splitRow = document.getElementById("splitRow");
    const laneFields = document.getElementById("laneFields");
    const laneTypeSelect = document.getElementById("laneType");
    const bikeWidthRow = document.getElementById("bikeWidthRow");
    const bikeWidthInput = document.getElementById("bikeWidth");
    const laneTitle = document.getElementById("laneTitle");
    const taperSelect = document.getElementById("laneTaper");
    const taperLength = document.getElementById("laneTaperLength");
    const taperState = document.getElementById("laneTaperState");
    const autoTapersInput = document.getElementById("autoTapers");
    const independentInput = document.getElementById("independentCurves");
    const goreFields = document.getElementById("goreFields");
    const goreTitle = document.getElementById("goreTitle");
    const goreState = document.getElementById("goreState");
    const goreSpacing = document.getElementById("goreSpacing");
    const goreSpacingValue = document.getElementById("goreSpacingValue");
    const goreLength = document.getElementById("goreLength");
    const addMedianButton = document.getElementById("addMedian");
    const medianFields = document.getElementById("medianFields");
    const medianTitle = document.getElementById("medianTitle");
    const medianType = document.getElementById("medianType");
    const paintedFields = document.getElementById("paintedFields");
    const medianColor = document.getElementById("medianColor");
    const medianLean = document.getElementById("medianLean");
    const medianSpacing = document.getElementById("medianSpacing");
    const medianSpacingValue = document.getElementById("medianSpacingValue");
    const medianState = document.getElementById("medianState");
    const defaults = { perLaneWidths: false, lanes: 1, laneWidth: 12, opposite: 0, median: 0, medianType: "grass", medianSpacing: MEDIAN_SPACING_FEET, medianColor: "yellow", medianLean: "right", bufferedBike: true };
    const medianPoints = [];
    const medianControls = new Map();
    let selectedMedian = null;
    let medianSheet = null;
    let medianDraw = null;
    const openCurves = new Set();
    const nodeButtons = new Map();
    const goreButtons = new Map();
    let selectedRoad = null;
    let selectedLane = null;
    let drawing = null;
    let drag = null;
    let snapTarget = null;
    let menuNode = null;
    let selectedGore = null;
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
      <polyline class="medianPreview"/><polyline class="medianPreview closing"/><g class="medianPreviewPoints"></g><circle class="roadSnap" r="15"/></svg>
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
    const [medianPreview, medianClosing] = overlay.querySelectorAll(".medianPreview");
    const medianPreviewPoints = overlay.querySelector(".medianPreviewPoints");
    const medianControlLines = document.createElementNS(SVG, "g");
    overlay.querySelector("svg").append(medianControlLines);
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
    // A lane's bike lane type ("bike" or "bufferedBike"), or null for a travel lane.
    // A hand-set "travel" entry keeps a carried bike lane from coming back.
    const bikeType = (road, lane) => { const type = road.laneTypes?.[lane]?.type; return type && type !== "travel" ? type : null; };
    const independentBikeRoad = road => road.lanes > 0 && Array.from({ length: road.lanes }, (_, lane) => bikeType(road, lane)).every(Boolean);
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
        sheet.gores ??= [];
        sheet.medians ??= [];
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
    const solveKey=sheet=>JSON.stringify([sheet.inchesPerPixel,sheet.autoTapers,sheet.roads,sheet.joints,sheet.intersections]);
    // Only road geometry is shared. Render-local masks, crosswalk cuts, gore
    // candidates and placement indexes get fresh ownership on every query.
    const copySolved=base=>Object.assign(new Map(base),{auto:base.auto,shapes:base.shapes,byJoint:base.byJoint,stacks:base.stacks??=new Map(),
      arcFits:base.arcFits,arcLaneMouths:base.arcLaneMouths,arcLaneExtensions:base.arcLaneExtensions,arcPavementMouths:base.arcPavementMouths,dropLaneEnds:base.dropLaneEnds,dropLaneTargets:base.dropLaneTargets,dropPavementEnds:base.dropPavementEnds});
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
      const solved = Object.assign(new Map(), { byJoint, auto: new Set(), shapes: new Map(), dropLaneEnds: new Map(), dropLaneTargets: new Map(), dropPavementEnds: new Map() });
      const separation = inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES);
      for (const joint of sheet.joints) {
        const here = byJoint.get(joint.id) ?? [];
        if (!here.length) continue;
        const byRoad = new Map(here.map(item => [item.road.id, item]));
        const root = byRoad.has(joint.root) ? joint.root : here[0].road.id;
        const offsets = new Map([[root, 0]]), dropBranches=[];
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
        // FDM 2027 Exhibit 223-3 B: after cyclists cross inward, the
        // dropped vehicle lane occupies the OUTSIDE slot. Its ramp must meet
        // the receiving bike lane's outside edge, not the old vehicle center
        // (which is now occupied by the bike lane). Keep stored lane links.
        // https://www.fdot.gov/roadway/fdm/default.shtm (223, Exhibit 223-3 B)
        const connected = laneLinks(sheet, joint);
        for (const bikeLink of connected) {
          const {from,to,fromLane,toLane}=bikeLink;
          if(!["bike","bufferedBike"].includes(bikeType(from,fromLane)) || !bikeType(to,toLane) || fromLane!==from.lanes-1 || toLane!==to.lanes-1 || toLane>=fromLane)continue;
          if([from.laneTypes[fromLane],to.laneTypes[toLane]].some(t=>["separate","channelized"].includes(t?.conflict)))continue;
          const incoming=byRoad.get(from.id),through=byRoad.get(to.id);
          if(!incoming||!through||!offsets.has(from.id)||!offsets.has(to.id))continue;
          const center=(r,l,e)=>solvedLateral(sheet,r,l,e);
          const half=(r,l,e)=>feetToPixels(sheet,window.StripeMaker.roadWidths.endWidth(sheet,r,e,l))/2;
          // Only an actual inward move with a separate departing vehicle feed.
          const oldBike=offsets.get(from.id)+incoming.end.sign*center(from,fromLane,1);
          const newBike=offsets.get(to.id)+through.end.sign*center(to,toLane,0);
          if((newBike-oldBike)*incoming.end.sign>=-feetToPixels(sheet,from.laneWidth)/2)continue;
          for(const turn of connected.filter(l=>l.from===from&&l.to!==to&&l.fromLane>=toLane&&l.fromLane<fromLane&&!bikeType(l.to,l.toLane))) {
            const branch=byRoad.get(turn.to.id);if(!branch||!offsets.has(turn.to.id))continue;
            const outside=offsets.get(to.id)+through.end.sign*(center(to,toLane,0)+half(to,toLane,0));
            // Several dropped lanes retain their order outside the bike lane.
            let preceding=0;for(let k=toLane;k<turn.fromLane;k++)preceding+=2*half(from,k,1);
            const target=outside+incoming.end.sign*(preceding+half(from,turn.fromLane,1));
            const next=target-branch.end.sign*center(turn.to,turn.toLane,0);
            const delta=next-offsets.get(turn.to.id);
            if(turn.to.id===root){for(const [id,value] of offsets)if(id!==root)offsets.set(id,value-delta);}
            else offsets.set(turn.to.id,next);
            const actual=offsets.get(turn.to.id)+branch.end.sign*center(turn.to,turn.toLane,0);
            const original=offsets.get(from.id)+incoming.end.sign*center(from,turn.fromLane,1);
            solved.dropLaneEnds.set(`${from.id}:1:${turn.fromLane}`,(actual-original)*incoming.end.sign);
            dropBranches.push({from,to,turn});
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
        const lateral = (item, lane) => (offsets.get(item.road.id) ?? 0) + item.end.sign * (solvedLateral(sheet, item.road, lane, item.e) + (solved.dropLaneEnds.get(`${item.road.id}:${item.e}:${lane}`)??0));
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
        // Match world-space edges too when the receiving end was turned
        // independently. A scalar lateral shift alone misses its tilted edge.
        for(const {from,to,turn} of dropBranches) {
          const through=solved.get(`${to.id}:0`),branch=solved.get(`${turn.to.id}:0`);
          const normal=at=>rightOf(at.travel??joint.dir??{x:0,y:-1});
          const edge=(r,k,e)=>solvedLinkLateral(sheet,r,k,e);
          const tr=normal(through),br=normal(branch);
          const target={x:through.x+tr.x*edge(to,"R",0),y:through.y+tr.y*edge(to,"R",0)};
          const branchLeft=solvedLateral(sheet,turn.to,turn.toLane,0)-feetToPixels(sheet,window.StripeMaker.roadWidths.endWidth(sheet,turn.to,0,turn.toLane))/2;
          let preceding=0;for(let k=to.lanes-1;k<turn.fromLane;k++)preceding+=feetToPixels(sheet,window.StripeMaker.roadWidths.endWidth(sheet,from,1,k));
          const dx=target.x+br.x*(preceding-branchLeft)-branch.x,dy=target.y+br.y*(preceding-branchLeft)-branch.y;
          if(turn.to.id===root){for(const item of here)if(item.road.id!==root){const at=solved.get(`${item.road.id}:${item.e}`);at.x-=dx;at.y-=dy;}}
          else {branch.x+=dx;branch.y+=dy;}
          const center=solvedLateral(sheet,turn.to,turn.toLane,0);
          solved.dropLaneTargets.set(`${from.id}:1:${turn.fromLane}`,{x:branch.x+br.x*center,y:branch.y+br.y*center});
          if(turn.fromLane===from.lanes-2){const outer=center+feetToPixels(sheet,window.StripeMaker.roadWidths.endWidth(sheet,turn.to,0,turn.toLane))/2;
            solved.dropPavementEnds.set(from.id,{x:branch.x+br.x*outer,y:branch.y+br.y*outer});}
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

    // Moving one attached end only needs its joint-connected road component.
    // Keep original road/joint iteration order and all intersection width rules.
    // Separate intersections do not join road solver components to each other.
    const componentCache=new WeakMap();
    function solveForRoad(sheet,road) {
      if(!road)return solve(sheet);
      const key=JSON.stringify([sheet.roads.map(r=>[r.id,r.ends.map(e=>e.joint)]),sheet.joints.map(j=>[j.id,j.links.map(l=>[l.a,l.b])])]);
      let cache=componentCache.get(sheet);
      if(cache?.key!==key || cache.roads!==sheet.roads || cache.joints!==sheet.joints ||
        cache.roadRefs.some((r,i)=>r!==sheet.roads[i]) || cache.jointRefs.some((j,i)=>j!==sheet.joints[i])){
        const byJoint=new Map(),byId=new Map(sheet.roads.map(r=>[r.id,r])),joints=new Map(sheet.joints.map(j=>[j.id,j])),components=new Map();
        for(const r of sheet.roads)for(const e of r.ends){if(!byJoint.has(e.joint))byJoint.set(e.joint,[]);byJoint.get(e.joint).push(r);}
        for(const r of sheet.roads){
          if(components.has(r.id))continue;
          const ids=new Set(),jointIds=new Set(),pending=[r];
          while(pending.length){const next=pending.pop();if(ids.has(next.id))continue;ids.add(next.id);
            for(const e of next.ends)if(!jointIds.has(e.joint)){jointIds.add(e.joint);pending.push(...byJoint.get(e.joint)??[]);
              for(const l of joints.get(e.joint)?.links??[])for(const id of [l.a,l.b])if(byId.has(id))pending.push(byId.get(id));
            }
          }
          const component={roads:sheet.roads.filter(r=>ids.has(r.id)),joints:sheet.joints.filter(j=>jointIds.has(j.id)),ids};
          for(const id of ids)components.set(id,component);
        }
        cache={key,roads:sheet.roads,joints:sheet.joints,roadRefs:[...sheet.roads],jointRefs:[...sheet.joints],components};componentCache.set(sheet,cache);
      }
      const component=cache.components.get(road.id);
      // Width rules only read mouths attached to a road in this component.
      // Filter current attachments on each read, preserving their order and
      // references while avoiding indexes for unrelated mouths elsewhere.
      const intersections=sheet.intersections?.filter(item=>item.approaches.some(a=>
        component.ids.has(a.binding?.road)||a.links?.some(l=>component.ids.has(l.road))));
      const local={inchesPerPixel:sheet.inchesPerPixel,autoTapers:sheet.autoTapers,intersections,...component};
      return window.StripeMaker.roadWidths.withSnapshot(local,()=>computeSolved(local));
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
      return road.arcAngle != null ? window.StripeMaker.circularArc.sample(a,b,a.fittedAngle??road.arcAngle,road.arcLoop) : bezier(a,c0,c1,b,road.keepWidthAtJoins);
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
        ends.every(([a,b],lane) => road.keepWidthAtJoins || a === b && a === roadWidths.laneWidth(road,lane)) &&
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
          // FDM Exhibit 223-3: taper the vehicle lane, never the bike lane.
          if (bikeType(road, lane)) continue;
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
        // it. Widened driveways retain their host-dependent construction.
        if(road.keepWidthAtJoins)return buildRoadShape(sheet,road,solved);
        const widths=window.StripeMaker.roadWidths,partner=pairOf(sheet,road);
        const key=JSON.stringify([sheet.inchesPerPixel,road,partner,
          partner&&pairLinks(sheet,road,partner)[0]?.median,
          [0,1].map(e=>solved.get(`${road.id}:${e}`)),[...tapersOf(sheet,road,solved)],
          [0,1].map(e=>[Array.from({length:road.lanes},(_,lane)=>widths.endWidth(sheet,road,e,lane)),widths.endGaps(sheet,road,e)]),
          solved.dropPavementEnds?.get(road.id),solved.arcFits?.get(road.id),road.arcAngle!=null&&sheet.roads.map(r=>[r.id,r.arcAngle,r.ends.map(e=>e.joint)])]);
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
        if(road.keepWidthAtJoins) {
          const hosts=wideTurnHosts(sheet,road);
          if(hosts.length) {
            const joined=road.ends.map(end=>hosts.some(h=>h.ends.some(e=>e.joint===end.joint)));
            const free=joined[0]&&!joined[1]?1:0;
            const i=free?shape.line.length-1:0;
            const p=shape.line[i],q=shape.line[free?i-1:1];
            const tangent=p.tangent??unit(free?{x:p.x-q.x,y:p.y-q.y}:{x:q.x-p.x,y:q.y-p.y});
            // Translate both edges along the driveway's cross-section axis.
            // Rotating that axis with the turn pinches the opening where the
            // curves cross the mainline boundary (the driveway sketch case).
            shape.widthNormal=rightOf(tangent);
            // Only the white outer edge rounds into the host's white edge.
            // The yellow edge keeps the translated driveway curve and cutoff.
            const white=shapeOffset(shape,k=>shape.bounds[k][road.lanes]);
            const stations=[0];
            for(let k=1;k<shape.line.length;k++)stations.push(stations[k-1]+Math.hypot(shape.line[k].x-shape.line[k-1].x,shape.line[k].y-shape.line[k-1].y));
            const total=stations.at(-1);
            for(const e of [0,1]) {
              const joint=jointOf(sheet,road.ends[e].joint);
              const link=joint?.links?.find(l=>l.b===road.id&&!l.pair&&!l.beside&&l.bi===road.lanes-1&&l.ai===roadOf(sheet,l.a)?.lanes-1);
              if(!link||!total)continue;
              const index=e?shape.line.length-1:0,at=shape.line[index];
              const direction=at.tangent??travelAt(road,e,solved),normal=rightOf(direction);
              const edge=linkLateral(sheet,road,"R",e);
              let target={x:at.x+normal.x*edge,y:at.y+normal.y*edge};
              // Slide the white join along the mainline rather than pulling
              // the driveway inward. Preserve its full cross-section along
              // widthNormal, including the small curved part at the mouth.
              const axis=shape.widthNormal,level=dot(white[index],axis);
              let best=Infinity;
              for(const host of hosts) {
                // Hosts use ordinary geometry; avoid circular shape lookups
                // if two explicitly widened driveways have been joined.
                if(host.keepWidthAtJoins)continue;
                const hostShape=shapeOf(sheet,host,solved),points=boundary(hostShape,host.lanes);
                for(let j=1;j<points.length;j++) {
                  const a=points[j-1],b=points[j],da=dot(a,axis),db=dot(b,axis);
                  if(Math.abs(db-da)<1e-9)continue;
                  const f=(level-da)/(db-da);if(f<0||f>1)continue;
                  const candidate={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
                  const d=Math.hypot(candidate.x-white[index].x,candidate.y-white[index].y);
                  if(d<best){best=d;target=candidate;}
                }
              }
              if(!Number.isFinite(best))continue;
              const dx=target.x-white[index].x,dy=target.y-white[index].y;
              for(let k=0;k<white.length;k++) {
                const distance=e?total-stations[k]:stations[k];
                const t=Math.max(0,Math.min(1,distance/(total/2)));
                const blend=1-t*t*t*(10+t*(-15+6*t));
                white[k]={...white[k],x:white[k].x+dx*blend,y:white[k].y+dy*blend};
              }
            }
            shape.pavementEdges={[road.lanes]:white};
          }
        }
      }
      const pavementEnd=solved.dropPavementEnds?.get(road.id);
      if(pavementEnd){
        const edge=offset(shape.line,i=>shape.bounds[i][road.lanes]),end=edge.at(-1),total=polylineLength(shape.line);
        const begin=total-feetToPixels(sheet,50),finish=total-feetToPixels(sheet,20);let along=0;
        shape.pavementEdges={[road.lanes]:edge.map((p,i)=>{if(i)along+=Math.hypot(shape.line[i].x-shape.line[i-1].x,shape.line[i].y-shape.line[i-1].y);
          const f=Math.max(0,Math.min(1,(along-begin)/(finish-begin)));return {x:p.x+f*(pavementEnd.x-end.x),y:p.y+f*(pavementEnd.y-end.y)};})};
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
      const cached=shape.bikeEdges?.[k]??shape.pavementEdges?.[k];
      // Polygon consumers reverse the returned edge to close an outline.
      // Always return a fresh array, just as shapeOffset does, so that cannot
      // corrupt cached white curves or bike boundaries for subsequent draws.
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
      const target=solved.arcLaneMouths?.get(`${road.id}:${e}:${lane}`)??solved.dropLaneTargets?.get(`${road.id}:${e}:${lane}`);if(target)return target;
      const shape=shapeOf(sheet,road,solved);
      const { line, bounds, laneBounds } = shape;
      const i = e ? line.length - 1 : 0;
      if(shape.widthNormal)return shapeOffset(shape,k=>(laneBounds[k][lane][0]+laneBounds[k][lane][1])/2)[i];
      return offset([line[e ? i - 1 : 0], line[e ? i : 1]], (laneBounds[i][lane][0] + laneBounds[i][lane][1]) / 2 + (solved.dropLaneEnds?.get(`${road.id}:${e}:${lane}`)??0))[e];
    }
    const pathData = points => `M${points.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("L")}`;

    function strokePath(points, color, width, dash, phase = 0) {
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("class", "roadMarking");
      path.setAttribute("d", pathData(points));
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", width);
      if (dash) path.setAttribute("stroke-dasharray", dash);
      if (phase) path.setAttribute("stroke-dashoffset", phase.toFixed(2));
      return path;
    }
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
    const roadDrawingCache=new WeakMap();
    // Uniform cross sections repeat one row at every sample. Encode it once
    // without rounding coordinates or conflating it with varying cross sections.
    const sectionKey=rows=>rows?.every(row=>row===rows[0]||row.length===rows[0].length&&row.every((value,i)=>
      Array.isArray(value)?value.length===rows[0][i]?.length&&value.every((n,j)=>n===rows[0][i][j]):value===rows[0][i]))?[rows.length,rows[0]]:rows;
    function drawRoad(sheet, road, shape, layers, className = "", solved = null) {
      // Ordinary ground roads can retain exact SVG when their sampled geometry,
      // clipping polygons, user lines and dash phase are unchanged. Bike routes,
      // spanning surfaces and elevated masks keep their full drawing path.
      const simple=solved && (solved.simpleRoadDrawing??= !sheet.bridges?.length && !sheet.surfaces?.length &&
        !sheet.intersections?.some(i=>(i.level??1)>1) && !sheet.roads.some(r=>r.keepWidthAtJoins||Object.values(r.laneTypes??{}).some(t=>t.type!=='travel')));
      if(!simple)return paintRoad(sheet,road,shape,layers,className,solved);
      const app=window.StripeMaker,center=centerTarget(sheet,road,shape);
      const phases=Array.from({length:road.lanes+1},(_,k)=>app.longitudinal.phase(`r:${road.id}:${k}`));
      if(center)phases.push(app.longitudinal.phase(center.key));
      const cuts=solved.crosswalkCuts??=app.markings?.crosswalkCuts(sheet,solved)??[];
      const key=JSON.stringify([sheet.id,sheet.inchesPerPixel,app.traffic.reversed,road.lanes,road.medianEdges,
        shape.line,sectionKey(shape.bounds),sectionKey(shape.laneBounds),shape.pavementEdges,shape.gapEnds,
        Array.from({length:road.lanes},(_,lane)=>[0,1].map(e=>solved.arcPavementMouths?.get(`${road.id}:${e}:${lane}`))),joinedPolygons(sheet,road,solved),cuts,medianEdgeCuts(sheet,solved),phases,sheet.lines,sheet.gores,className]);
      const cached=roadDrawingCache.get(road);
      if(cached?.sheet===sheet&&cached.key===key){
        const {band,group,ring}=cached.nodes;layers.pavement.append(band);layers.markings.append(group);if(ring)layers.selection.append(ring);
        return cached.nodes;
      }
      const nodes=paintRoad(sheet,road,shape,layers,className,solved);
      roadDrawingCache.set(road,{sheet,key,nodes});return nodes;
    }
    function paintRoad(sheet, road, shape, layers, className = "", solved = null) {
      if(window.DiagrammaticRoadRenderer) return window.DiagrammaticRoadRenderer(sheet,road,shape,layers,className,
        k=>boundary(shape,k), !road.ends || !attachments(sheet,jointOf(sheet,road.ends[1].joint)).some(item=>item.road!==road&&item.e===0));
      const margin = inchesToPixels(sheet, PAVEMENT_MARGIN_INCHES);
      const band = document.createElementNS(SVG, "path");
      band.setAttribute("class", `roadBand ${className}`);
      band.setAttribute("d", fittedHostPolygons(sheet,road,shape,solved,margin).map(ring=>`${pathData(ring)}Z`).join(''));
      // Keep the driveway's complete width outside the mainline, right up
      // to its boundary. The host retains its own cross-section inside it.
      let pavementParent=layers.pavement;
      if(solved && road.keepWidthAtJoins) for(const host of wideTurnHosts(sheet,road)) {
        const hs=shapeOf(sheet,host,solved);
        const polygon=[...boundary(hs,0),...boundary(hs,host.lanes).reverse()];
        const clip=document.createElementNS(SVG,"clipPath");
        clip.id=`wide-turn-${sheet.id}-${road.id}-${host.id}`;
        const path=document.createElementNS(SVG,"path");
        const extent=Math.max(sheet.width,sheet.height,1)*4;
        path.setAttribute("d",`M${-extent} ${-extent}L${extent} ${-extent}L${extent} ${extent}L${-extent} ${extent}Z${pathData(polygon)}Z`);
        path.setAttribute("clip-rule","evenodd");path.setAttribute("fill-rule","evenodd");
        clip.append(path);layers.pavement.append(clip);
        const clipped=document.createElementNS(SVG,"g");
        clipped.setAttribute("clip-path",`url(#${clip.id})`);pavementParent.append(clipped);pavementParent=clipped;
      }
      pavementParent.append(band);
      const group = document.createElementNS(SVG, "g");
      if (className) group.setAttribute("class", className);
      const polygons = solved ? joinedPolygons(sheet, road, solved) : [];
      const crosswalkCuts=solved?(solved.crosswalkCuts??=window.StripeMaker.markings?.crosswalkCuts(sheet,solved)??[]):[];
      // Each boundary's line (and a two-way road's centerline) draws through the
      // longitudinal markings, which apply user lines over the defaults and keep
      // dash patterns in step from one joined line to the next.
      const lines = window.StripeMaker.longitudinal;
      const dotted = solved ? bikeConflicts(sheet, road, shape, solved) : new Map();
      // Colored pavement (green bike lanes, red bus lanes) goes under the lines.
      for (const surface of sheet.surfaces ?? []) {
        if (surface.on.road !== road.id || surface.on.lane >= road.lanes) continue;
        const C = window.StripeMaker.markingCatalog, total = polylineLength(shape.line);
        const a = surface.from * total, feet = (surface.to - surface.from) * total / feetToPixels(sheet, 1);
        const phase = solved ? (lanePhase(sheet, road, surface.on.lane, solved) + a) / feetToPixels(sheet, 1) : 0;
        const span = surface.span && (sheet.surfaces ?? []).filter(s => s.span === surface.span).sort((a,b) => a.order - b.order);
        const lengths = span?.map(s => { const r = roadOf(sheet, s.on.road); return r ? (s.to-s.from)*polylineLength(shapeOf(sheet,r,solved).line)/feetToPixels(sheet,1) : 0; });
        const before = span ? lengths.slice(0,span.indexOf(surface)).reduce((a,b)=>a+b,0) : 0;
        const full = span ? lengths.reduce((a,b)=>a+b,0) : feet;
        let painted = C.stretches(surface.pattern, full, phase - before);
        if (surface.pattern === "conflict" && bikeType(road,surface.on.lane)) {
          // Exhibit 223-3 A/B/D/E: green supplements the actual white conflict
          // pattern; an unmarked weaving gap stays unpainted. Clip to placement.
          const lane=surface.on.lane, scale=feetToPixels(sheet,1);
          // FDM 223.5.3(2): 50 ft before/after, clipped to placement
          // at a stop bar/curb return (also applies to Exhibit E).
          const lead=50;
          // Carry solid approaches across the user's connected placement span.
          let walked=0;
          const sections=(span || [surface]).flatMap((s,i)=>{
            const r=roadOf(sheet,s.on.road);
            if(!r)return [];
            const sh=shapeOf(sheet,r,solved), len=polylineLength(sh.line)/scale;
            const map=r===road?dotted:bikeConflicts(sheet,r,sh,solved);
            const origin=walked-before+surface.from*total/scale-s.from*len;
            walked+=span?lengths[i]:feet;
            return [...(map.get(s.on.lane)??[]),...(map.get(s.on.lane+1)??[])].map(([a,b,k])=>[origin+a*len,origin+b*len,k]);
          });
          const stops=[...new Set([surface.from*total/scale,surface.to*total/scale,...sections.flatMap(([a,b])=>[a-lead,a,b,b+50])])].sort((a,b)=>a-b);
          painted=[];
          for(let i=1;i<stops.length;i++) {
            const lo=Math.max(stops[i-1],surface.from*total/scale),hi=Math.min(stops[i],surface.to*total/scale),mid=(lo+hi)/2;
            if(hi<=lo || sections.some(([a,b,k])=>k==="blank"&&mid>=a&&mid<b))continue;
            const dots=sections.some(([a,b,k])=>k==="dotted"&&mid>=a&&mid<b);
            const solid=sections.some(([a,b,k])=>k==="dotted"&&mid>=a-lead&&mid<b+50);
            const origin=surface.from*total/scale;
            for(const [a,b] of dots ? C.stretches("dotted",hi-lo,phase+lo-origin) : solid ? [[0,hi-lo]] : [])
              painted.push([before+lo-origin+a,before+lo-origin+b]);
          }
        }
        for (const [p0, p1] of painted) {
          const s0 = Math.max(0,p0-before), s1 = Math.min(feet,p1-before);
          if (s1 <= s0) continue;
          const paintShape=solved?bikeMarkingShape(sheet,road,surface.on.lane,shape,solved):shape;
          const lane=surface.on.lane,start=a+feetToPixels(sheet,s0),finish=a+feetToPixels(sheet,s1);
          const strip=surfaceStrip(sheet,road,paintShape,lane,start,finish,surface.color);
          const path = document.createElementNS(SVG, "path");
          path.setAttribute("d", `${pathData(strip.map(p=>window.StripeMaker.itemTransform.apply(surface,p)))}Z`);
          path.setAttribute("fill", C.SURFACE[surface.color] ?? C.SURFACE.green);
          path.setAttribute("class", "laneSurface");
          group.append(path);
        }
      }
      // Bike lanes (711-001 sheet 3): a 6" solid white line separates the bike
      // lane from the travel lane, with no line on the bike lane's outer edge; a
      // buffered bike lane adds a second 6" line inside it (711-002 sheet 2).
      const bike = lane => lane >= 0 && lane < road.lanes && Boolean(bikeType(road, lane));
      const independentBike = independentBikeRoad(road);
      // A line drawn with its conflict stretches 2'-4' dotted (default lines
      // only; user lines on the target still draw over them).
      const drawLine = (k, points, base, key, options) => {
        // Bike paths take precedence over default vehicle/ramp markings. In
        // particular a ramp's yellow edge must not run through a bike buffer.
        const bikePolygons=solved?bikeTransitions(sheet,solved).flatMap(t=>[
          {road:t.road,lane:t.lane,shape:t.shape},
          {road:t.entering?t.from:t.to,lane:t.entering?t.fromLane:t.toLane,
            shape:shapeOf(sheet,t.entering?t.from:t.to,solved)}
        ]).concat(sheet.roads.filter(r=>Array.from({length:r.lanes},(_,i)=>bikeType(r,i)).every(Boolean)).flatMap(r=>Array.from({length:r.lanes},(_,lane)=>({road:r,lane,shape:shapeOf(sheet,r,solved)})))).filter(t=>t.road!==road || (k!==t.lane&&k!==t.lane+1)).map(t=>{
          const margin=inchesToPixels(sheet,4);
          return [...boundary(t.shape,t.lane,-margin),...boundary(t.shape,t.lane+1,margin).reverse()];
        }):[];
        // These bike routes already resolve the crossing. At an angled joint
        // the physical road polygons overlap their continuation; trimming
        // against those polygons would erase the receiving solid buffer.
        const connectedBike=solved&&bikeTransitions(sheet,solved).some(t=>
          (t.from===road&&(k===t.fromLane||k===t.fromLane+1)) ||
          (t.to===road&&(k===t.toLane||k===t.toLane+1)));
        const roadClips=solved?joinedPolygons(sheet,road,solved,k):polygons;
        const clips=[...fittedHostPolygons(sheet,road,shape,solved,0,true),...(connectedBike?[]:[...roadClips,...bikePolygons]),...crosswalkCuts,...(solved&&options?.edge&&!bike(k)&&!bike(k-1)?medianEdgeCuts(sheet,solved):[])];
        if (solved && options?.edge) {
          // Painted channelization replaces default edges inside its footprint.
          // This matters when two arcs diverge and then cross back at a merge.
          for (const gore of sheet.gores ?? []) {
            if (!gore.key.split('|').some(end=>Number(end.split(':')[0])===road.id)) continue;
            const candidate = goreCandidates(sheet, solved).get(gore.key);
            if (!candidate?.same) continue;
            const last = indexAt(candidate.along, Math.min(feetToPixels(sheet,gore.length),candidate.along.at(-1)));
            if (last > 0) clips.push([...candidate.e1.slice(0,last+1),...candidate.e2.slice(0,last+1).reverse()]);
          }
        }
        const ranges = dotted.get(k);
        if (!ranges?.length) return lines.drawTarget(sheet, key, points, base, group, clips, options);
        const total = polylineLength(shape.line);
        if (key) lines.drawTarget(sheet, key, points, null, group, clips, options);
        let at = 0;
        for (const [f0, f1, kind] of ranges) {
          if (base && f0 * total > at) lines.drawTarget(sheet, null, stationSlice(shape, points, at, f0 * total), base, group, clips, options);
          // Dotted conflict lines carry across the crossing road, untrimmed; a
          // weaving gap has no line at all.
          if (kind !== "blank") {
            const lane = bikeType(road,k) ? k : k-1;
            const conflictShape=solved?bikeMarkingShape(sheet,road,lane,shape,solved):shape;
            // Independent edges already follow this exposed pavement edge,
            // so solid and dotted stretches must not offset it a second time.
            const extra=independentBike?0:bikePavementExtra(sheet,road,conflictShape,lane,k-lane);
            const conflictPoints=extra?offset(points,extra):points;
            const centerLength = polylineLength(shape.line), scale = feetToPixels(sheet,1);
            const start = f0*centerLength/scale, length = (f1-f0)*centerLength/scale;
            const phase = lanePhase(sheet,road,lane,solved)/scale + start;
            for (const [a,b] of window.StripeMaker.markingCatalog.stretches("dotted",length,phase)) {
              const p0 = f0+(a*scale/centerLength), p1 = f0+(b*scale/centerLength);
              lines.drawTarget(sheet,null,stationSlice(shape,conflictPoints,p0*centerLength,p1*centerLength),{style:"solid",color:"white"},group,crosswalkCuts,options);
            }
          }
          at = f1 * total;
        }
        if (base && at < total) lines.drawTarget(sheet, null, stationSlice(shape, points, at, total), base, group, clips, options);
      };
      for (let k = 0; k <= road.lanes; k++) {
        const gap=shape.gapEnds?.some(ends=>ends[k]?.width>0);
        if(k>0&&k<road.lanes&&gap){
          const left=offset(shape.line,i=>shape.laneBounds[i][k-1][1]),right=offset(shape.line,i=>shape.laneBounds[i][k][0]);
          const total=polylineLength(shape.line),island=[...left,...right.slice().reverse()];
          for(const e of [0,1]){
            const a=e?total/2:0,b=e?total:total/2;
            const l=stationSlice(shape,left,a,b),r=stationSlice(shape,right,a,b);
            const fill=document.createElementNS(SVG,"path");fill.setAttribute("d",`${pathData([...l,...r.slice().reverse()])}Z`);
            fill.setAttribute("fill",(shape.gapEnds[e][k].width?shape.gapEnds[e][k].surface:shape.gapEnds[1-e][k].surface)==="concrete"?CONCRETE:GRASS);group.append(fill);
            for(const edge of [l,r])lines.drawTarget(sheet,null,edge,{style:"solid",color:"white"},group,[...polygons,...crosswalkCuts],{edge:true});
          }
          lines.drawTarget(sheet,`r:${road.id}:${k}`,boundary(shape,k),{style:"skip",color:"white"},group,[...polygons,island,...crosswalkCuts]);
          continue;
        }
        const split = k > 0 && k < road.lanes && bike(k - 1) !== bike(k);
        // Standalone bike facilities leave their outer edges unmarked outside
        // conflicts. Keep the editable targets and dotted crossing ranges.
        let line = k === 0 ? (bike(0) ? null : { style: "solid", color: road.medianEdges?.L?"white":"yellow" })
          : k === road.lanes ? (bike(k - 1) ? null : { style: "solid", color: "white" })
          : split ? { style: "solid", color: "white" } : { style: "skip", color: "white" };
        // Exhibit 223-3 B and 711-001: the vehicle lane becoming turn-only
        // has a 12-inch 3'-9' lane-drop line, not the normal 6-inch 10'-30'.
        const drop=solved&&bikeTransitions(sheet,solved).find(t=>!t.entering&&t.road===road&&k===(t.lane>0?t.lane-1:t.lane+2));
        if(drop)line={style:"dottedLaneDrop",color:"white"};
        const bikeLane=bike(k)?k:bike(k-1)?k-1:null;
        const markingShape=solved&&bikeLane!=null?bikeMarkingShape(sheet,road,bikeLane,shape,solved):shape;
        if(drop) {
          // The 12-inch vehicle divider ends where the unmarked weave begins;
          // beyond it the relocated bike lane separates through/turn traffic.
          const points=boundary(shape,k),key=`r:${road.id}:${k}`;
          lines.drawTarget(sheet,key,points,null,group,polygons);
          if(drop.gapStart>0)lines.drawTarget(sheet,null,stationSlice(shape,points,0,drop.gapStart),line,group,[...polygons,...crosswalkCuts]);
        } else drawLine(k, bikeEdgeLine(sheet,road,markingShape,k), line, solved ? `r:${road.id}:${k}` : null, { edge: k === 0 || k === road.lanes || split });
        // The buffer goes on the bike lane's through-lane side: its left, or its
        // right for a bike lane on the road's left edge. A keyhole (a bike lane
        // with a turn lane outside it) keeps a single 6" line on the turn side
        // (711-001 sheet 4). At a conflict the double line is dotted too (FDM 223.5.2).
        const into = split ? (bike(k) ? k : k - 1) : -1;
        const throughSide = into >= 0 && (into > 0 ? k === into : k === into + 1);
        if (throughSide && bikeType(road, into) === "bufferedBike") {
          const offset = inchesToPixels(sheet, BIKE_BUFFER_INCHES) * (into === k ? 1 : -1);
          drawLine(k, boundary(markingShape, k, offset), { style: "solid", color: "white" }, null, { edge: true });
        }
      }
      // Once the bike lane crosses inward, the pavement's outside edge
      // belongs to the departing vehicle lane. Carry its white edge into the
      // ramp; the bike route's shifted outer dots are not a pavement edge.
      for(const t of solved?bikeTransitions(sheet,solved):[])if(!t.entering&&t.road===road&&solved.dropLaneEnds.has(`${road.id}:1:${t.lane-1}`)) {
        const points=boundary(shape,road.lanes);
        lines.drawTarget(sheet,null,stationSlice(shape,points,Math.max(0,t.gapStart),t.total),{style:"solid",color:"white"},group,[...polygons,...crosswalkCuts],{edge:true});
      }
      // A two-way bike track's yellow center line runs down its middle.
      for (let lane = 0; lane < road.lanes; lane++) {
        if (bikeType(road, lane) !== "twoWayBike") continue;
        const left = boundary(shape, lane), right = boundary(shape, lane + 1);
        const middle = left.map((p, i) => ({ x: (p.x + right[i].x) / 2, y: (p.y + right[i].y) / 2 }));
        lines.drawTarget(sheet, null, middle, { style: "bikewayCenter", color: "yellow" }, group, polygons, { edge: true });
      }
      const center = solved && centerTarget(sheet, road, shape);
      if (center) lines.drawTarget(sheet, center.key, center.points, null, group, polygons);
      layers.markings.append(group);
      let ring = null;
      if (className === "selected") {
        ring = band.cloneNode();
        ring.setAttribute("d",`${pathData([...boundary(shape,0,-margin),...boundary(shape,road.lanes,margin).reverse()])}Z`);
        ring.setAttribute("class", "roadOutline");
        layers.selection.append(ring);
      }
      return { band, group, ring };
    }

    // Bike lane conflicts: stretches of each bike lane's lines (by boundary,
    // as fractions along the road) that turn 2'-4' dotted where traffic crosses
    // the bike lane (FDM 223.5.2-223.5.3; Standard Plans 711-001 sheets 5-6):
    // - a keyhole: a turn lane added at this road's start outside the bike lane,
    //   over that lane's taper (L1; 150 ft when it has none), on both sides
    //   (FDM Exhibit 223-3 A; the bike lane itself stays straight);
    // - a road splitting off at this road's start or merging in at its end, over
    //   the stretch its pavement crosses the bike lane, on both sides;
    // - a road beside it there, on the outer side, the first 150 ft.
    const CONFLICT_SAMPLE_FEET = 2;
    // - a bike lane that moves over at a joint (its continuation a lane or more
    //   to the side, as where the lane inside it drops off into a ramp or turn
    //   lane): FDM Exhibit 223-3 B, 50 ft of skip lines at the old position, a
    //   30 ft unmarked weaving gap on the wider approach, then 20 ft of skip
    //   lines at the new position before the through-road joint.
    const MOVE_OVER = { before: 50, gap: 30, after: 20 };
    // FDM 2027 Exhibit 223-3 D (minimums) and A (design-speed L1 table).
    const FREE_FLOW = { before: 100, gap: 50, after: 50 };
    const BIKE_L1 = {35:70,40:80,45:85,50:105,55:125,60:145,65:170};
    // A/B/D are paths, not just dash changes on unrelated lane boundaries.
    // Cache actual lane-change routes in drawing coordinates, retaining the
    // physical lane model so vehicle lanes and node links are not renumbered.
    // A through-lane anchor can change lane indexes when lanes are added on
    // the opposite edge. Match the bike facilities using that anchor rather
    // than requiring equal indexes or an explicit bike-to-bike joint link.
    function bikeTransitionLinks(sheet, joint) {
      const links = laneLinks(sheet, joint), result = [...links];
      for (const anchor of links) {
        const { from, to, fromLane, toLane } = anchor;
        for (const [key, config] of Object.entries(from.laneTypes ?? {})) {
          const lane = Number(key);
          if (config.conflict !== "drop" || !["bike", "bufferedBike"].includes(config.type)) continue;
          if (result.some(l => l.from === from && l.fromLane === lane && bikeType(l.to, l.toLane))) continue;
          const aligned = lane + toLane - fromLane;
          const candidates = Object.keys(to.laneTypes ?? {}).map(Number).filter(k =>
            ["bike", "bufferedBike"].includes(bikeType(to, k)) &&
            (lane === from.lanes - 1 ? k < aligned : lane === 0 && k > aligned));
          candidates.sort((a, b) => Math.abs(a - aligned) - Math.abs(b - aligned));
          if (candidates.length) result.push({ ...anchor, fromLane: lane, toLane: candidates[0] });
        }
      }
      return result;
    }
    function bikeTransitions(sheet, solved) {
      if (solved.bikeTransitions) return solved.bikeTransitions;
      const transitions = solved.bikeTransitions = [];
      for (const joint of sheet.joints) for (const link of bikeTransitionLinks(sheet, joint)) {
        const {from,to,fromLane,toLane}=link;
        if (!["bike","bufferedBike"].includes(bikeType(from,fromLane)) || !bikeType(to,toLane)) continue;
        if ([from.laneTypes[fromLane],to.laneTypes[toLane]].some(t=>["separate","channelized"].includes(t?.conflict))) continue;
        const a=lanePoint(sheet,from,1,fromLane,solved),b=lanePoint(sheet,to,0,toLane,solved);
        const delta={x:b.x-a.x,y:b.y-a.y};
        if(Math.hypot(delta.x,delta.y)<feetToPixels(sheet,from.laneWidth)/2)continue;
        const lateral=dot(delta,rightOf(travelAt(from,1,solved)));
        const entering=(fromLane>0?lateral>0:lateral<0) && laneLinks(sheet,joint).some(l=>l.to===to&&l.from!==from&&!bikeType(l.from,l.fromLane));
        const road=entering?to:from,lane=entering?toLane:fromLane;
        const shape=shapeOf(sheet,road,solved),total=polylineLength(shape.line),scale=feetToPixels(sheet,1);
        // Exhibit B: 50 dotted + 30 unmarked + 20 dotted, all before
        // the turn separates. D: 100 + 50 + 50 on the widened receiving road.
        const defaults=entering?FREE_FLOW:MOVE_OVER;
        const requested=Number(road.laneTypes[lane].conflictLength);
        const factor=Number.isFinite(requested)&&requested>0
          ? Math.min(requested,total/scale)/(defaults.before+defaults.gap+defaults.after) : 1;
        const dimensions=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,v*factor]));
        const start=entering?0:total-(dimensions.before+dimensions.gap+dimensions.after)*scale;
        const gapStart=start+dimensions.before*scale,gapEnd=gapStart+dimensions.gap*scale;
        const other=entering?from:to,otherLane=entering?fromLane:toLane;
        const otherShape=shapeOf(sheet,other,solved),otherEnd=entering?otherShape.line.length-1:0;
        const ownEnd=entering?0:shape.line.length-1;
        const targetTangent=otherShape.line[otherEnd].tangent??travelAt(other,entering?1:0,solved);
        const ownTangent=shape.line[ownEnd].tangent??travelAt(road,entering?0:1,solved);
        const along=[0];
        for(let i=1;i<shape.line.length;i++)along.push(along[i-1]+Math.hypot(shape.line[i].x-shape.line[i-1].x,shape.line[i].y-shape.line[i-1].y));
        const bikeEdges={};
        for(const side of [0,1]) {
          const edge=boundary(shape,lane+side),target=boundary(otherShape,otherLane+side)[otherEnd];
          bikeEdges[lane+side]=edge.map((p,i)=>{
            const progress=Math.max(0,Math.min(1,(along[i]-gapStart)/(gapEnd-gapStart)));
            // The crossover changes lateral position at a constant rate.
            // Preserve one edge sample per centerline station for stationSlice.
            const blend=entering?1-progress:progress;
            const distance=along[i]-(entering?0:total);
            // Blend onto the receiving edge's tangent ray, rather than
            // translating the original curved edge. Translation retained the
            // original road's curvature after the crossover, bending the final
            // dotted section away from the receiving lane before the joint.
            const tangent=shape.line[i].tangent??ownTangent;
            const targetPoint={x:target.x+distance*targetTangent.x,y:target.y+distance*targetTangent.y};
            return {x:p.x+blend*(targetPoint.x-p.x),
              y:p.y+blend*(targetPoint.y-p.y),
              tangent:unit({x:tangent.x+blend*(targetTangent.x-ownTangent.x),y:tangent.y+blend*(targetTangent.y-ownTangent.y)})};
          });
        }
        transitions.push({...link,road,lane,entering,start,gapStart,gapEnd,total,shape:{...shape,bikeEdges}});
      }
      return transitions;
    }
    function bikeMarkingShape(sheet,road,lane,shape,solved) {
      return bikeTransitions(sheet,solved).find(t=>t.road===road&&t.lane===lane)?.shape??shape;
    }
    function bikeConflicts(sheet, road, shape, solved) {
      const out = new Map(), blanks = new Map();
      const add = (k, f0, f1) => { f0=Math.max(0,f0);f1=Math.min(1,f1);if (f1 > f0) out.set(k, [...out.get(k) ?? [], [f0,f1]]); };
      const blank = (k, f0, f1) => { f0=Math.max(0,f0);f1=Math.min(1,f1);if (f1 > f0) blanks.set(k, [...blanks.get(k) ?? [], [f0,f1]]); };
      const total = polylineLength(shape.line), partner = pairOf(sheet, road);
      if (!total) return out;
      for (let lane = 0; lane < road.lanes; lane++) {
        const type = bikeType(road, lane);
        if (!type || type === "twoWayBike") continue;
        const layout = road.laneTypes[lane].conflict ?? "auto";

        // The through-lane side is the bike lane's left unless it's on the left edge.
        const inner = lane > 0 || road.lanes === 1 ? lane : lane + 1, outer = inner === lane ? lane + 1 : lane;
        const outsideLane = inner === lane ? lane + 1 : lane - 1;
        // Entry and exit tapers both cross a straight bike lane (FDM 223,
        // Exhibits 223-1 bus bay and 223-3 A/C). Treat merges symmetrically.
        if (outsideLane >= 0 && outsideLane < road.lanes) for (const e of [0, 1]) {
          const joint = jointOf(sheet, road.ends[e].joint);
          const links = joint ? laneLinks(sheet, joint) : [];
          const continues = k => links.some(l => e ? l.from === road && l.fromLane === k : l.to === road && l.toLane === k);
          const taper = shape.tapers.get(`${e}:${outsideLane}`) ?? 0;
          if (!taper && (!continues(lane) || continues(outsideLane))) continue;
          const designLength = layout === "separate" && BIKE_L1[road.laneTypes[lane].designSpeed];
          const span = Math.min(1, (designLength ? feetToPixels(sheet,designLength) : taper || feetToPixels(sheet, KEYHOLE_DOTTED_FEET)) / total);
          for (const k of [inner, outer]) e ? add(k, 1 - span, 1) : add(k, 0, span);
        }
        // FDM 223.5.2 (2027), intersection approach: 150 ft of 2'-4'
        // dotted buffer striping. A keyhole already separates turning traffic;
        // do not introduce another merge across it at the intersection mouth.
        const approach = (sheet.intersections ?? []).some(item => item.approaches.some(a =>
          a.links?.some(l => l.road === road.id && l.e === 1) ||
          (a.binding && roadOf(sheet, a.binding.road)?.ends[a.binding.e]?.joint === road.ends[1].joint)));
        // The approach treatment is for cyclists beside motor traffic. A
        // separate bicycle road has no adjacent right-turn merge; its actual
        // driveway crossings are still detected geometrically below.
        if (approach && !independentBikeRoad(road) && outsideLane >= road.lanes) {
          add(inner, Math.max(0, 1 - feetToPixels(sheet, KEYHOLE_DOTTED_FEET) / total), 1);
        }
        // Moving over at either end: where the bike lane continues (or comes from)
        // a lane or more to the side.
        const moveOverEnds = new Set();
        for (const t of bikeTransitions(sheet,solved)) {
          const upstream=t.from===road&&t.fromLane===lane,downstream=t.to===road&&t.toLane===lane;
          if(!upstream&&!downstream)continue;
          moveOverEnds.add(upstream?1:0);
          if(t.road!==road)continue;
          for(const k of [inner,outer]) {
            add(k,t.start/total,t.gapStart/total);
            // Optional continuous crossing; default retains the exhibit weaving gap.
            (road.laneTypes[lane].continueCrossover ? add : blank)(k,t.gapStart/total,t.gapEnd/total);
            add(k,t.gapEnd/total,(t.entering?t.gapEnd+feetToPixels(sheet,50):total)/total);
          }
        }
        const left = boundary(shape, lane), right = boundary(shape, lane + 1);
        const middle = left.map((p, i) => ({ x: (p.x + right[i].x) / 2, y: (p.y + right[i].y) / 2 }));
        const step = Math.max(feetToPixels(sheet, CONFLICT_SAMPLE_FEET), total / 2048), reach = total;
        const middleLengths = measurePolyline(middle);
        for (const [e, joint] of [[0, road.ends[0].joint], [1, road.ends[1].joint]]) {
          // Exhibit 223-3 B already defines this crossing. Generic ramp overlap
          // must not extend its 20-ft receiving dotted zone to the gore tip.
          if (moveOverEnds.has(e)) continue;
          for (const other of sheet.roads) {
            if (other === road || other === partner) continue;
            // A detached bike facility can cross a driveway without sharing
            // a road joint. Its green conflict treatment must still follow
            // the actual crossing pavement. Scan these once, from the start.
            const detached=Array.from({length:road.lanes},(_,k)=>Boolean(bikeType(road,k))).every(Boolean)
              && other.ends.every(end=>!road.ends.some(own=>own.joint===end.joint))
              && Array.from({length:other.lanes},(_,k)=>!bikeType(other,k)).some(Boolean);
            if(other.ends[e].joint!==joint && !(detached&&e===0))continue;
            // Roads continuing this bike lane don't cross it.
            const otherShape = shapeOf(sheet, other, solved);
            const outline = [...boundary(otherShape, 0), ...boundary(otherShape, other.lanes).reverse()];
            let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
            for (const p of outline) { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); }
            let first = null, last = null;
            const crossings = [];
            for (let d = step / 2; d < reach; d += step) {
              const at = e ? total - d : d, p = slicePolyline(middle, at, at + 0.01, middleLengths)[0];
              const level=window.StripeMaker.levels?.levelAt;
              const sameLevel=!level||level(sheet,p,road.id)===level(sheet,p,other.id);
              if (sameLevel && p.x>=minX && p.x<=maxX && p.y>=minY && p.y<=maxY && insidePolygon(p, outline)) { first ??= d; last = d; }
              else if (first != null) { crossings.push([first, last]); first = last = null; }
            }
            if (first != null) crossings.push([first, last]);
            for (const [start, finish] of crossings) {
              // Keep separate crossings separate on curved roads; do not paint
              // the non-conflict stretch between them or before a remote crossing.
              const [f0, f1] = e ? [(total - finish - step) / total, (total - start + step) / total]
                : [(start - step) / total, (finish + step) / total];
              add(inner, f0, f1);
              add(outer, f0, f1);
            }
            if (!crossings.length && !detached) {
              // Beside it on the outer side (a turn lane or ramp starting alongside).
              const edge = boundary(shape, outer), outward = inchesToPixels(sheet, 24) * (outer === lane + 1 ? 1 : -1);
              const probe = slicePolyline(edge, e ? total - step : step, e ? total - step + 0.01 : step + 0.01)[0];
              const n = unit(rightOf(unit({ x: edge.at(-1).x - edge[0].x, y: edge.at(-1).y - edge[0].y })));
              if (insidePolygon({ x: probe.x + n.x * outward, y: probe.y + n.y * outward }, outline)) {
                const span = Math.min(1, feetToPixels(sheet, KEYHOLE_DOTTED_FEET) / total);
                e ? add(outer, 1 - span, 1) : add(outer, 0, span);
              }
            }
          }
        }
      }
      // A standalone crossing can pass through two carriageways with an
      // asphalt median between them. Carry an existing conflict treatment
      // through that unpainted gap, without creating conflicts on quiet paths.
      if(independentBikeRoad(road)&&[...out.values()].some(r=>r.length)) {
        const areas=medianEdgeCuts(sheet,solved,false);
        if(areas.length)for(let lane=0;lane<road.lanes;lane++) {
          const left=boundary(shape,lane),right=boundary(shape,lane+1);
          const middle=left.map((p,i)=>({x:(p.x+right[i].x)/2,y:(p.y+right[i].y)/2})),length=polylineLength(middle);
          let at=0;
          for(const part of window.StripeMaker.markingTrim.trim(middle,areas)) {
            if(part.distance>at){add(lane,at/length,part.distance/length);add(lane+1,at/length,part.distance/length);}
            at=part.distance+polylineLength(part.points);
          }
          if(at<length){add(lane,at/length,1);add(lane+1,at/length,1);}
        }
      }
      // Overlapping stretches on a line are merged, and a weaving gap wins over
      // dotting: [f0, f1, "dotted" | "blank"] in order along the road.
      const merge = ranges => {
        const merged = [];
        for (const r of [...ranges].sort((p, q) => p[0] - q[0])) merged.length && r[0] <= merged.at(-1)[1] ? merged.at(-1)[1] = Math.max(merged.at(-1)[1], r[1]) : merged.push([r[0], r[1]]);
        return merged;
      };
      const result = new Map();
      for (const k of new Set([...out.keys(), ...blanks.keys()])) {
        const gaps = merge(blanks.get(k) ?? []), pieces = [];
        for (const [a, b] of merge(out.get(k) ?? [])) {
          let start = a;
          for (const [g0, g1] of gaps) {
            if (g1 <= start || g0 >= b) continue;
            if (g0 > start) pieces.push([start, g0, "dotted"]);
            start = Math.max(start, g1);
          }
          if (start < b) pieces.push([start, b, "dotted"]);
        }
        result.set(k, [...pieces, ...gaps.map(([a, b]) => [a, b, "blank"])].sort((p, q) => p[0] - q[0]));
      }
      return result;
    }
    // Repeated slices can share segment lengths. Retain the lengths themselves
    // (not differences of accumulated stations) to keep interpolation exact.
    function measurePolyline(points) {
      const along = [0], lengths = [0];
      for (let i = 1; i < points.length; i++) {
        const p = points[i - 1], q = points[i], len = Math.hypot(q.x - p.x, q.y - p.y);
        lengths.push(len); along.push(along[i - 1] + len);
      }
      return { along, lengths };
    }
    // A polyline between arc lengths a and b. Measurements belong only to the
    // unchanged points passed by this caller, never to a later road edit.
    function slicePolyline(points, a, b, measured) {
      const out = [];
      let first = 1;
      if (measured) {
        let low = 1, high = points.length;
        while (low < high) { const mid = (low + high) >> 1; if (measured.along[mid] < a) low = mid + 1; else high = mid; }
        first = low;
      }
      let walked = measured?.along[first - 1] ?? 0;
      for (let i = first; i < points.length; i++) {
        if (measured && walked > b) break;
        const p = points[i - 1], q = points[i], len = measured ? measured.lengths[i] : Math.hypot(q.x - p.x, q.y - p.y);
        const at = s => ({ x: p.x + (q.x - p.x) * (s - walked) / (len || 1), y: p.y + (q.y - p.y) * (s - walked) / (len || 1) });
        if (walked + len >= a && walked <= b) {
          if (!out.length) out.push(at(Math.max(a, walked)));
          out.push(at(Math.min(b, walked + len)));
        }
        walked += len;
      }
      return out.length > 1 ? out : points.slice(0, 2);
    }
    // A lane's pavement between arc lengths a and b along the road (sheet pixels).
    function stationSlice(shape, edge, a, b) {
      const along = [0];
      for (let i = 1; i < shape.line.length; i++) along.push(along[i - 1] + Math.hypot(shape.line[i].x - shape.line[i - 1].x, shape.line[i].y - shape.line[i - 1].y));
      const at = s => {
        let i = 1;
        while (i < along.length - 1 && along[i] < s) i++;
        const f = Math.max(0, Math.min(1, (s - along[i - 1]) / ((along[i] - along[i - 1]) || 1)));
        return { x: edge[i - 1].x + (edge[i].x - edge[i - 1].x) * f, y: edge[i - 1].y + (edge[i].y - edge[i - 1].y) * f };
      };
      return [at(a), ...edge.filter((_, i) => along[i] > a && along[i] < b), at(b)];
    }
    function laneBoundary(shape,lane,side,extra=0){
      const k=lane+side;
      if(shape.bikeEdges?.[k]||shape.pavementEdges?.[k]||!shape.laneBounds)return boundary(shape,k,extra);
      return shapeOffset(shape,i=>shape.laneBounds[i][lane][side]+extra);
    }
    function laneStrip(shape, lane, a, b) {
      return [...stationSlice(shape,laneBoundary(shape,lane,0),a,b), ...stationSlice(shape,laneBoundary(shape,lane,1),a,b).reverse()];
    }
    function bikePavementExtra(sheet,road,shape,lane,side) {
      if(!bikeType(road,lane)||shape.bikeEdges?.[lane+side])return 0;
      const bufferSide=lane>0||road.lanes===1?0:1;
      if(bikeType(road,lane)==="bufferedBike"&&side===bufferSide)return 0;
      if(side===0&&lane===0)return -inchesToPixels(sheet,PAVEMENT_MARGIN_INCHES);
      if(side===1&&lane===road.lanes-1)return inchesToPixels(sheet,PAVEMENT_MARGIN_INCHES);
      return 0;
    }
    function bikeEdgeLine(sheet,road,shape,k,points=boundary(shape,k)) {
      if((k!==0&&k!==road.lanes)||!independentBikeRoad(road))return points;
      const lane=k===0?0:road.lanes-1,side=k===0?0:1;
      // Share the conflict stripe/green-pavement edge, including the existing
      // pavement apron, throughout a standalone bicycle facility. This is a
      // drawing offset; the lane's width and riding-space placement stay put.
      const extra=bikePavementExtra(sheet,road,shape,lane,side);
      return extra?offset(points,extra):points;
    }
    function surfaceStrip(sheet,road,shape,lane,a,b,color) {
      const green=color==="green"&&Boolean(bikeType(road,lane));
      const buffer=green&&bikeType(road,lane)==="bufferedBike"?inchesToPixels(sheet,BIKE_BUFFER_INCHES):0;
      const bufferOnLeft=lane>0||road.lanes===1;
      // At an exposed bike-lane edge, fill the pavement apron as well. Keep
      // buffers and neighboring travel lanes clear. Virtual crossover edges
      // stay on their conflict path rather than gaining a pavement apron.
      const left=buffer&&bufferOnLeft?buffer:green?bikePavementExtra(sheet,road,shape,lane,0):0;
      const right=buffer&&!bufferOnLeft?-buffer:green?bikePavementExtra(sheet,road,shape,lane,1):0;
      return [...stationSlice(shape,laneBoundary(shape,lane,0,left),a,b),
        ...stationSlice(shape,laneBoundary(shape,lane,1,right),a,b).reverse()];
    }
    // Colored pavement split at a cut (`fraction` along `first`): the part past it
    // moves to `second`.
    function splitSurfaces(sheet, first, second, fraction) {
      for (const surface of [...(sheet.surfaces ?? [])]) {
        if (surface.on.road !== first.id) continue;
        if (surface.to <= fraction) Object.assign(surface, { from: surface.from / fraction, to: surface.to / fraction });
        else if (surface.from >= fraction) Object.assign(surface, { on: { ...surface.on, road: second.id }, from: (surface.from - fraction) / (1 - fraction), to: (surface.to - fraction) / (1 - fraction) });
        else {
          const nextOrder = Math.min(...sheet.surfaces.filter(s => s.span === surface.span && s.order > surface.order).map(s => s.order), (surface.order ?? 0) + 1);
          sheet.surfaces.push({ ...structuredClone(surface), order: ((surface.order ?? 0) + nextOrder) / 2, id: crypto.randomUUID(), on: { ...surface.on, road: second.id }, from: 0, to: (surface.to - fraction) / (1 - fraction) });
          Object.assign(surface, { from: surface.from / fraction, to: 1 });
        }
      }
    }

    // Gores: where two road ends leave a joint on the same side and their facing
    // edges spread apart, the space between them can be marked. Same-direction
    // roads (a split or merge) get a gore; opposite directions get traffic
    // separation. Each candidate is keyed by its two road ends.
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
    // Retain every original boundary vertex. Uniform samples alone shortcut
    // bends and let the underlying yellow road edge peek past a white gore line.
    function sampleGoreEdges(first, second, count, total, meetAgain = false) {
      const lengths = [first,second].map(edge=>meetAgain?polylineLength(edge):total);
      const stations = Array.from({length: count + 1}, (_, i) => i / count);
      for (const [n,edge] of [first, second].entries()) {
        let distance = 0;
        for (let i = 1; i < edge.length; i++) {
          distance += Math.hypot(edge[i].x-edge[i-1].x, edge[i].y-edge[i-1].y);
          if (distance < lengths[n]) stations.push(distance/lengths[n]);
        }
      }
      const sorted = [...new Set(stations)].sort((a,b)=>a-b);
      return [first, second].map((edge,n) => resample(edge, sorted.length-1, lengths[n], sorted.map(f=>f*lengths[n])));
    }
    const sideOf = ({ e, end }) => ((e === 0) === (end.sign === 1) ? 1 : -1);
    const goreKey = (a, b) => [`${a.road.id}:${a.e}`, `${b.road.id}:${b.e}`].sort().join("|");
    function goreCandidates(sheet, solved) {
      if (solved.gores) return solved.gores;
      solved.gores = new Map();
      const tolerance = inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES) + feetToPixels(sheet, 1);
      for (const joint of sheet.joints) {
        const here = attachments(sheet, joint, solved);
        here.forEach((a, i) => here.slice(i + 1).forEach(b => {
          if (a.road === b.road || pairOf(sheet, a.road) === b.road || sideOf(a) !== sideOf(b)) return;
          // The facing edges are the two edges, one per road, that start closest.
          // Each edge's side across the joint: only a pair of edges facing each
          // other across the gap can bound a gore.
          const edges = item => [0, item.road.lanes].map(k => {
            const points = boundary(shapeOf(sheet, item.road, solved), k);
            return { points: item.e ? points.reverse() : points, side: (k ? 1 : -1) * item.end.sign };
          });
          let best = null, crossed = null;
          for (const e1 of edges(a)) for (const e2 of edges(b)) {
            if (e1.side !== -e2.side) continue;
            const gap = Math.hypot(e1.points[0].x - e2.points[0].x, e1.points[0].y - e2.points[0].y);
            if (!best || gap < best.gap) best = { e1: e1.points, e2: e2.points, gap };
            // A lane split (a road fed head-on from another's edge lanes) starts
            // overlapping it: its facing edge starts lanes inside the other road
            // and crosses that road's edge line downstream. The gore starts at
            // the crossing (the theoretical gore point).
            if (gap > tolerance && gap < feetToPixels(sheet, Math.max(a.road.lanes, b.road.lanes) * MAX_LANE_WIDTH + 2)) {
              const cross = firstCrossing(e1.points, e2.points);
              if (cross && (!crossed || cross.along < crossed.along)) crossed = { ...cross, gap: 0 };
            }
          }
          if ((!best || best.gap > tolerance) && crossed) best = crossed;
          if (!best || best.gap > tolerance) return;
          const meetAgain = a.road.ends[1-a.e].joint === b.road.ends[1-b.e].joint;
          let roadCuts=[];
          if(meetAgain&&a.e===b.e){
            // The gap can reach a through road before these two branches
            // reach their logical shared mouth. Stop each facing edge at its
            // first contact with that connected pavement, not inside a lane.
            const farJoint=a.road.ends[1-a.e].joint;
            roadCuts=sheet.roads.filter(road=>road!==a.road&&road!==b.road&&road.ends.some(end=>end.joint===farJoint))
              .flatMap(road=>fittedHostPolygons(sheet,road,shapeOf(sheet,road,solved),solved));
            if(roadCuts.length){
              const edges=[best.e1,best.e2].map(edge=>window.StripeMaker.markingTrim.trim(edge,roadCuts).find(part=>part.distance<1e-6)?.points);
              if(edges.some(edge=>!edge||edge.length<2))return;
              best={...best,e1:edges[0],e2:edges[1]};
            }
          }
          const total = Math.min(polylineLength(best.e1), polylineLength(best.e2));
          const count = Math.min(400, Math.max(20, Math.ceil(total / feetToPixels(sheet, 2))));
          // When branches meet again, each boundary must reach that shared
          // mouth. Equal distances stop the longer (outer) edge short.
          const [e1, e2] = sampleGoreEdges(best.e1, best.e2, count, total, meetAgain);
          const mid = e1.map((p, n) => ({ x: (p.x + e2[n].x) / 2, y: (p.y + e2[n].y) / 2 }));
          const width = e1.map((p, n) => Math.hypot(e2[n].x - p.x, e2[n].y - p.y));
          if (Math.max(...width) < feetToPixels(sheet, 4)) return;
          const along = [0];
          for (let n = 1; n < mid.length; n++) along.push(along[n - 1] + Math.hypot(mid[n].x - mid[n - 1].x, mid[n].y - mid[n - 1].y));
          const key = goreKey(a, b);
          solved.gores.set(key, {
            key, e1, e2, mid, width, along, roadCuts,
            rejoins: meetAgain && a.e === b.e,
            same: a.e === b.e,          // both start (split) or both end (merge) here
            split: a.e === 0 && b.e === 0,
            awayFirst: a.e === 0,       // e1's road leaves the gore point
          });
        }));
      }
      // A ramp can branch from the extra lane of a road whose remaining lanes
      // enter an intersection at this same joint. Its facing boundary is then
      // the intersection corner, rather than a second departing road.
      for (const joint of sheet.intersections?.length ? sheet.joints : []) {
        const here=attachments(sheet,joint);
        for (const source of here) {
          const continuations=window.StripeMaker.intersections?.goreContinuationEdges(sheet,nodeRef(source.road,source.e),solved)??[];
          if (!continuations.length) continue;
          for (const branch of here) {
            if (branch.road===source.road || branch.e===source.e || branch.end.sign!==source.end.sign || pairOf(sheet,source.road)===branch.road) continue;
            const key=goreKey(source,branch);
            if (solved.gores.has(key)) continue;
            let best=null;
            for (const corner of continuations) for (const k of [0,branch.road.lanes]) {
              const edge=boundary(shapeOf(sheet,branch.road,solved),k);
              if (branch.e) edge.reverse();
              const gap=Math.hypot(corner[0].x-edge[0].x,corner[0].y-edge[0].y);
              if (gap>tolerance || (best && gap>=best.gap)) continue;
              // Both boundaries must lead into the same gap, not back into the
              // approaching road or across the opposite intersection corner.
              const a=unit({x:corner[1].x-corner[0].x,y:corner[1].y-corner[0].y});
              const b=unit({x:edge[1].x-edge[0].x,y:edge[1].y-edge[0].y});
              if (a.x*b.x+a.y*b.y<.5) continue;
              best={e1:corner,e2:edge,gap};
            }
            if (!best) continue;
            const total=Math.min(polylineLength(best.e1),polylineLength(best.e2));
            const count=Math.min(400,Math.max(20,Math.ceil(total/feetToPixels(sheet,2))));
            const [e1,e2]=sampleGoreEdges(best.e1,best.e2,count,total);
            const mid=e1.map((p,n)=>({x:(p.x+e2[n].x)/2,y:(p.y+e2[n].y)/2}));
            const width=e1.map((p,n)=>Math.hypot(p.x-e2[n].x,p.y-e2[n].y));
            if (Math.max(...width)<feetToPixels(sheet,4)) continue;
            const along=[0];
            for(let n=1;n<mid.length;n++)along.push(along[n-1]+Math.hypot(mid[n].x-mid[n-1].x,mid[n].y-mid[n-1].y));
            solved.gores.set(key,{key,e1,e2,mid,width,along,same:true,split:branch.e===0,awayFirst:branch.e===0});
          }
        }
      }
      for(const notch of window.StripeMaker.intersections?.goreNotches(sheet)??[]) {
        const total=Math.min(polylineLength(notch.e1),polylineLength(notch.e2));
        if(total<1)continue;
        const count=Math.min(400,Math.max(20,Math.ceil(total/feetToPixels(sheet,2))));
        const [e1,e2]=sampleGoreEdges(notch.e1,notch.e2,count,total);
        const mid=e1.map((p,n)=>({x:(p.x+e2[n].x)/2,y:(p.y+e2[n].y)/2}));
        const width=e1.map((p,n)=>Math.hypot(p.x-e2[n].x,p.y-e2[n].y));
        if(Math.max(...width)<feetToPixels(sheet,4))continue;
        const along=[0];for(let n=1;n<mid.length;n++)along.push(along[n-1]+Math.hypot(mid[n].x-mid[n-1].x,mid[n].y-mid[n-1].y));
        solved.gores.set(notch.key,{...notch,e1,e2,mid,width,along,same:true,awayFirst:notch.split});
      }
      return solved.gores;
    }
    // Where two polylines first cross, and both from that point on.
    function firstCrossing(p, q) {
      let along = 0;
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i], d1 = { x: b.x - a.x, y: b.y - a.y };
        for (let j = 1; j < q.length; j++) {
          const c = q[j - 1], d2 = { x: q[j].x - c.x, y: q[j].y - c.y };
          const den = d1.x * d2.y - d1.y * d2.x;
          if (Math.abs(den) < 1e-9) continue;
          const t = ((c.x - a.x) * d2.y - (c.y - a.y) * d2.x) / den, u = ((c.x - a.x) * d1.y - (c.y - a.y) * d1.x) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const point = { x: a.x + d1.x * t, y: a.y + d1.y * t };
          return { e1: [point, ...p.slice(i)], e2: [point, ...q.slice(j)], along: along + Math.hypot(d1.x, d1.y) * t };
        }
        along += Math.hypot(d1.x, d1.y);
      }
      return null;
    }
    const indexAt = (along, s) => {
      const i = along.findIndex(value => value >= s);
      return i < 0 ? along.length - 1 : i;
    };
    const goreTangent = (mid, i) => unit({ x: mid[Math.min(i + 1, mid.length - 1)].x - mid[Math.max(i - 1, 0)].x, y: mid[Math.min(i + 1, mid.length - 1)].y - mid[Math.max(i - 1, 0)].y });
    const goreDefaultSpacing = candidate => (candidate.same ? GORE_SPACING_FEET : 20);
    function goreLine(points, color, width, join, cuts = []) {
      const path = strokePath(points, color, width);
      if (cuts.length) path.setAttribute("d", window.StripeMaker.markingTrim.trim(points, cuts).map(part => pathData(part.points)).join(""));
      if (join) path.setAttribute("stroke-linejoin", "miter");
      return path;
    }
    // Paves the gore from its point to the marked length, then lays chevrons (same
    // direction) or diagonals (opposite directions) clipped to it.
    function drawGore(sheet, gore, candidate, layers, cuts = []) {
      const length = Math.min(feetToPixels(sheet, gore.length), candidate.along.at(-1));
      const last = indexAt(candidate.along, length);
      if (last < 1) return;
      const outline = [...candidate.e1.slice(0, last + 1), ...candidate.e2.slice(0, last + 1).reverse()];
      // The closing cross-section can span a curved receiving boundary. Clip
      // its pavement and full stripe widths there as well as stopping the
      // candidate edges. Successive clips preserve overlapping road unions.
      const cutIds=(candidate.roadCuts??[]).map((polygon,i)=>{
        const id=`gore-road-${sheet.id}-${gore.key.replace(/[^0-9]/g,'-')}-${i}`;
        const clip=document.createElementNS(SVG,'clipPath'),path=document.createElementNS(SVG,'path'),extent=Math.max(sheet.width,sheet.height,1)*4;
        clip.id=id;
        path.setAttribute('d',`M${-extent} ${-extent}L${extent} ${-extent}L${extent} ${extent}L${-extent} ${extent}Z${pathData(polygon)}Z`);
        path.setAttribute('clip-rule','evenodd');clip.append(path);layers.pavement.append(clip);
        return id;
      });
      const clipped=parent=>{
        for(const id of cutIds){const group=document.createElementNS(SVG,'g');group.setAttribute('clip-path',`url(#${id})`);parent.append(group);parent=group;}
        return parent;
      };
      const pavement=clipped(layers.pavement),markings=clipped(layers.markings);
      // Traffic separation is edged in 6" double yellow on both sides: the roads'
      // yellow edges plus a second line 10" inside each, meeting at the tip.
      const inner = !candidate.same && separationInner(sheet, candidate, last);
      const band = document.createElementNS(SVG, "path");
      band.setAttribute("class", `roadBand goreBand${gore.key === selectedGore ? " selected" : ""}`);
      band.setAttribute("d", `${pathData(outline)}Z`);
      pavement.append(band);
      if (gore.key === selectedGore) {
        const ring = band.cloneNode();
        ring.setAttribute("class", "roadOutline");
        clipped(layers.selection).append(ring);
      }
      const clip = document.createElementNS(SVG, "clipPath");
      clip.id = `gore-${sheet.id}-${gore.key.replace(/[^0-9]/g, "-")}`;
      const clipShape = band.cloneNode();
      clipShape.removeAttribute("class");
      if (inner) clipShape.setAttribute("d", `${pathData([...inner.e1, ...[...inner.e2].reverse()])}Z`);
      clip.append(clipShape);
      const stripes = document.createElementNS(SVG, "g");
      stripes.setAttribute("clip-path", `url(#${clip.id})`);
      const color = candidate.same ? WHITE : YELLOW;
      const stripe = inchesToPixels(sheet, GORE_STRIPE_INCHES);
      const spacing = feetToPixels(sheet, gore.spacing ?? goreDefaultSpacing(candidate));
      if (candidate.same) {
        const edges=[candidate.e1.slice(0,last+1),candidate.e2.slice(0,last+1)];
        const guide=polylineLength(edges[0])>=polylineLength(edges[1])?edges[0]:edges[1];
        const total=polylineLength(guide);
        const direction=candidate.split !== window.StripeMaker.traffic.reversed ? 1 : -1;
        stripes.setAttribute('class','goreChevrons');
        for(let s=spacing;s<total;s+=spacing) {
          const p=pointAtFraction(guide,s/total),a=pointAtFraction(guide,Math.max(0,s-.5)/total),b=pointAtFraction(guide,Math.min(total,s+.5)/total);
          const tangent=unit({x:b.x-a.x,y:b.y-a.y});
          const section=curvedHatchSection(outline,p,tangent,stripe);
          if(!section || section.width<stripe)continue;
          const {tip,at}=section;
          stripes.append(goreLine([at(direction,-1),tip,at(direction,1)],color,stripe,true,cuts));
        }
      } else {
        for (let s = spacing; s < length; s += spacing) {
          const i = indexAt(candidate.along, s);
          const w = candidate.width[i];
          if (w < stripe) continue;
          const m = candidate.mid[i];
          const t = goreTangent(candidate.mid, i);
          const n = unit({ x: candidate.e2[i].x - candidate.e1[i].x, y: candidate.e2[i].y - candidate.e1[i].y });
          const reach = w * 1.5;
          // Diagonals run from the arriving side toward the departing side as they
          // move away from the gore point, as drawn in 711-001.
          const side = (candidate.awayFirst ? -1 : 1) * window.StripeMaker.traffic.sign;
          const d = unit({ x: t.x + n.x * side, y: t.y + n.y * side });
          stripes.append(goreLine([{ x: m.x - d.x * reach, y: m.y - d.y * reach }, { x: m.x + d.x * reach, y: m.y + d.y * reach }], color, stripe, false, cuts));
        }
      }
      markings.append(clip, stripes);
      if (inner) {
        const lineWidth = inchesToPixels(sheet, LINE_INCHES);
        markings.append(goreLine(inner.e1, YELLOW, lineWidth, false, cuts), goreLine(inner.e2, YELLOW, lineWidth, false, cuts));
      }
      // Gores are outlined in 8" white over the roads' edge lines.
      if (candidate.same) {
        const lineWidth = inchesToPixels(sheet, GORE_LINE_INCHES);
        const outline=document.createElementNS(SVG,"g");
        outline.setAttribute("class","goreWhiteOutline");
        // A split that rejoins encloses one same-direction separator. Its
        // white edge lines continue to the merge even when the handle paints
        // only part of the pocket; it must not revert to yellow at that handle.
        // Open-ended branches still change back at the marked length.
        const edgeLast = candidate.rejoins ? candidate.e1.length - 1 : last;
        outline.append(goreLine(candidate.e1.slice(0, edgeLast + 1), WHITE, lineWidth, false, cuts), goreLine(candidate.e2.slice(0, edgeLast + 1), WHITE, lineWidth, false, cuts));
        markings.append(outline);
      }
    }
    // The inner lines of each side's double yellow, from where the sides are far
    // enough apart for both (where the inner lines meet) to the marked length.
    function separationInner(sheet, candidate, last) {
      const step = inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES);
      const first = candidate.width.findIndex(w => w >= step * 2);
      if (first < 0 || first >= last) return null;
      const e1 = [];
      const e2 = [];
      for (let i = first; i <= last; i++) {
        const a = candidate.e1[i];
        const b = candidate.e2[i];
        const n = unit({ x: b.x - a.x, y: b.y - a.y });
        e1.push({ x: a.x + n.x * step, y: a.y + n.y * step });
        e2.push({ x: b.x - n.x * step, y: b.y - n.y * step });
      }
      return { e1, e2 };
    }
    function goreAt(sheet, point) {
      const solved = solve(sheet);
      const candidates = goreCandidates(sheet, solved);
      for (const gore of sheet.gores) {
        const candidate = candidates.get(gore.key);
        if (!candidate) continue;
        const last = indexAt(candidate.along, feetToPixels(sheet, gore.length));
        if (last > 0 && insidePolygon(point, [...candidate.e1.slice(0, last + 1), ...candidate.e2.slice(0, last + 1).reverse()])) return gore.key;
      }
      return null;
    }
    // Drops gore markings whose roads no longer form a gore.
    function pruneGores(sheet) {
      if (!sheet?.gores?.length || !sheet.inchesPerPixel) return;
      const candidates = goreCandidates(sheet, solve(sheet));
      sheet.gores = sheet.gores.filter(gore => candidates.has(gore.key) && gore.length > 0);
    }

    // Medians are closed outlines clicked point by point. Points snap to the corners
    // and edges of road pavement, marked gores, and other medians, so medians of
    // different surfaces can share points and edges.
    const samePoint = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-3;
    const medianOf = (sheet, id) => sheet?.medians?.find(median => median.id === id);
    function nearestOn(points, point) {
      let best = null;
      for (let i = 0; i < points.length - 1; i++) {
        const p = points[i];
        const q = points[i + 1];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const squared = dx * dx + dy * dy;
        const f = squared ? Math.max(0, Math.min(1, ((point.x - p.x) * dx + (point.y - p.y) * dy) / squared)) : 0;
        const at = { x: p.x + dx * f, y: p.y + dy * f };
        const distance = Math.hypot(at.x - point.x, at.y - point.y);
        if (!best || distance < best.distance) best = { ...at, distance, s: i + f };
      }
      return best;
    }
    // Road pavement edges and marked gore outlines, which medians snap to and follow.
    const pavementBounds = new WeakMap();
    function nearPavement(edge, point, tolerance) {
      let box = pavementBounds.get(edge);
      if (!box) {
        box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
        for (const p of edge) {
          box.left = Math.min(box.left,p.x); box.right = Math.max(box.right,p.x);
          box.top = Math.min(box.top,p.y); box.bottom = Math.max(box.bottom,p.y);
        }
        pavementBounds.set(edge,box);
      }
      // These sampled edges belong to one solved geometry. A point outside
      // their expanded bounds cannot pass the existing distance tolerance.
      if (point.x < box.left-tolerance || point.x > box.right+tolerance ||
        point.y < box.top-tolerance || point.y > box.bottom+tolerance) return null;
      return nearestOn(edge,point);
    }
    const medianAnchorKey = on => on.intersection ? on.median != null ? `intersection:${on.intersection}:island:${on.median}` : `intersection:${on.intersection}:${on.approach}:${on.side}`
      : on.gore ? `gore:${on.gore}:${on.side}` : `${on.road}:${on.side}`;
    function pavementEdges(sheet, solved) {
      if (solved.pavementEdges) return solved.pavementEdges;
      const margin = inchesToPixels(sheet, PAVEMENT_MARGIN_INCHES);
      const corners = [];
      const edges = [];
      const byKey = new Map();
      // Paved areas (roads, marked gores, intersections less their medians), to
      // tell the pavement's outer edges from edges buried under other pavement.
      const paved = [];
      const holes = [];
      // Each road edge is tagged with its road and side (L, R, or the S and E end
      // caps), so median points on it can be anchored there and follow the road.
      for (const road of sheet.roads) {
        const shape = shapeOf(sheet, road, solved);
        const [left, right] = [boundary(shape, 0, -margin), boundary(shape, road.lanes, margin)];
        const sides = { L: left, R: right, S: [left[0], right[0]], E: [left.at(-1), right.at(-1)] };
        for (const [side, edge] of Object.entries(sides)) {
          edge.on = { road: road.id, side };
          byKey.set(`${road.id}:${side}`, edge);
          edges.push(edge);
        }
        corners.push(...[["L", 0], ["L", 1], ["R", 0], ["R", 1]].map(([side, f]) => ({ ...sides[side][f ? sides[side].length - 1 : 0], on: { road: road.id, side, f } })));
        paved.push([...left, ...[...right].reverse()]);
      }
      const candidates = goreCandidates(sheet, solved);
      for (const gore of sheet.gores) {
        const candidate = candidates.get(gore.key);
        const last = candidate ? indexAt(candidate.along, feetToPixels(sheet, gore.length)) : 0;
        if (last < 1) continue;
        // Gore edges and corners are anchored to the gore (its two edges up to
        // the marked length, and its end), so median points on them follow it.
        const [e1, e2] = [candidate.e1.slice(0, last + 1), candidate.e2.slice(0, last + 1)];
        const end = [e1[last], e2[last]];
        for (const [side, edge] of [["e1", e1], ["e2", e2], ["end", end]]) {
          edge.on = { gore: gore.key, side };
          byKey.set(medianAnchorKey(edge.on), edge);
        }
        corners.push({ ...e1[0], on: { gore: gore.key, side: "e1", f: 0 } }, { ...e1[last], on: { gore: gore.key, side: "e1", f: 1 } },
          { ...e2[last], on: { gore: gore.key, side: "e2", f: 1 } });
        edges.push(e1, e2, end);
        paved.push([...e1, ...[...e2].reverse()]);
      }
      const intersections = window.StripeMaker.intersections?.boundaries(sheet, solved);
      if (intersections) {
        paved.push(...intersections.paved ?? []);
        holes.push(...intersections.holes ?? []);
        corners.push(...intersections.corners);
        for (const edge of intersections.edges) {
          edges.push(edge);
          byKey.set(medianAnchorKey(edge.on), edge);
        }
      }
      const area = points => {
        const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        for (const p of points) Object.assign(box, { x0: Math.min(box.x0, p.x), y0: Math.min(box.y0, p.y), x1: Math.max(box.x1, p.x), y1: Math.max(box.y1, p.y) });
        return { points, box };
      };
      return (solved.pavementEdges = { corners, edges, byKey, paved: paved.map(area), holes: holes.map(area) });
    }
    function insideArea({ points, box }, p) {
      if (p.x < box.x0 || p.x > box.x1 || p.y < box.y0 || p.y > box.y1) return false;
      let hit = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j], b = points[i];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
      }
      return hit;
    }
    // A point is on the pavement's outer edge when somewhere just beside it (6")
    // isn't paved; points on lane lines, edge lines, or edges buried under
    // other pavement are paved all around.
    const EDGE_PROBE_INCHES = 6;
    function outerEdge(sheet, solved, p) {
      const { paved, holes } = pavementEdges(sheet, solved);
      const r = inchesToPixels(sheet, EDGE_PROBE_INCHES);
      for (let k = 0; k < 16; k++) {
        const q = { x: p.x + r * Math.cos(k * Math.PI / 8), y: p.y + r * Math.sin(k * Math.PI / 8) };
        if (!paved.some(area => insideArea(area, q)) || holes.some(area => insideArea(area, q))) return true;
      }
      return false;
    }
    // Arc-length fraction of position `s` (segment index plus fraction) along a
    // polyline, and the point at a fraction.
    function fractionAt(points, s) {
      const total = polylineLength(points) || 1;
      const i = Math.min(Math.floor(s), points.length - 2);
      return (polylineLength(points.slice(0, i + 1)) + Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) * (s - i)) / total;
    }
    function pointAtFraction(points, f) {
      const [, at] = resample(points, 1, polylineLength(points) * Math.max(0, Math.min(1, f)));
      return at;
    }
    // A pinch point belongs to both crossing pavement edges. Its arc-length
    // fractions identify the crossing branch; they are not fixed positions.
    function edgeCrossings(a,b) {
      const result=[];
      for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
        const p=a[i-1],q=b[j-1],u={x:a[i].x-p.x,y:a[i].y-p.y},v={x:b[j].x-q.x,y:b[j].y-q.y};
        if(Math.max(p.x,a[i].x)<Math.min(q.x,b[j].x)||Math.min(p.x,a[i].x)>Math.max(q.x,b[j].x)||Math.max(p.y,a[i].y)<Math.min(q.y,b[j].y)||Math.min(p.y,a[i].y)>Math.max(q.y,b[j].y))continue;
        const den=u.x*v.y-u.y*v.x;if(Math.abs(den)<1e-9)continue;
        const x=q.x-p.x,y=q.y-p.y,t=(x*v.y-y*v.x)/den,f=(x*u.y-y*u.x)/den;
        if(t<0||t>1||f<0||f>1)continue;
        result.push({x:p.x+t*u.x,y:p.y+t*u.y,a:fractionAt(a,i-1+t),b:fractionAt(b,j-1+f)});
      }
      return result;
    }
    // Median points anchored to a road edge move with the road; an anchor to a
    // road that's gone is dropped and the point stays where it was.
    function anchorMedians(sheet, solved) {
      if (!sheet.medians.some(median => median.points.some(p => p.on))) return;
      const { byKey,edges,corners } = pavementEdges(sheet, solved);
      for (const p of sheet.medians.flatMap(median => median.points)) {
        if (!p.on) continue;
        let edge = byKey.get(medianAnchorKey(p.on));
        if(!edge&&p.on.crossing){p.on={...p.on.crossing};edge=byKey.get(medianAnchorKey(p.on));}
        if (!edge) {delete p.on;continue;}
        if(p.on.tip) {
          const tip=corners.find(c=>c.tip&&medianAnchorKey(c.on)===medianAnchorKey(p.on));
          if(tip){p.x=tip.x;p.y=tip.y;p.on.f=tip.on.f;continue;}
          delete p.on.tip;
        }
        // Upgrade old single-edge pinch anchors while their saved location
        // still identifies the crossing. Ordinary edge points stay single.
        if(!p.on.crossing&&Math.hypot(pointAtFraction(edge,p.on.f).x-p.x,pointAtFraction(edge,p.on.f).y-p.y)<.5){
          for(const other of edges){
            if(!other.on||medianAnchorKey(other.on)===medianAnchorKey(p.on)||other.on.road!=null&&other.on.road===p.on.road)continue;
            const near=nearPavement(other,p,.5);if(!near||near.distance>.5)continue;
            const hit=edgeCrossings(edge,other).find(hit=>Math.hypot(hit.x-p.x,hit.y-p.y)<.5);
            if(hit){p.on.crossing={...other.on,f:hit.b};break;}
          }
        }
        const other=p.on.crossing&&byKey.get(medianAnchorKey(p.on.crossing));
        if(other){
          const hits=edgeCrossings(edge,other).sort((a,b)=>Math.abs(a.a-p.on.f)+Math.abs(a.b-p.on.crossing.f)-Math.abs(b.a-p.on.f)-Math.abs(b.b-p.on.crossing.f));
          if(hits.length){const hit=hits[0];p.x=hit.x;p.y=hit.y;p.on.f=hit.a;p.on.crossing.f=hit.b;continue;}
          // Temporarily separated edges can meet again; retain both references.
        }else if(p.on.crossing)delete p.on.crossing;
        Object.assign(p, pointAtFraction(edge, p.on.f));
      }
    }

    // After a road is cut, points anchored to it re-anchor to whichever piece
    // they lie on.
    function rehomeMedians(sheet, roads) {
      const ids = roads.map(road => road.id);
      const edges = pavementEdges(sheet, solve(sheet)).edges.filter(edge => ids.includes(edge.on?.road));
      for (const p of (sheet.medians ?? []).flatMap(median => median.points)) {
        for(const on of [p.on,p.on?.crossing]) {
          if (!on || !ids.includes(on.road)) continue;
          let best = null;
          for (const edge of edges) {
            const at = nearestOn(edge, p);
            if (at && (!best || at.distance < best.at.distance)) best = { edge, at };
          }
          if (best) Object.assign(on,best.edge.on,{f:fractionAt(best.edge,best.at.s)});
        }
      }
    }
    // A median's drawn outline: between two points on the same pavement edge it
    // follows that edge (a curved road's edge, say) instead of cutting across.
    function medianOutline(sheet, solved, points) {
      const cache = solved.medianOutlines ??= new WeakMap(), key = JSON.stringify(points);
      const cached = cache.get(points);
      if (cached?.key === key) return cached.outline;
      const outline = medianLegs(sheet, solved, points).flat();
      cache.set(points, { key, outline });
      return outline;
    }
    // Each point followed by the outline from it to the next point (the last
    // one's leg closes back to the first).
    function medianLegs(sheet, solved, points) {
      const { edges: pavement } = pavementEdges(sheet, solved);
      const edges = pavement;
      // Keep branches in a graph rather than greedily joining the first two
      // coincident edges. At a merge, that would consume the shared edge into
      // the wrong branch and leave a median on the other branch straight.
      // Intersection corners and marked gore edges are continuations too:
      // an anchored median may cross a road mouth on its way to the next point.
      const longitudinal = pavement.filter(edge => edge.on &&
        (["L","R"].includes(edge.on.side) ||
          (edge.on.intersection && ["corner","cornerLine"].includes(edge.on.side)) ||
          (edge.on.gore && ["e1","e2"].includes(edge.on.side))));
      const slice = (edge, from, to, first, last) => {
        const result=[first];
        if(from<to)for(let n=Math.floor(from)+1;n<to;n++)result.push(edge[n]);
        else for(let n=Math.ceil(from)-1;n>to;n--)result.push(edge[n]);
        result.push(last);return result;
      };
      const follow = (p,q) => {
        const nodes=longitudinal.flatMap(edge=>[edge[0],edge.at(-1)]), start=nodes.length, finish=start+1;
        nodes.push(p,q);
        const graph=nodes.map(()=>[]);
        const arc=(a,b,path)=>graph[a].push({to:b,path,length:polylineLength(path)});
        longitudinal.forEach((edge,i)=>{
          const a=i*2,b=a+1;
          arc(a,b,edge);arc(b,a,[...edge].reverse());
          for(const [point,node,starting] of [[p,start,true],[q,finish,false]]) {
            if(point.on&&medianAnchorKey(point.on)!==medianAnchorKey(edge.on)&&(!point.on.crossing||medianAnchorKey(point.on.crossing)!==medianAnchorKey(edge.on)))continue;
            const at=nearPavement(edge,point,.5);if(!at||at.distance>.5)continue;
            for(const [end,index] of [[a,0],[b,edge.length-1]]) {
              const path=slice(edge,at.s,index,point,nodes[end]);
              starting?arc(node,end,path):arc(end,node,path.reverse());
            }
          }
        });
        for(let a=0;a<start;a++)for(let b=a+1;b<start;b++)
          if(Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y)<=.5){arc(a,b,[nodes[a],nodes[b]]);arc(b,a,[nodes[b],nodes[a]]);}
        const distances=nodes.map(()=>Infinity),previous=[],pending=new Set(nodes.map((_,i)=>i));distances[start]=0;
        while(pending.size){
          let at=null;for(const n of pending)if(at===null||distances[n]<distances[at])at=n;
          if(!Number.isFinite(distances[at]))return null;
          if(at===finish)break;
          pending.delete(at);
          for(const link of graph[at])if(distances[at]+link.length<distances[link.to]){
            distances[link.to]=distances[at]+link.length;previous[link.to]={from:at,path:link.path};
          }
        }
        const parts=[];for(let at=finish;at!==start;){const step=previous[at];if(!step)return null;parts.unshift(step.path.slice(0,-1));at=step.from;}
        return parts.flat();
      };
      const tolerance = 0.5;
      const on = points.map(p => edges.map(edge => {
        const at = nearPavement(edge, p, tolerance);
        return at && at.distance <= tolerance ? at.s : null;
      }));
      return points.map((p, i) => {
        const j = (i + 1) % points.length;
        const q = points[j], a = !p.on && p.curve?.out, b = !q.on && q.curve?.in;
        if (a || b) return bezier(p, a ? {x:p.x+a.x,y:p.y+a.y} : p,
          b ? {x:q.x+b.x,y:q.y+b.y} : q, q).slice(0,-1);
        const anchored=(point,edge)=>!point.on||[point.on,point.on.crossing].some(anchor=>anchor&&medianAnchorKey(anchor)===medianAnchorKey(pavement[edge].on));
        const k = edges.findIndex((edge, n) => on[i][n] != null && on[j][n] != null && edge.length >= 2 && anchored(p,n) && anchored(points[j],n));
        if (k < 0) return follow(p,points[j]) ?? [p];
        const [from, to] = [on[i][k], on[j][k]];
        const between = [];
        if (from < to) for (let n = Math.floor(from) + 1; n < to; n++) between.push(edges[k][n]);
        else for (let n = Math.ceil(from) - 1; n > to; n--) between.push(edges[k][n]);
        return [p, ...between];
      });
    }
    // Corners and edges a median point can snap to; points in `exclude` (the ones
    // being dragged) and median edges touching them are left out.
    function medianSnaps(sheet, solved, exclude) {
      const { corners: pavementCorners, edges: pavement } = pavementEdges(sheet, solved);
      const corners = [...pavementCorners];
      const edges = [...pavement];
      // Medians' own points and edges; everything else is pavement, which only
      // snaps along its outer edges.
      const own = new Set(corners.filter(p=>p.tip));
      for (const median of sheet.medians) {
        if (median.points.some(p => exclude.has(p))) {
          median.points.forEach(p => !exclude.has(p) && (corners.push(p), own.add(p)));
          continue;
        }
        corners.push(...median.points);
        median.points.forEach(p => own.add(p));
        const outline = medianOutline(sheet, solved, median.points);
        const edge = [...outline, outline[0]];
        edges.push(edge);
        own.add(edge);
      }
      return { corners, edges, own };
    }
    // Corners win over edges within the snapping distance.
    function snapMedian(sheet, point, exclude = new Set(), extra = []) {
      const radius = SNAP_PIXELS / sheet.view.scale;
      const solved = medianSolve(sheet);
      const { corners, edges, own } = medianSnaps(sheet, solved, exclude);
      for (const p of extra) own.add(p);
      // Intersections make precise pinch-point targets, even when neither
      // road has a pavement corner there. Only inspect segments near the cursor.
      const nearby = [];
      for (const edge of edges) for (let i = 1; i < edge.length; i++) {
        const a = edge[i - 1], b = edge[i];
        if (point.x < Math.min(a.x, b.x) - radius || point.x > Math.max(a.x, b.x) + radius ||
            point.y < Math.min(a.y, b.y) - radius || point.y > Math.max(a.y, b.y) + radius) continue;
        nearby.push({ a, b, edge, i });
      }
      for (let i = 0; i < nearby.length; i++) for (let j = i + 1; j < nearby.length; j++) {
        const a = nearby[i], b = nearby[j];
        if (a.edge === b.edge) continue;
        const u = { x: a.b.x - a.a.x, y: a.b.y - a.a.y };
        const v = { x: b.b.x - b.a.x, y: b.b.y - b.a.y };
        const d = u.x * v.y - u.y * v.x;
        if (Math.abs(d) < 1e-9) continue;
        const x = b.a.x - a.a.x, y = b.a.y - a.a.y;
        const t = (x * v.y - y * v.x) / d, f = (x * u.y - y * u.x) / d;
        if (t < 0 || t > 1 || f < 0 || f > 1) continue;
        const crossing = { x: a.a.x + t * u.x, y: a.a.y + t * u.y,
          on: a.edge.on ? { ...a.edge.on, f: fractionAt(a.edge, a.i - 1 + t),
            ...(b.edge.on&&medianAnchorKey(a.edge.on)!==medianAnchorKey(b.edge.on)?{crossing:{...b.edge.on,f:fractionAt(b.edge,b.i-1+f)}}:{}) }
            : b.edge.on && {...b.edge.on,f:fractionAt(b.edge,b.i-1+f)} };
        if (own.has(a.edge) && own.has(b.edge)) own.add(crossing);
        corners.push(crossing);
      }
      // The nearest candidate within reach that is a median's own or lies on the
      // pavement's outer edge.
      const nearest = candidates => candidates.filter(c => c.distance <= radius).sort((a, b) => a.distance - b.distance)
        .find(c => c.own || outerEdge(sheet, solved, c)) ?? null;
      const corner = nearest([...corners, ...extra].map(c => ({ x: c.x, y: c.y, on: c.on, own: own.has(c), distance: Math.hypot(c.x - point.x, c.y - point.y) })));
      if (corner) return corner;
      return nearest(edges.map(edge => {
        const at = nearestOn(edge, point);
        return at && { ...at, own: own.has(edge), on: edge.on && { ...edge.on, f: fractionAt(edge, at.s) } };
      }).filter(Boolean));
    }
    // Every median point at the same place, so shared points move together.
    const sharedPoints = (sheet, point) => sheet.medians.flatMap(median => median.points.filter(p => samePoint(p, point)));
    // The outline moved `distance` inward, with mitered corners.
    function insetPolygon(points, distance) {
      const area = points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0);
      const inward = v => (area > 0 ? rightOf(v) : { x: v.y, y: -v.x });
      return points.map((p, i) => {
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];
        const n1 = inward(unit({ x: p.x - prev.x, y: p.y - prev.y }));
        const n2 = inward(unit({ x: next.x - p.x, y: next.y - p.y }));
        const scale = distance / Math.max(0.25, 1 + dot(n1, n2));
        return { x: p.x + (n1.x + n2.x) * scale, y: p.y + (n1.y + n2.y) * scale };
      });
    }
    // Shared by standalone and intersection painted medians. Dimensions and
    // pattern: FDOT Standard Plans 711-001 sheet 8 (constants above).
    function medianHatchGuide(points, corners) {
      // Follow the longest boundary between actual corners. Smooth Bézier
      // points are intermediate stations, not a reason to restart the pattern.
      let stops = corners.filter(p=>!p.curve).map(p=>points.findIndex(q=>samePoint(p,q))).filter(i=>i>=0);
      if(stops.length<2)stops=corners.map(p=>points.findIndex(q=>samePoint(p,q))).filter(i=>i>=0);
      let guide=[],longest=0;
      for(let i=0;i<stops.length;i++) {
        const path=[points[stops[i]]],end=stops[(i+1)%stops.length];
        for(let n=(stops[i]+1)%points.length;n!==end;n=(n+1)%points.length)path.push(points[n]);
        path.push(points[end]);const length=polylineLength(path);
        if(length>longest){guide=path;longest=length;}
      }
      if(guide.length<3)return null;
      const a=guide[0],b=guide.at(-1),chord=Math.hypot(b.x-a.x,b.y-a.y);
      if(chord<1e-6||guide.every(p=>Math.abs((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))/chord<.5))return null;
      if(b.x<a.x-1e-6 || Math.abs(b.x-a.x)<=1e-6&&b.y>a.y)guide.reverse();
      return guide;
    }
    // Perpendicular cross-sections and boundary-limited arms are shared by
    // painted medians and handle-created gores. Equal distances along curved
    // edges do not necessarily describe a perpendicular cross-section.
    function curvedHatchSection(points, p, tangent, stripe) {
      const normal=rightOf(tangent),hits=[];
      points.forEach((q,i)=>{
        const r=points[(i+1)%points.length],u=dot({x:q.x-p.x,y:q.y-p.y},tangent),v=dot({x:r.x-p.x,y:r.y-p.y},tangent);
        if(Math.abs(u-v)<1e-9||u*v>0)return;
        const f=u/(u-v);hits.push(dot({x:q.x+(r.x-q.x)*f-p.x,y:q.y+(r.y-q.y)*f-p.y},normal));
      });
      hits.sort((a,b)=>a-b);
      const unique=hits.filter((v,i)=>!i||Math.abs(v-hits[i-1])>1e-5);
      let cross=null;
      for(let i=0;i+1<unique.length;i+=2) {
        const lo=unique[i],hi=unique[i+1],distance=Math.max(lo,0,-hi);
        if(!cross||distance<cross.distance)cross={lo,hi,distance};
      }
      if(!cross)return null;
      const center=(cross.lo+cross.hi)/2;
      const tip={x:p.x+normal.x*center,y:p.y+normal.y*center};
      const at=(along,across)=>{
        const dir=unit({x:tangent.x*along+normal.x*across,y:tangent.y*along+normal.y*across});
        let reach=Infinity;
        points.forEach((q,i)=>{
          const r=points[(i+1)%points.length],edge={x:r.x-q.x,y:r.y-q.y},v={x:q.x-tip.x,y:q.y-tip.y};
          const denominator=dir.x*edge.y-dir.y*edge.x;if(Math.abs(denominator)<1e-9)return;
          const t=(v.x*edge.y-v.y*edge.x)/denominator,u=(v.x*dir.y-v.y*dir.x)/denominator;
          if(t>=-1e-6&&u>=0&&u<=1)reach=Math.min(reach,Math.max(0,t));
        });
        if(!Number.isFinite(reach))reach=cross.hi-cross.lo;
        return {x:tip.x+dir.x*(reach+stripe),y:tip.y+dir.y*(reach+stripe)};
      };
      return {tip, at, width:cross.hi-cross.lo};
    }
    function drawMedianHatching(points, corners, inner, median, parent, pixelsPerFoot, id) {
      if (inner.length < 3) return;
      const color = median.color === "white" ? WHITE : YELLOW;
      // Diagonals at 45° to the median's longest side, `spacing` apart along it,
      // leaning right (╱) or left (╲) as seen with that side running left to right.
      let along = { x: 1, y: 0 };
      let longest = 0;
      corners.forEach((p, i) => {
        const q = corners[(i + 1) % corners.length];
        const length = Math.hypot(q.x - p.x, q.y - p.y);
        if (length > longest) [longest, along] = [length, unit({ x: q.x - p.x, y: q.y - p.y })];
      });
      if (along.x < -1e-6 || (Math.abs(along.x) <= 1e-6 && along.y > 0)) along = { x: -along.x, y: -along.y };
      const lean = (median.lean === "left" ? 1 : -1) * (median.color === "white" ? window.StripeMaker.traffic.sign : 1);
      const d = unit({ x: along.x + rightOf(along).x * lean, y: along.y + rightOf(along).y * lean });
      const across = rightOf(d);
      const step = pixelsPerFoot * Math.max(MIN_GORE_SPACING_FEET, Math.min(MAX_GORE_SPACING_FEET, Number(median.spacing) || MEDIAN_SPACING_FEET)) / Math.SQRT2;
      const [lo, hi] = [Math.min(...points.map(p => dot(p, across))), Math.max(...points.map(p => dot(p, across)))];
      const [first, last] = [Math.min(...points.map(p => dot(p, d))), Math.max(...points.map(p => dot(p, d)))];
      const clip = document.createElementNS(SVG, "clipPath");
      clip.id = id;
      const clipPath = document.createElementNS(SVG, "path");
      clipPath.setAttribute("d", `${pathData(inner)}Z`);
      clip.append(clipPath);
      const stripes = document.createElementNS(SVG, "g");
      stripes.setAttribute("clip-path", `url(#${id})`);
      parent.append(clip, stripes);
      const stripe = pixelsPerFoot * GORE_STRIPE_INCHES / 12;
      const guide=medianHatchGuide(points,corners);
      if(guide) {
        // Keep the same 45° markings and arc-length spacing while their local
        // direction turns with the boundary; clip every stroke to the median.
        const spacing=step*Math.SQRT2,total=polylineLength(guide);
        stripes.setAttribute('class',median.color==='white'?'medianChevrons medianCurvedStripes':'medianCurvedStripes');
        for(let s=(total%spacing)/2;s<=total;s+=spacing) {
          const p=pointAtFraction(guide,s/total),a=pointAtFraction(guide,Math.max(0,s-.5)/total),b=pointAtFraction(guide,Math.min(total,s+.5)/total);
          const tangent=unit({x:b.x-a.x,y:b.y-a.y});
          const section=curvedHatchSection(points,p,tangent,stripe);
          if(!section)continue;
          const {tip,at}=section;
          const path=median.color==='white'?[at(lean,-1),tip,at(lean,1)]:[at(-1,-lean),at(1,lean)];
          const mark=strokePath(path,color,stripe);mark.setAttribute('stroke-linejoin','miter');stripes.append(mark);
        }
        return;
      }
      if(median.color==='white') {
        const normal=rightOf(along),low=Math.min(...points.map(p=>dot(p,along))),high=Math.max(...points.map(p=>dot(p,along)));
        const acrossLow=Math.min(...points.map(p=>dot(p,normal))),acrossHigh=Math.max(...points.map(p=>dot(p,normal)));
        const reach=Math.max(acrossHigh-acrossLow,stripe)*2;
        const spacing=step*Math.SQRT2;
        stripes.setAttribute('class','medianChevrons');
        for(let c=low+((high-low)%spacing)/2;c<=high;c+=spacing) {
          const hits=[];
          points.forEach((p,i)=>{
            const q=points[(i+1)%points.length],a=dot(p,along),b=dot(q,along);
            if(Math.abs(b-a)<1e-9||c<Math.min(a,b)||c>Math.max(a,b))return;
            const f=(c-a)/(b-a);hits.push(dot(p,normal)+(dot(q,normal)-dot(p,normal))*f);
          });
          if(hits.length<2)continue;
          const center=(Math.min(...hits)+Math.max(...hits))/2;
          const tip={x:along.x*c+normal.x*center,y:along.y*c+normal.y*center};
          const arms=[-1,1].map(side=>({x:tip.x+along.x*reach*lean+normal.x*reach*side,y:tip.y+along.y*reach*lean+normal.y*reach*side}));
          const chevron=strokePath([arms[0],tip,arms[1]],WHITE,stripe);chevron.setAttribute('stroke-linejoin','miter');stripes.append(chevron);
        }
        return;
      }
      for (let c = lo + ((hi - lo) % step) / 2; c <= hi; c += step) {
        stripes.append(strokePath([first, last].map(t => ({ x: across.x * c + d.x * t, y: across.y * c + d.y * t })), color, stripe));
      }
    }
    function drawMedian(sheet, median, layers, solved) {
      const distinct = median.points.filter((p, i) => !samePoint(p, median.points[(i + 1) % median.points.length]));
      const corners = distinct.length === median.points.length ? median.points : distinct;
      if (corners.length < 3) return;
      const points = medianOutline(sheet, solved, corners).filter((p, i, all) => !samePoint(p, all[(i + 1) % all.length]));
      const outline = `${pathData(points)}Z`;
      const fill = document.createElementNS(SVG, "path");
      fill.setAttribute("d", outline);
      if (median.type === "painted") fill.setAttribute("class", "roadBand medianBand");
      else fill.setAttribute("fill", median.type === "concrete" ? CONCRETE : GRASS);
      layers.pavement.append(fill);
      if (median.id === selectedMedian) {
        const ring = document.createElementNS(SVG, "path");
        ring.setAttribute("class", "roadOutline");
        ring.setAttribute("d", outline);
        layers.selection.append(ring);
      }
      if (median.type === "grass" || median.type === "painted" && median.color === "none") return;
      const clipTo = (shape, id) => {
        const clip = document.createElementNS(SVG, "clipPath");
        clip.id = `median-${sheet.id}-${median.id}-${id}`;
        const path = document.createElementNS(SVG, "path");
        path.setAttribute("d", `${pathData(shape)}Z`);
        clip.append(path);
        const group = document.createElementNS(SVG, "g");
        group.setAttribute("clip-path", `url(#${clip.id})`);
        layers.markings.append(clip, group);
        return group;
      };
      const color = median.type === "concrete" ? CURB : median.color === "white" ? WHITE : YELLOW;
      const closed = shape => {
        const path = strokePath([...shape, shape[0]], color, 0);
        path.setAttribute("stroke-linejoin", "miter");
        return path;
      };
      if (median.type === "concrete") {
        // The curb: a stroke twice its width, clipped to the inside of the outline.
        const curb = closed(points);
        curb.setAttribute("stroke-width", inchesToPixels(sheet, CURB_INCHES) * 2);
        clipTo(points, "curb").append(curb);
        return;
      }
      // The inner line sits 10" (center to center) inside the road's edge line,
      // which is itself 8" inside the pavement edge the median snaps to. White
      // (same-direction) medians are outlined like gores, in 8" white.
      const inner = insetPolygon(points, inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES - PAVEMENT_MARGIN_INCHES));
      drawMedianHatching(points, corners, inner, median, layers.markings, feetToPixels(sheet, 1), `median-${sheet.id}-${median.id}-stripes`);
      const line = closed(inner);
      line.setAttribute("stroke-width", inchesToPixels(sheet, median.color === "white" ? GORE_LINE_INCHES : LINE_INCHES));
      layers.markings.append(line);
    }
    function medianAt(sheet, point) {
      const solved = solve(sheet);
      return [...sheet.medians].reverse().find(median => median.points.length > 2 && insidePolygon(point, medianOutline(sheet, solved, median.points)))?.id ?? null;
    }
    function medianEdgeCuts(sheet,solved,hideOnly=true) {
      const cache=hideOnly?'medianEdgeCuts':'unpaintedMedianAreas';
      if(solved[cache])return solved[cache];
      const polygons=[],G=window.StripeMaker.intersectionGeometry,k=12/sheet.inchesPerPixel;
      const hidden=m=>(m.type??m.surface)==='painted'&&m.color==='none'&&(!hideOnly||m.hideEdgeLines);
      // Median points follow pavement edges; reach the marking centerlines
      // just inside the road's existing 8-inch pavement apron (711-001).
      const add=points=>{if(points.length>2)polygons.push(hideOnly?insetPolygon(points,-inchesToPixels(sheet,PAVEMENT_MARGIN_INCHES+LINE_INCHES/2+0.01)):points);};
      for(const m of sheet.medians??[])if(hidden(m))add(medianOutline(sheet,solved,m.points));
      for(const item of sheet.intersections??[]){
        const world=p=>({x:item.x+p.x*k,y:item.y+p.y*k});
        for(const m of item.medians??[])if(hidden(m))add(G.islandOutline(item,m).map(world));
        for(const a of item.approaches)for(const m of G.medians(a))if(hidden(m.split??a))add(m.points.map(world));
      }
      return solved[cache]=polygons;
    }

    // Trim against traveled-way boundaries, not inset raster masks. Shared
    // boundary lines stay whole, and crossings terminate at exact intersections.
    function wideTurnHosts(sheet,road) {
      const ids=new Set(road.ends.flatMap(end=>(jointOf(sheet,end.joint)?.links??[])
        .filter(l=>l.b===road.id&&!l.pair&&!l.beside).map(l=>l.a)));
      // An edge join splits the mainline into two pieces at this joint.
      // Both pieces form the receiving pavement boundary.
      for(const end of road.ends)for(const link of jointOf(sheet,end.joint)?.links??[]) {
        if(link.pair||link.beside||link.a===road.id||link.b===road.id)continue;
        if(ids.has(link.a)||ids.has(link.b)){ids.add(link.a);ids.add(link.b);}
      }
      return sheet.roads.filter(r=>ids.has(r.id));
    }
    function clipAtMouth(polygon, mouth, end, keep = true) {
      const sign=(end?1:-1)*(keep?1:-1),d=p=>sign*((p.x-mouth.x)*mouth.tangent.x+(p.y-mouth.y)*mouth.tangent.y);
      const out=[];
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],b=polygon[(i+1)%polygon.length],da=d(a),db=d(b);
        if(da<=0)out.push(a);
        if((da<0&&db>0)||(da>0&&db<0)){
          const f=da/(da-db);out.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
        }
      }
      return out;
    }
    function fittedHostPolygons(sheet,road,shape,solved,margin=0,removed=false) {
      const mouths=Array.from({length:road.lanes},(_,lane)=>[0,1].map(e=>solved?.arcPavementMouths?.get(`${road.id}:${e}:${lane}`)));
      if(!mouths.some(ends=>ends.some(Boolean)))return removed?[]:[[...boundary(shape,0,-margin),...boundary(shape,road.lanes,margin).reverse()]];
      const polygons=[];
      for(let lane=0;lane<road.lanes;lane++){
        const extra=removed?inchesToPixels(sheet,LINE_INCHES)/2+1e-5:0;
        let ring=[...boundary(shape,lane,-(lane===0?margin:0)-extra),...boundary(shape,lane+1,(lane===road.lanes-1?margin:0)+extra).reverse()];
        if(removed){
          for(const e of [0,1])if(mouths[lane][e]){const cut=clipAtMouth(ring,mouths[lane][e],e,false);if(cut.length>=3)polygons.push(cut);}
        }else{
          for(const e of [0,1])if(mouths[lane][e])ring=clipAtMouth(ring,mouths[lane][e],e);
          if(ring.length>=3)polygons.push(ring);
        }
      }
      return polygons;
    }
    function joinedPolygons(sheet, road, solved, boundaryIndex = null) {
      const joints = road.ends.map(end => end.joint);
      return sheet.roads.filter(other => other !== road && other.ends.some(end => joints.includes(end.joint)))
        .filter(other=>!(boundaryIndex>0&&boundaryIndex<road.lanes&&other.keepWidthAtJoins&&wideTurnHosts(sheet,other).includes(road)))
        .flatMap(other => fittedHostPolygons(sheet,other,shapeOf(sheet,other,solved),solved));
    }

    // Every line markings can go on: each road's lane boundaries (k = 0 is the
    // left edge) and, for a two-way road without a median, its centerline (kept by
    // the side with the lower id), in sheet pixels along the direction of travel.
    function centerTarget(sheet, road, shape) {
      const partner = pairOf(sheet, road);
      if (!partner || road.id > partner.id || (pairLinks(sheet, road, partner)[0]?.median ?? 0) > 0) return null;
      return { key: `r:${road.id}:C`, points: boundary(shape, 0, -inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES) / 2), road: road.id, partner: partner.id };
    }
    function lineTargets(sheet, solved) {
      return sheet.roads.flatMap(road => roadTargets(sheet, road, solved));
    }
    function roadTargets(sheet, road, solved) {
      const targets = [];
      const shape = shapeOf(sheet, road, solved);
      for (let k = 0; k <= road.lanes; k++) {
        const lane=bikeType(road,k)?k:bikeType(road,k-1)?k-1:null;
        const markingShape=lane==null?shape:bikeMarkingShape(sheet,road,lane,shape,solved);
        targets.push({key:`r:${road.id}:${k}`,points:bikeEdgeLine(sheet,road,markingShape,k),on:{road:road.id,k},edge:k===0||k===road.lanes});
      }
      const center = centerTarget(sheet, road, shape);
      if (center) targets.push({ ...center, on: { road: road.id, k: "C" } });
      return targets;
    }

    // Where a road end is curved on its own (end.dir), it meets the road joined
    // to it at an angle: each end is cut square to its own direction, leaving a
    // wedge open on the outside of the bend. Pave that wedge as a rounded corner
    // about the point where the two end cuts cross, and carry each line round it.
    function drawKinks(sheet, solved, layers) {
      const margin = inchesToPixels(sheet, PAVEMENT_MARGIN_INCHES);
      const lineWidth = inchesToPixels(sheet, LINE_INCHES);
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
          band.setAttribute("d", `${pathData([...arc(r2), ...(r1 > 0 ? arc(r1).reverse() : [center])])}Z`);
          layers.pavement.append(band);
          // Corner markings obey the same traveled-way trimming as road lines.
          const cuts = here.map(({ road }) => {
            const shape = shapeOf(sheet, road, solved);
            return [...boundary(shape, 0), ...boundary(shape, road.lanes).reverse()];
          });
          // Lines on the open side continue around the corner at their own radius.
          for (let k = first; k <= last; k++) {
            const r = reach(boundary(sa, k).at(-1));
            if (r <= 0) continue;
            const color = k === 0 ? YELLOW : WHITE;
            const parts = window.StripeMaker.markingTrim.trim(arc(r), cuts);
            const append = (part, dash) => {
              const path = strokePath(part.points, color, lineWidth, dash?.array, dash?.offset);
              path.dataset.corner = `${a.road.id}:${k}:${b.road.id}`;
              layers.markings.append(path);
            };
            if (k > 0 && k < a.road.lanes) {
              const k6 = feetToPixels(sheet, 1), lines = window.StripeMaker.longitudinal;
              const start = (lines.phase(`r:${a.road.id}:${k}`) + polylineLength(boundary(sa, k))) / k6;
              for (const part of parts) append(part, window.StripeMaker.lineStyles.dashAttributes(
                { on: 10, off: 30, start: 0 }, start + part.distance / k6, k6));
            } else for (const part of parts) append(part);
          }
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
          // Keep the original position below intersections and elevated work.
          if(!old.length&&nodes.length)return render();
          for(const node of nodes)parent.insertBefore(node,old[0]);
          const parts=drawn.parts[name].after,index=parts.indexOf(old[0]);
          if(old.length)parts.splice(index,old.length,...nodes);
          old.forEach(node=>node.remove());drawn.preview[i]=nodes;
        }
        drawDrawingCursor();
      });
    }
    function renderSigns() {
      const sheet=sheets.selected,app=window.StripeMaker;
      if(!sheet || renderFrame || pendingChange || drawn?.sheet!==sheet ||
        !app.signs?.updateDrawing(sheet))return render();
      app.signs.refreshOverlay();
      app.selection?.refresh?.();
    }
    function renderMarkings() {
      const sheet=sheets.selected,app=window.StripeMaker;
      if(!sheet || renderFrame || pendingChange || drawn?.sheet!==sheet ||
        !app.markings?.updateDrawing(sheet))return render();
      app.markings.refreshOverlay();
      app.selection?.refresh?.();
      app.simulator?.refreshOverlay();
    }
    // Keep every point edit, but draw at most once per frame. drawSheet may
    // retain unchanged ground-level road SVG; changed geometry and elevated
    // layouts always take the complete drawing path.
    function renderMedianSoon() {
      pendingChange = null;
      renderFrame ||= requestAnimationFrame(() => {
        renderFrame = 0;
        drawSheet({ roads: [], joints: [], medianOnly: true });
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
      for (const id of [...ids]) {
        const partner = pairOf(sheet, roadOf(sheet, id));
        if (partner) ids.add(partner.id);
      }
      return ids;
    }
    // The last render's solved roads, so panning and zooming (which don't change
    // them) only move the overlay.
    let lastSolved = null;
    const medianGeometryKey = sheet => JSON.stringify([sheet.inchesPerPixel, sheet.autoTapers, sheet.roads, sheet.joints, sheet.intersections, sheet.gores]);
    const medianSolve = sheet => lastSolved?.sheet === sheet && lastSolved.medianKey === medianGeometryKey(sheet)
      ? lastSolved.solved : solve(sheet);
    const roadDrawingKey = (sheet, geometryKey) => JSON.stringify([geometryKey, sheet.width, sheet.height,
      sheet.markings, sheet.lines, sheet.surfaces, sheet.medians?.filter(m=>m.type==='painted'&&m.color==='none'), selectedRoad?.id, selectedGore]);
    // What the last render drew: each layer's group, the nodes in it before the
    // roads (medians) and after them (gores, intersections, markings), each
    // road's nodes, and each road's line targets, so a partial render can
    // replace just its roads.
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
      let solved = null, medianKey;
      // Selecting a road or gore deselects the median.
      if (selectedRoad || selectedGore) selectedMedian = null;
      if (sheet) {
        const layer = layerFor(sheet);
        if (!drag) window.StripeMaker.intersections?.alignLinks(sheet);
        window.StripeMaker.roadWidths.withSnapshot(sheet,()=>{
        if(sheet.speedZones)sheet.speedZones=sheet.speedZones.filter(z=>sheet.roads.some(r=>r.id===z.road));
        if (sheet.surfaces) sheet.surfaces = sheet.surfaces.filter(s => sheet.roads.some(road => road.id === s.on.road && s.on.lane < road.lanes));
        solved = solve(sheet);
        medianKey = medianGeometryKey(sheet);
        anchorMedians(sheet, solved);
        const roadKey = roadDrawingKey(sheet, medianGeometryKey(sheet));
        if (change?.medianOnly && (drawn?.roadKey !== roadKey || sheet.bridges?.length ||
          sheet.intersections?.some(item => (item.level ?? 1) > 1) || sheet.roads.some(road => road.keepWidthAtJoins))) partial = null;
        const before = groups(), after = groups(), gores = [];
        let preview=null;
        const roads = partial ? drawn.layers : groups();
        const nodes = partial ? drawn.roads : new Map();
        const targets = partial ? drawn.targets : new Map();
        if (sheet.inchesPerPixel) {
          for (const road of sheet.roads) if (!partial || partial.has(road.id)) targets.set(road.id, roadTargets(sheet, road, solved));
          for (const id of targets.keys()) if (!roadOf(sheet, id)) targets.delete(id);
          window.StripeMaker.longitudinal.begin(sheet, () => [
            ...[...targets.values()].flat(), ...(window.StripeMaker.intersections?.lineTargets?.(sheet, solved) ?? [])]);
        }
        if (sheet.inchesPerPixel) {
          // Medians go under the roads, so road pavement always shows over them.
          sheet.medians.forEach(median => drawMedian(sheet, median, before, solved));
          const partner = pairOf(sheet, selectedRoad);
          for (const road of sheet.roads) {
            if (partial && !partial.has(road.id)) continue;
            const className = road === selectedRoad || road === partner ? "selected" : "";
            const next = (partial?paintRoad:drawRoad)(sheet, road, shapeOf(sheet, road, solved), partial ? groups() : roads, className, solved);
            const old = partial && nodes.get(road.id);
            if (partial) for (const [key, name] of [["band", "pavement"], ["group", "markings"], ["ring", "selection"]]) swapNode(old?.[key], next[key], roads[name]);
            nodes.set(road.id, next);
          }
          const candidates = goreCandidates(sheet, solved);
          for (const gore of sheet.gores) {
            const candidate = candidates.get(gore.key);
            if (!candidate || candidate.intersection) continue;
            // What each marked gore drew and where it's paved, so a bridge over
            // a lane split takes in its gore.
            const counts = LAYERS.map(name => after[name].childNodes.length);
            drawGore(sheet, gore, candidate, after, solved.crosswalkCuts ??= window.StripeMaker.markings?.crosswalkCuts(sheet, solved) ?? []);
            const last = indexAt(candidate.along, Math.min(feetToPixels(sheet, gore.length), candidate.along.at(-1)));
            if (last < 1) continue;
            gores.push({ roads: gore.key.split("|").map(end => Number(end.split(":")[0])),
              outline: [...candidate.e1.slice(0, last + 1), ...candidate.e2.slice(0, last + 1).reverse()],
              nodes: ["pavement", "markings"].flatMap(name => [...after[name].childNodes].slice(counts[LAYERS.indexOf(name)])) });
          }
          drawKinks(sheet, solved, after);
          if ((drawing?.start || drawing?.end) && drawing.cursor) {
            const counts=LAYERS.map(name=>after[name].childNodes.length);
            drawPreview(sheet, after);
            preview=LAYERS.map((name,i)=>[...after[name].childNodes].slice(counts[i]));
          }
        }
        if (sheet.inchesPerPixel) window.StripeMaker.intersections?.draw(sheet, after, solved);  // ground level
        if(sheet.inchesPerPixel){
          const areas=medianEdgeCuts(sheet,solved,false);
          if(areas.length){
            const id=`bike-asphalt-medians-${sheet.id}`,clip=document.createElementNS(SVG,'clipPath');clip.id=id;
            for(const area of areas){const p=document.createElementNS(SVG,'path');p.setAttribute('d',`${pathData(area)}Z`);clip.append(p);}
            const over=document.createElementNS(SVG,'g');over.setAttribute('clip-path',`url(#${id})`);over.classList.add('bikeMedianConflicts');
            for(const road of sheet.roads)if(independentBikeRoad(road)&&(road.level??1)===1){const group=nodes.get(road.id)?.group;if(group)over.append(group.cloneNode(true));}
            after.markings.append(clip,over);
          }
        }
        if (sheet.inchesPerPixel) window.StripeMaker.longitudinal.drawMovementLines(sheet, after.markings);
        // A same-direction gore's 8-inch white boundary replaces the edge color
        // underneath it, including the yellow half of an intersection corner.
        // Keep these vector strokes above ground-level intersection markings,
        // but below bridges; yellow beyond the marked gore remains untouched.
        for(const outline of [...after.markings.querySelectorAll('.goreWhiteOutline')])after.markings.append(outline);
        // Bridges go over every lower road, gore, and intersection.
        const place = sheet.inchesPerPixel ? window.StripeMaker.levels?.draw(sheet, after.markings, {
          section: crossSectionOf(sheet, solved), nodes, gores, pairOf: road => pairOf(sheet, road), concrete: CONCRETE, barrier: CURB }) : null;
        // Elevated intersections go on their level, over lower bridges and roads.
        if (place) window.StripeMaker.intersections?.drawElevated?.(sheet, place.slot, solved);
        if (sheet.inchesPerPixel) window.StripeMaker.markings?.draw(sheet, after.markings, solved, place);
        window.StripeMaker.signs?.draw(sheet, after.markings);
        window.StripeMaker.matchLines?.draw(sheet, after.markings);
        // Each layer's group holds the medians, then the roads, then the rest.
        const parts = Object.fromEntries(LAYERS.map(name => [name, { before: [...before[name].childNodes], after: [...after[name].childNodes] }]));
        for (const name of LAYERS) {
          const group = roads[name];
          if (partial) drawn.parts[name].before.concat(drawn.parts[name].after).forEach(node => {if(node.parentNode===group)node.remove();});
          else group.setAttribute("class", `road${name[0].toUpperCase()}${name.slice(1)}`);
          group.prepend(...parts[name].before);
          group.append(...parts[name].after);
        }
        if (!partial) layer.replaceChildren(...LAYERS.map(name => roads[name]));
        drawn = { sheet, layers: roads, parts, roads: nodes, targets, roadKey, preview };
        });
      }
      lastSolved = solved && { sheet, solved, medianKey };
      drawOverlay(solved, partial);
      updatePanel(solved);
      window.StripeMaker.diagrammaticRender?.(sheet);
      window.StripeMaker.intersections?.refreshOverlay();
      window.StripeMaker.signs?.refreshOverlay();
      window.StripeMaker.matchLines?.refreshOverlay();
      window.StripeMaker.markings?.refreshOverlay();
      window.StripeMaker.longitudinal.refreshOverlay?.();
      window.StripeMaker.levels?.refreshOverlay?.();
      window.StripeMaker.simulator?.refreshOverlay();
      window.StripeMaker.selection?.refresh?.();
    }
    // A two-way preview puts the clicked line on the centerline, like the result.
    function drawPreview(sheet, layers) {
      const defaults = drawingDefaults();
      const line = drawing.end ? [drawing.cursor, drawing.end] : [drawing.start, drawing.cursor];
      if (!defaults.opposite) return drawRoad(sheet, defaults, buildShape(sheet, defaults, line, new Map()), layers, "preview");
      const half = (inchesToPixels(sheet, DOUBLE_GAP_INCHES + LINE_INCHES) + feetToPixels(sheet, defaults.median)) / 2;
      const width = lanes => lanes * feetToPixels(sheet, defaults.laneWidth) / 2;
      const opposite = { ...defaults, lanes: defaults.opposite };
      drawRoad(sheet, defaults, buildShape(sheet, defaults, offset(line, half + width(defaults.lanes)), new Map()), layers, "preview");
      drawRoad(sheet, opposite, buildShape(sheet, opposite, offset([...line].reverse(), half + width(opposite.lanes)), new Map()), layers, "preview");
    }
    // Every edit is an undo step (typing in a field is one step until it's left).
    // A drag's last change ({ joints, roads }) redraws only those roads; the rest
    // of the sheet refreshes shortly after.
    // Bike lane upkeep (stale lane types, carrying on, keyholes), on every edit
    // and when a sheet opens. Returns whether anything changed.
    function tidyBikeLanes(sheet) {
      if (!sheet?.roads) return false;
      const before = JSON.stringify([sheet.roads.map(r => r.laneTypes ?? null), sheet.joints.map(j => j.links)]);
      // Retire the former Elements checkbox's generated surfaces. Markings
      // tool placements have no bikeTreatment flag and remain untouched.
      const removedGreen=sheet.surfaces?.some(surface=>surface.bikeTreatment)??false;
      if(removedGreen)sheet.surfaces=sheet.surfaces.filter(surface=>!surface.bikeTreatment);
      for (const road of sheet.roads) for (const lane of Object.keys(road.laneTypes ?? {})) if (Number(lane) >= road.lanes) delete road.laneTypes[lane];
      extendBikeLanes(sheet);
      makeKeyholes(sheet);
      carryBikeLanes(sheet);
      return removedGreen || before !== JSON.stringify([sheet.roads.map(r => r.laneTypes ?? null), sheet.joints.map(j => j.links)]);
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
      pruneGores(sheets.selected);
      tidyBikeLanes(sheets.selected);
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
      overlay.classList.toggle("drawing", Boolean(drawing || medianDraw));
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
      drawGoreButtons(sheet, solved);
      drawLaneAdds(sheet, solved);
      drawMedianOverlay(sheet, solved);
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
      const state=!overlay.hidden&&!drawing&&!medianDraw&&arcHandleState();
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
      const road = !overlay.hidden && !drawing && !medianDraw && selectedRoad && sheet?.roads.includes(selectedRoad) ? selectedRoad : null;
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
        const bikeEdge = bikeType(r, side === "R" ? r.lanes - 1 : 0);
        button.setAttribute("aria-label", label);
        button.title = bikeEdge ? `${label} (inside the bike lane; Shift-click for a turn lane outside it, a keyhole)` : label;
      });
    }
    // A lane added on an edge. A one-way road keeps its other edge and every
    // lane in place: each end that positions its joint (the joint's root) moves
    // the joint half a lane toward the new lane. A two-way side already grows
    // outward from its centerline.
    function addLane(sheet, road, side, bike = null, outside = false) {
      if (!sheet || road.lanes >= MAX_LANES) return;
      growRoad(sheet, road, side, bike, outside);
      changed();
    }
    // The lane itself (a bike lane when `bike` is "bike" or "bufferedBike").
    // A travel lane added on a bike lane's side goes inside it, keeping the bike
    // lane at the edge; `outside` (Shift-click) puts it outside instead, as a
    // turn lane, making a keyhole.
    function growRoad(sheet, road, side, bike = null, outside = false) {
      const edge = side === "R" ? road.lanes - 1 : 0;
      const inside = !bike && !outside && road.lanes > 0 && bikeType(road, edge) && bikeType(road, edge) !== "twoWayBike";
      const solved = solve(sheet);
      const width = bike ? BIKE_LANE[bike].width : road.laneWidth;
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
      const at = side === "L" ? (inside ? 1 : 0) : (inside ? road.lanes - 1 : road.lanes);
      if (at < road.lanes) {
        renumberLanes(sheet, road, at);
        if (selectedLane && selectedRoad === road && selectedLane.lane >= at) selectedLane = { ...selectedLane, lane: selectedLane.lane + 1 };
      }
      road.lanes += 1;
      if (bike) (road.laneTypes ??= {})[side === "L" ? 0 : road.lanes - 1] = { type: bike, width };
    }
    // Add Bike Lane: on the outer (right) edge of the selected road, both sides of
    // a two-way road, buffered or not per the Buffered bike lane toggle.
    function addBikeLane(track = false) {
      const sheet = sheets.selected;
      if (!sheet || !selectedRoad) return;
      const type = track ? "twoWayBike" : defaults.bufferedBike ? "bufferedBike" : "bike";
      // A two-way track serves both directions, so it goes on the selected side only.
      const sides = (track ? [selectedRoad] : [selectedRoad, pairOf(sheet, selectedRoad)]).filter(Boolean).filter(road => !bikeType(road, road.lanes - 1));
      if (!sides.length) {
        hint.textContent = "This road already has a bike lane on its outer edge.";
        return;
      }
      for (const road of sides) growRoad(sheet, road, "R", type);
      changed();
      document.getElementById("bikeSetup").scrollIntoView({block:"nearest"});
      hint.textContent = `${{ bufferedBike: "Buffered bike lane", bike: "Bike lane", twoWayBike: "Two-way bike track" }[type]} added (${BIKE_LANE[type].width} ft).`;
    }
    // The Buffered bike lane toggle: the selected road's bike lanes switch
    // between buffered (7 ft, double line) and plain (5 ft) per FDM 223.2.2.1.
    function setBuffered(on) {
      defaults.bufferedBike = on;
      const sheet = sheets.selected;
      if (!selectedRoad || !sheet) return render();
      let any = false;
      for (const road of [selectedRoad, pairOf(sheet, selectedRoad)].filter(Boolean)) {
        for (const lane of Object.values(road.laneTypes ?? {})) {
          const from = lane.type, to = on ? "bufferedBike" : "bike";
          if (from === to || lane.inherited || !["bike", "bufferedBike"].includes(from)) continue;
          if (lane.width === BIKE_LANE[from].width) lane.width = BIKE_LANE[to].width;
          lane.type = to;
          any = true;
        }
      }
      any ? changed() : render();
    }
    // Keyholes: a bike lane carries on into the road it continues into, lane to
    // lane. When that road adds a right-turn lane outside it, the bike lane ends
    // up between the through and turn lanes: a keyhole (FDM 223.3.2). Carried
    // bike lanes are marked `inherited` and follow their source; one set by hand
    // stays as it is.
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
    // Bike lane keyholes, automatically (FDM 223.3.2): when a bike lane continues
    // into a lane with lanes added between it and the through lanes (a right-turn
    // lane starting inside it), it moves over to continue into the first added
    // lane instead, so it runs between the through lanes and the turn lane. Its
    // road shifts over to line up; the turn lane is left outside it.
    function makeKeyholes(sheet) {
      for (const joint of sheet.joints) {
        const links = laneLinks(sheet, joint);
        for (const l of links) {
          // Two-way tracks are separated facilities, not keyhole lanes.
          if (!bikeType(l.from, l.fromLane) || bikeType(l.from, l.fromLane) === "twoWayBike") continue;
          const fed = new Set(links.filter(x => x.to === l.to).map(x => x.toLane));
          // Through lanes are on the bike lane's inside: its left on the right
          // half of the road, its right on the left half.
          const step = l.fromLane >= (l.from.lanes - 1) / 2 ? -1 : 1;
          let k = l.toLane + step;
          while (k >= 0 && k < l.to.lanes && !fed.has(k)) k += step;
          const target = k - step;
          if (target !== l.toLane && target >= 0 && target < l.to.lanes) {
            if (l.link.b === l.to.id) l.link.bi = target; else l.link.ai = target;
          }
        }
      }
    }
    // A bike lane doesn't just end where traffic crosses its path (FDM 223.5.2):
    // when it ends at a joint where its road carries on and another road leaves
    // there, it carries on along the through road (the one carrying on most of
    // its lanes), which gets a bike lane on that edge. Where the lane inside the
    // bike lane is the one leaving (a drop lane into a ramp or turn), the bike
    // lane moves over to the through road's edge (FDM Exhibit 223-3 B). A bike lane carried on this way
    // keeps going through plain continuations too.
    function extendBikeLanes(sheet) {
      for (let pass = 0, again = true; again && pass <= sheet.roads.length; pass++) {
        again = false;
        for (const road of [...sheet.roads]) for (const lane of [road.lanes - 1, 0]) {
          const type = bikeType(road, lane);
          if (!type || type === "twoWayBike" || road.lanes < 2) continue;
          const joint = jointOf(sheet, road.ends[1].joint);
          const links = joint ? laneLinks(sheet, joint) : [];
          if (!joint || links.some(l => l.from === road && l.fromLane === lane)) continue;
          // The through road: the one that carries on most of this road's lanes
          // (a ramp or turn lane splitting off takes fewer).
          const right = lane === road.lanes - 1;
          const counts = new Map();
          for (const l of links) if (l.from === road) counts.set(l.to, (counts.get(l.to) ?? 0) + 1);
          const solved = solve(sheet), incoming = travelAt(road, 1, solved);
          const through = [...counts].sort((p, q) => q[1] - p[1] ||
            dot(incoming, travelAt(q[0], 0, solved)) - dot(incoming, travelAt(p[0], 0, solved)))[0]?.[0];
          if (!through) continue;
          const crossing = sheet.roads.some(o => o !== through && o !== road && o.ends[0].joint === joint.id && o !== pairOf(sheet, through));
          if (!crossing && !road.laneTypes[lane].inherited) continue;
          const edge = right ? through.lanes - 1 : 0;
          if (bikeType(through, edge)) {
            // The through road already has a bike lane there: it continues this
            // one. A travel lane of this road feeding it instead (as when the
            // bike lane was drawn on afterward) gives way; that lane keeps
            // whatever else it continues into, like the ramp.
            const feeding = links.filter(l => l.to === through && l.toLane === edge);
            if (feeding.some(l => l.from !== road || bikeType(road, l.fromLane))) continue;
            for (const l of feeding) joint.links.splice(joint.links.indexOf(l.link), 1);
            joint.links.push({ a: road.id, ai: lane, b: through.id, bi: edge });
          } else if (!bikeType(through, edge)) {
            growRoad(sheet, through, right ? "R" : "L", type);
            joint.links.push({ a: road.id, ai: right ? lane : 0, b: through.id, bi: right ? through.lanes - 1 : 0 });
            through.laneTypes[right ? through.lanes - 1 : 0].inherited = true;
          } else continue;
          again = true;
        }
      }
    }
    function carryBikeLanes(sheet) {
      const destinations = new Set(sheet.joints.flatMap(j => laneLinks(sheet, j)).map(l => `${l.to.id}:${l.toLane}`));
      for (const road of sheet.roads) for (const [lane, type] of Object.entries(road.laneTypes ?? {})) {
        if (type.inherited && !destinations.has(`${road.id}:${lane}`)) delete road.laneTypes[lane];
      }
      for (let pass = 0, again = true; again && pass <= sheet.roads.length; pass++) {
        again = false;
        for (const joint of sheet.joints) for (const link of joint.links) {
          if (link.pair || link.beside || typeof link.ai !== "number" || typeof link.bi !== "number") continue;
          let [from, fromLane, to, toLane] = [roadOf(sheet, link.a), link.ai, roadOf(sheet, link.b), link.bi];
          if (!from || !to) continue;
          if (from.ends[0].joint === joint.id && to.ends[1].joint === joint.id) [from, fromLane, to, toLane] = [to, toLane, from, fromLane];
          if (from.ends[1].joint !== joint.id || to.ends[0].joint !== joint.id) continue;
          const source = from.laneTypes?.[fromLane], own = to.laneTypes?.[toLane];
          if (own && !own.inherited) continue;
          if (source && (own?.type !== source.type || own?.width !== source.width)) {
            (to.laneTypes ??= {})[toLane] = { type: source.type, width: source.width, inherited: true };
            again = true;
          } else if (!source && own) {
            delete to.laneTypes[toLane];
            again = true;
          }
        }
      }
    }
    // Lanes count from the left, so a lane added on the left renumbers the road's
    // lanes and everything that refers to them.
    function renumberLanes(sheet, road, from = 0) {
      const up = lane => (Number(lane) >= from ? Number(lane) + 1 : Number(lane));
      for (const spawn of sheet.vehicleSpawns ?? []) {
        if (spawn.road === road.id) {
          if (spawn.excludedLanes) spawn.excludedLanes = spawn.excludedLanes.map(up);
          if (spawn.laneShares) spawn.laneShares = Object.fromEntries(Object.entries(spawn.laneShares).map(([lane, percent]) => [up(lane), percent]));
          if (spawn.outputs) spawn.outputs = Object.fromEntries(Object.entries(spawn.outputs).map(([lane, rate]) => [up(lane), rate]));
          for (const route of spawn.routes ?? []) if (route.lane != null) route.lane = up(route.lane);
        }
        for (const route of spawn.routes ?? []) if (route.exit.road === road.id && route.exit.lane != null) route.exit.lane = up(route.exit.lane);
      }
      const bump = key => key.replace(/:(\d+)$/, (_, lane) => `:${up(lane)}`);
      for (const field of ["tapers", "laneEndWidths"]) {
        if (road[field]) road[field] = Object.fromEntries(Object.entries(road[field]).map(([key, value]) => [bump(key), value]));
      }
      for (const field of ["laneWidths", "laneTypes", "gapProfiles"]) {
        if (road[field]) road[field] = Object.fromEntries(Object.entries(road[field]).map(([lane, value]) => [up(lane), value]));
      }
      if (road.widthProfiles) road.widthProfiles = [...road.widthProfiles.slice(0, from), null, ...road.widthProfiles.slice(from)];
      for (const joint of sheet.joints) for (const link of joint.links) {
        if (link.a === road.id && typeof link.ai === "number") link.ai = up(link.ai);
        if (link.b === road.id && typeof link.bi === "number") link.bi = up(link.bi);
      }
      for (const item of sheet.intersections ?? []) for (const approach of item.approaches) {
        for (const link of approach.links ?? []) if (link.road === road.id && typeof link.lane === "number") link.lane = up(link.lane);
      }
      for (const marking of sheet.markings ?? []) if (marking.on?.road === road.id && typeof marking.on.lane === "number") marking.on.lane = up(marking.on.lane);
      // Lines on boundaries: those at or past the new lane's left boundary move over.
      for (const line of sheet.lines ?? []) if (line.on?.road === road.id && typeof line.on.k === "number" && line.on.k >= (from ? from + 1 : 0)) line.on.k++;
      for (const surface of sheet.surfaces ?? []) if (surface.on.road === road.id) surface.on.lane = up(surface.on.lane);
    }

    // Every place a gore can go shows a gore icon at its point; dragging it along
    // the gore's center marks the gore up to the icon.
    function goreButton(key) {
      let button = goreButtons.get(key);
      if (button) return button;
      button = document.createElement("button");
      button.type = "button";
      button.className = "goreHandle";
      button.dataset.gore = key;
      button.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Delete");
      bindGore(button);
      goreButtons.set(key, button);
      overlay.append(button);
      return button;
    }
    function drawGoreButtons(sheet, solved) {
      const seen = new Set();
      if (!overlay.hidden) {
        for (const candidate of goreCandidates(sheet, solved).values()) {
          const gore = sheet.gores.find(item => item.key === candidate.key);
          const button = goreButton(candidate.key);
          seen.add(candidate.key);
          const rest = GORE_ICON_PIXELS / sheet.view.scale;
          const at = Math.min(Math.max(gore ? feetToPixels(sheet, gore.length) : 0, rest), candidate.along.at(-1));
          const i = indexAt(candidate.along, at);
          const t = goreTangent(candidate.mid, i);
          place(button, candidate.mid[i]);
          button.style.setProperty("--angle", `${Math.atan2(t.y, t.x)}rad`);
          button.classList.toggle("marked", Boolean(gore));
          button.classList.toggle("selected", candidate.key === selectedGore);
          const kind = candidate.same ? "Gore" : "Traffic separation";
          button.setAttribute("aria-label", gore ? `${kind}, marked ${Math.round(Math.min(gore.length,candidate.along.at(-1)/feetToPixels(sheet,1)))} ft` : `${kind}, unmarked. Drag along the gore to mark it.`);
        }
      }
      for (const [key, button] of goreButtons) {
        if (seen.has(key)) continue;
        button.remove();
        goreButtons.delete(key);
      }
      if (selectedGore && !seen.has(selectedGore) && !overlay.hidden) selectedGore = null;
    }
    function setGoreLength(sheet, key, feet) {
      let gore = sheet.gores.find(item => item.key === key);
      const candidate = goreCandidates(sheet, solve(sheet)).get(key);
      if (!candidate) return;
      feet = Math.max(0, Math.min(feet, candidate.along.at(-1) / feetToPixels(sheet, 1)));
      if (!gore && feet > 0) sheet.gores.push(gore = { key, length: feet, spacing: goreDefaultSpacing(candidate),
        ...(candidate.intersection?{intersection:candidate.intersection,approaches:candidate.approaches}: {}) });
      if (gore) gore.length = feet;
    }
    function bindGore(button) {
      let dragging = false;
      button.addEventListener("pointerdown", event => {
        if (event.button !== 0 || drawing) return;
        event.stopPropagation();
        button.setPointerCapture(event.pointerId);
        dragging = false;
        selectGore(button.dataset.gore);
      });
      button.addEventListener("pointermove", event => {
        if (!button.hasPointerCapture(event.pointerId)) return;
        const sheet = sheets.selected;
        const candidate = goreCandidates(sheet, solve(sheet)).get(button.dataset.gore);
        if (!candidate) return;
        dragging = true;
        // The marking follows the nearest point along the gore's center.
        const pointer = sheets.toImage(event.clientX, event.clientY);
        let nearest = 0;
        candidate.mid.forEach((p, i) => {
          const m = candidate.mid[nearest];
          if (Math.hypot(p.x - pointer.x, p.y - pointer.y) < Math.hypot(m.x - pointer.x, m.y - pointer.y)) nearest = i;
        });
        const s = candidate.along[nearest];
        setGoreLength(sheet, button.dataset.gore, s < GORE_ICON_PIXELS / sheet.view.scale / 2 ? 0 : s / feetToPixels(sheet, 1));
        renderSoon({});
      });
      const finish = event => {
        if (!button.hasPointerCapture(event.pointerId)) return;
        button.releasePointerCapture(event.pointerId);
        if (dragging) changed({});
      };
      button.addEventListener("pointerup", finish);
      button.addEventListener("pointercancel", finish);
      button.addEventListener("keydown", event => {
        const moves = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
        if (!moves[event.key]) return;
        event.preventDefault();
        event.stopPropagation();
        const sheet = sheets.selected;
        const gore = sheet.gores.find(item => item.key === button.dataset.gore);
        selectedGore = button.dataset.gore;
        setGoreLength(sheet, button.dataset.gore, (gore?.length ?? 0) + moves[event.key] * (event.shiftKey ? 50 : 5));
        changed();
      });
    }
    function selectGore(key) {
      selectedGore = key;
      selectedRoad = null;
      selectedLane = null;
      closeMenu();
      render();
      window.StripeMaker.selection?.editorChanged();
    }
    function removeGore() {
      const sheet = sheets.selected;
      if (!sheet || !selectedGore) return;
      sheet.gores = sheet.gores.filter(gore => gore.key !== selectedGore);
      changed();
    }
    // While a median is drawn: its points so far and lines to the cursor and back to
    // the first point. Once selected: a handle on each point; dragging a shared
    // point moves every median that shares it.
    // The preview follows a road's edge between points on it, like the median will.
    function drawMedianOverlay(sheet, solved) {
      const show = !overlay.hidden && medianDraw;
      const points = show ? [...medianDraw.points, ...(medianDraw.cursor ? [medianDraw.cursor] : [])] : [];
      const legs = points.length > 1 ? medianLegs(sheet, solved ?? solve(sheet), points) : points.map(p => [p]);
      const screen = path => path.map(p => sheets.toScreen(p)).map(p => `${p.x},${p.y}`).join(" ");
      medianPreview.setAttribute("points", screen([...legs.slice(0, -1).flat(), ...points.slice(-1)]));
      medianClosing.setAttribute("visibility", points.length > 2 ? "visible" : "hidden");
      if (points.length > 2) medianClosing.setAttribute("points", screen([...legs.at(-1), points[0]]));
      medianPreviewPoints.replaceChildren(...(show ? medianDraw.points : []).map(p => {
        const at = sheets.toScreen(p);
        const mark = document.createElementNS(SVG, "circle");
        Object.entries({ cx: at.x, cy: at.y, r: 4 }).forEach(([key, value]) => mark.setAttribute(key, value));
        return mark;
      }));
      const median = !overlay.hidden && !medianDraw && medianOf(sheet, selectedMedian);
      const count = median ? median.points.length : 0;
      while (medianPoints.length > count) medianPoints.pop().remove();
      while (medianPoints.length < count) medianPoints.push(medianPointButton(medianPoints.length));
      medianPoints.forEach((button, i) => {
        place(button, median.points[i]);
        const shared = sharedPoints(sheet, median.points[i]).length > 1;
        button.classList.toggle("shared", shared);
        button.setAttribute("aria-label", `Median point ${i + 1} of ${count}${shared ? ", shared with another median" : ""}`);
        button.title = median.points[i].on ? "Anchored to a roadway edge. Drag away to make a free point."
          : "Double-click or press Enter to switch between a corner and a Bézier point. Drag the round handles to shape the curve.";
        button.setAttribute("aria-description", button.title);
      });
      medianControlLines.replaceChildren();
      const visible = new Set();
      median?.points?.forEach((p,index) => {
        if (p.on || !p.curve) return;
        for (const side of ['in','out']) {
          const key = `${index}:${side}`; visible.add(key);
          if (!medianControls.has(key)) medianControls.set(key, medianCurveButton(index,side));
          const at = {x:p.x+p.curve[side].x,y:p.y+p.curve[side].y};
          place(medianControls.get(key),at);
          const from = sheets.toScreen(p), to = sheets.toScreen(at), line = document.createElementNS(SVG,'line');
          for (const [k,v] of Object.entries({x1:from.x,y1:from.y,x2:to.x,y2:to.y,class:'roadControlLine'})) line.setAttribute(k,v);
          medianControlLines.append(line);
        }
      });
      for (const [key,button] of medianControls) if (!visible.has(key)) { button.remove(); medianControls.delete(key); }
    }
    function toggleMedianCurve(index) {
      const median = medianOf(sheets.selected,selectedMedian), p = median?.points[index];
      if (!p || p.on) return;
      if (p.curve) delete p.curve;
      else {
        const prev = median.points[(index+median.points.length-1)%median.points.length], next = median.points[(index+1)%median.points.length];
        const tangent = unit({x:next.x-prev.x,y:next.y-prev.y});
        const length = Math.min(Math.hypot(p.x-prev.x,p.y-prev.y),Math.hypot(next.x-p.x,next.y-p.y))/3;
        // Relative vectors keep handles attached during point/selection moves.
        p.curve = {in:{x:-tangent.x*length,y:-tangent.y*length},out:{x:tangent.x*length,y:tangent.y*length}};
      }
      changed();
    }
    function medianCurveButton(index,side) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'roadControl medianCurveControl';
      button.dataset.index = index; button.dataset.side = side;
      button.setAttribute('aria-label',`Median point ${index+1} ${side==='in'?'incoming':'outgoing'} curve handle`);
      button.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown');
      button.title = 'Drag to shape the curve. Hold Option/Alt to adjust this handle independently.';
      const target = () => medianOf(sheets.selected,selectedMedian)?.points[index];
      const move = (to,independent) => {
        const p = target(); if (!p?.curve || p.on) return;
        const v = {x:to.x-p.x,y:to.y-p.y}, other = side==='in'?'out':'in', length = Math.hypot(v.x,v.y);
        if (!independent && length>1e-6) {
          const scale = Math.hypot(p.curve[other].x,p.curve[other].y)/length;
          p.curve[other] = {x:-v.x*scale,y:-v.y*scale};
        }
        p.curve[side] = v;
      };
      button.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.stopPropagation();button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('pointermove',event=>{
        if(!button.hasPointerCapture(event.pointerId))return;
        move(sheets.toImage(event.clientX,event.clientY),event.altKey);renderMedianSoon();
      });
      const finish=event=>{if(button.hasPointerCapture(event.pointerId)){button.releasePointerCapture(event.pointerId);changed();}};
      button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',finish);
      button.addEventListener('dblclick',event=>event.stopPropagation());
      nudgeKeys(button,(dx,dy)=>{const p=target();if(!p?.curve)return false;move({x:p.x+p.curve[side].x+dx,y:p.y+p.curve[side].y+dy},false);});
      overlay.append(button); return button;
    }
    function medianPointButton(index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "medianPoint";
      button.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Delete");
      const target = () => medianOf(sheets.selected, selectedMedian)?.points[index];
      let moving = null;
      button.addEventListener("pointerdown", event => {
        const point = target();
        if (event.button !== 0 || !point) return;
        event.stopPropagation();
        button.setPointerCapture(event.pointerId);
        moving = sharedPoints(sheets.selected, point);
      });
      button.addEventListener("pointermove", event => {
        if (!moving || !button.hasPointerCapture(event.pointerId)) return;
        const pointer = sheets.toImage(event.clientX, event.clientY);
        snapTarget = snapMedian(sheets.selected, pointer, new Set(moving));
        const goal = snapTarget ?? pointer;
        moving.forEach(p => {
          Object.assign(p, { x: goal.x, y: goal.y, on: goal.on && { ...goal.on } });
          if (!p.on) delete p.on;
          else delete p.curve;
        });
        // Apply every snap/point edit above; coalesce only the drawing work.
        // Release/cancel calls changed(), which flushes the final full render.
        renderMedianSoon();
      });
      const finish = event => {
        if (!moving || !button.hasPointerCapture(event.pointerId)) return;
        button.releasePointerCapture(event.pointerId);
        moving = null;
        snapTarget = null;
        changed();
      };
      button.addEventListener("pointerup", finish);
      button.addEventListener("pointercancel", finish);
      nudgeKeys(button, (dx, dy) => {
        const point = target();
        if (!point) return false;
        // A nudged point leaves the edge it was anchored to.
        sharedPoints(sheets.selected, point).forEach(p => {
          Object.assign(p, { x: p.x + dx, y: p.y + dy });
          delete p.on;
        });
      });
      button.dataset.index = index;
      button.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();toggleMedianCurve(index);});
      button.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();toggleMedianCurve(index);}});
      overlay.append(button);
      return button;
    }
    function insertMedianPoint(sheet, point) {
      const solved=solve(sheet),tolerance=8/sheet.view.scale;
      let best=null;
      for(const median of [...sheet.medians].reverse()) {
        if(median.points.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<=tolerance))continue;
        const legs=medianLegs(sheet,solved,median.points);
        legs.forEach((leg,index)=>{
          const at=nearestOn([...leg,median.points[(index+1)%median.points.length]],point);
          if(at&&at.distance<=tolerance&&(!best||at.distance<best.at.distance))best={median,index,at,segments:leg.length};
        });
      }
      if(!best)return false;
      const next={x:best.at.x,y:best.at.y};
      const p=best.median.points[best.index],q=best.median.points[(best.index+1)%best.median.points.length];
      const curved=(!p.on&&p.curve)||(!q.on&&q.curve);
      if(curved) {
        // Split the cubic itself so adding a point does not reshape the median.
        const t=best.at.s/best.segments,lerp=(a,b)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
        const a=!p.on&&p.curve?{x:p.x+p.curve.out.x,y:p.y+p.curve.out.y}:p;
        const b=!q.on&&q.curve?{x:q.x+q.curve.in.x,y:q.y+q.curve.in.y}:q;
        const u=lerp(p,a),v=lerp(a,b),w=lerp(b,q),l=lerp(u,v),r=lerp(v,w),at=lerp(l,r);
        Object.assign(next,at,{curve:{in:{x:l.x-at.x,y:l.y-at.y},out:{x:r.x-at.x,y:r.y-at.y}}});
        if(!p.on&&p.curve)p.curve.out={x:u.x-p.x,y:u.y-p.y};
        if(!q.on&&q.curve)q.curve.in={x:w.x-q.x,y:w.y-q.y};
      }
      // A point on a curved road boundary keeps its anchor, so inserting it
      // cannot straighten the outline and it continues to follow road edits.
      let anchor=null;
      for(const edge of curved?[]:pavementEdges(sheet,solved).edges){
        const at=nearestOn(edge,next);
        if(edge.on&&at&&at.distance<=.5&&(!anchor||at.distance<anchor.at.distance))anchor={edge,at};
      }
      if(anchor)next.on={...anchor.edge.on,f:fractionAt(anchor.edge,anchor.at.s)};
      best.median.points.splice(best.index+1,0,next);
      window.StripeMaker.showEditor("elementsEditor");
      selectMedian(best.median.id);changed();
      medianPoints[best.index+1]?.focus();
      return true;
    }
    // A median keeps at least three points.
    function removeMedianPoint(index) {
      const median = medianOf(sheets.selected, selectedMedian);
      if (!median || median.points.length <= 3) return;
      median.points.splice(index, 1);
      changed();
      medianPoints[Math.min(index, medianPoints.length - 1)]?.focus();
    }
    function selectMedian(id) {
      selectedMedian = id;
      medianSheet = sheets.selected;
      selectedRoad = null;
      selectedLane = null;
      selectedGore = null;
      closeMenu();
      render();
      window.StripeMaker.selection?.editorChanged();
    }
    function startMedian() {
      drawing = null;
      snapTarget = null;
      selectMedian(null);
      medianDraw = { points: [], cursor: null };
      render();
    }
    // Three or more points close the outline; fewer cancel it.
    function finishMedian() {
      const sheet = sheets.selected;
      const points = medianDraw?.points ?? [];
      medianDraw = null;
      snapTarget = null;
      if (!sheet || points.length < 3) return render();
      const median = {
        id: nextId(sheet.medians), type: defaults.medianType, spacing: defaults.medianSpacing,
        color: defaults.medianColor, lean: defaults.medianLean, hideEdgeLines:Boolean(defaults.medianHideEdgeLines), points,
      };
      sheet.medians.push(median);
      selectMedian(median.id);
      changed();
    }
    function removeMedian() {
      const sheet = sheets.selected;
      sheet.medians = sheet.medians.filter(median => median.id !== selectedMedian);
      selectedMedian = null;
      changed();
    }
    // The median's own points count too, so clicking the first one closes it.
    function medianDrawPoint(sheet, clientX, clientY) {
      const point = sheets.toImage(clientX, clientY);
      snapTarget = snapMedian(sheet, point, new Set(), medianDraw.points);
      return snapTarget ? { x: snapTarget.x, y: snapTarget.y, ...(snapTarget.on && { on: { ...snapTarget.on } }) } : point;
    }

    function setupBikeLane() {
      const lanes=Object.keys(selectedRoad?.laneTypes??{}).map(Number).filter(k=>["bike","bufferedBike"].includes(bikeType(selectedRoad,k)));
      return lanes.includes(selectedLane?.lane) ? selectedLane.lane : lanes[0];
    }
    function updateBikeSetup(sheet,solved) {
      const lane=setupBikeLane(), box=document.getElementById("bikeSetup");
      box.hidden=lane==null;
      if(lane==null)return;
      const lanes=Object.keys(selectedRoad.laneTypes).map(Number).filter(k=>["bike","bufferedBike"].includes(bikeType(selectedRoad,k)));
      const picker=document.getElementById("bikeSetupLane");
      picker.replaceChildren(...lanes.map(k=>new Option(`Lane ${k+1}`,k)));
      picker.value=String(lane);document.getElementById("bikeSetupLaneRow").hidden=lanes.length<2;
      const config=selectedRoad.laneTypes[lane],layout=config.conflict??"auto";
      document.getElementById("bikeConflict").value=layout;
      document.getElementById("bikeSpeedRow").hidden=layout!=="separate";
      document.getElementById("bikeSpeed").value=String(config.designSpeed??0);
      document.getElementById("bikeConflictHelp").textContent={
        auto:"Uses the connected roads and their tapers. Choose a situation below when you need a specific crossing treatment.",
        drop:"Use when a through lane becomes turn-only and cyclists move left. Join the bike lane to the through road beyond the drop.",
        separate:"Use when a new turn lane starts outside the bike lane. Add a tapered turn lane below, then choose its design speed if known.",
        freeflow:"Connect the bike lane across the ramp. An entering lane moves cyclists outward; a dropped exit lane moves them inward. The markings follow that direction.",
        channelized:"Use where a curbed turn crosses the bike lane. Join the turning road at the crossing; its pavement defines the dotted section.",
      }[layout];
      const add=document.getElementById("bikeAddTurn");add.disabled=lane!==selectedRoad.lanes-1 || selectedRoad.lanes>=MAX_LANES;
      add.textContent=lane===selectedRoad.lanes-1?"Add Outside Turn Lane":"Outside Lane Already Present";
      const ranges=bikeConflicts(sheet,selectedRoad,shapeOf(sheet,selectedRoad,solved),solved);
      const detected=[...(ranges.get(lane)??[]),...(ranges.get(lane+1)??[])].some(r=>r[2]==="dotted");
      const transition=bikeTransitions(sheet,solved).find(t=>t.road===selectedRoad&&t.lane===lane);
      const showCrossover=Boolean(transition)||["drop","freeflow"].includes(layout);
      document.getElementById("bikeConflictLengthRow").hidden=!showCrossover;
      document.getElementById("bikeConflictLengthHelp").hidden=!showCrossover;
      const lengthInput=document.getElementById("bikeConflictLength");
      lengthInput.value=String(config.conflictLength??(transition?.entering?200:100));
      document.getElementById("bikeCrossoverRow").hidden=!showCrossover;
      document.getElementById("bikeCrossoverHelp").hidden=!showCrossover;
      document.getElementById("bikeCrossover").checked=Boolean(config.continueCrossover);
      document.getElementById("bikeConflictStatus").textContent=detected
        ? `Conflict striping active on lane ${lane+1}. Changes apply immediately.`
        : `No crossing detected on lane ${lane+1} yet. ${layout==="separate"?"Add an outside turn lane and taper its start.":"Connect the crossing or continuing roads to activate the markings."}`;
    }
    function updatePanel(solved) {
      const sheet = sheets.selected;
      const ready = Boolean(sheet?.inchesPerPixel);
      addButton.disabled = !ready;
      addButton.setAttribute("aria-pressed", String(Boolean(drawing && !drawing.bike)));
      addStandaloneBikeButton.disabled = !ready;
      addStandaloneBikeButton.setAttribute("aria-pressed", String(Boolean(drawing?.bike)));
      const standaloneSelected=selectedRoad?.lanes===1&&independentBikeRoad(selectedRoad);
      standaloneBikeTypeInput.disabled=!ready;
      standaloneBikeTypeInput.value=standaloneSelected?(bikeType(selectedRoad,0)==='twoWayBike'?'twoWayBike':'bike'):standaloneBikeType;
      document.getElementById('standaloneBikeTypeRow').hidden=!standaloneSelected;
      addMedianButton.disabled = !ready;
      addMedianButton.setAttribute("aria-pressed", String(Boolean(medianDraw)));
      const median = medianOf(sheet, selectedMedian);
      deleteButton.disabled = !selectedRoad && !median && !sheet?.gores?.some(gore => gore.key === selectedGore);
      updateBikeSetup(sheet,solved);
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
      for (const input of [lanesInput, widthInput, oppositeInput]) input.disabled = Boolean(drawing?.bike);
      document.getElementById("perLaneWidths").checked = Boolean(values.perLaneWidths);
      // The toggle shows the selected road's bike lanes (or the next one's style).
      const bikeLanes = selectedRoad ? Object.values(selectedRoad.laneTypes ?? {}) : [];
      document.getElementById("bufferedBike").checked = bikeLanes.length ? bikeLanes.some(lane => lane.type === "bufferedBike") : defaults.bufferedBike;
      document.getElementById("addBikeLane").disabled = !selectedRoad || !ready;
      document.getElementById("addBikeTrack").disabled = !selectedRoad || !ready;
      updateAddElement();
      // The bike lane controls show with a road selected (Add Bike Lane needs one).
      document.querySelector("#elementsEditor .bikeActions").hidden = !selectedRoad;
      document.getElementById("perLaneWidthsHint").hidden = !values.perLaneWidths;
      document.getElementById("laneWidthFields").hidden = !values.perLaneWidths;
      const partner = sheet && pairOf(sheet, selectedRoad);
      if (document.activeElement !== lanesInput) lanesInput.value = values.lanes;
      if (document.activeElement !== widthInput) widthInput.value = drawing?.bike ? BIKE_LANE[standaloneBikeType].width : values.laneWidth;
      if (document.activeElement !== oppositeInput) oppositeInput.value = selectedRoad ? partner?.lanes ?? 0 : values.opposite;
      medianRow.hidden = selectedRoad ? !partner : !values.opposite;
      if (document.activeElement !== medianInput) {
        medianInput.value = partner ? pairLinks(sheet, selectedRoad, partner)[0]?.median ?? 0 : defaults.median;
      }
      splitRow.hidden = !partner;
      updateCurveFields();
      const lane = selectedRoad && selectedLane?.lane < selectedRoad.lanes ? selectedLane : null;
      laneFields.hidden = !lane || !solved;
      if (!laneFields.hidden) {
        for (const [id, e] of [["laneStartWidth", 0], ["laneEndWidth", 1]]) {
          const input = document.getElementById(id);
          if (document.activeElement !== input) input.value = window.StripeMaker.roadWidths.endWidth(sheet, selectedRoad, e, lane.lane);
        }
        const laneWidthInput = document.getElementById("selectedLaneWidth");
        if (document.activeElement !== laneWidthInput) laneWidthInput.value = window.StripeMaker.roadWidths.laneWidth(selectedRoad, lane.lane);
        const key = `${lane.e}:${lane.lane}`;
        const setting = selectedRoad.tapers?.[key];
        laneTitle.textContent = `Lane ${lane.lane + 1} ${lane.e ? "end" : "start"}`;
        const type = bikeType(selectedRoad, lane.lane);
        if (document.activeElement !== laneTypeSelect) laneTypeSelect.value = type ?? "travel";
        bikeWidthRow.hidden = !type;
        if (type) {
          bikeWidthInput.min = BIKE_LANE[type].min;
          if (document.activeElement !== bikeWidthInput) bikeWidthInput.value = selectedRoad.laneTypes[lane.lane].width;
        }
        if (document.activeElement !== taperSelect) taperSelect.value = setting?.mode ?? "auto";
        if (document.activeElement !== taperLength) taperLength.value = setting?.length ?? DEFAULT_TAPER_FEET;
        const tapering = shapeOf(sheet, selectedRoad, solved).tapers.has(key);
        const autoOff = (setting?.mode ?? "auto") === "auto" && !sheet.autoTapers && solved.auto.has(`${selectedRoad.id}:${key}`);
        taperSelect.disabled = Boolean(type);
        taperLength.disabled = Boolean(type);
        taperState.textContent = type ? "Bike lanes stay full width. Taper the adjacent travel lane instead." : autoOff ? "Auto tapers are off, so this lane stays full width. Choose Taper to taper it."
          : !tapering ? "No taper here."
          : lane.e ? "This lane narrows to nothing at its end (lane drop)." : "This lane widens from nothing at its start (lane add).";
      }
      document.getElementById("keepWidthAtJoins").disabled=!selectedRoad;
      document.getElementById("keepWidthAtJoins").checked=Boolean(selectedRoad?.keepWidthAtJoins);
      autoTapersInput.disabled = !ready;
      autoTapersInput.checked = Boolean(sheet?.autoTapers);
      const candidate = selectedGore && solved && goreCandidates(sheet, solved).get(selectedGore);
      goreFields.hidden = !candidate;
      if (candidate) {
        const gore = sheet.gores.find(item => item.key === selectedGore);
        const spacing = gore?.spacing ?? goreDefaultSpacing(candidate);
        goreTitle.textContent = candidate.same ? "Gore" : "Traffic Separation";
        goreState.textContent = "Drag the gore handle to change its marked length.";
        for (const input of [goreSpacing, goreSpacingValue]) {
          input.disabled = !gore;
          if (document.activeElement !== input) input.value = spacing;
        }
        const maximum=candidate.along.at(-1)/feetToPixels(sheet,1);
        if (document.activeElement !== goreLength) goreLength.value = Math.round(Math.min(gore?.length??0,maximum));
        goreLength.max = Math.floor(maximum);
      }
      medianFields.hidden = !median && !medianDraw;
      if (!medianFields.hidden) {
        const values = median ?? { type: defaults.medianType, spacing: defaults.medianSpacing, color: defaults.medianColor, lean: defaults.medianLean };
        medianTitle.textContent = median ? `${MEDIAN_TYPES[values.type]} Median` : "New Median";
        if (document.activeElement !== medianType) medianType.value = values.type;
        paintedFields.hidden = values.type !== "painted";
        if (document.activeElement !== medianColor) medianColor.value = values.color ?? "yellow";
        medianLean.closest('.fieldRow').hidden=values.color==='none';
        medianSpacing.closest('.fieldRow').hidden=values.color==='none';
        document.getElementById('medianHideEdgesRow').hidden=values.color!=='none';
        document.getElementById('medianHideEdges').checked=Boolean(median?median.hideEdgeLines:defaults.medianHideEdgeLines);
        const chevrons=values.color==='white';
        document.querySelector('label[for="medianLean"]').textContent=chevrons?'Chevron direction':'Stripe direction';
        for(const option of medianLean.options) {
          const label=chevrons?(option.value==='right'?'Point right':'Point left'):(option.value==='right'?'╱ Lean right':'╲ Lean left');
          if(option.textContent!==label)option.textContent=label;
        }
        if (document.activeElement !== medianLean) medianLean.value = values.lean ?? "right";
        for (const input of [medianSpacing, medianSpacingValue]) {
          if (document.activeElement !== input) input.value = values.spacing ?? MEDIAN_SPACING_FEET;
        }
        medianState.textContent = "Choose a surface, then drag the median's points to reshape it.";
      }
      workspace.classList.toggle("drawing", Boolean(drawing || medianDraw));
      workspace.classList.toggle("elementsActive", active());
      if (!sheet) hint.textContent = "Upload a sheet first.";
      else if (!ready) hint.textContent = "Set this sheet's scale first (Sheets › Set Scale) so lanes draw true size.";
      else if (medianDraw) hint.textContent = medianDraw.points.length < 3
        ? "Click the median's corners. Points snap to the outer edges and corners of the pavement, and to other medians' points."
        : "Keep clicking corners. Click the first point, double-click, or press Esc to close the median."
      else if(drawing&&snapTarget?.edge)hint.textContent=snapTarget.direct
        ? "Direct lane connection. Click to join the edge lane; release Shift to add beside it."
        : "Click to add beside this road. Hold Shift to connect directly to its edge lane.";
      else if (drawing?.bike) hint.textContent = drawing.start || drawing.end
        ? "Click the next bike lane node. Keep clicking to continue; double-click or press Esc to finish."
        : "Click the standalone bike lane's start point, then its next node.";
      else if (drawing && (drawing.start || drawing.end) && !drawingAlongTraffic()) hint.textContent = "Click where the new road starts; it ends at the chosen lane's start. Esc cancels.";
      else if (drawing && !drawing.start && !drawing.end) hint.textContent = defaults.opposite
        ? "Click the start of the two-way road's centerline." : "Click the road's start point, a lane's end node to continue from it, or a road's edge line to branch off it.";
      else if (drawing) hint.textContent = defaults.opposite
        ? "Click the next node of the centerline; keep clicking to continue, and double-click or press Esc to finish. Lanes travel start to end; opposite lanes return."
        : drawing.last
          ? "Click to add the next node, or a lane's start node or edge line to join it. Double-click or press Esc to finish."
          : "Click the next node, a lane's start node to join it, or a road's edge line to merge into it. Keep clicking to continue the road; double-click or press Esc to finish. Traffic flows from start to end.";
      else if (candidate) hint.textContent = sheet.gores.some(gore => gore.key === selectedGore)
        ? "Drag the gore icon along the gore to change how far the marking reaches. Drag it back to the point to remove it."
        : "Drag the gore icon along the center of the gore to mark it.";
      else if (median) hint.textContent = "Median selected. Drag its points to reshape it; points shared with another median move both. Delete removes a focused point or the median."
      else if (lane) hint.textContent = bikeType(selectedRoad, lane.lane) ? "Bike lane selected. Choose its situation below. Add green pavement with Markings." : "Lane end selected. Set its taper below, drag the node to move the road end, or right-click it for more.";
      else if (partner) hint.textContent = "Two-way road. Right-click a lane node for actions like curving, tapering, or splitting into one-way roads.";
      else if (selectedRoad) hint.textContent = "Drag a lane node to move the road end, onto another road's node to join them, or onto a road's edge line to feed its edge lane. Hold Shift while dragging a node or curve handle to keep its original direction. Right-click a node for more actions.";
      else hint.textContent = goreButtons.size
        ? "Add a road or median, or click one to edit it. Drag a gore icon along a gore to mark it. Right-click any lane node for actions."
        : "Add a road (set Opposite lanes for two-way) or median, or click one to edit it. Right-click any lane node for actions.";
    }

    function selectRoad(road) {
      selectedGore = null;
      selectedMedian = null;
      selectedRoad = road;
      selectedLane = null;
      render();
      window.StripeMaker.selection?.editorChanged();
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
    const drawingDefaults = () => drawing?.bike ? { ...defaults, lanes: 1, opposite: 0,
      perLaneWidths: false, laneTypes: { 0: { type: standaloneBikeType, width: BIKE_LANE[standaloneBikeType].width } } } : defaults;
    function startDrawing({ start = null, end = null, bike = false } = {}) {
      drawingPointer=null;
      drawing = { start, end, cursor: null, bike };
      medianDraw = null;
      selectedMedian = null;
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
          if(bikeType(other,lane)&&!bikeType(road,movingLane)) {
            // In a lane drop the displayed through bike node sits beside the
            // vacated vehicle lane. A ramp takes that vehicle lane, never the
            // bike-to-bike link. Only infer this for an actually dropped lane.
            if(e!==0)continue;
            const inside=targetLane+(targetLane>0?-1:1);
            if(inside<0||inside>=targetRoad.lanes||bikeType(targetRoad,inside) ||
              links.some(l=>l.from===targetRoad&&l.fromLane===inside&&l.to===other&&!bikeType(other,l.toLane)))continue;
            targetLane=inside;
          }
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
    // A road's centerline (a two-way road's shared one, from its side) and its
    // pavement edges, point for point, for drawing and picking bridges.
    const crossSectionOf = (sheet, solved) => road => {
      const shape = shapeOf(sheet, road, solved);
      const margin = inchesToPixels(sheet, PAVEMENT_MARGIN_INCHES);
      return { line: shape.line, left: boundary(shape, 0, -margin), right: boundary(shape, road.lanes, margin) };
    };
    // The road on top at a point: on the highest level shown there, then the
    // one drawn last. Roads on hidden levels (Settings › Hide levels above)
    // can't be picked there.
    function roadAt(sheet, point) {
      const solved = solve(sheet);
      const slop = 6 / sheet.view.scale;
      const levels = window.StripeMaker.levels;
      let best = null;
      for (const road of [...sheet.roads].reverse()) {
        const shape = shapeOf(sheet, road, solved);
        if (!insidePolygon(point, [...boundary(shape, 0, -slop), ...boundary(shape, road.lanes, slop).reverse()])) continue;
        if (levels && !levels.shownAt(sheet, point, road.id)) continue;
        const level = levels?.levelAt(sheet, point, road.id) ?? 1;
        if (!best || level > best.level) best = { road, level };
      }
      return best?.road ?? null;
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
      // Only simple, undivided, uniform-width travel roads. Branches, bike
      // facilities and explicit tapers retain their normal lane-to-lane joins.
      if (four.some(r => r.centerlineTransition || r.perLaneWidths || r.widthProfiles?.some(p => p && [p.start,p.end,p.width].some(w => w !== r.laneWidth)) || r.gapProfiles ||
          r.laneWidth !== road.laneWidth || Object.values(r.laneTypes ?? {}).some(t => t.type !== 'travel') ||
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
        delete r.widthProfiles; delete r.laneEndWidths;
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
      window.StripeMaker.intersections?.releaseRoad(sheet, road.id, e);
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
      drawing=null; medianDraw=null; snapTarget=null;
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
        const attached=(sheet.intersections??[]).some(x=>x.approaches.some(a=>
          [a.binding,...a.links??[]].some(b=>b && [source.road.id,node.road.id].includes(b.road))));
        if (attached) { curveStatus.textContent="Detach these roads from their intersection before mirroring."; return; }
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

    addButton.addEventListener("click", () => (drawing && !drawing.bike ? stopDrawing() : startDrawing()));
    addStandaloneBikeButton.addEventListener("click", () => (drawing?.bike ? stopDrawing() : startDrawing({ bike: true })));
    elementToAdd.addEventListener('change',updateAddElement);
    addElement.addEventListener('click',()=>{
      if(elementToAdd.value==='bike'||elementToAdd.value==='track'){
        const type=elementToAdd.value==='track'?'twoWayBike':'bike';
        if(drawing?.bike&&standaloneBikeType!==type)stopDrawing();
        standaloneBikeType=type;
      }
      document.getElementById(elementCommands[elementToAdd.value]).click();
      updateAddElement();
    });
    standaloneBikeTypeInput.addEventListener('change',()=>{
      standaloneBikeType=standaloneBikeTypeInput.value;
      if(selectedRoad?.lanes===1&&independentBikeRoad(selectedRoad)){
        selectedRoad.laneTypes[0]={type:standaloneBikeType,width:BIKE_LANE[standaloneBikeType].width};
        changed();
      }else render();
    });
    addMedianButton.addEventListener("click", () => (medianDraw ? finishMedian() : startMedian()));
    for (const [input, key, field] of [[medianColor, "medianColor", "color"], [medianLean, "medianLean", "lean"]]) {
      input.addEventListener("change", () => {
        const median = medianOf(sheets.selected, selectedMedian);
        defaults[key] = input.value;
        if (!median) return render();
        median[field] = input.value;
        changed();
      });
    }
    document.getElementById('medianHideEdges').addEventListener('change',event=>{
      defaults.medianHideEdgeLines=event.target.checked;
      const median=medianOf(sheets.selected,selectedMedian);
      if(!median)return render();
      median.hideEdgeLines=event.target.checked;changed();
    });
    medianType.addEventListener("change", () => {
      const median = medianOf(sheets.selected, selectedMedian);
      defaults.medianType = medianType.value;
      if (!median) return render();
      median.type = medianType.value;
      changed();
    });
    for (const input of [medianSpacing, medianSpacingValue]) {
      input.addEventListener("input", () => {
        const feet = Number(input.value);
        if (!(feet >= MIN_GORE_SPACING_FEET && feet <= MAX_GORE_SPACING_FEET)) return;
        defaults.medianSpacing = feet;
        const median = medianOf(sheets.selected, selectedMedian);
        if (!median) return render();
        median.spacing = feet;
        changed();
      });
    }
    deleteButton.addEventListener("click", deleteSelection);
    function deleteSelection() {
      if (selectedGore) removeGore();
      else if (medianOf(sheets.selected, selectedMedian)) removeMedian();
      else deleteRoad();
    }
    document.getElementById("removeGore").addEventListener("click", removeGore);
    document.getElementById("keepWidthAtJoins").addEventListener("change",event=>{
      if(!selectedRoad)return;
      selectedRoad.keepWidthAtJoins=event.target.checked;
      const partner=pairOf(sheets.selected,selectedRoad);
      if(partner)partner.keepWidthAtJoins=event.target.checked;
      changed();
    });
    autoTapersInput.addEventListener("change", () => {
      if (!sheets.selected) return;
      sheets.selected.autoTapers = autoTapersInput.checked;
      changed();
    });
    goreLength.addEventListener("input", () => {
      const feet = Number(goreLength.value);
      if (!(feet >= 0) || !selectedGore) return;
      setGoreLength(sheets.selected, selectedGore, feet);
      changed();
    });
    for (const input of [goreSpacing, goreSpacingValue]) {
      input.addEventListener("input", () => {
        const feet = Number(input.value);
        const gore = sheets.selected?.gores.find(item => item.key === selectedGore);
        if (!gore || !(feet >= MIN_GORE_SPACING_FEET && feet <= MAX_GORE_SPACING_FEET)) return;
        gore.spacing = feet;
        changed();
      });
    }
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
    // Adds the opposite side of a two-way road on the shared joints. With `keep`,
    // the existing road stays put; otherwise only joints shared with other roads
    // hold still, so a newly drawn road's clicked line becomes its centerline.
    function addOpposite(sheet, road, lanes, median, keep) {
      const before = solve(sheet);
      const joints = road.ends.map(end => jointOf(sheet, end.joint));
      const shared = joints.filter(joint => attachments(sheet, joint).length > 1);
      const opposite = {
        id: nextId(sheet.roads), lanes, laneWidth: road.laneWidth,
        ...(road.arcAngle!=null?{arcAngle:-road.arcAngle}:{}),
        ...(road.clothoid?{clothoid:{start:-road.clothoid.end,end:-road.clothoid.start}}:{}),
        ...(road.arcLoop?{arcLoop:{radius:road.arcLoop.radius,heading:{x:-road.arcLoop.heading.x,y:-road.arcLoop.heading.y}}}:{}),
        ends: [1, 0].map(e => ({ joint: road.ends[e].joint, sign: -road.ends[e].sign, length: road.ends[e].length })),
      };
      joints.forEach((joint, e) => {
        if (!joint.dir) {
          const travel = travelAt(road, e, before);
          joint.dir = { x: travel.x * road.ends[e].sign, y: travel.y * road.ends[e].sign };
        }
        joint.links.push({ a: road.id, ai: 0, b: opposite.id, bi: 0, pair: true, median });
      });
      sheet.roads.push(opposite);
      reanchor(sheet, before, keep ? joints : shared);
      return opposite;
    }
    // Split a lane group lengthwise at median boundaries. This changes road
    // identity, not lane width: each resulting road gets its own editable ends.
    function splitLaneGroups(sheet,road,cuts){
      cuts=cuts.filter(c=>Number.isInteger(c.at)&&c.at>0&&c.at<road.lanes).sort((a,b)=>a.at-b.at);
      if(!cuts.length)return [road];
      const before=solve(sheet),shape=shapeOf(sheet,road,before),curve=curveOf(sheet,road,before);
      const original=structuredClone(road),oldJoints=road.ends.map(e=>jointOf(sheet,e.joint));
      const ranges=[0,...cuts.map(c=>c.at),road.lanes],groups=[];
      let id=nextId(sheet.roads);
      for(let n=0;n<ranges.length-1;n++){
        const from=ranges[n],to=ranges[n+1],part=n?structuredClone(original):road;
        if(n)part.id=id++;
        part.lanes=to-from;part.ends=structuredClone(original.ends);
        for(const field of ['laneTypes','laneWidths'])if(original[field])part[field]=Object.fromEntries(Object.entries(original[field]).filter(([k])=>+k>=from&&+k<to).map(([k,v])=>[+k-from,structuredClone(v)]));
        for(const field of ['tapers','laneEndWidths'])if(original[field])part[field]=Object.fromEntries(Object.entries(original[field]).filter(([k])=>{const lane=+k.split(':')[1];return lane>=from&&lane<to;}).map(([k,v])=>{const [e,lane]=k.split(':');return [`${e}:${+lane-from}`,structuredClone(v)];}));
        if(original.widthProfiles)part.widthProfiles=structuredClone(original.widthProfiles.slice(from,to));
        if(original.gapProfiles)part.gapProfiles=Object.fromEntries(Object.entries(original.gapProfiles).filter(([k])=>+k>from&&+k<to).map(([k,v])=>[+k-from,structuredClone(v)]));
        part.medianEdges={...original.medianEdges,...(n?{L:true}:{}),...(n<ranges.length-2?{R:true}:{})};
        for(const e of [0,1]){
          const i=e?shape.line.length-1:0,point=shape.line[i],normal=rightOf(point.tangent??travelAt(road,e,before));
          const lateral=(shape.laneBounds[i][from][0]+shape.laneBounds[i][to-1][1])/2;
          const at={x:point.x+normal.x*lateral,y:point.y+normal.y*lateral,travel:point.tangent??before.get(`${original.id}:${e}`).travel};
          before.set(`${part.id}:${e}`,at);
          part.ends[e].length=e?Math.hypot(curve.b.x-curve.c1.x,curve.b.y-curve.c1.y):Math.hypot(curve.c0.x-curve.a.x,curve.c0.y-curve.a.y);
          part.ends[e].dir=at.travel;
        }
        if(n)sheet.roads.push(part);
        groups.push({road:part,from,to});
      }
      const owner=lane=>groups.find(g=>lane>=g.from&&lane<g.to)??groups.at(-1);
      // Each separated group must position independently, including from its
      // former opposite-direction partner; preserve their solved positions.
      for(const joint of oldJoints)joint.links=joint.links.filter(link=>!(link.pair&&(link.a===original.id||link.b===original.id)));
      // Remap all lane connections, including other intersections at the far end.
      for(const joint of sheet.joints)for(const link of joint.links)for(const [ref,index] of [['a','ai'],['b','bi']])if(link[ref]===original.id){
        const k=link[index],g=typeof k==='number'?owner(k):k==='R'?groups.at(-1):groups[0];
        link[ref]=g.road.id;if(typeof k==='number')link[index]=k-g.from;
      }
      for(const item of sheet.intersections??[])for(const a of item.approaches)for(const link of a.links??[])if(link.road===original.id){const g=owner(link.lane);link.road=g.road.id;link.lane-=g.from;}
      for(const collection of [sheet.markings??[],sheet.surfaces??[]])for(const mark of collection)if(mark.on?.road===original.id&&Number.isInteger(mark.on.lane)){const g=owner(mark.on.lane);mark.on.road=g.road.id;mark.on.lane-=g.from;}
      for(const line of [...sheet.lines??[]])if(line.on?.road===original.id){
        const k=line.on.k;
        const matches=typeof k==='number'?groups.filter(g=>k>=g.from&&k<=g.to):[groups[0]];
        const saved=structuredClone(line);
        matches.forEach((g,n)=>{const next=n?structuredClone(saved):line;if(n){next.id=crypto.randomUUID();sheet.lines.push(next);}next.on={...next.on,road:g.road.id,k:typeof k==='number'?k-g.from:0};});
      }
      const reanchorPoint=point=>{
        const on=point?.on;if(on?.crossing)reanchorPoint({on:on.crossing});if(on?.road!==original.id)return;
        let g=on.side==='R'?groups.at(-1):groups[0];
        if(on.side==='S'||on.side==='E'){
          const i=on.side==='E'?shape.line.length-1:0,b=shape.laneBounds[i];
          const lateral=b[0][0]+(b.at(-1)[1]-b[0][0])*(on.f??0);
          g=groups.reduce((best,next)=>Math.abs(lateral-(b[next.from][0]+b[next.to-1][1])/2)<Math.abs(lateral-(b[best.from][0]+b[best.to-1][1])/2)?next:best,groups[0]);
          on.f=Math.max(0,Math.min(1,(lateral-b[g.from][0])/(b[g.to-1][1]-b[g.from][0])));
        }
        on.road=g.road.id;
      };
      for(const mark of sheet.markings??[]){reanchorPoint(mark.a);reanchorPoint(mark.b);}
      for(const median of sheet.medians??[])for(const point of median.points)reanchorPoint(point);
      for(const bridge of [...sheet.bridges??[]])if(bridge.road===original.id)for(const g of groups.slice(1))sheet.bridges.push({...structuredClone(bridge),id:crypto.randomUUID(),road:g.road.id});
      for(const gore of sheet.gores??[])gore.key=gore.key.split('|').map(key=>{
        const [id,e]=key.split(':').map(Number);if(id!==original.id)return key;
        const otherKey=gore.key.split('|').find(k=>!k.startsWith(`${original.id}:`)),other=otherKey&&before.get(otherKey),at=before.get(`${original.id}:${e}`);
        const right=other&&dot({x:other.x-at.x,y:other.y-at.y},rightOf(at.travel??{x:0,y:-1}))>0;
        return `${(right?groups.at(-1):groups[0]).road.id}:${e}`;
      }).sort().join('|');
      for(const joint of oldJoints)regroup(sheet,joint,before);
      // Keep the strip between the independent roads as an ordinary anchored
      // median, so it follows their edges and remains editable/removable.
      for(let n=0;n<groups.length-1;n++){
        const left=groups[n],right=groups[n+1],at=cuts[n].at;
        const point=(g,side,e)=>{const i=e?shape.line.length-1:0,p=shape.line[i],normal=rightOf(p.tangent??{x:0,y:-1}),d=side==='R'?shape.laneBounds[i][at-1][1]:shape.laneBounds[i][at][0];
          return {x:p.x+normal.x*d,y:p.y+normal.y*d,on:{road:g.road.id,side,f:e}};};
        (sheet.medians??=[]).push({id:nextId(sheet.medians),type:cuts[n].surface,color:cuts[n].color??'white',lean:cuts[n].lean??'right',spacing:cuts[n].spacing??MEDIAN_SPACING_FEET,intersectionMedian:cuts[n].owner,points:[point(left,'R',0),point(left,'R',1),point(right,'L',1),point(right,'L',0)]});
      }
      return groups.map(g=>g.road);
    }
    // Separates a two-way road into two one-way roads, left in place.
    function splitOppositeRoads(sheet, road, preserveTangents = false) {
      const partner = pairOf(sheet, road);
      if (!partner) return;
      const before = solve(sheet);
      for (const end of partner.ends) {
        const joint = jointOf(sheet, end.joint);
        // Preserve the actual tangents/pulls when regrouping creates free
        // ends. Independently curved intersection mouths can then rotate one
        // road without straightening the other or moving either far end.
        for (const item of preserveTangents ? attachments(sheet, joint) : []) {
          if (item.road !== road && item.road !== partner) continue;
          const pose = before.get(`${item.road.id}:${item.e}`), other = before.get(`${item.road.id}:${1 - item.e}`);
          item.end.length ??= Math.hypot(other.x - pose.x, other.y - pose.y) / 3;
        }
        joint.links = joint.links.filter(link => !(link.pair && [link.a, link.b].includes(partner.id) && [link.a, link.b].includes(road.id)));
        regroup(sheet, joint, before);
      }
    }
    function splitRoad() {
      if (!pairOf(sheets.selected, selectedRoad)) return;
      splitOppositeRoads(sheets.selected, selectedRoad);
      changed();
    }
    document.getElementById("splitRoad").addEventListener("click", splitRoad);
    oppositeInput.addEventListener("input", () => {
      const lanes = Math.round(Number(oppositeInput.value));
      if (!(lanes >= 0 && lanes <= MAX_LANES)) return;
      defaults.opposite = lanes;
      const sheet = sheets.selected;
      if (!selectedRoad || !sheet) return render();
      const partner = pairOf(sheet, selectedRoad);
      if (partner && !lanes) removeRoads(sheet, [partner]);
      else if (partner) partner.lanes = lanes;
      else if (lanes) addOpposite(sheet, selectedRoad, lanes, defaults.median, true);
      changed();
    });
    oppositeInput.addEventListener("change", () => {
      oppositeInput.value = selectedRoad ? pairOf(sheets.selected, selectedRoad)?.lanes ?? 0 : defaults.opposite;
    });
    medianInput.addEventListener("input", () => {
      const feet = Number(medianInput.value);
      if (!(feet >= 0 && feet <= MAX_MEDIAN_FEET)) return;
      defaults.median = feet;
      const sheet = sheets.selected;
      const partner = sheet && pairOf(sheet, selectedRoad);
      if (!partner) return render();
      pairLinks(sheet, selectedRoad, partner).forEach(link => { link.median = feet; });
      changed();
    });
    document.getElementById("addBikeLane").addEventListener("click", () => addBikeLane());
    document.getElementById("addBikeTrack").addEventListener("click", () => addBikeLane(true));
    document.getElementById("bufferedBike").addEventListener("change", event => setBuffered(event.target.checked));
    document.getElementById("perLaneWidths").addEventListener("change", event => {
      (selectedRoad ?? defaults).perLaneWidths = event.target.checked;
      if (selectedRoad) { delete selectedRoad.widthProfiles; changed(); } else render();
    });
    for (const [id, endpoint] of [["selectedLaneWidth", null], ["laneStartWidth", 0], ["laneEndWidth", 1]]) {
      const input = document.getElementById(id);
      input.addEventListener("input", () => {
        if (!selectedRoad || !selectedLane || input.value === "") return;
        const value = Number(input.value);
        if (!(value >= MIN_LANE_WIDTH && value <= MAX_LANE_WIDTH)) return;
        if (selectedRoad.widthProfiles) {
          for (const e of [0, 1]) (selectedRoad.laneEndWidths ??= {})[`${e}:${selectedLane.lane}`] = window.StripeMaker.roadWidths.endWidth(sheets.selected, selectedRoad, e, selectedLane.lane);
          delete selectedRoad.widthProfiles[selectedLane.lane];
        }
        if (endpoint == null) {
          (selectedRoad.laneWidths ??= {})[selectedLane.lane] = value;
          for (const e of [0, 1]) if (selectedRoad.laneEndWidths) delete selectedRoad.laneEndWidths[`${e}:${selectedLane.lane}`];
        } else (selectedRoad.laneEndWidths ??= {})[`${endpoint}:${selectedLane.lane}`] = value;
        changed();
      });
      input.addEventListener("change", () => render());
    }
    // Lane type: a travel lane, a bike lane, or a buffered bike lane, at its
    // FDOT starting width.
    laneTypeSelect.addEventListener("change", () => {
      if (!selectedRoad || !selectedLane) return;
      const type = laneTypeSelect.value;
      selectedRoad.laneTypes ??= {};
      // Turning a carried bike lane into a travel lane is remembered.
      if (type === "travel") {
        selectedRoad.laneTypes[selectedLane.lane] = { type: "travel" };
      }
      else selectedRoad.laneTypes[selectedLane.lane] = { type, width: BIKE_LANE[type].width };
      changed();
    });
    document.getElementById("bikeSetupLane").addEventListener("change",event=>{selectedLane={e:0,lane:Number(event.target.value)};render();});
    document.getElementById("bikeAddTurn").addEventListener("click",()=>{
      const lane=setupBikeLane();if(lane==null||lane!==selectedRoad.lanes-1)return;
      selectedRoad.laneTypes[lane].conflict="separate";selectedRoad.laneTypes[lane].inherited=false;
      growRoad(sheets.selected,selectedRoad,"R",null,true);
      (selectedRoad.tapers??={})[`0:${selectedRoad.lanes-1}`]={mode:"taper",length:DEFAULT_TAPER_FEET};
      selectedLane={e:0,lane};changed();
    });
    for (const [id,key] of [["bikeConflict","conflict"],["bikeSpeed","designSpeed"]]) {
      document.getElementById(id).addEventListener("change",event=>{
        const lane=selectedRoad?.laneTypes?.[setupBikeLane()];
        if (!lane) return;
        lane[key]=key === "designSpeed" ? Number(event.target.value) : event.target.value;
        lane.inherited=false;
        if(key === "designSpeed" && BIKE_L1[lane.designSpeed]) {
          const outside=setupBikeLane()+1;
          if(outside<selectedRoad.lanes && selectedRoad.tapers?.[`0:${outside}`]?.mode === "taper")
            selectedRoad.tapers[`0:${outside}`].length=BIKE_L1[lane.designSpeed];
        }
        changed();
      });
    }
    document.getElementById("bikeConflictLength").addEventListener("change",event=>{
      const config=selectedRoad?.laneTypes?.[setupBikeLane()];
      const value=Number(event.target.value);
      if(!config||!Number.isFinite(value)||value<=0)return;
      config.conflictLength=value;config.inherited=false;changed();
    });
    document.getElementById("bikeCrossover").addEventListener("change",event=>{
      const lane=selectedRoad?.laneTypes?.[setupBikeLane()];
      if(!lane)return;
      lane.continueCrossover=event.target.checked;lane.inherited=false;changed();
    });
    bikeWidthInput.addEventListener("input", () => {
      const lane = selectedRoad && selectedLane && selectedRoad.laneTypes?.[selectedLane.lane];
      const width = Number(bikeWidthInput.value);
      if (!lane || !(width >= BIKE_LANE[lane.type].min && width <= BIKE_LANE.max)) return;
      lane.width = width;
      changed();
    });
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
            delete road.laneWidths; delete road.laneEndWidths; delete road.widthProfiles;
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
      const placed = window.StripeMaker.markings?.capture(sheet, [road.id, partner?.id]);
      const lines = window.StripeMaker.longitudinal.capture(sheet, [road.id, partner?.id]);
      const bridges = window.StripeMaker.levels?.capture(sheet, [road.id, partner?.id], crossSectionOf(sheet, solved));
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
        window.StripeMaker.intersections?.rehomeRoad(sheet, from, 1, to, 1);
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
        sheet.gores.forEach(gore => { gore.key = gore.key.split("|").map(end => (end === `${from}:1` ? `${to}:1` : end)).sort().join("|"); });
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
        const made = { id: nextId(sheet.roads), lanes: from.lanes, laneWidth: from.laneWidth, perLaneWidths: from.perLaneWidths, laneWidths: structuredClone(from.laneWidths ?? {}), laneEndWidths: structuredClone(from.laneEndWidths ?? {}), laneTypes: structuredClone(from.laneTypes ?? {}), ends };
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
        rehomeMedians(sheet, [partner, back]);
      }
      rehomeMedians(sheet, [road, after]);
      window.StripeMaker.markings?.rehome(sheet, placed);
      window.StripeMaker.longitudinal.rehome(sheet, lines, lineTargets(sheet, solve(sheet)), [road.id, after.id, partner?.id, back?.id]);
      window.StripeMaker.levels?.rehome(sheet, bridges, [[road.id, after.id], [partner?.id, back?.id]], crossSectionOf(sheet, solve(sheet)));
      window.StripeMaker.speedZones?.split(sheet,road.id,after.id,fraction);
      if(partner&&back)window.StripeMaker.speedZones?.split(sheet,partner.id,back.id,1-fraction);
      splitSurfaces(sheet, road, after, fraction);
      if (partner && back) splitSurfaces(sheet, partner, back, 1 - fraction);
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
      const approach = !snapTarget && window.StripeMaker.intersections?.laneAt(sheet, { e }, point);
      if (approach) snapTarget = { ...approach.point, approach };
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
      if (medianDraw && !event.buttons && sheet?.inchesPerPixel && active()) {
        medianDraw.cursor = medianDrawPoint(sheet, event.clientX, event.clientY);
        return drawOverlay();
      }
      if (!drawing || event.buttons || !sheet?.inchesPerPixel || !active()) return;
      const point = drawingPoint(sheet, event.clientX, event.clientY, event.shiftKey);
      if (drawing.start || drawing.end) drawing.cursor = point;
      renderPreviewSoon();
    });
    workspace.addEventListener("contextmenu", event => {
      const sheet = sheets.selected;
      if (!active() || drawing || medianDraw || !sheet?.inchesPerPixel || event.defaultPrevented) return;
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
      if (!active() || !sheet?.inchesPerPixel || !press || event.target.closest(".roadNode, .roadControl, .medianPoint")) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) return;
      if (medianDraw) {
        const point = medianDrawPoint(sheet, event.clientX, event.clientY);
        const { points } = medianDraw;
        if (points.length > 2 && samePoint(point, points[0])) return finishMedian();
        if (!points.some(p => samePoint(p, point))) points.push(point);
        medianDraw.cursor = point;
        return render();
      }
      if (!drawing) {
        const point = sheets.toImage(event.clientX, event.clientY);
        const median = medianAt(sheet, point);
        if (median) return selectMedian(median);
        const road = roadAt(sheet, point);
        const gore = !road && goreAt(sheet, point);
        return gore ? selectGore(gore) : selectRoad(road);
      }
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
      const road = { id: nextId(sheet.roads), lanes: values.lanes, laneWidth: values.laneWidth, perLaneWidths: values.perLaneWidths,
        ...(drawing.bike ? { laneTypes: structuredClone(values.laneTypes) } : {}), ends: [] };
      road.ends = [start, end].map(p => ({ joint: newJoint(sheet, p, road.id).id, sign: 1, length: null }));
      sheet.roads.push(road);
      // A new road lines its matching lane up with the lane it was drawn from or to.
      [start, end].forEach((p, e) => {
        if (p.target?.approach) return; // Align after creating the opposite side, if any.
        if(p.target?.edge&&p.target.direct)feedEdge(sheet,road,e,
          Math.min(p.target.side==="R"?p.target.road.lanes-1:0,road.lanes-1),p.target.edgePoint);
        else if (p.target?.edge) attachToEdge(sheet, road, e, p);
        else if (p.target) connect(sheet, road, e, Math.min(p.target.lane, road.lanes - 1), p.target);
      });
      if (values.opposite) addOpposite(sheet, road, values.opposite, values.median, false);
      [start, end].forEach((p, e) => {
        const target = p.target?.approach;
        if (!target) return;
        const binding = { road: road.id, e };
        alignLaneEnd(sheet, binding, 0, target.point, target.angle);
        window.StripeMaker.intersections.linkLane(sheet, target, binding, 0);
      });
      snapTarget = null;
      // Like Cities: Skylines, each click adds a node: the road carries on from the
      // segment just drawn until a double-click or Esc, or until it joins a lane
      // or edge line. A two-way road carries on from its centerline.
      const nextEnd=drawing.start?1:0,nextPoint=nextEnd?end:start;
      if (drawingAlongTraffic() && !nextPoint.target) {
        const solved = solve(sheet);
        const joint = jointOf(sheet, road.ends[nextEnd].joint);
        const at = values.opposite ? { x: joint.x, y: joint.y } : solved.get(`${road.id}:${nextEnd}`);
        const anchor = { x: at.x, y: at.y, target: { road, e: nextEnd, lane: 0 } };
        drawing = { start:null,end:null,[nextEnd?'start':'end']:anchor,cursor:anchor,last:road.id,bike:drawing.bike };
        selectedRoad = null;
      } else {
        drawing = null;
        selectedRoad = road;
      }
      changed();
    });
    // A double-click finishes the road or median being drawn (its first click has
    // already placed the last node), and must not trigger the refit.
    workspace.addEventListener("dblclick", event => {
      if (!drawing && !medianDraw) return;
      event.preventDefault();
      if (drawing) stopDrawing();
      else finishMedian();
    }, true);
    // Double-clicking anything on the sheet opens it in its editor, selected (the
    // smallest thing there first: sign, marking, line, intersection, then
    // median, gore, or road). With Elements open, double-clicking the road
    // that's already selected splits it in two there.
    workspace.addEventListener("dblclick", event => {
      const sheet = sheets.selected;
      if (event.defaultPrevented || !sheet?.inchesPerPixel || drawing || medianDraw) return;
      if (event.target.closest("button, .roadOverlay *, .markingOverlay *, .signOverlay *")) return;
      if (!document.getElementById("markingsEditor").hidden) return;  // the Markings tabs handle their own
      const point = sheets.toImage(event.clientX, event.clientY);
      if(insertMedianPoint(sheet,point)){event.preventDefault();return;}
      const small = window.StripeMaker.selection?.itemAt(point);
      if (small && !["roads", "medians"].includes(small.kind)) {
        event.preventDefault();
        window.StripeMaker.selection.edit(small, point);
        return;
      }
      const gore = goreAt(sheet, point), median = gore ? null : medianAt(sheet, point), road = gore || median ? null : roadAt(sheet, point);
      if (!gore && !median && !road) return;
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
      if (gore) selectGore(gore);
      else if (median) selectMedian(median);
      else selectRoad(road);
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
        window.StripeMaker.selection?.editorChanged();
      });
      button.addEventListener("pointermove", event => {
        if (!drag || !button.hasPointerCapture(event.pointerId)) return;
        const { sheet, road, e, lane } = drag;
        const pointer = sheets.toImage(event.clientX, event.clientY);
        let wanted = { x: drag.from.x + (pointer.x - drag.pointer.x), y: drag.from.y + (pointer.y - drag.pointer.y) };
        if(event.shiftKey)wanted=alongDragAxis(wanted,drag.from,drag.axis);
        // Lane nodes first, then intersection openings, then edge lines, which pull
        // the dragged lane onto the center of the edge lane it will feed. An
        // opening turns the road end to line up with it, so undo that turn first.
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
        const approach = !event.shiftKey && !snapTarget && window.StripeMaker.intersections?.laneAt(sheet, { road: road.id, e, lane }, wanted);
        if (approach) {
          alignLaneEnd(sheet, { road: road.id, e }, lane, approach.point, approach.angle);
          snapTarget = { ...approach.point, approach };
          renderSoon({ joints: [joint.id] });
          return;
        }
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
        // Moving a road end off an intersection lane unlinks it.
        if (drag.moved) window.StripeMaker.intersections?.releaseLanes(drag.sheet, drag.road.id, drag.e);
        if (snapTarget?.approach && event.type === "pointerup")
          window.StripeMaker.intersections.linkLane(drag.sheet, snapTarget.approach, { road: drag.road.id, e: drag.e }, drag.lane);
        else if (snapTarget?.edge && event.type === "pointerup") feedEdge(drag.sheet, drag.road, drag.e, drag.lane, snapTarget.edgePoint);
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
      for (const median of sheet.medians) for (const p of median.points) for(const on of [p.on,p.on?.crossing]){
        if (on?.road !== road.id) continue;
        on.side = { L: "R", R: "L", S: "E", E: "S" }[on.side];
        on.f = 1 - on.f;
      }
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
        !bikeType(road, lane) && { label: "Auto Taper", checked: taper === "auto", run: setTaperMode("auto") },
        !bikeType(road, lane) && { label: e ? "Taper (Lane Drop)" : "Taper (Lane Add)", checked: taper === "taper", run: setTaperMode("taper") },
        !bikeType(road, lane) && { label: "No Taper", checked: taper === "none", run: setTaperMode("none") },
        "separator",
        road.lanes < MAX_LANES && { label: "Add Travel Lane on Left", run: () => addLane(sheet, road, "L") },
        road.lanes < MAX_LANES && { label: "Add Travel Lane on Right", run: () => addLane(sheet, road, "R") },
        road.lanes < MAX_LANES && Object.values(road.laneTypes ?? {}).some(t => ["bike", "bufferedBike"].includes(t.type)) &&
          { label: "Add Turn Lane on Right of Bike Lane", run: () => addLane(sheet, road, "R", null, true) },
        "separator",
        partner ? { label: "Make One-Way", run: () => { removeRoads(sheet, [partner]); changed(); } }
          : { label: "Make Two-Way", run: () => { addOpposite(sheet, road, road.lanes, defaults.median, true); changed(); } },
        partner && { label: "Split Into One-Way Roads", run: splitRoad },
        { label: "Reverse Direction", run: () => reverseRoad(sheet, road) },
        { label: partner ? "Delete Two-Way Road" : "Delete Road", run: deleteRoad },
      ].filter(Boolean);
    }
    // Another road whose pavement is at `point` and that isn't joined to `road`.
    function crossingAt(sheet, road, point) {
      const solved = solve(sheet), mine = [road, pairOf(sheet, road)].filter(Boolean);
      const joints = new Set(mine.flatMap(r => r.ends.map(end => end.joint)));
      return sheet.roads.find(other => !mine.includes(other) && !other.ends.some(end => joints.has(end.joint)) && insidePolygon(point,
        [...boundary(shapeOf(sheet, other, solved), 0), ...boundary(shapeOf(sheet, other, solved), other.lanes).reverse()])) ?? null;
    }
    // Make Intersection: each road is cut back from the crossing, far enough to
    // clear the other road, and the free ends become an intersection's approaches.
    // Every crossing between two of `roads` (one side standing for a two-way
    // road; roads joined to each other don't count): where their centerlines
    // cross, and how far along each road that is.
    const NEARBY_CROSSING_FEET = 250;
    function crossings(sheet, roads) {
      const solved = solve(sheet);
      const reps = roads.filter(road => { const partner = pairOf(sheet, road); return !partner || !roads.includes(partner) || road.id < partner.id; });
      const lines = new Map(reps.map(road => {
        const line = shapeOf(sheet, road, solved).line, along = [0];
        for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y));
        return [road, { line, along }];
      }));
      const jointsOf = road => [road, pairOf(sheet, road)].filter(Boolean).flatMap(r => r.ends.map(end => end.joint));
      const list = [];
      reps.forEach((a, i) => reps.slice(i + 1).forEach(b => {
        if (jointsOf(a).some(j => jointsOf(b).includes(j))) return;
        const A = lines.get(a), B = lines.get(b);
        for (let m = 1; m < A.line.length; m++) for (let n = 1; n < B.line.length; n++) {
          const p = A.line[m - 1], q = A.line[m], r = B.line[n - 1], t = B.line[n];
          const d1 = { x: q.x - p.x, y: q.y - p.y }, d2 = { x: t.x - r.x, y: t.y - r.y }, den = d1.x * d2.y - d1.y * d2.x;
          if (Math.abs(den) < 1e-9) continue;
          const u = ((r.x - p.x) * d2.y - (r.y - p.y) * d2.x) / den, v = ((r.x - p.x) * d1.y - (r.y - p.y) * d1.x) / den;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          list.push({ a, b, x: p.x + d1.x * u, y: p.y + d1.y * u,
            sa: A.along[m - 1] + (A.along[m] - A.along[m - 1]) * u, sb: B.along[n - 1] + (B.along[n] - B.along[n - 1]) * v });
        }
      }));
      return { lines, list };
    }
    // The crossings among all roads near a point (right-click on a crossing).
    function nearbyCrossings(sheet, point) {
      const radius = feetToPixels(sheet, NEARBY_CROSSING_FEET);
      return crossings(sheet, sheet.roads).list.filter(c => Math.hypot(c.x - point.x, c.y - point.y) <= radius);
    }
    // Make Intersection: one intersection over every crossing among `roads`
    // (near `near` when given). Each road is cut back clear of all its crossings
    // and of the roads crossing it, and the free ends become the approaches.
    function makeIntersection(sheet, roads, near = null) {
      const { lines, list } = crossings(sheet, roads);
      const radius = feetToPixels(sheet, NEARBY_CROSSING_FEET);
      const found = near ? list.filter(c => Math.hypot(c.x - near.x, c.y - near.y) <= radius) : list;
      if (!found.length) {
        hint.textContent = "Those roads don't cross. Select roads that cross each other to make an intersection.";
        return render();
      }
      const halfWidth = road => [road, pairOf(sheet, road)].filter(Boolean).reduce((sum, r) => sum + r.lanes * r.laneWidth, 0) / 2;
      const plan = new Map();
      for (const c of found) for (const [road, s, other] of [[c.a, c.sa, c.b], [c.b, c.sb, c.a]]) {
        const entry = plan.get(road) ?? { min: Infinity, max: -Infinity, widest: 0 };
        Object.assign(entry, { min: Math.min(entry.min, s), max: Math.max(entry.max, s), widest: Math.max(entry.widest, halfWidth(other)) });
        plan.set(road, entry);
      }
      // Check every cut fits before changing anything. Each side is cut back the
      // usual opening distance, or as far as the road allows, but at least 10 ft
      // past the crossing road's pavement.
      const margin = feetToPixels(sheet, 5);
      for (const [road, entry] of plan) {
        const wanted = feetToPixels(sheet, Math.max(window.StripeMaker.intersectionGeometry.REACH, entry.widest + 30));
        const least = feetToPixels(sheet, entry.widest + 10), length = lines.get(road).along.at(-1);
        entry.before = Math.min(wanted, entry.min - margin);
        entry.after = Math.min(wanted, length - margin - entry.max);
        if (entry.before < least || entry.after < least) {
          hint.textContent = `A crossing is too close to the end of road ${road.id} to make an intersection there.`;
          return render();
        }
      }
      const joints = [];
      for (const [road, entry] of plan) {
        const { line, along } = lines.get(road);
        const tAt = d => {
          let i = 1;
          while (i < along.length - 1 && along[i] < d) i++;
          return (i - 1 + (d - along[i - 1]) / ((along[i] - along[i - 1]) || 1)) / (line.length - 1);
        };
        const t1 = tAt(entry.min - entry.before), t2 = tAt(entry.max + entry.after);
        const { after: tail } = cutRoad(sheet, road, t2);
        const { after: middle } = cutRoad(sheet, road, t1 / t2);
        removeRoads(sheet, [middle, pairOf(sheet, middle)].filter(Boolean));
        joints.push(road.ends[1].joint, tail.ends[0].joint);
      }
      const center = { x: found.reduce((t, c) => t + c.x, 0) / found.length, y: found.reduce((t, c) => t + c.y, 0) / found.length };
      const item = window.StripeMaker.intersections?.makeAt(sheet, center, joints, { combineDivided: found.length > 1 });
      selectedRoad = null;
      selectedLane = null;
      changed();
      hint.textContent = item ? `${item.name} made over ${found.length} crossing${found.length > 1 ? "s" : ""}. Open Intersections to add its movements.` : "Couldn't make an intersection there.";
      return item;
    }
    function gradeSeparate(sheet, over, under, point) {
      const piece = window.StripeMaker.levels?.separate(sheet, over, under, point, crossSectionOf(sheet, solve(sheet)), road => pairOf(sheet, road));
      changed();
      if (piece) hint.textContent = `Road ${over.id} now crosses on a level ${piece.level} bridge. Adjust it in Levels.`;
    }
    function openMenu(button, point = null) {
      const node = nodeTarget(button);
      if (!node || drawing) return;
      closeMenu();
      selectedRoad = node.road;
      selectedLane = { e: node.e, lane: node.lane };
      menuNode = { button, point, key: `${node.road.id}:${node.e}:${node.lane}` };
      nodeMenu.setAttribute("aria-label", `Road ${node.road.id}, lane ${node.lane + 1} ${node.e ? "end" : "start"}`);
      // Right-clicking a road where it crosses another (not joined to it) offers
      // to make an intersection there or grade-separate the two.
      const other = point && crossingAt(node.sheet, node.road, point);
      const nearby = other ? nearbyCrossings(node.sheet, point) : [];
      const crossing = other ? [
        { label: "Make Intersection", run: () => makeIntersection(node.sheet, [node.road, other], point) },
        ...(nearby.length > 1 ? [{ label: `Make Intersection (${nearby.length} crossings)`, run: () => makeIntersection(node.sheet, [...new Set(nearby.flatMap(c => [c.a, c.b]))], point) }] : []),
        { label: `Grade Separate (Road ${node.road.id} Over)`, run: () => gradeSeparate(node.sheet, node.road, other, point) },
        { label: `Grade Separate (Road ${other.id} Over)`, run: () => gradeSeparate(node.sheet, other, node.road, point) },
        "separator",
      ] : [];
      const items = point ? [...crossing, ...menuItems(node).filter(item => item !== "separator" && /^(Make |Split |Delete |Reverse )/.test(item.label))] : menuItems(node);
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
      const bike = bikeType(road, side === "R" ? road.lanes - 1 : 0);
      const direction = side === "R" ? "Right" : "Left";
      showMenuItems([
        { label: bike ? "Add Travel Lane Inside Bike Lane" : `Add Travel Lane on ${direction}`,
          run: () => addLane(sheets.selected, road, side) },
        ...(bike && bike !== "twoWayBike" ? [{ label: `Add Turn Lane on ${direction} of Bike Lane`,
          run: () => addLane(sheets.selected, road, side, null, true) }] : []),
      ]);
      positionMenu();
      nodeMenu.querySelector("button")?.focus({ preventScroll: true });
    }
    function showMenuItems(items) {
      if(window.StripeMaker.diagrammatic) items=items.filter(item=>item==='separator'||! /bike|two-way|one-way|intersection/i.test(item.label));
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
      } else if (medianDraw && (event.key === "Escape" || (event.key === "Enter" && !typing))) {
        event.preventDefault();
        event.stopPropagation();
        finishMedian();
      } else if ((event.key === "Delete" || event.key === "Backspace") && event.target.closest?.(".medianPoint")) {
        event.preventDefault();
        removeMedianPoint(medianPoints.indexOf(event.target.closest(".medianPoint")));
      } else if (event.key === "Escape" && (drawing || selectedRoad || selectedGore || selectedMedian)) {
        event.stopPropagation();
        // One level at a time: a selected lane end first, then the road.
        if (drawing) stopDrawing();
        else if (selectedLane && selectedRoad) { selectedLane = null; render(); }
        else selectRoad(null);
      } else if ((event.key === "Delete" || event.key === "Backspace") && !typing && !deleteButton.disabled) {
        event.preventDefault();
        deleteSelection();
      }
    }, true);

    new MutationObserver(() => {
      if (!active()) {
        curvePick = null;
        drawing = null;
        medianDraw = null;
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
      sheet && (sheet.gores ??= []);
      sheet && (sheet.medians ??= []);
      if (!medianOf(sheet, selectedMedian)) selectedMedian = null;
      medianDraw = null;
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
      if (sheets.selected !== medianSheet) selectedMedian = null;
      drawing = null;
      medianDraw = null;
      snapTarget = null;
      closeMenu();
      // Sheets saved before a bike lane rule changed are brought up to date.
      if (tidyBikeLanes(sheets.selected)) {
        save();
        window.StripeMaker.history.rebase();
      }
      render();
    });
    // An intersection mouth attaches to a terminal road end. Keep geometry and
    // joint mutation here so intersection editing uses the same solved road model.
    function intersectionEnd(sheet, binding, solved = solveForRoad(sheet,roadOf(sheet,binding.road))) {
      return window.StripeMaker.roadWidths.withSnapshot(sheet,()=>readIntersectionEnd(sheet,binding,solved));
    }
    function readIntersectionEnd(sheet, binding, solved) {
      const road = roadOf(sheet, binding.road);
      const e = binding.e;
      if (!road || (e !== 0 && e !== 1)) return null;
      const joint = jointOf(sheet, road.ends[e].joint);
      const partner = pairOf(sheet, road);
      const here = attachments(sheet, joint, solved);
      const terminal = here.every(item => item.road === road || item.road === partner);
      const shape = shapeOf(sheet, road, solved);
      const at = endOf(shape.line, e);
      const travel = at.tangent ?? travelAt(road, e, solved);
      const outward = { x: travel.x * (e ? -1 : 1), y: travel.y * (e ? -1 : 1) };
      const incoming = e ? road : partner;
      const outgoing = e ? partner : road;
      const normal = rightOf(outward);
      const median = partner ? pairLinks(sheet, road, partner)[0]?.median ?? 0 : 0;
      const gap = partner ? median + (DOUBLE_GAP_INCHES + LINE_INCHES) / 12 : 0;
      const inWidth = incoming ? endWidth(sheet, incoming, 1) : endWidth(sheet, outgoing, 0);
      const outWidth = outgoing ? endWidth(sheet, outgoing, 0) : endWidth(sheet, incoming, 1);
      const center = partner ? { x: joint.x, y: joint.y }
        : { x: at.x - normal.x * (e ? -1 : 1) * linkLateral(sheet,road,"R",e),
            y: at.y - normal.y * (e ? -1 : 1) * linkLateral(sheet,road,"R",e) };
      const tapered = here.some(item => [...shapeOf(sheet, item.road, solved).tapers.keys()].some(key => key.startsWith(`${item.e}:`)));
      // A branch can occupy only part of a road end. The remaining lanes
      // can meet an intersection even though the whole joint is nonterminal.
      // Include implicit lane continuations, not just the alignment link
      // that positions two multi-lane roads beside one another.
      const across = here.filter(item => item.e !== e && item.end.sign === road.ends[e].sign);
      const linked = laneLinks(sheet, joint);
      const receiving = across.flatMap(item => Array.from({ length: item.road.lanes }, (_, lane) => ({
        p: lanePoint(sheet, item.road, item.e, lane, solved),
        width: window.StripeMaker.roadWidths.endWidth(sheet, item.road, item.e, lane),
      })));
      const freeLanes = Array.from({ length: road.lanes }, (_, lane) => {
        if (shape.tapers.has(`${e}:${lane}`) || linked.some(link => e
          ? link.from === road && link.fromLane === lane : link.to === road && link.toLane === lane)) return false;
        if (!receiving.length) return true;
        const p = lanePoint(sheet, road, e, lane, solved), width = window.StripeMaker.roadWidths.endWidth(sheet, road, e, lane);
        return !receiving.some(other => Math.hypot(p.x - other.p.x, p.y - other.p.y) < feetToPixels(sheet, (width + other.width) / 2) - 0.01);
      });
      const details=(r,end)=>r?Array.from({length:r.lanes},(_,lane)=>({
        width:window.StripeMaker.roadWidths.endWidth(sheet,r,end,lane),
        type:r.laneTypes?.[lane]?.type??'travel',
        // Same riding-space center used by lateral markings: exclude the
        // double stripe and clear buffer (17 inches), and the outer half
        // stripe (3 inches): the riding center shifts by (17 - 3) / 2.
        centerShift:r.laneTypes?.[lane]?.type==='bufferedBike'?(lane===0&&r.lanes>1?-1:1)*14/24:0,
      })):[];
      return { ...center, angle: Math.atan2(outward.y, outward.x) * 180 / Math.PI,
        incoming: incoming?.lanes ?? 0, outgoing: outgoing?.lanes ?? 0,
        width: inWidth, outWidth, inDetails:details(incoming,1), outDetails:details(outgoing,0), median, gap, joint: joint.id, terminal: terminal && !tapered, freeLanes,
        binding: { road: road.id, e, joint: joint.id },
        ends: here.map(item => ({ road: item.road.id, e: item.e })),
      };
    }
    function intersectionEnds(sheet) {
      const solved = solve(sheet), seen = new Set(), result = [];
      for (const road of sheet.roads) for (const e of [0, 1]) {
        const end = intersectionEnd(sheet, { road: road.id, e }, solved);
        if (!end?.terminal || seen.has(end.joint)) continue;
        seen.add(end.joint); result.push(end);
      }
      return result;
    }
    function moveIntersectionEnd(sheet, binding, point, angle, solved, knownEnd) {
      const end = knownEnd??intersectionEnd(sheet, binding, solved);
      if (!end) return;
      const joint = jointOf(sheet, end.joint);
      const delta = (angle - end.angle) * Math.PI / 180;
      const old = joint.dir ?? (() => {
        const road = roadOf(sheet, binding.road), t = travelAt(road, binding.e, solved??solve(sheet));
        return { x: t.x * road.ends[binding.e].sign, y: t.y * road.ends[binding.e].sign };
      })();
      joint.x += point.x - end.x; joint.y += point.y - end.y;
      joint.dir = { x: old.x * Math.cos(delta) - old.y * Math.sin(delta), y: old.x * Math.sin(delta) + old.y * Math.cos(delta) };
      for (const item of attachments(sheet, joint)) if (item.end.dir) {
        const v = item.end.dir;
        item.end.dir = { x: v.x * Math.cos(delta) - v.y * Math.sin(delta), y: v.x * Math.sin(delta) + v.y * Math.cos(delta) };
      }
    }
    // Turns a road end to an approach's direction, then moves it so one of its
    // lanes ends at the given point.
    function alignLaneEnd(sheet, binding, lane, point, angle) {
      curveLinks.unlink(sheet,roadOf(sheet,binding.road)?.ends[binding.e].curveLink);
      const road=roadOf(sheet,binding.road),e=binding.e;
      if(!road||(e!==0&&e!==1))return;
      const solved=solveForRoad(sheet,road),shape=shapeOf(sheet,road,solved),atEnd=endOf(shape.line,e);
      const travel=atEnd.tangent??travelAt(road,e,solved),sign=e?-1:1;
      // Alignment needs only the current tangent and joint. Occupancy, lane
      // metadata and all other endpoint widths are unrelated to this move.
      const end={joint:road.ends[e].joint,x:0,y:0,angle:Math.atan2(travel.y*sign,travel.x*sign)*180/Math.PI};
      moveIntersectionEnd(sheet, binding, end, angle, solved, end);
      const at = lanePoint(sheet, road, binding.e, lane, solveForRoad(sheet,road));
      const joint = jointOf(sheet, end.joint);
      joint.x += point.x - at.x;
      joint.y += point.y - at.y;
    }
    // Each road's centerline and lane boundaries (sideways offsets right of travel,
    // per centerline point), for markings placed in its lanes.
    function laneTracks(sheet, solved = solve(sheet)) {
      return sheet.roads.map(road => {
        const shape = shapeOf(sheet, road, solved);
        // Crosswalk bars follow the marked bike path, which can move across
        // physical lane boundaries at a drop/added-lane transition.
        const ridingEdges=Array.from({length:road.lanes+1},(_,k)=>{
          const lane=bikeType(road,k)?k:bikeType(road,k-1)?k-1:null;
          return boundary(lane==null?shape:bikeMarkingShape(sheet,road,lane,shape,solved),k);
        });
        const placementBounds=shape.line.map((p,i)=>shape.laneBounds[i].map((bounds,lane)=>{
          if(!bikeType(road,lane))return bounds;
          // A free/straightened end has a zero Bézier derivative. Use the same
          // neighboring-sample direction as offset() so the bike riding space
          // stays aligned with its edges without interrupting the render.
          const prev=shape.line[Math.max(0,i-1)],next=shape.line[Math.min(shape.line.length-1,i+1)];
          const n=rightOf(p.tangent??unit({x:next.x-prev.x,y:next.y-prev.y})),project=q=>(q.x-p.x)*n.x+(q.y-p.y)*n.y;
          return [project(ridingEdges[lane][i]),project(ridingEdges[lane+1][i])];
        }));
        const markingEdges=independentBikeRoad(road)?ridingEdges.map((points,k)=>
          bikeEdgeLine(sheet,road,bikeMarkingShape(sheet,road,Math.min(k,road.lanes-1),shape,solved),k,points)):ridingEdges;
        return { road: road.id, line: shape.line, bounds: shape.bounds, laneBounds:shape.laneBounds, placementBounds, markingEdges,
          bikeLanes:Array.from({length:road.lanes},(_,lane)=>Boolean(bikeType(road,lane))) };
      });
    }
    window.StripeMaker.roadEditor = { selectedItem:()=>active() ? selectedMedian!=null?{kind:"medians",id:selectedMedian}:selectedRoad?{kind:"roads",id:selectedRoad.id}:null : null, splitLaneGroups, splitOppositeRoads, diagnostics: () => structuredClone({selectedRoad,selectedLane,selectedGore,selectedMedian,defaults,openCurves:[...openCurves],medianPoints}), render, renderSigns, renderMarkings, renderLater: (change = {}) => renderSoon(change),
      roadAt: (sheet, point) => roadAt(sheet, point), medianAt: (sheet, point) => medianAt(sheet, point),
      // Directed vehicle lanes and their actual lane-to-lane continuations.
      // Geometric matches at a shared joint include implicit parallel lanes;
      // coincident roads with different joints never connect.
      simulatorNetwork(sheet) {
        const solved = solve(sheet), lanes = [], connections = [], laneChangePairs = [], byKey = new Map();
        for (const road of sheet.roads ?? []) {
          const shape = shapeOf(sheet, road, solved), stations = [0];
          for (let i = 1; i < shape.line.length; i++) stations.push(stations.at(-1) + Math.hypot(shape.line[i].x - shape.line[i - 1].x, shape.line[i].y - shape.line[i - 1].y));
          const vehicleLanes = Array.from({ length: road.lanes }, (_, lane) => lane).filter(lane => !bikeType(road, lane));
          const conflicts = vehicleLanes.some((lane, i) => i && lane > vehicleLanes[i - 1] + 1) ? bikeConflicts(sheet, road, shape, solved) : new Map();
          for (let index = 1; index < vehicleLanes.length; index++) {
            const from = vehicleLanes[index - 1], to = vehicleLanes[index], blocked = [], crossings = [];
            if (Array.from({ length: to - from - 1 }, (_, i) => bikeType(road, from + i + 1)).includes('twoWayBike')) continue;
            for (let i = 1; i < shape.line.length; i++) {
              const hasGap = k => Array.from({ length: to - from }, (_, j) => from + j).some(lane => shape.laneBounds[k][lane + 1][0] - shape.laneBounds[k][lane][1] > inchesToPixels(sheet, 1));
              if (hasGap(i - 1) || hasGap(i)) blocked.push([stations[i - 1] / stations.at(-1), stations[i] / stations.at(-1)]);
            }
            // FDM 2027 223.3.2 / 223.5.2: cross ordinary bike lanes at
            // their modeled conflict striping; never drive along a bike lane.
            // https://www.fdot.gov/roadway/fdm/default.shtm (Chapter 223)
            for (let bike = from + 1; bike < to; bike++) for (const boundary of [bike, bike + 1]) crossings.push({
              points: shape.line.map((point, i) => ({ ...point, lateral: shape.laneBounds[i][bike][boundary === bike ? 0 : 1] })),
              ranges: (conflicts.get(boundary) ?? []).map(([lo, hi]) => [lo, hi]),
            });
            laneChangePairs.push({ road: road.id, from, to, blocked, crossings });
          }
          for (const lane of vehicleLanes) {
            const points = offset(shape.line, i => (shape.laneBounds[i][lane][0] + shape.laneBounds[i][lane][1]) / 2);
            if(!solved.arcLaneMouths?.has(`${road.id}:0:${lane}`))points[0] = lanePoint(sheet, road, 0, lane, solved);
            if(!solved.arcLaneMouths?.has(`${road.id}:1:${lane}`))points[points.length - 1] = lanePoint(sheet, road, 1, lane, solved);
            points.forEach((point, i) => {
              point.laneWidth = shape.laneBounds[i][lane][1] - shape.laneBounds[i][lane][0];
              point.lateral = (shape.laneBounds[i][lane][0] + shape.laneBounds[i][lane][1]) / 2;
              point.road = road.id; point.lane = lane; point.station = stations[i]; point.direction = 1;
              point.level = window.StripeMaker.levels.levelAt(sheet, point, road.id);
            });
            for(const e of [0,1]){
              const mouth=solved.arcLaneMouths?.get(`${road.id}:${e}:${lane}`);if(!mouth)continue;
              const extension=solved.arcLaneExtensions?.get(`${road.id}:${e}:${lane}`);
              if(extension){
                const tip=points.at(e?-1:0),lead=(e?extension.slice(1):extension.slice(0,-1)).map(p=>({...tip,...p}));
                if(e)points.push(...lead);else points.unshift(...lead);
                continue;
              }
              const beyond=p=>((p.x-mouth.x)*mouth.tangent.x+(p.y-mouth.y)*mouth.tangent.y)*(e?1:-1)>0;
              while(points.length>1&&beyond(points.at(e?-1:0)))e?points.pop():points.shift();
              const last=points.at(e?-1:0),tip={...last,x:mouth.x,y:mouth.y};
              if(Math.hypot(last.x-tip.x,last.y-tip.y)>1e-8)e?points.push(tip):points.unshift(tip);
            }
            const laneStations=[0];for(let i=1;i<points.length;i++)laneStations.push(laneStations.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
            if(solved.arcLaneMouths?.has(`${road.id}:0:${lane}`)||solved.arcLaneMouths?.has(`${road.id}:1:${lane}`))points.forEach((p,i)=>p.station=laneStations[i]);
            const open = [0, 1].map(e => {
              const bounds = shape.laneBounds[e ? shape.line.length - 1 : 0][lane];
              return bounds[1] - bounds[0] > inchesToPixels(sheet, 1);
            });
            const record = { road: road.id, lane, points, open, stations: (solved.arcLaneMouths?.has(`${road.id}:0:${lane}`)||solved.arcLaneMouths?.has(`${road.id}:1:${lane}`))?laneStations:stations };
            lanes.push(record); byKey.set(`${road.id}:${lane}`, record);
          }
        }
        const connect = (from, fromLane, to, toLane) => {
          if (!byKey.get(`${from}:${fromLane}`)?.open[1] || !byKey.get(`${to}:${toLane}`)?.open[0]) return;
          connections.push({ from: { road: from, lane: fromLane }, to: { road: to, lane: toLane } });
        };
        for (const joint of sheet.joints ?? []) {
          for (const link of laneLinks(sheet, joint)) connect(link.from.id, link.fromLane, link.to.id, link.toLane);
          const ends = attachments(sheet, joint);
          for (const a of ends.filter(a => a.e === 1)) for (const b of ends.filter(b => b.e === 0 && b.end.sign === a.end.sign)) {
            if (a.road === b.road) continue;
            for (let i = 0; i < a.road.lanes; i++) for (let j = 0; j < b.road.lanes; j++) {
              const p = byKey.get(`${a.road.id}:${i}`)?.points.at(-1), q = byKey.get(`${b.road.id}:${j}`)?.points[0];
              if (p && q && Math.hypot(p.x - q.x, p.y - q.y) < inchesToPixels(sheet, 1)) connect(a.road.id, i, b.road.id, j);
            }
          }
        }
        return { lanes, connections, laneChangePairs };
      },
      removeRoads: (sheet, roads) => removeRoads(sheet, roads),
      // A colored pavement record's outline, or a lane stretch (fractions), in sheet pixels.
      laneStrip: (sheet, road, lane, from, to, color = "green") => {
        const solved=lastSolved?.sheet===sheet?lastSolved.solved:solve(sheet);
        const shape=bikeMarkingShape(sheet,road,lane,shapeOf(sheet,road,solved),solved),total=polylineLength(shape.line);
        return surfaceStrip(sheet,road,shape,lane,from*total,to*total,color);
      },
      makeIntersection: (sheet, roads) => makeIntersection(sheet, roads),
      crossingCount: (sheet, roads) => crossings(sheet, roads).list.length,
      // Opens a road or median in the Elements panel, selected (right-click Edit).
      focusRoad: road => { window.StripeMaker.showEditor("elementsEditor"); selectRoad(road); },
      focusMedian: id => { window.StripeMaker.showEditor("elementsEditor"); selectMedian(id); },
      // A road's pavement outline (sheet pixels), for selection.
      outline: (sheet, road) => {
        const shape = shapeOf(sheet, road, lastSolved?.sheet === sheet ? lastSolved.solved : solve(sheet)), margin = inchesToPixels(sheet, PAVEMENT_MARGIN_INCHES);
        return [...boundary(shape, 0, -margin), ...boundary(shape, road.lanes, margin).reverse()];
      },
      medianOutline: (sheet, median) => medianOutline(sheet, medianSolve(sheet), median.points),
      crossSection: sheet => crossSectionOf(sheet, lastSolved?.sheet === sheet ? lastSolved.solved : solve(sheet)), flush: () => refreshTimer && render(), laneTracks, lanePoint, solve, pairOf: (sheet, road) => pairOf(sheet, road), intersectionEnd, intersectionEnds, moveIntersectionEnd, alignLaneEnd,
      pavementMarginFeet: PAVEMENT_MARGIN_INCHES / 12,
      tidyGores:pruneGores,
      drawIntersectionGores(sheet,item,layers,solved,cuts=[]) {
        const candidates=goreCandidates(sheet,solved??solve(sheet));
        for(const gore of sheet.gores??[])if(gore.intersection===item.id) {
          const candidate=candidates.get(gore.key);if(candidate)drawGore(sheet,gore,candidate,layers,cuts);
        }
      },
      paintedGoreEdges: (sheet, solved = lastSolved?.sheet === sheet ? lastSolved.solved : solve(sheet)) => {
        const candidates = goreCandidates(sheet, solved);
        return (sheet.gores ?? []).flatMap(gore => {
          const candidate = candidates.get(gore.key);
          if (!candidate || !(gore.length > 0)) return [];
          const last = indexAt(candidate.along, feetToPixels(sheet, gore.length));
          return [candidate.e1.slice(0, last + 1), candidate.e2.slice(0, last + 1)];
        });
      },
      markingStyle: { white: WHITE, yellow: YELLOW, lineFeet: LINE_INCHES / 12 },
      drawMedianHatching,
      insetPolygon,
      // FDOT 711-001 sheet 8: 8" white outline; double 6" yellow,
      // 4" clear gap (10" between marking centerlines).
      medianEdgeCuts,
      paintedMedianStyle: { whiteLineFeet: GORE_LINE_INCHES / 12, doubleOffsetFeet: (DOUBLE_GAP_INCHES + LINE_INCHES) / 12 },
      medianStyle: { grass: GRASS, concrete: CONCRETE, curb: CURB, curbFeet: CURB_INCHES / 12 } };
    render();
  });
})();
