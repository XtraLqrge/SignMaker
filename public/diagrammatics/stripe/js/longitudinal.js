/* Longitudinal pavement markings: lines along the road (the Markings panel's
   Longitudinal tab). Patterns are in js/line-styles.js.

   Every line a marking can go on is a target: each road's lane boundaries, a
   two-way road's centerline, and both edges of every intersection movement. A
   user line ({ style, color, ..., on, from, to }) replaces a target's default
   line over a stretch (fractions of the target's length). Dash patterns are
   measured along chains of joined targets (a target continues the one that ends
   where it starts, heading the same way), so any skip or dotted line stays in
   step through road joints and intersections. */
(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const PICK_PIXELS = 9;            // screen distance that picks a line
  const CLICK_PIXELS = 5;
  const CHAIN_FEET = 1.5;           // a target continues one ending this close to its start

  const app = window.StripeMaker ??= {};
  const S = app.lineStyles;
  let registry = null;              // targets of the last render
  const ppf = sheet => 12 / sheet.inchesPerPixel;
  const svg = (tag, attrs, parent) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent?.append(e);
    return e;
  };
  const keyOf = on => on.road != null ? `r:${on.road}:${on.k}` : on.median != null
    ? `im:${on.intersection}:${on.median}` : on.roundabout
    ? `m:${on.intersection}:roundabout:${on.approach}:${on.incoming ? "in" : "out"}:${on.k}`
    : `m:${on.intersection}:${on.movement}:${on.side}`;

  // Polyline helpers (sheet pixels).
  function measure(points) {
    const along = [0];
    for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    return along;
  }
  function pointAt(target, s) {
    const { points, along } = target;
    let i = 1,hi=points.length-1;
    // First station at or beyond s, including repeated/zero-length stations.
    // Keep extrapolation at either end and the original interpolation math.
    while(i<hi){const mid=(i+hi)>>1;if(along[mid]<s)i=mid+1;else hi=mid;}
    const a = points[i - 1], b = points[i], f = (s - along[i - 1]) / ((along[i] - along[i - 1]) || 1);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, t: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } };
  }
  function slice(target, a, b) {
    const { points, along } = target;
    const out = [pointAt(target, a)];
    for (let i = 0; i < points.length; i++) if (along[i] > a && along[i] < b) out.push(points[i]);
    out.push(pointAt(target, b));
    return out;
  }
  function offsetLine(points, distance) {
    if (!distance) return points;
    return points.map((p, i) => {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: p.x - (b.y - a.y) / len * distance, y: p.y + (b.x - a.x) / len * distance };
    });
  }
  function project(target, point) {
    let best = null;
    const { points, along } = target;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      const f = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
      const d = Math.hypot(point.x - (a.x + dx * f), point.y - (a.y + dy * f));
      if (!best || d < best.distance) best = { s: along[i] + f * Math.sqrt(len2), distance: d };
    }
    return best;
  }

  // Registry: built each render from the road editor and intersections.
  function begin(sheet, targets) {
    // Snapping targets are needed on demand when there are no user lines.
    // Opening the line editor or drawing a road still materializes the same
    // complete registry; dragging an unmarked intersection need not build it.
    if (typeof targets === 'function') {
      const build = targets;
      if (sheet.lines?.length) return begin(sheet, build());
      let ready;
      const lazy = { sheet };
      for (const key of ['targets', 'centers', 'phases']) Object.defineProperty(lazy, key, {
        get: () => (ready ??= begin(sheet, build()))[key],
      });
      sheet.lines ??= [];
      return registry = lazy;
    }

    const map = new Map();
    for (const t of targets) {
      if (t.points.length < 2) continue;
      const along = measure(t.points);
      map.set(t.key, { ...t, along, length: along.at(-1) });
    }
    // Two-way centerlines take over both sides' left edges where they're edited.
    const centers = new Map();
    for (const t of map.values()) if (t.on?.k === 'C') {
      centers.set(t.road, { key: t.key, reversed: false });
      centers.set(t.partner, { key: t.key, reversed: true });
    }
    registry = { sheet, targets: map, centers, phases: new Map() };
    sheet.lines ??= [];
    // Lines go with their target: a removed road, lane or movement drops them.
    sheet.lines = sheet.lines.filter(l => map.has(keyOf(l.on ?? {})));
    return registry;
  }
  // Follow end-to-start continuations in either direction. Matching tangents
  // excludes crossing lines and keeps the drag on the same marking chain.
  function linkedStretches(targets, start, startS, finish, finishS, tolerance) {
    const queue = [{ target: start, path: [start], direction: 0 }], seen = new Set([start.key]);
    while (queue.length) {
      const state = queue.shift(), current = state.target;
      if (current === finish) return state.path.map((target, i, path) => {
        const forward = state.direction >= 0;
        const a = i === 0 ? startS : forward ? 0 : target.length;
        const b = i === path.length - 1 ? finishS : forward ? target.length : 0;
        return { target, a: Math.min(a,b), b: Math.max(a,b) };
      });
      for (const next of targets.values()) {
        if (seen.has(next.key)) continue;
        for (const direction of state.direction ? [state.direction] : [1,-1]) {
          const a = pointAt(current, direction > 0 ? current.length : 0);
          const b = pointAt(next, direction > 0 ? 0 : next.length);
          if (Math.hypot(a.x-b.x,a.y-b.y)>tolerance || a.t.x*b.t.x+a.t.y*b.t.y<0.9) continue;
          seen.add(next.key);
          queue.push({ target: next, path: [...state.path,next], direction });
          break;
        }
      }
    }
    return null;
  }
  // The registry owns immutable target geometry until the next begin(). Index
  // endpoints once, so each phase query examines only nearby continuations.
  // The exact distance, tangent and road/key tie-breaks still decide the chain.
  const phaseIndexes=new WeakMap();
  function nearbyEnds(r,start,tolerance) {
    const targets=r.targets;
    if(!(tolerance>0)||!Number.isFinite(tolerance)||!Number.isFinite(start.x)||!Number.isFinite(start.y))return targets.values();
    let index=phaseIndexes.get(targets);
    if(!index||index.tolerance!==tolerance){
      index={tolerance,cells:new Map(),invalid:false};
      for(const target of targets.values()){
        const end=target.points.at(-1);
        if(!Number.isFinite(end.x)||!Number.isFinite(end.y)){index.invalid=true;break;}
        const key=`${Math.floor(end.x/tolerance)}:${Math.floor(end.y/tolerance)}`;
        if(!index.cells.has(key))index.cells.set(key,[]);index.cells.get(key).push(target);
      }
      phaseIndexes.set(targets,index);
    }
    if(index.invalid)return targets.values();
    const x=Math.floor(start.x/tolerance),y=Math.floor(start.y/tolerance),near=[];
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)near.push(...index.cells.get(`${x+dx}:${y+dy}`)??[]);
    return near;
  }
  const endTangents=new WeakMap();
  const endTangent=target=>{let tangent=endTangents.get(target);if(!tangent){tangent=pointAt(target,target.length).t;endTangents.set(target,tangent);}return tangent;};
  // Distance (pixels) along a target's chain to its start.
  function phase(key, visiting = new Set()) {
    const r = registry;
    if (r.phases.has(key)) return r.phases.get(key);
    const target = r.targets.get(key);
    if (!target || visiting.has(key)) return 0;
    visiting.add(key);
    const tolerance = CHAIN_FEET * ppf(r.sheet);
    const start = target.points[0], dir = pointAt(target, 0).t;
    let before = null;
    for (const other of nearbyEnds(r,start,tolerance)) {
      if (other === target) continue;
      const end = other.points.at(-1);
      if (Math.hypot(end.x - start.x, end.y - start.y) > tolerance) continue;
      const t = endTangent(other);
      if (t.x * dir.x + t.y * dir.y < 0.9) continue;
      // Roads first, then intersection movements; lowest key wins ties.
      if (!before || (other.key[0] === 'r') > (before.key[0] === 'r') || ((other.key[0] === 'r') === (before.key[0] === 'r') && other.key < before.key)) before = other;
    }
    const value = before ? phase(before.key, visiting) + before.length : 0;
    r.phases.set(key, value);
    return value;
  }
  // A target's stretches: its default line, with user lines laid over it in order.
  function pieces(sheet, key, length, base) {
    let out = [{ a: 0, b: length, line: base }];
    const cut = (a, b, line) => {
      const next = [];
      for (const p of out) {
        if (p.b <= a || p.a >= b) { next.push(p); continue; }
        if (p.a < a) next.push({ ...p, b: a });
        if (p.b > b) next.push({ ...p, a: b });
      }
      next.push({ a, b, line });
      out = next.sort((x, y) => x.a - y.a);
    };
    const road = key?.match(/^r:(\d+):0$/)?.[1];
    const center = road != null && registry?.centers.get(+road);
    for (const line of sheet.lines ?? []) {
      const k = keyOf(line.on);
      if (k === key) cut(line.from * length, line.to * length, line);
      // A centerline line replaces both sides' left edge lines under it.
      else if (center && k === center.key) {
        const [f, t] = center.reversed ? [1 - line.to, 1 - line.from] : [line.from, line.to];
        cut(f * length, t * length, null);
      }
    }
    return out.filter(p => p.line && p.b - p.a > 1e-6);
  }
  function paint(sheet, points, line, distance, parent, polygons = [], options = {}, extra = {}) {
    const k = ppf(sheet), toPx = inches => inches / sheet.inchesPerPixel;
    const closed = options.closed && points.length > 3 && Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y) < 1e-7;
    const ring = closed ? points.slice(0,-1) : null;
    const orientation = ring && ring.reduce((sum,p,i) => { const q=ring[(i+1)%ring.length];return sum+p.x*q.y-q.x*p.y; },0) > 0 ? 1 : -1;
    for (const stripe of S.stripes(line, options)) {
      // Median rings need joined corners on both stripes of a double line.
      // Offsetting them as an open path leaves a gap at the first vertex.
      const inset = closed && stripe.offset ? app.roadEditor.insetPolygon(ring,toPx(stripe.offset)*orientation) : null;
      const path = inset ? [...inset,inset[0]] : offsetLine(points, toPx(stripe.offset));
      const parts = polygons.length ? app.markingTrim.trim(path, polygons) : [{ points: path, distance: 0 }];
      for (const part of parts) {
        if (part.points.length < 2) continue;
        const attrs = { class: 'roadMarking', d: `M${part.points.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('L')}${closed && !polygons.length ? 'Z' : ''}`,
          stroke: stripe.color, 'stroke-width': toPx(stripe.width), ...(options.edge ? { 'data-edge': '1' } : {}), ...extra };
        const dash = S.dashAttributes(stripe.dash, distance + part.distance / k, k);
        if (dash) Object.assign(attrs, { 'stroke-dasharray': dash.array, 'stroke-dashoffset': dash.offset.toFixed(2) });
        svg('path', attrs, parent);
      }
    }
  }
  // Draws one target: its default line (null for none) with user lines over it.
  function drawTarget(sheet, key, points, base, parent, polygons = [], options = {}) {
    const target = key && registry?.sheet === sheet ? registry.targets.get(key) : null;
    if (!target) { if (base) paint(sheet, points, base, 0, parent, polygons, options); return; }
    const start = phase(key), k = ppf(sheet);
    for (const p of pieces(sheet, key, target.length, base)) {
      // Default lines stay off the travel lanes of roads joined to them; a line
      // placed by hand is drawn where it was placed.
      const user = p.line !== base;
      paint(sheet, slice(target, p.a, p.b).map(q=>app.itemTransform.apply(p.line,q)), p.line, (start + p.a) / k, parent, user ? [] : polygons, user && p.line.on?.k === 'C' ? {} : options);
    }
  }
  function drawMovementLines(sheet, parent) {
    if (registry?.sheet !== sheet) return;
    const keys = new Set((sheet.lines ?? []).map(l => keyOf(l.on)).filter(k => k.startsWith('m:')));
    for (const key of keys) drawTarget(sheet, key, registry.targets.get(key).points, null, parent);
  }

  // Cutting a road keeps its lines where they are: before the cut, sample each
  // line on the road; afterward, put it on whichever pieces' lines it lies along
  // (a line across the cut becomes one on each piece).
  function capture(sheet, roads) {
    const ids = roads.filter(id => id != null);
    if (registry?.sheet !== sheet) return [];
    const step = ppf(sheet);
    return (sheet.lines ?? []).filter(l => ids.includes(l.on?.road)).map(line => {
      const target = registry.targets.get(keyOf(line.on));
      if (!target) return null;
      const a = line.from * target.length, b = line.to * target.length, samples = [];
      for (let s = a; s < b; s += step) samples.push(pointAt(target, s));
      samples.push(pointAt(target, b));
      return { line, samples };
    }).filter(Boolean);
  }
  function rehome(sheet, captured, targets, roads) {
    if (!captured.length) return;
    const ids = new Set(roads.filter(id => id != null));
    const pieces = targets.filter(t => ids.has(t.on?.road)).map(t => {
      const along = measure(t.points);
      return { ...t, along, length: along.at(-1) };
    });
    const tolerance = ppf(sheet);
    for (const { line, samples } of captured) {
      const made = [];
      for (const t of pieces) {
        if (t.on.k !== line.on.k) continue;
        const on = samples.map(p => project(t, p)).filter(p => p.distance < tolerance).map(p => p.s);
        if (on.length < 2) continue;
        made.push({ ...line, id: made.length ? crypto.randomUUID() : line.id, on: t.on,
          from: Math.min(...on) / t.length, to: Math.max(...on) / t.length });
      }
      if (!made.length) continue;
      const i = sheet.lines.indexOf(line);
      sheet.lines.splice(i, 1, ...made);
    }
  }
  app.longitudinal = { begin, drawTarget, drawMovementLines, capture, rehome, phase: key => phase(key), keyOf };

  document.addEventListener('DOMContentLoaded', () => {
    const sheets = app.sheets;
    const get = id => document.getElementById(id);
    const workspace = get('workspace'), panel = get('markingsEditor');
    const overlay = document.createElement('div');
    overlay.className = 'markingOverlay lineOverlay';
    sheets.addOverlay(overlay);

    const draft = { style: 'skip', color: 'white', width: 8, side: 'left', contrast: false };
    let selected = null, selectedSheet = null, hover = null, drag = null;
    app.longitudinal.diagnostics = () => structuredClone({selected,draft});

    const active = () => !panel.hidden && app.markings?.tab() === 'longitudinal';
    const current = () => sheets.selected?.lines?.find(l => l.id === selected) ?? null;
    const model = () => current() ?? draft;
    const tell = text => { get('lineStatus').textContent = text; };
    // Overlay: the line under the pointer, the stretch being dragged, and the
    // selected line's end nodes.
    function nearest(point, filter = () => true) {
      const sheet = sheets.selected;
      if (!registry || registry.sheet !== sheet) return null;
      let best = null;
      for (const target of registry.targets.values()) {
        if (!filter(target)) continue;
        const p = project(target, point);
        if (p && p.distance * sheet.view.scale <= PICK_PIXELS && (!best || p.distance < best.distance)) best = { target, ...p };
      }
      return best;
    }
    function hitLine(found) {
      const lines = sheets.selected?.lines ?? [];
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        if (keyOf(l.on) === found.target.key && found.s >= l.from * found.target.length - 1 && found.s <= l.to * found.target.length + 1) return l;
      }
      return null;
    }
    function refreshOverlay() {
      if (drag?.handle) return;
      overlay.replaceChildren();
      const sheet = sheets.selected;
      if (!sheet?.inchesPerPixel || !active() || registry?.sheet !== sheet) return;
      const root = svg('svg', { 'aria-hidden': 'true' }, overlay);
      const view = svg('g', { transform: `translate(${sheet.view.x} ${sheet.view.y}) scale(${sheet.view.scale})` }, root);
      // Keep intersection boundaries discoverable, including median outlines
      // that have been erased with the No line style.
      for (const t of registry.targets.values()) if (t.key.startsWith('m:') || t.key.startsWith('im:')) {
        svg('path', { d: pathData(t.points), class: 'lineGuide', 'vector-effect': 'non-scaling-stroke' }, view);
      }
      if (hover && !drag) svg('path', { d: pathData(hover.target.points), class: 'lineHover', 'vector-effect': 'non-scaling-stroke' }, view);
      if (drag?.preview) for (const item of drag.preview) {
        // Keep the extent visible even for an erase line or a dashed gap.
        svg('path', { d: pathData(slice(item.target,item.a,item.b)), class: 'lineSelected', 'vector-effect': 'non-scaling-stroke' }, view);
        paint(sheet, slice(item.target, item.a, item.b), { ...(drag.style ?? draft), on: item.target.on }, 0, svg('g', { opacity: '0.8' }, view));
      }
      const line = current(), target = line && registry.targets.get(keyOf(line.on));
      if (!target) return;
      svg('path', { d: pathData(pathOf(line)), class: 'lineSelected', 'vector-effect': 'non-scaling-stroke' }, view);
      const name = S.find(line.style)?.name ?? 'Line';
      for (const end of ['from', 'to']) {
        const p = app.itemTransform.apply(line,pointAt(target, line[end] * target.length)), s = sheets.toScreen(p);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'markingHandle'; b.dataset.end = end;
        b.setAttribute('aria-label', `${name} ${end === 'from' ? 'start' : 'end'}. Drag along the line, or use the arrow keys (Shift for 10 ft); Delete removes the line.`);
        b.title = `${name} ${end === 'from' ? 'start' : 'end'}`;
        Object.assign(b.style, { left: `${s.x}px`, top: `${s.y}px` });
        overlay.append(b);
      }
    }
    const pathData = points => `M${points.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('L')}`;

    let handleFrame = 0;
    function cancelHandleFrame() {
      cancelAnimationFrame(handleFrame); handleFrame = 0;
    }
    function drawHandle() {
      cancelHandleFrame();
      app.roadEditor.render();
      const line = current(), target = line && registry?.targets.get(keyOf(line.on));
      if (drag?.handle && target) {
        const s = sheets.toScreen(pointAt(target,line[drag.end]*target.length));
        Object.assign(drag.handle.style,{left:`${s.x}px`,top:`${s.y}px`});
      }
    }
    function changed(message) {
      cancelHandleFrame();
      app.roadEditor.render();
      updatePanel();
      sheets.save(sheets.selected);
      app.history.record();
      if (message) tell(message);
    }
    function select(id) { selected = id; selectedSheet = sheets.selected; updatePanel(); refreshOverlay(); app.selection?.editorChanged(); }
    function remove() {
      const sheet = sheets.selected;
      if (!current()) return;
      sheet.lines = sheet.lines.filter(l => l.id !== selected);
      selected = null;
      changed('Line removed.');
    }
    const newLine = (target, a, b, style = draft) => ({
      id: crypto.randomUUID(), ...(style.style === 'custom' ? { custom: structuredClone(style.custom) } : {}), style: style.style, color: style.color, ...(S.find(style.style)?.widths ? { width: style.width } : {}),
      ...(S.find(style.style)?.sided ? { side: style.side } : {}), ...(style.contrast && S.contrastable(style) && (!target.edge || style.style === 'custom') ? { contrast: true } : {}),
      on: target.on, from: Math.max(0, Math.min(a, b) / target.length), to: Math.min(1, Math.max(a, b) / target.length),
    });
    // The stretch being dragged: on the line where the drag started, or with
    // Shift on every line of that road between it and the line under the pointer.
    function stretches(point, shift, d = drag) {
      const { target, s } = d;
      const end = project(target, point).s;
      if (!shift || target.on?.road == null) {
        const found = nearest(point);
        if (found && found.target !== target) {
          const linked = linkedStretches(registry.targets, target, s, found.target, found.s, CHAIN_FEET * ppf(sheets.selected));
          if (linked) return linked;
        }
        return [{ target, a: Math.min(s, end), b: Math.max(s, end) }];
      }
      const road = target.on.road, other = nearest(point, t => t.on?.road === road && t.on.k !== 'C');
      const k0 = target.on.k === 'C' ? 0 : target.on.k, k1 = other ? other.target.on.k : k0;
      const p0 = pointAt(target, s), p1 = pointAt(target, end);
      const out = [];
      const model = sheets.selected.roads.find(r => r.id === road);
      const travel = i => i >= 0 && i < model?.lanes && !['bike','bufferedBike','twoWayBike'].includes(model.laneTypes?.[i]?.type);
      for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) {
        if (!travel(k-1) && !travel(k)) continue;
        const t = registry.targets.get(`r:${road}:${k}`);
        if (!t) continue;
        const a = project(t, p0).s, b = project(t, p1).s;
        out.push({ target: t, a: Math.min(a, b), b: Math.max(a, b) });
      }
      return out;
    }

    const pointOf = event => sheets.toImage(event.clientX, event.clientY);
    workspace.addEventListener('pointermove', event => {
      if (!active() || !sheets.selected?.inchesPerPixel) return;
      if (drag && event.pointerId === drag.pointer) {
        if (drag.handle) return;
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > CLICK_PIXELS) drag.moved = true;
        if (drag.moved) drag.preview = stretches(pointOf(event), event.shiftKey);
        refreshOverlay();
        return;
      }
      hover = nearest(pointOf(event));
      workspace.classList.toggle('markingPlacing', Boolean(hover));
      refreshOverlay();
    });
    workspace.addEventListener('pointerleave', () => { if (!drag) { hover = null; workspace.classList.remove('markingPlacing'); refreshOverlay(); } });
    workspace.addEventListener('pointerdown', event => {
      if (!active() || !sheets.selected?.inchesPerPixel || event.button !== 0 || !event.isPrimary) return;
      if (event.target.closest('.markingOverlay button')) return;
      const found = nearest(pointOf(event));
      if (!found) return;  // off the lines, a drag pans
      event.preventDefault(); event.stopImmediatePropagation();
      drag = { pointer: event.pointerId, target: found.target, s: found.s, x: event.clientX, y: event.clientY, moved: false, found, style: { ...model() } };
      workspace.setPointerCapture(event.pointerId);
    }, true);
    workspace.addEventListener('pointerup', event => {
      if (!drag || event.pointerId !== drag.pointer || drag.handle) return;
      const d = drag, sheet = sheets.selected;
      drag = null;
      if (workspace.hasPointerCapture(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
      if (!d.moved) {
        // A click selects a line already there, or puts the marking on the whole line.
        const hit = hitLine(d.found);
        if (hit) { select(hit.id); return; }
        d.preview = [{ target: d.target, a: 0, b: d.target.length }];
      } else d.preview = stretches(pointOf(event), event.shiftKey, d);
      const made = d.preview.filter(p => p.b - p.a > 0.5).map(p => newLine(p.target, p.a, p.b, d.style));
      if (!made.length) { refreshOverlay(); return; }
      sheet.lines ??= [];
      sheet.lines.push(...made);
      selected = made[0].id; selectedSheet = sheet;
      const edge = made.some(l => registry.targets.get(keyOf(l.on))?.edge);
      changed(`${made.length > 1 ? `${made.length} lines` : 'Line'} added.${d.style.contrast && edge && d.style.style !== 'custom' ? ' Edge lines don’t get black contrast.' : ''}`);
    }, true);
    workspace.addEventListener('pointercancel', event => {
      if (drag && event.pointerId === drag.pointer && !drag.handle) { drag = null; refreshOverlay(); }
    }, true);
    workspace.addEventListener('dblclick', event => {
      if (active() && hover) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);

    // End nodes: drag along the line or nudge with the arrow keys.
    overlay.addEventListener('pointerdown', event => {
      const handle = event.target.closest('button[data-end]');
      if (!handle || event.button !== 0 || !current()) return;
      event.preventDefault(); event.stopPropagation();
      drag = { pointer: event.pointerId, handle, end: handle.dataset.end, before: structuredClone(current()), moved: false };
      handle.setPointerCapture(event.pointerId);
      handle.focus({ preventScroll: true });
    });
    function setEnd(line, end, s, target) {
      line[end] = Math.max(0, Math.min(1, s / target.length));
      if (line.from > line.to) { [line.from, line.to] = [line.to, line.from]; return end === 'from' ? 'to' : 'from'; }
      return end;
    }
    overlay.addEventListener('pointermove', event => {
      if (!drag?.handle || event.pointerId !== drag.pointer) return;
      const line = current(), target = line && registry.targets.get(keyOf(line.on));
      if (!target) return;
      drag.moved = true;
      drag.end = setEnd(line, drag.end, project(target, pointOf(event)).s, target);
      handleFrame ||= requestAnimationFrame(drawHandle);
    });
    function endHandle(event, cancel) {
      if (!drag?.handle || event.pointerId !== drag.pointer) return;
      cancelHandleFrame();
      const d = drag;
      drag = null;
      if (cancel && current()) Object.assign(current(), d.before);
      if (d.handle.hasPointerCapture(event.pointerId)) d.handle.releasePointerCapture(event.pointerId);
      if (d.moved) changed(); else refreshOverlay();
      overlay.querySelector(`button[data-end="${d.end}"]`)?.focus({ preventScroll: true });
    }
    overlay.addEventListener('pointerup', event => endHandle(event, false));
    overlay.addEventListener('pointercancel', event => endHandle(event, true));
    overlay.addEventListener('click', event => event.stopPropagation());
    overlay.addEventListener('keydown', event => {
      const handle = event.target.closest('button[data-end]'), line = current();
      if (!handle || !line) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); remove(); return; }
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
      const target = registry?.targets.get(keyOf(line.on));
      if (!dir || !target) return;
      event.preventDefault(); event.stopPropagation();
      const end = setEnd(line, handle.dataset.end, line[handle.dataset.end] * target.length + dir * (event.shiftKey ? 10 : 1) * ppf(sheets.selected), target);
      changed();
      overlay.querySelector(`button[data-end="${end}"]`)?.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', event => {
      if (!active() || event.target.closest('input,select,textarea,dialog')) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && current()) { event.preventDefault(); remove(); }
      else if (event.key === 'Escape' && current()) { event.preventDefault(); event.stopImmediatePropagation(); select(null); }
    }, true);

    // Panel.
    function edit(apply) {
      const line = current();
      if (line) { apply(line); changed(); } else { apply(draft); updatePanel(); }
    }
    get('lineColor').addEventListener('change', event => edit(l => { l.color = event.target.value; }));
    get('lineWidth').addEventListener('change', event => edit(l => { l.width = +event.target.value; }));
    get('lineSide').addEventListener('change', event => edit(l => { l.side = event.target.value; }));
    get('lineContrast').addEventListener('change', event => edit(l => { if (event.target.checked) l.contrast = true; else delete l.contrast; }));
    get('deleteLine').addEventListener('click', remove);
    get('chooseLine').addEventListener('click', () => app.markings.openPicker());

    function thumbnail(line) {
      const root = document.createElementNS(SVG, 'svg');
      root.setAttribute('xmlns', SVG);
      const half = line.style === 'custom' ? Math.max(6, ...S.stripes(line).map(s => (Math.abs(s.offset) + s.width / 2) / 3 + 2)) : 6;
      root.setAttribute('viewBox', `${-half} 0 ${half * 2} 60`);
      svg('rect', { x: -half, y: 0, width: half * 2, height: 60, fill: '#55575a' }, root);
      // Feet: a 60 ft stretch, inches converted for the stripes.
      for (const stripe of S.stripes({ ...line, contrast: line.contrast && S.contrastable(line) })) {
        const attrs = { d: `M${stripe.offset / 12 * 4} 60L${stripe.offset / 12 * 4} 0`, stroke: stripe.color, 'stroke-width': Math.max(0.5, stripe.width / 12 * 4), fill: 'none' };
        const dash = S.dashAttributes(stripe.dash, 0, 1);
        if (dash) Object.assign(attrs, { 'stroke-dasharray': dash.array, 'stroke-dashoffset': dash.offset });
        svg('path', attrs, root);
      }
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(root));
    }
    // The picker (shared with lateral markings) lists these on this tab.
    const source = {
      items: () => S.styles.filter(s => s.id !== 'custom').map(s => ({ id: s.id, name: s.name, group: 'Lines', note: s.note })),
      thumbnail: item => thumbnail({ style: item.id, color: S.find(item.id).colors[0] ?? 'white', width: S.find(item.id).widths?.[0] }),
      chosen: item => model().style === item.id,
      choose(item) {
        const line = current(), style = S.find(item.id);
        const target = line ?? draft;
        target.style = item.id;
        if (item.id === 'custom') target.custom ??= { stripes: [{ width: 6, offset: 0, color: '#ffffff', pattern: [10, 30], phase: 0 }], contrastColor: '#000000', contrastWidth: 1.5 };
        if (!style.colors.includes(target.color) && style.colors.length) target.color = style.colors[0];
        if (style.widths) target.width = style.widths.includes(target.width) ? target.width : style.widths[0]; else if (line) delete line.width;
        if (style.sided) target.side ??= 'left'; else if (line) delete line.side;
        if (line) changed('Line changed.'); else { updatePanel(); tell(HINT); }
      },
    };
    const HINT = 'Drag along connected lane lines across roads to mark a stretch; the preview shows the full extent. Click a line for all of it. Hold Shift to include the lines between.';

    function updateCustomFields(line) {
      const custom = line.style === 'custom';
      get('customLineFields').hidden = !custom;
      if (!custom) return;
      get('customLinePreview').src = thumbnail(line);
      const container = get('customLineStripes');
      if (!container.contains(document.activeElement)) {
        container.replaceChildren();
        line.custom.stripes.forEach((stripe, i) => {
          const fieldset = document.createElement('fieldset'), legend = document.createElement('legend');
          legend.textContent = `Stripe ${i + 1}`; fieldset.append(legend);
          for (const [key, label, type, min, max, step] of [
            ['color', 'Color', 'color'], ['width', 'Width (in)', 'number', .1, 120, .1],
            ['offset', 'Sideways offset (in)', 'number', -1200, 1200, .25],
            ['pattern', 'Repeat pattern (ft)', 'text'], ['phase', 'Pattern start (ft)', 'number', -10000, 10000, .1]]) {
            const row = document.createElement('div'); row.className = 'fieldRow';
            const title = document.createElement('label'), input = document.createElement('input');
            input.id = `customStripe-${i}-${key}`; title.htmlFor = input.id; title.textContent = label; input.type = type;
            if (type === 'number') { input.min = min; input.max = max; input.step = step; }
            input.value = key === 'pattern' ? stripe.pattern.join(', ') : stripe[key];
            input.addEventListener('input', () => {
              let value = input.value;
              if (key === 'pattern') {
                value = value.trim() ? value.trim().split(/[,\s]+/).map(Number) : [];
                input.setCustomValidity(value.length % 2 || value.length > 32 || value.some(n => !Number.isFinite(n) || n <= 0 || n > 10000) ? 'Enter pairs of positive stripe and gap lengths (up to 32 values).' : '');
              } else if (type === 'number') value = input.valueAsNumber;
              if (!input.checkValidity() || (type === 'number' && !Number.isFinite(value))) return;
              edit(l => { l.custom.stripes[i][key] = value; });
            });
            row.append(title, input); fieldset.append(row);
          }
          if (line.custom.stripes.length > 1) {
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove Stripe';
            remove.addEventListener('click', () => { remove.blur(); edit(l => l.custom.stripes.splice(i, 1)); }); fieldset.append(remove);
          }
          container.append(fieldset);
        });
      }
      for (const [id, key] of [['customContrastColor', 'contrastColor'], ['customContrastWidth', 'contrastWidth']])
        if (document.activeElement !== get(id)) get(id).value = line.custom[key];
    }
    get('addCustomStripe').addEventListener('click', () => edit(l => { if (l.custom.stripes.length >= 100) return; const last = l.custom.stripes.at(-1); l.custom.stripes.push({ ...structuredClone(last), offset: Math.min(1200, last.offset + last.width + 4) }); }));
    for (const [id, key] of [['customContrastColor', 'contrastColor'], ['customContrastWidth', 'contrastWidth']])
      get(id).addEventListener('input', event => { if (event.target.checkValidity() && (event.target.type !== 'number' || Number.isFinite(event.target.valueAsNumber))) edit(l => { l.custom[key] = event.target.type === 'number' ? event.target.valueAsNumber : event.target.value; }); });

    function updatePanel() {
      const sheet = sheets.selected, line = model(), style = S.find(line.style);
      if (selectedSheet !== sheet) selected = null;
      const editing = Boolean(current());
      get('deleteLine').disabled = !editing;
      const color = style.colors.includes(line.color) ? line.color : style.colors[0];
      get('lineName').textContent = `${editing ? 'Selected: ' : ''}${style.name}${color ? ` (${color})` : ''}`;
      get('linePreview').src = thumbnail({ ...line, color });
      updateCustomFields(line);
      const select = get('lineColor');
      select.replaceChildren(...style.colors.map(c => new Option(c[0].toUpperCase() + c.slice(1), c)));
      select.value = color ?? '';
      get('lineColorRow').hidden = style.colors.length < 2;
      get('lineWidthRow').hidden = !style.widths;
      if (style.widths) get('lineWidth').value = String(line.width ?? style.widths[0]);
      get('lineSideRow').hidden = !style.sided;
      get('lineSide').value = line.side ?? 'left';
      const can = S.contrastable({ ...line, color });
      get('lineContrast').disabled = !can;
      get('lineContrast').checked = can && Boolean(line.contrast);
      get('lineContrastHint').textContent = !can ? 'Choose a white line to enable high contrast.' : '';
      if (!sheet) tell('Upload a sheet first.');
      else if (!sheet.inchesPerPixel) tell('Set the sheet’s scale (Sheets › Set Scale) to add markings.');
      else if (!get('lineStatus').textContent || /^(Upload|Set the)/.test(get('lineStatus').textContent)) tell(HINT);
    }

    new MutationObserver(() => { if (panel.hidden) { hover = null; drag = null; } updatePanel(); refreshOverlay(); })
      .observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('sheetview', refreshOverlay);
    for (const event of ['sheetchange', 'sheethistory']) document.addEventListener(event, () => {
      cancelHandleFrame();
      hover = null; drag = null;
      if (selectedSheet !== sheets.selected || !current()) selected = null;
      updatePanel(); refreshOverlay();
    });

    // For selection: a user line's path, and the user line near a point.
    function pathOf(line) {
      const target = registry?.targets.get(keyOf(line.on ?? {}));
      return target ? slice(target, line.from * target.length, line.to * target.length).map(p=>app.itemTransform.apply(line,p)) : [];
    }
    function lineAt(point, tolerance) {
      for (const line of [...(sheets.selected?.lines ?? [])].reverse()) {
        const target = registry?.targets.get(keyOf(line.on ?? {}));
        const t=line.placementTransform, q=t?app.itemTransform.apply({placementTransform:{angle:-t.angle,x:0,y:0}},{x:point.x-t.x,y:point.y-t.y}):point;
        const found = target && project(target, q);
        if (found && found.distance <= tolerance && found.s >= line.from * target.length && found.s <= line.to * target.length) return line;
      }
      return null;
    }
    // Opens a line in the Markings panel's Longitudinal tab, selected.
    function focus(id) { app.showEditor?.('markingsEditor'); app.markings?.showTab?.('longitudinal'); select(id); }
    // For pasting: the line target under a point, and where along it.
    function targetAt(point) {
      const found = nearest(point);
      return found && { on: found.target.on, s: found.s, length: found.target.length };
    }
    Object.assign(app.longitudinal, { selectedItem:()=>active()&&current()?{kind:"lines",id:selected}:null, refreshOverlay, source, pathOf, lineAt, focus, targetAt });
    updatePanel();
  });
})();
