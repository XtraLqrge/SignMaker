// Lane and endpoint overrides belong to this road, never to its neighbors.
(() => {
  let snapshot=null;
  const firstById=items=>{const map=new Map();for(const item of items)if(!map.has(item.id))map.set(item.id,item);return map;};
  // A synchronous geometry read may share lookup indexes.
  // Values remain references to the current model; no computed widths persist.
  // Ending the scope (including exceptions) drops every index, so subsequent
  // in-place edits, undo, and imported topology cannot leave stale lookups.
  function buildSnapshot(sheet) {
    return {roads:firstById(sheet.roads),joints:firstById(sheet.joints)};
  }
  function withSnapshot(sheet,callback) {
    if(snapshot?.sheet===sheet)return callback();
    const previous=snapshot;snapshot={sheet,previous,index:null};
    try{return callback();}finally{snapshot=previous;}
  }
  function invalidateSnapshot(sheet) {
    // Normalization inside a paint pass can remove attachments. Invalidate
    // after topology/binding edits; the next read rebuilds from current refs.
    for(let current=snapshot;current;current=current.previous)if(current.sheet===sheet)current.index=null;
  }
  const snapshotFor=sheet=>snapshot?.sheet===sheet?(snapshot.index??=buildSnapshot(sheet)):null;
  const roadById=(sheet,id)=>{const index=snapshotFor(sheet);return index?index.roads.get(id):sheet.roads.find(r=>r.id===id);};
  const jointById=(sheet,id)=>{const index=snapshotFor(sheet);return index?index.joints.get(id):sheet.joints.find(j=>j.id===id);};
  function endWidth(sheet, road, e, lane, visiting = new Set()) {
    if (lane == null && road.lanes) return Array.from({length: road.lanes}, (_, i) => endWidth(sheet, road, e, i)).reduce((a,b) => a+b, 0) / road.lanes;
    lane ??= 0;
    if (road.centerlineTransition) return road.centerlineTransition[e ? "end" : "start"][lane] ?? laneWidth(road, lane);
    const key = `${road.id}:${e}:${lane}`;
    if (!visiting.has(key) && road.ends?.[e]) {
      visiting.add(key);
      const joint = jointById(sheet,road.ends[e].joint);
      for (const link of joint?.links ?? []) {
        if (link.b !== road.id || link.bi !== lane || link.pair || link.beside || typeof link.ai !== 'number') continue;
        const receiver = roadById(sheet,link.a);
        if (!receiver) continue;
        const re = receiver.ends.findIndex(end => end.joint === joint.id);
        // Older edge feeds predate the flag. Their receiving road is the second
        // piece of a cut, with its untouched continuation at the same joint.
        const legacy = re === 0 && receiver.widthProfiles?.[link.ai]?.from > 0 &&
          joint.links.some(l => l.b === receiver.id && l.a !== road.id && !l.pair && !l.beside && typeof l.ai === 'number');
        // Saved end-to-start node joins use the same a=host, b=joining
        // convention as edge feeds. Honor explicit per-end edits on legacy
        // node links; new connections explicitly opt into following the host.
        const nodeFeed = e === 1 && re === 0 &&
          !(road.perLaneWidths && road.laneEndWidths?.[`${e}:${lane}`] != null);
        if (re >= 0 && (link.feed || legacy || nodeFeed)) {
          const width = endWidth(sheet, receiver, re, link.ai, visiting);
          visiting.delete(key);
          return width;
        }
      }
      visiting.delete(key);
    }
    const own = (road.perLaneWidths ? road.laneEndWidths?.[`${e}:${lane}`] : null) ?? laneWidth(road, lane);
    if (road.widthProfiles?.[lane]) return profileAt(road.widthProfiles[lane], e);
    return own;
  }
  function widthAt(width, start, end, fraction) {
    // Meet the shared width square at the joint, and recover the chosen road
    // width at mid-length. Smoothstep keeps the pavement edges tangent there.
    const t = Math.max(0, Math.min(1, fraction < .5 ? fraction * 2 : (1 - fraction) * 2));
    const blend = t * t * (3 - 2 * t);
    const endpoint = fraction < .5 ? start : end;
    return endpoint + (width - endpoint) * blend;
  }
  const laneWidth = (road, lane) => (road.perLaneWidths ? road.laneWidths?.[lane] : null) ?? road.laneWidth;
  const profileAt = (p, f) => widthAt(p.width, p.start, p.end, p.from + (p.to - p.from) * f);
  function splitWidths(sheet, road, fraction) {
    const before = [], after = [];
    for (let lane = 0; lane < road.lanes; lane++) {
      const p = road.widthProfiles?.[lane] ?? {width: laneWidth(road, lane), start: endWidth(sheet, road, 0, lane), end: endWidth(sheet, road, 1, lane), from: 0, to: 1};
      const middle = p.from + (p.to - p.from) * fraction;
      before.push({...p, to: middle}); after.push({...p, from: middle});
    }
    return [before, after];
  }
  // Callers sampling many fractions of one lane can pass its [start, end]
  // endpoint widths, which don't change along the road.
  function laneAt(sheet, road, lane, fraction, ends = [endWidth(sheet, road, 0, lane), endWidth(sheet, road, 1, lane)]) {
    if (road.centerlineTransition) {
      const t = Math.max(0, Math.min(1, fraction));
      return ends[0] + (ends[1] - ends[0]) * t;
    }
    // A wide turn meets the receiving road by geometric clipping, not by
    // narrowing its cross-section into the receiving lane.
    if (road.keepWidthAtJoins) return laneWidth(road,lane);
    if (road.widthProfiles?.[lane]) {
      const p = road.widthProfiles[lane];
      // Preserve a cut road's profile, adding only the correction needed by a
      // new receiving lane at either endpoint.
      return profileAt(p, fraction) + widthAt(0, ends[0] - profileAt(p, 0), ends[1] - profileAt(p, 1), fraction);
    }
    return widthAt(laneWidth(road, lane), ends[0], ends[1], fraction);
  }
  // Saved gap profiles keep real spaces between lanes; spacing blends
  // smoothly between the two ends.
  function endGaps(sheet,road,e) {
    return Array.from({length:road.lanes+1},(_,k)=>({width:road.gapProfiles?.[k]?gapProfileAt(road.gapProfiles[k],e):0,surface:road.gapProfiles?.[k]?.surface??'grass'}));
  }
  const smooth=f=>{const t=Math.max(0,Math.min(1,f));return t*t*(3-2*t);};
  const blendGap=(start,end,f)=>start+(end-start)*smooth(f);
  const gapProfileAt=(p,f)=>blendGap(p.start,p.end,p.from+(p.to-p.from)*f);
  function gapAt(road,k,f,start,end){
    const p=road.gapProfiles?.[k];
    return p?gapProfileAt(p,f)+blendGap(start-gapProfileAt(p,0),end-gapProfileAt(p,1),f):blendGap(start,end,f);
  }
  function splitGaps(sheet,road,f){
    const ends=[0,1].map(e=>endGaps(sheet,road,e)),before={},after={};
    for(let k=1;k<road.lanes;k++)if(ends[0][k].width||ends[1][k].width||road.gapProfiles?.[k]){
      const p=road.gapProfiles?.[k]??{start:ends[0][k].width,end:ends[1][k].width,from:0,to:1,surface:ends[0][k].width?ends[0][k].surface:ends[1][k].surface};
      const mid=p.from+(p.to-p.from)*f;before[k]={...p,to:mid};after[k]={...p,from:mid};
    }
    return [before,after];
  }
  const api = { withSnapshot, invalidateSnapshot, gapAt,splitGaps,endGaps, endWidth, widthAt, laneWidth, laneAt, splitWidths };
  if (typeof module !== 'undefined') module.exports = api;
  else (window.StripeMaker ??= {}).roadWidths = api;
})();
