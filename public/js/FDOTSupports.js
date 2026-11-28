/* Visual elevations based on FDOT FY 2026-27 Standard Plans.
 * See docs/fdot-supports.md for the drawing/sheet behind each family.
 * Overhead trusses are drawn head on, with depth shading on the three-chord section.
 * Span width fits the signs. Vertical dimensions use a fixed mounting layout.
 */
window.SignMakerFDOTSupports = (() => {
  const definitions = [
    ["FDOTFrangible", "Frangible aluminum", "700-010", "Center", "round"],
    ["FDOTSlipBaseWelded", "Welded slip base", "700-010", "Center", "round", { base: "welded" }],
    ["FDOTSlipBaseBolted", "Bolted slip base", "700-010", "Center", "round", { base: "bolted" }],
    ["FDOTGroundCantileverLeft", "Ground cantilever", "700-011", "Left", "offset", { side: "left" }],
    ["FDOTGroundCantileverRight", "Ground cantilever", "700-011", "Right", "offset", { side: "right" }],
    ["FDOTBarrierSide", "Side-mounted barrier", "700-012", "Center", "barrierSide"],
    ["FDOTBarrierTop", "Top-mounted barrier", "700-013", "Center", "barrierTop"],
    ["FDOTMultiColumnTwo", "Two steel columns", "700-020", "Rural", "multi", { columns: 2 }],
    ["FDOTMultiColumnThree", "Three steel columns", "700-020", "Rural", "multi", { columns: 3 }],
    ["FDOTCantileverLeft", "Cantilever truss", "700-040", "Left", "truss", { side: "left" }],
    ["FDOTCantileverRight", "Cantilever truss", "700-040", "Right", "truss", { side: "right" }],
    ["FDOTSpan", "Span truss", "700-041", "Overhead", "truss"],
    ["FDOTLitCantileverLeft", "Lighted cantilever", "700-040 / 700-031", "Left", "truss", { side: "left", lighting: true }],
    ["FDOTLitCantileverRight", "Lighted cantilever", "700-040 / 700-031", "Right", "truss", { side: "right", lighting: true }],
    ["FDOTLitSpan", "Lighted span truss", "700-041 / 700-031", "Overhead", "truss", { lighting: true }],
    ["FDOTDMSCantileverLeft", "DMS cantilever", "700-090 / 700-091", "Left", "truss", { side: "left", catwalk: true }],
    ["FDOTDMSCantileverRight", "DMS cantilever", "700-090 / 700-091", "Right", "truss", { side: "right", catwalk: true }],
    ["FDOTDMSSpan", "DMS span truss", "700-090 / 700-091", "Overhead", "truss", { catwalk: true }],
    ["FDOTStreetMastLeft", "Mast arm", "700-050", "Left", "mast", { side: "left" }],
    ["FDOTStreetMastRight", "Mast arm", "700-050", "Right", "mast", { side: "right" }],
    ["FDOTStreetBracketLeft", "Separate mast arm", "700-050", "Left", "mast", { side: "left", separateArm: true }],
    ["FDOTStreetBracketRight", "Separate mast arm", "700-050", "Right", "mast", { side: "right", separateArm: true }],
    ["FDOTStreetWire", "Span wire with arm", "700-050", "Overhead", "wire", { street: true }],
    ["FDOTSpanWireA", "Direct span wire", "659-010", "Overhead", "wire", { attachment: "A" }],
    ["FDOTSpanWireBC", "Span wire with wind beams", "659-010", "Overhead", "wire", { attachment: "BC" }],
    ["FDOTSpanWireD", "Span wire with hangers", "659-010", "Overhead", "wire", { attachment: "D" }],
    // Tampa monotubes: one tube rises from each upright and turns into the span.
    // THEA specifies mitered corners (East Selmon); the curved style uses an
    // adjustable bend radius, since no Tampa sheet for it was found.
    ["TampaMonotubeSpanCurved", "Monotube span, curved corners", "Tampa", "Overhead", "monotube", { corners: "curved", group: "Tampa" }],
    ["TampaMonotubeSpanMitered", "Monotube span, mitered corners", "THEA", "Overhead", "monotube", { corners: "mitered", group: "Tampa" }],
    ["TampaMonotubeCantileverCurvedLeft", "Monotube cantilever, curved corner", "Tampa", "Left", "monotube", { side: "left", corners: "curved", group: "Tampa" }],
    ["TampaMonotubeCantileverCurvedRight", "Monotube cantilever, curved corner", "Tampa", "Right", "monotube", { side: "right", corners: "curved", group: "Tampa" }],
    ["TampaMonotubeCantileverMiteredLeft", "Monotube cantilever, mitered corner", "THEA", "Left", "monotube", { side: "left", corners: "mitered", group: "Tampa" }],
    ["TampaMonotubeCantileverMiteredRight", "Monotube cantilever, mitered corner", "THEA", "Right", "monotube", { side: "right", corners: "mitered", group: "Tampa" }],
  ];
  const catalog = definitions.map(([id, label, index, position, kind, options = {}]) =>
    ({ id, label, index, position, kind, ...options })
  );
  const byId = new Map();
  const byPosition = new Map();
  for (const support of catalog) {
    byId.set(support.id, support);
    if (!byPosition.has(support.position)) byPosition.set(support.position, []);
    byPosition.get(support.position).push(support);
  }
  const frontViewKinds = new Set(["truss", "monotube", "mast", "wire"]);
  const frontLayout = { height: 30, mountTop: 3.2 };
  const groundLayout = { height: 24, mountTop: 1 };
  const mountHeight = 3;
  // Truss depth (top chord to bottom chord) and target panel length, in rem.
  // The panel count is rounded up so whole panels fill the span.
  const trussDefaults = { depth: 4.35, panelLength: 5 };
  const trussLimits = { depth: [2, 12], panelLength: [2, 15] };
  // Curved monotube corner: bend radius to the tube centerline, in rem.
  const monotubeDefaults = { radius: 3 };
  const monotubeLimits = { radius: [0.5, 10] };
  const clamp = (value, [min, max], fallback) => {
    const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
  };
  const trussSettings = (post) => ({
    depth: clamp(post?.trussDepth, trussLimits.depth, trussDefaults.depth),
    panelLength: clamp(post?.trussPanelLength, trussLimits.panelLength, trussDefaults.panelLength),
  });
  const monotubeSettings = (post) => ({
    radius: clamp(post?.monotubeRadius, monotubeLimits.radius, monotubeDefaults.radius),
  });
  const renderedGeometry = new WeakMap();
  let observedContainer;
  let observer;
  let frame;
  let currentPost;
  let hitContext;

  function containsPoint(layer, x, y) {
    const { left, top, width, height } = layer.getBoundingClientRect();
    if (!layer.naturalWidth || !width || !height || x < left || x >= left + width || y < top || y >= top + height) return false;
    if (!hitContext) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      hitContext = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!hitContext) return false;
    const sourceX = Math.floor((x - left) * layer.naturalWidth / width);
    const sourceY = Math.floor((y - top) * layer.naturalHeight / height);
    // Only the painted support opens the editor, including through open trusses.
    hitContext.clearRect(0, 0, 1, 1);
    hitContext.drawImage(layer, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
    return hitContext.getImageData(0, 0, 1, 1).data[3] > 0;
  }

  let colorContext;
  function rgbOf(color) {
    colorContext ||= document.createElement("canvas").getContext("2d");
    if (!colorContext) return [128, 128, 128];
    colorContext.fillStyle = "#000";
    colorContext.fillStyle = color || "#000";
    const value = colorContext.fillStyle;
    if (value[0] === "#") return [1, 3, 5].map((i) => parseInt(value.slice(i, i+2), 16));
    return (value.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  }

  function mixColor(a, b, amount) {
    const from = rgbOf(a);
    const to = rgbOf(b);
    return `rgb(${from.map((v, i) => Math.round(v+(to[i]-v)*amount)).join(",")})`;
  }

  function prepare(post, container, panels) {
    currentPost = post;
    const support = byId.get(post.polePosition);
    container.classList.toggle("fdotSupportContainer", !!support);
    if (support) {
      const overhead = frontViewKinds.has(support.kind);
      const { height, mountTop } = overhead ? frontLayout : groundLayout;
      const left = overhead && support.side !== "right" ? 5.5 : 1;
      const right = overhead && support.side !== "left" ? 5.5 : 1;
      const bottom = height - mountTop - mountHeight;
      container.style.height = `${height}rem`;
      container.style.padding = `0 ${right}rem ${bottom}rem ${left}rem`;
      panels.style.background = "none";
    } else {
      container.style.padding = "";
      container.style.height = "";
      container.querySelector(".fdotSupport")?.remove();
      observer?.disconnect();
      observer = null;
      observedContainer = null;
      cancelAnimationFrame(frame);
      return;
    }
    if (observedContainer !== panels && typeof ResizeObserver === "function") {
      observer?.disconnect();
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => render(currentPost, container, panels));
      });
      observer.observe(panels);
      observedContainer = panels;
    }
  }

  function render(post, container, panels) {
    const support = byId.get(post?.polePosition);
    let layer = container.querySelector(".fdotSupport");
    if (!support) {
      layer?.remove();
      return;
    }
    if (!layer) {
      layer = document.createElement("img");
      layer.className = "fdotSupport";
      layer.alt = "";
      layer.setAttribute("aria-hidden", "true");
      layer.draggable = false;
      container.insertBefore(layer, container.firstChild);
    }
    const display = post.showPost || post.thickness === 0 ? "none" : "block";
    if (layer.style.display !== display) layer.style.display = display;
    if (display === "none") return;

    const frontView = frontViewKinds.has(support.kind);
    const { height: h, mountTop: py } = frontView ? frontLayout : groundLayout;
    const ph = mountHeight;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const width = container.offsetWidth;
    const w = width / rem;
    const containerRect = container.getBoundingClientRect();
    const scale = width ? containerRect.width / width || 1 : 1;
    let faceLeft = Infinity;
    let faceRight = -Infinity;
    for (const face of panels.querySelectorAll(".sign")) {
      const rect = face.getBoundingClientRect();
      if (rect.width <= 0) continue;
      faceLeft = Math.min(faceLeft, rect.left);
      faceRight = Math.max(faceRight, rect.right);
    }
    const px = Number.isFinite(faceLeft) ? (faceLeft-containerRect.left)/scale/rem : panels.offsetLeft/rem;
    const pw = Number.isFinite(faceRight) ? (faceRight-faceLeft)/scale/rem : panels.offsetWidth/rem;
    // Read layout dimensions, which remain stable when the mobile preview is scaled.
    const t = Math.min(2.5, Math.max(0.08, post.thickness));
    const style = getComputedStyle(container);
    const mid = style.getPropertyValue("--post-color-mid").trim();
    const light = style.getPropertyValue("--post-color-light").trim();
    const dark = style.getPropertyValue("--post-color-dark").trim();
    const n = (v) => Number(v.toFixed(3));
    const truss = trussSettings(post);
    const monotube = monotubeSettings(post);
    const geometry = [support.id, width, rem, px, pw, t, mid, light, dark, truss.depth, truss.panelLength, monotube.radius].join("|");
    if (renderedGeometry.get(layer) === geometry) return;
    // Depth tones: near members are lighter, far members darker.
    const tone = (id, hi, base, lo) => ({ id, hi, base, lo, edge: mixColor(lo, "#000", 0.25) });
    const tones = {
      near: tone("near", mixColor(light, "#fff", 0.45), mixColor(mid, light, 0.6), mid),
      middle: tone("middle", mid, mixColor(mid, dark, 0.35), mixColor(mid, dark, 0.8)),
      far: tone("far", mixColor(mid, dark, 0.45), mixColor(mid, dark, 0.85), mixColor(dark, "#000", 0.35)),
    };
    const parts = [];
    const rect = (x, y, width, height, fill = "url(#metal)", extra = "") =>
      parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, width))}" height="${n(Math.max(0, height))}" fill="${fill}" ${extra}/>`);
    const path = (d, fill = "none", stroke = dark, width = 0.06, extra = "") =>
      parts.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${n(width)}" stroke-linejoin="round" ${extra}/>`);
    const bar = (x1, y1, x2, y2, width, fill = "url(#metalHorizontal)") => {
      const length = Math.hypot(x2 - x1, y2 - y1);
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      rect(0, -width / 2, length, width, fill,
        `rx="${n(width * 0.14)}" stroke="${dark}" stroke-width="0.035" transform="translate(${n(x1)} ${n(y1)}) rotate(${n(angle)})"`);
    };
    const bolt = (x, y, r = 0.075) => {
      parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${dark}" stroke="${light}" stroke-width="0.035"/>`);
    };
    const plate = (x, y, width, depth = 0.24) => {
      if (frontView) {
        rect(x-width/2, y-0.12, width, 0.25, "url(#metalHorizontal)");
        for (const dir of [-1, 1]) {
          rect(x+dir*width*0.36-0.04, y-0.26, 0.08, 0.26, mid);
          rect(x+dir*width*0.36-0.09, y-0.22, 0.18, 0.09, dark);
        }
        return;
      }
      path(`M${n(x-width/2)} ${n(y)} l${n(depth)} ${n(-depth)} h${n(width)} l${n(-depth)} ${n(depth)} Z`, light);
      rect(x-width/2, y, width, 0.13, dark);
      bolt(x-width*0.36, y-0.06);
      bolt(x+width*0.36, y-0.06);
    };
    const foundation = (x, y, width) => {
      rect(x-width/2, y, width, 0.52, "url(#concrete)", 'rx="0.08"');
      if (frontView) bar(x-width/2, y, x+width/2, y, 0.035, "#aaa9a2");
      else parts.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(width/2)}" ry="0.18" fill="#e3e3df" stroke="#aaa9a2" stroke-width="0.04"/>`);
    };
    const base = (x, y, width, type = "anchor") => {
      foundation(x, y+0.15, width*2.1);
      if (type === "anchor") {
        for (const dir of [-1, 1]) {
          path(`M${n(x+dir*width/2)} ${n(y-1.1)} L${n(x+dir*width)} ${n(y)} L${n(x+dir*width/2)} ${n(y)} Z`, mid);
        }
      } else {
        rect(x-width*0.6, y-0.8, width*1.2, 0.65);
        bolt(x, y-0.58);
        if (type === "bolted") bolt(x, y-0.24);
        plate(x, y-0.12, width*2.2);
      }
      plate(x, y, width*2.2);
    };
    const column = (x, y, bottom, width, type) => {
      rect(x-width/2, y, width, bottom-y, "url(#metal)", 'rx="0.07"');
      if (frontView) rect(x-width/2-0.03, y-0.045, width+0.06, 0.09, "url(#metalHorizontal)");
      else parts.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(width/2)}" ry="0.09" fill="${light}" stroke="${dark}" stroke-width="0.035"/>`);
      if (type) base(x, bottom, width, type);
    };
    const windBeams = (left, right, top, bottom, hangers = true) => {
      const beam = Math.max(0.14, t*0.2);
      for (const y of [top, bottom]) bar(left, y, right, y, beam);
      if (hangers) {
        const count = Math.max(2, Math.ceil((right-left)/8));
        for (let i=0; i<count; i++) {
          const x = left + (right-left)*(i+0.5)/count;
          bar(x, top-0.45, x, bottom+0.45, beam);
          bolt(x, top); bolt(x, bottom);
        }
      }
    };
    const left = 2.4;
    const right = w-2.4;
    const bottom = h-0.9;
    const signBottom = py+ph;

    if (["round", "offset", "multi", "barrierSide", "barrierTop"].includes(support.kind)) {
      const signLeft = px;
      const signRight = px+pw;
      windBeams(signLeft+0.15, Math.max(signLeft+0.3, signRight-0.15), py+ph*0.3, py+ph*0.75, false);
      let xs = [(signLeft+signRight)/2];
      if (support.kind === "offset") xs = [px+pw*(support.side === "left" ? 0.22 : 0.78)];
      if (support.kind === "multi") {
        // 21/58/21% for two columns, 15/35/35/15% for three (700-020 sheet 1).
        const positions = support.columns === 3 ? [0.15, 0.5, 0.85] : [0.21, 0.79];
        xs = positions.map((p) => signLeft+(signRight-signLeft)*p);
      }
      for (const x of xs) {
        if (support.kind === "multi") {
          const width = t*0.8;
          rect(x-width/2, py+0.2, width, bottom-py-0.2, dark);
          rect(x-width*0.16, py+0.2, width*0.32, bottom-py-0.2, light);
          rect(x-width/2, py+0.2, width*0.16, bottom-py-0.2, mid);
          for (const y of [signBottom+0.25, bottom-0.35]) {
            rect(x-width*0.75, y, width*1.5, 0.24, mid);
            bolt(x-width*0.52, y+0.12); bolt(x+width*0.52, y+0.12);
          }
          base(x, bottom, width, "welded");
        } else if (support.kind === "barrierTop" || support.kind === "barrierSide") {
          const barrierTop = bottom-3.2;
          const bx = support.kind === "barrierSide" ? x-2.2 : x;
          path(`M${n(bx-1.8)} ${n(bottom+0.4)} L${n(bx-0.6)} ${n(barrierTop)} H${n(bx+0.6)} L${n(bx+1.8)} ${n(bottom+0.4)} Z`, "url(#concrete)", "#aaa9a2");
          path(`M${n(bx+0.6)} ${n(barrierTop)} l0.45 -0.22 l1.2 3.6 l-0.45 0.22 Z`, "#a6a6a0", "#999992");
          const end = support.kind === "barrierTop" ? barrierTop : bottom-0.5;
          column(x, py+0.1, end, t*0.65);
          if (support.kind === "barrierTop") plate(x, end, t*1.7);
          else for (const y of [barrierTop+1.5, bottom-0.7]) {
            bar(bx+0.65, y, x, y, 0.2);
            rect(bx+0.56, y-0.25, 0.16, 0.5, dark);
            bolt(bx+0.62, y-0.14); bolt(bx+0.62, y+0.14);
            rect(x-t*0.45, y-0.08, t*0.9, 0.16);
          }
        } else column(x, py+0.15, bottom, t*(support.base || support.kind === "offset" ? 0.65 : 0.4), support.base || (support.kind === "offset" ? "bolted" : null));
      }
    } else if (support.kind === "truss") {
      // 700-040/041 sheets 3-4: a triangular three-chord truss. The two front chords
      // sit C apart, and the back chord is behind them at mid-depth (30° side elevation).
      // Seen head on, the back chord and the inclined-face webs show through the
      // front panels. Shading darkens with distance from the viewer.
      const top = 1.15;
      const lower = top+truss.depth;
      const back = (top+lower)/2;
      const chord = t*0.46;
      const web = Math.max(0.11, t*0.2);
      const targetCount = Math.max(support.side ? 1 : 2, Math.ceil((right-left)/truss.panelLength));
      // Use an even panel count for a symmetric span elevation (700-041 sheet 4).
      const count = support.side ? targetCount : Math.ceil(targetCount/2)*2;
      const bay = (right-left)/count;
      const uprights = support.side ? [support.side === "left" ? left : right] : [left, right];
      const isUpright = (x) => uprights.some((u) => Math.abs(u-x) < 0.01);
      // Chords run 'OD/2 + 1"' past an upright centerline and 7" past a truss plug.
      const ends = [left, right].map((x, i) => x+(i ? 1 : -1)*(isUpright(x) ? t/2+0.08 : 0.18));
      const plate = (x, y, width, height, tone) =>
        rect(x-width/2, y-height/2, width, height, tone.base, `stroke="${tone.edge}" stroke-width="0.025"`);
      const nodeBolt = (x, y, tone, r = 0.05) =>
        parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${tone.lo}" stroke="${tone.hi}" stroke-width="0.02"/>`);
      const member = (x1, y1, x2, y2, width, tone, kind = "angle") => {
        const length = Math.hypot(x2-x1, y2-y1);
        const angle = Math.atan2(y2-y1, x2-x1)*180/Math.PI;
        rect(0, -width/2, length, width, `url(#${kind}-${tone.id})`,
          `rx="${n(kind === "pipe" ? width*0.12 : 0.01)}" stroke="${tone.edge}" stroke-width="0.03" transform="translate(${n(x1)} ${n(y1)}) rotate(${n(angle)})"`);
      };
      const panelPoints = Array.from({ length: count+1 }, (_, i) => left+i*bay);

      parts.push(`<g data-fdot-part="truss" data-panels="${count}" data-depth="${n(lower-top)}">`);
      // Farthest: the back chord, its end plates and its web gussets.
      parts.push('<g data-fdot-part="back-chord">');
      for (const x of uprights) {
        const outward = x === left ? -1 : 1;
        plate(x-outward*0.25*chord, back, t+chord*1.5, 0.09, tones.far);
      }
      member(ends[0], back, ends[1], back, chord, tones.far, "pipe");
      for (const x of panelPoints) if (!isUpright(x)) plate(x, back, 0.5, 0.3, tones.far);
      parts.push('</g>');
      // Middle: Warren webs in the top and bottom inclined faces (Section B-B / C-C).
      // They meet the back chord at panel points and the front chords at mid-panel.
      parts.push('<g data-fdot-part="inclined-webs">');
      for (let i=0; i<count; i++) {
        const xm = left+(i+0.5)*bay;
        for (const y of [top, lower]) {
          member(panelPoints[i], back, xm, y, web, tones.middle);
          member(xm, y, panelPoints[i+1], back, web, tones.middle);
          plate(xm, y+(y === top ? 0.14 : -0.14), 0.55, 0.22, tones.middle);
        }
      }
      parts.push('</g>');
      // The upright centerline is between the front and back chords (sheet 3).
      uprights.forEach((x) => column(x, top-0.75, bottom, t, "anchor"));
      // Upright-truss connections: chord plates seen edge-on, with bolts and TE gussets.
      parts.push('<g data-fdot-part="upright-connections">');
      for (const x of uprights) {
        const outward = x === left ? -1 : 1;
        for (const sign of [-1, 1]) {
          const gx = x+sign*t*0.16;
          rect(gx-0.03, top-0.72, 0.06, 0.66, tones.near.lo);
          rect(gx-0.03, lower+0.06, 0.06, 1.1, tones.near.lo);
        }
        for (const y of [top, lower]) {
          const width = t+chord*1.5;
          const cx = x-outward*0.25*chord;
          rect(cx-width/2, y-chord/2-0.1, width, 0.1, `url(#plate-${tones.near.id})`, `stroke="${tones.near.edge}" stroke-width="0.02"`);
          rect(cx-width/2, y+chord/2, width, 0.1, `url(#plate-${tones.near.id})`, `stroke="${tones.near.edge}" stroke-width="0.02"`);
          for (let b=0; b<5; b++) {
            const bx = x+(b-2)*t*0.13;
            rect(bx-0.025, y-chord/2-0.2, 0.05, chord+0.4, tones.near.lo);
            for (const ny of [y-chord/2-0.2, y+chord/2+0.12]) rect(bx-0.06, ny, 0.12, 0.08, tones.near.base, `stroke="${tones.near.edge}" stroke-width="0.015"`);
          }
        }
      }
      parts.push('</g>');
      // Nearest: the front face, with verticals at the panel points and one diagonal
      // per panel. Cantilever diagonals rise toward the upright; span diagonals reverse
      // at midspan. Upright ends have no vertical (detail J / H).
      parts.push('<g data-fdot-part="front-face">');
      for (let i=0; i<count; i++) {
        const x = panelPoints[i];
        const risesRight = support.side ? support.side === "right" : i >= count/2;
        member(x, risesRight ? lower : top, x+bay, risesRight ? top : lower, web, tones.near);
      }
      for (const x of panelPoints) {
        if (!isUpright(x)) member(x, lower, x, top, web, tones.near);
        for (const y of [top, lower]) {
          const dir = y === top ? 1 : -1;
          plate(x, y+dir*0.2, 0.6, 0.4, tones.near);
          nodeBolt(x-0.15, y+dir*0.26, tones.near);
          nodeBolt(x+0.15, y+dir*0.26, tones.near);
        }
      }
      member(ends[0], top, ends[1], top, chord, tones.near, "pipe");
      member(ends[0], lower, ends[1], lower, chord, tones.near, "pipe");
      // Truss plugs close the free chord ends.
      for (const [i, x] of [left, right].entries()) {
        if (isUpright(x)) continue;
        for (const y of [top, back, lower]) {
          const tone = y === back ? tones.far : tones.near;
          rect(ends[i]-(i ? 0.07 : 0), y-chord*0.58, 0.07, chord*1.16, tone.lo, `stroke="${tone.edge}" stroke-width="0.02"`);
        }
      }
      parts.push('</g>');
      parts.push('</g>');
      windBeams(px+0.65, px+pw-0.65, py+ph*0.25, py+ph*0.78);
      if (support.catwalk) {
        // The access bay is next to the DMS face, with a grated floor and three rails.
        const start = support.side === "left" ? left+0.6 : px+pw+0.2;
        const end = support.side === "left" ? px-0.2 : right-0.6;
        const floor = Math.max(lower+0.8, signBottom+0.45);
        rect(start, floor-0.12, end-start, 0.24, "url(#metalHorizontal)");
        for(let x=start+0.08; x<end; x+=0.2) rect(x, floor-0.1, 0.035, 0.2, dark);
        for(const x of [start, end]) bar(x, floor-2.6, x, floor+0.15, 0.13);
        for(const y of [floor-2.6, floor-1.6, floor-0.7, floor]) bar(start, y, end, y, 0.12);
        for(const x of [start, end]) bar(x, lower, x, floor+0.3, 0.16);
      }
      if (support.lighting) {
        const count = Math.max(1, Math.ceil(pw/8));
        for(let i=0; i<count; i++) {
          const x = px+pw*(i+0.5)/count;
          bar(x, signBottom-0.3, x, signBottom+1.5, 0.12);
          rect(x-0.45, signBottom+1.1, 0.9, 0.42, "url(#metalHorizontal)", 'rx="0.06"');
          rect(x-0.36, signBottom+1.19, 0.72, 0.24, light, 'rx="0.03"');
        }
      }
    } else if (support.kind === "monotube") {
      // One tube per upright, turning into the horizontal span. The sign hangs on
      // wind beams in front of the tube, about a third of the way down its face.
      const tube = Math.max(0.35, t*0.9);
      const beamY = py+ph*0.35;
      const uprights = support.side ? [support.side === "left" ? left : right] : [left, right];
      const signLeft = px, signRight = px+pw;
      // A cantilever's free end stops a little past the sign, then is capped.
      const freeEnd = support.side === "left" ? Math.min(w-0.3, signRight+0.6)
        : support.side === "right" ? Math.max(0.3, signLeft-0.6) : null;
      const curved = support.corners === "curved";
      const radius = curved ? Math.max(tube*0.6, Math.min(monotube.radius, (bottom-beamY)/2,
        support.side ? Math.abs(freeEnd-uprights[0])*0.8 : (right-left)/2)) : 0;
      const corner = (x, inward) => curved
        ? `L${n(x)} ${n(beamY+radius)} A${n(radius)} ${n(radius)} 0 0 ${inward > 0 ? 1 : 0} ${n(x+inward*radius)} ${n(beamY)}`
        : `L${n(x)} ${n(beamY)}`;
      let d;
      if (support.side === "left") d = `M${n(left)} ${n(bottom)} ${corner(left, 1)} L${n(freeEnd)} ${n(beamY)}`;
      else if (support.side === "right") d = `M${n(right)} ${n(bottom)} ${corner(right, -1)} L${n(freeEnd)} ${n(beamY)}`;
      else {
        const back = curved
          ? `L${n(right-radius)} ${n(beamY)} A${n(radius)} ${n(radius)} 0 0 1 ${n(right)} ${n(beamY+radius)}`
          : `L${n(right)} ${n(beamY)}`;
        d = `M${n(left)} ${n(bottom)} ${corner(left, 1)} ${back} L${n(right)} ${n(bottom)}`;
      }
      // Tube shading that follows bends: dark edge, body, then a centered highlight.
      parts.push('<g data-fdot-part="monotube" fill="none" stroke-linejoin="miter" stroke-miterlimit="4" stroke-linecap="butt">');
      parts.push(`<path d="${d}" stroke="${dark}" stroke-width="${n(tube)}"/>`);
      parts.push(`<path d="${d}" stroke="${mid}" stroke-width="${n(tube*0.82)}"/>`);
      parts.push(`<path d="${d}" stroke="${light}" stroke-width="${n(tube*0.28)}" stroke-opacity="0.85"/>`);
      parts.push('</g>');
      if (!curved) {
        // Mitered joints: the weld seam runs from the outer to the inner corner.
        for (const x of uprights) {
          const inward = x === left ? 1 : -1;
          path(`M${n(x-inward*tube/2)} ${n(beamY-tube/2)} L${n(x+inward*tube/2)} ${n(beamY+tube/2)}`, "none", dark, 0.05);
        }
      }
      if (freeEnd !== null) {
        const cap = support.side === "left" ? freeEnd : freeEnd-0.12;
        rect(cap, beamY-tube*0.55, 0.12, tube*1.1, dark, 'rx="0.04"');
      }
      for (const x of uprights) {
        // Hand hole near the base, then the anchored base plate.
        rect(x-tube*0.18, bottom-2.2, tube*0.36, 0.7, dark, 'rx="0.08"');
        base(x, bottom, tube, "anchor");
      }
      windBeams(signLeft+0.65, signRight-0.65, py+ph*0.25, py+ph*0.78);
    } else if (support.kind === "mast") {
      const x = support.side === "left" ? left : right;
      const end = support.side === "left" ? right : left;
      column(x, 0.7, bottom, t, "anchor");
      const y = support.separateArm ? 2.5 : 1.25;
      path(`M${n(x)} ${n(y-t*0.32)} L${n(end)} ${n(y-0.07)} V${n(y+0.07)} L${n(x)} ${n(y+t*0.32)} Z`, "url(#metalHorizontal)");
      rect(x-t*0.7, y-0.4, t*1.4, 0.8);
      if (support.separateArm) {
        bar(x, 1, end, 1.1, t*0.45);
        bar(x, y-1.2, x+(end-x)*0.55, y, 0.13);
      }
      for(const hx of [px+pw*0.25, px+pw*0.75]) {
        bar(hx, y, hx, py+0.35, 0.12);
        bolt(hx, y, 0.12);
        rect(hx-0.2, py-0.07, 0.4, 0.2, dark);
      }
    } else if (support.kind === "wire") {
      for(const x of [left, right]) column(x, 0.6, bottom, t*0.85, "anchor");
      path(`M${n(left)} 1.1 Q${n(w/2)} 3.0 ${n(right)} 1.1`, "none", dark, 0.065);
      bar(left, 2.7, right, 2.7, 0.06, mid);
      if (support.street) {
        const x = right;
        bar(x, 3, px+0.5, 3, 0.22);
        bar(x, 1.8, px+0.5, 3, 0.1);
        for(const hx of [px+pw*0.25, px+pw*0.75]) bar(hx, 3, hx, py+0.25, 0.12);
      } else {
        const hangers = support.attachment === "A" ? 1 : Math.max(2, Math.ceil(pw/7));
        for(let i=0;i<hangers;i++) {
          const x = px+pw*(i+0.5)/hangers;
          const ratio = (x-left)/(right-left);
          const wireY = 1.1+3.8*ratio*(1-ratio);
          bar(x, wireY, x, support.attachment === "D" ? py+0.25 : signBottom-0.2, 0.09);
          bolt(x, wireY, 0.1); bolt(x, 2.7, 0.1);
          if (support.attachment === "D") {
            rect(x-0.13, 2.9, 0.26, Math.max(0.2, py-2.9), mid);
            bolt(x, 3.05); bolt(x, 3.25);
          }
        }
        if(support.attachment !== "D") windBeams(px+0.65, px+pw-0.65, py+ph*0.3, py+ph*0.8, false);
      }
    }

    const toneDefs = support.kind === "truss" ? Object.values(tones).map(({ id, hi, base, lo }) =>
      `<linearGradient id="pipe-${id}" x2="0" y2="1"><stop stop-color="${base}"/><stop offset="0.3" stop-color="${hi}"/><stop offset="0.6" stop-color="${base}"/><stop offset="1" stop-color="${lo}"/></linearGradient>` +
      `<linearGradient id="angle-${id}" x2="0" y2="1"><stop stop-color="${hi}"/><stop offset="0.24" stop-color="${hi}"/><stop offset="0.24" stop-color="${lo}"/><stop offset="0.34" stop-color="${base}"/><stop offset="1" stop-color="${base}"/></linearGradient>` +
      `<linearGradient id="plate-${id}" x2="0" y2="1"><stop stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>`
    ).join("") : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-view="${frontView ? "front" : "shaded-elevation"}" width="${width}" height="${h*rem}" viewBox="0 0 ${w} ${h}"><defs>${toneDefs}<linearGradient id="metal"><stop stop-color="${mid}"/><stop offset="0.35" stop-color="${light}"/><stop offset="0.6" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="metalHorizontal" x2="0" y2="1"><stop stop-color="${light}"/><stop offset="0.5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="concrete"><stop stop-color="#d8d8d2"/><stop offset="0.6" stop-color="#c9c9c2"/><stop offset="1" stop-color="#a8a8a1"/></linearGradient></defs>${parts.join("")}</svg>`;
    layer.setAttribute("src", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    layer.dataset.fdotIndex = support.index;
    layer.style.width = `${width}px`;
    layer.style.height = `${h}rem`;
    renderedGeometry.set(layer, geometry);
  }

  return { catalog, get: (id) => byId.get(id), forPosition: (position) => byPosition.get(position), prepare, render, containsPoint,
    trussDefaults, trussLimits, trussSettings, monotubeDefaults, monotubeLimits, monotubeSettings };
})();

Post.prototype.polePositions.push(
  ...window.SignMakerFDOTSupports.catalog.map(({ id }) => id)
);
