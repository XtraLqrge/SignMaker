/* Visual elevations based on FDOT FY 2026-27 Standard Plans.
 * See docs/fdot-supports.md for the drawing/sheet behind each family.
 * Overhead geometry follows the orthographic front elevations, with material shading.
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
  const frontViewKinds = new Set(["truss", "mast", "wire"]);
  const frontLayout = { height: 30, mountTop: 3.2 };
  const groundLayout = { height: 24, mountTop: 1 };
  const mountHeight = 3;
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
    const geometry = [support.id, width, rem, px, pw, t, mid, light, dark].join("|");
    if (renderedGeometry.get(layer) === geometry) return;
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
      const top = 1.15;
      const lower = 5.5;
      const chord = t*0.46;
      const web = Math.max(0.1, t*0.16);
      const targetCount = Math.max(3, Math.ceil((right-left)/5));
      // Use an even panel count for a symmetric span elevation (700-041 sheet 4).
      const count = support.side ? targetCount : Math.ceil(targetCount/2)*2;
      const bay = (right-left)/count;
      const uprights = support.side ? [support.side === "left" ? left : right] : [left, right];
      uprights.forEach((x) => column(x, top-0.5, bottom, t, "anchor"));
      // 700-040/041 sheet 4 explicitly omits out-of-plane members in FRONT ELEVATION.
      // Cantilever diagonals rise toward the upright; span diagonals reverse at midspan.
      // The rear chord and triangular cross section belong to the side view.
      parts.push(`<g data-fdot-part="front-truss" data-panels="${count}" data-depth="${n(lower-top)}">`);
      parts.push('<g data-fdot-part="front-diagonals">');
      for (let i=0; i<count; i++) {
        const x = left+i*bay;
        const risesRight = support.side ? support.side === "right" : i >= count/2;
        bar(x, risesRight ? lower : top, x+bay, risesRight ? top : lower, web);
      }
      parts.push('</g>');
      for (let i=0; i<=count; i++) {
        const x = left+i*bay;
        bar(x, top, x, lower, web);
        for (const y of [top, lower]) {
          rect(x-0.25, y-0.18, 0.5, 0.36, mid);
          bolt(x, y);
        }
      }
      bar(left-0.18, top, right+0.18, top, chord);
      bar(left-0.18, lower, right+0.18, lower, chord);
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

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-view="${frontView ? "front" : "shaded-elevation"}" width="${width}" height="${h*rem}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="metal"><stop stop-color="${mid}"/><stop offset="0.35" stop-color="${light}"/><stop offset="0.6" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="metalHorizontal" x2="0" y2="1"><stop stop-color="${light}"/><stop offset="0.5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="concrete"><stop stop-color="#d8d8d2"/><stop offset="0.6" stop-color="#c9c9c2"/><stop offset="1" stop-color="#a8a8a1"/></linearGradient></defs>${parts.join("")}</svg>`;
    layer.setAttribute("src", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    layer.dataset.fdotIndex = support.index;
    layer.style.width = `${width}px`;
    layer.style.height = `${h}rem`;
    renderedGeometry.set(layer, geometry);
  }

  return { catalog, get: (id) => byId.get(id), forPosition: (position) => byPosition.get(position), prepare, render, containsPoint };
})();

Post.prototype.polePositions.push(
  ...window.SignMakerFDOTSupports.catalog.map(({ id }) => id)
);
