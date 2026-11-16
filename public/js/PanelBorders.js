/* The panel reserves space outside its inner border for the extended face.
 * Connected faces share their seams; only exposed edges extend into that space.
 * Row colors use the same measured regions as the inner sign paint.
 */
const PanelBorders = (() => {
  const fills = new WeakMap();
  const faceIds = new WeakMap();
  let nextFaceId = 0;
  const number = value => Math.round(value * 1000) / 1000;
  const xml = value => String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
  const transparent = value => !value || value === 'transparent' || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(value) || /\/\s*0(?:\.0+)?\s*\)$/.test(value);
  const radiusNames = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];

  function roundedPath(x, y, width, height, corners) {
    const [a, b, c, d] = corners.map(value => ({
      x: Math.min(Math.max(0, typeof value === 'number' ? value : value.x), width / 2),
      y: Math.min(Math.max(0, typeof value === 'number' ? value : value.y), height / 2),
    }));
    const right = x + width, bottom = y + height;
    return `M${number(x + a.x)} ${number(y)}H${number(right - b.x)}A${number(b.x)} ${number(b.y)} 0 0 1 ${number(right)} ${number(y + b.y)}V${number(bottom - c.y)}A${number(c.x)} ${number(c.y)} 0 0 1 ${number(right - c.x)} ${number(bottom)}H${number(x + d.x)}A${number(d.x)} ${number(d.y)} 0 0 1 ${number(x)} ${number(bottom - d.y)}V${number(y + a.y)}A${number(a.x)} ${number(a.y)} 0 0 1 ${number(x + a.x)} ${number(y)}Z`;
  }

  // Interior transitions keep their exact position. Only colors touching an
  // exterior edge extend with that edge's panel material.
  function extendFill(rect, width, height, thickness, edges = {left:thickness, top:thickness, right:thickness, bottom:thickness}) {
    const left = rect.left <= 1.5 ? -edges.left || 0 : rect.left;
    const top = rect.top <= 1.5 ? -edges.top || 0 : rect.top;
    const right = rect.left + rect.width >= width - 1.5 ? width + edges.right : rect.left + rect.width;
    const bottom = rect.top + rect.height >= height - 1.5 ? height + edges.bottom : rect.top + rect.height;
    return { left, top, width: right - left, height: bottom - top };
  }

  function exposedEdges(surface, surfaces, thickness) {
    const epsilon = 0.01;
    const covers = (intervals, start, end) => {
      let covered = start;
      for (const [left, right] of intervals.sort((a,b) => a[0] - b[0])) {
        if (left > covered + epsilon) break;
        covered = Math.max(covered, right);
      }
      return covered >= end - epsilon;
    };
    const edges = {};
    for (const edge of ['left','top','right','bottom']) {
      const horizontal = edge === 'top' || edge === 'bottom';
      const start = horizontal ? surface.x : surface.y;
      const end = start + (horizontal ? surface.width : surface.height);
      const intervals = surfaces.filter(other => {
        if (other === surface) return false;
        if (edge === 'top') return other.y < surface.y - epsilon && other.y + other.height >= surface.y - epsilon;
        if (edge === 'bottom') return other.y + other.height > surface.y + surface.height + epsilon && other.y <= surface.y + surface.height + epsilon;
        if (edge === 'left') return other.x < surface.x - epsilon && other.x + other.width >= surface.x - epsilon;
        return other.x + other.width > surface.x + surface.width + epsilon && other.x <= surface.x + surface.width + epsilon;
      }).map(other => horizontal ? [other.x,other.x + other.width] : [other.y,other.y + other.height]);
      edges[edge] = covers(intervals,start,end) ? 0 : thickness;
    }
    return edges;
  }

  function svgForSurfaces(surfaces, thickness, bounds, idPrefix = '') {
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${number(bounds.width)}" height="${number(bounds.height)}" viewBox="${number(bounds.left)} ${number(bounds.top)} ${number(bounds.width)} ${number(bounds.height)}" preserveAspectRatio="none">`];
    surfaces.forEach((surface, index) => {
      const { x, y, width, height, corners, color, regions } = surface;
      const edges = exposedEdges(surface, surfaces, thickness);
      const expandedCorners = surface.roundOuter === false ? [0,0,0,0] : corners.map((value, corner) => value ? {
        x: value + (corner === 0 || corner === 3 ? edges.left : edges.right),
        y: value + (corner < 2 ? edges.top : edges.bottom),
      } : 0);
      const outer = roundedPath(x - edges.left, y - edges.top, width + edges.left + edges.right, height + edges.top + edges.bottom, expandedCorners);
      const id = idPrefix + 'face' + index;
      parts.push(`<defs><clipPath id="${id}"><path d="${outer}"/></clipPath></defs><g clip-path="url(#${id})"><path d="${outer}" fill="${xml(color)}"/>`);
      for (const region of regions) {
        const rect = extendFill(region.rect, width, height, thickness, edges);
        parts.push(`<rect x="${number(x + rect.left)}" y="${number(y + rect.top)}" width="${number(rect.width)}" height="${number(rect.height)}" fill="${xml(region.color)}"/>`);
      }
      parts.push('</g>');
    });
    parts.push('</svg>');
    return parts.join('');
  }

  const recordFills = (element, regions = []) => fills.set(element, regions);
  const layoutSize = (element, computed, axis) => {
    const size = parseFloat(computed[axis]);
    const edges = axis === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
    return Number.isFinite(size) ? size + (computed.boxSizing === 'border-box' ? 0 :
      edges.reduce((sum, edge) => sum + (parseFloat(computed['padding' + edge]) || 0) +
        (parseFloat(computed['border' + edge + 'Width']) || 0), 0)) :
      element[axis === 'width' ? 'offsetWidth' : 'offsetHeight'];
  };

  function bodyBounds(container) {
    const rect = container.getBoundingClientRect(), panel = container.closest('.panel');
    if (!panel?.classList.contains('hasPanelOuterBorder')) return rect;
    const style = getComputedStyle(container);
    const scaleX = rect.width / layoutSize(container, style, 'width') || 1;
    const scaleY = rect.height / layoutSize(container, style, 'height') || scaleX;
    const extra = (parseFloat(panel.style.getPropertyValue('--panelOuterBorderWidth')) || 0) *
      (parseFloat(getComputedStyle(document.documentElement).fontSize) || 20);
    return {left:rect.left-extra*scaleX, right:rect.right+extra*scaleX,
      top:rect.top-extra*scaleY, bottom:rect.bottom+extra*scaleY,
      width:rect.width+2*extra*scaleX, height:rect.height+2*extra*scaleY};
  }

  function refresh(panel) {
    const existing = panel.querySelector(':scope > .panelOuterFace');
    const thickness = (parseFloat(panel.style.getPropertyValue('--panelOuterBorderWidth')) || 0) *
      (parseFloat(getComputedStyle(document.documentElement).fontSize) || 20);
    if (!panel.classList.contains('hasPanelOuterBorder') || !thickness || !panel.isConnected) {
      existing?.remove();
      return;
    }
    const panelRect = panel.getBoundingClientRect();
    const panelStyle = getComputedStyle(panel);
    const scaleX = panelRect.width / layoutSize(panel, panelStyle, 'width') || 1;
    const scaleY = panelRect.height / layoutSize(panel, panelStyle, 'height') || scaleX;
    const surfaces = [];
    for (const element of panel.querySelectorAll('.signContainer > .sign,.signContainer > .guideArrows,.signContainer > .aplArrows,.exitTab')) {
      if (element.closest('.panel') !== panel || element.classList.contains('transparentAsset')) continue;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height) continue;
      const width = rect.width / scaleX, height = rect.height / scaleY;
      let color = style.backgroundColor;
      for (let parent = element.parentElement; transparent(color) && parent && parent !== panel; parent = parent.parentElement) color = getComputedStyle(parent).backgroundColor;
      if (transparent(color)) color = panel.style.getPropertyValue('--panelFillColor') || '#005a4a';
      const regions = [...(fills.get(element) || [])];
      for (const lane of element.querySelectorAll('.modernExitColoredLane,.modernExitPlainLane')) {
        const laneColor = getComputedStyle(lane).backgroundColor;
        if (transparent(laneColor)) continue;
        const box = lane.getBoundingClientRect();
        regions.push({color: laneColor, rect: {left: (box.left - rect.left) / scaleX, top: (box.top - rect.top) / scaleY, width: box.width / scaleX, height: box.height / scaleY}});
      }
      surfaces.push({x: (rect.left - panelRect.left) / scaleX, y: (rect.top - panelRect.top) / scaleY, width, height,
        corners: radiusNames.map(name => parseFloat(style[name]) || 0), roundOuter:panel.classList.contains('round'), color, regions});
    }
    if (!surfaces.length) { existing?.remove(); return; }
    const left = Math.min(...surfaces.map(surface => surface.x)) - thickness;
    const top = Math.min(...surfaces.map(surface => surface.y)) - thickness;
    const right = Math.max(...surfaces.map(surface => surface.x + surface.width)) + thickness;
    const bottom = Math.max(...surfaces.map(surface => surface.y + surface.height)) + thickness;
    const bounds = {left, top, width: right - left, height: bottom - top};
    if (!faceIds.has(panel)) faceIds.set(panel, `panelFace${++nextFaceId}-`);
    const source = svgForSurfaces(surfaces, thickness, bounds, faceIds.get(panel));
    const face = existing || document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Keep the paint in the same vector coordinate space as the sign. An img
    // introduces its own intrinsic viewport rounding at fractional sizes.
    face.setAttribute('class', 'panelOuterFace');
    face.setAttribute('aria-hidden', 'true');
    face.setAttribute('focusable', 'false');
    face.setAttribute('preserveAspectRatio', 'none');
    face.setAttribute('viewBox', `${number(bounds.left)} ${number(bounds.top)} ${number(bounds.width)} ${number(bounds.height)}`);
    face.setAttribute('width', number(bounds.width));
    face.setAttribute('height', number(bounds.height));
    const paint = source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>'));
    if (face._panelFacePaint !== paint) {
      face.innerHTML = paint;
      face._panelFacePaint = paint;
    }
    for (const key of ['left', 'top', 'width', 'height']) face.style[key] = number(bounds[key]) + 'px';
    if (!existing) panel.prepend(face);
  }

  function refreshAll(root) {
    if (root.classList?.contains('panel')) refresh(root);
    for (const panel of root.querySelectorAll('.panel')) refresh(panel);
  }
  return { recordFills, refreshAll, roundedPath, extendFill, exposedEdges, svgForSurfaces, bodyBounds };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PanelBorders;
