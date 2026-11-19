// Curve relationships are stored on ends, so road cuts rehome them along with
// the original endpoint. They are editing constraints, never traffic links.
(() => {
  const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  function valid(link) {
    return link && typeof link.id === 'string' && link.id.length > 0 &&
      ['parallel', 'mirror'].includes(link.mode) && [-1, 1].includes(link.polarity) &&
      (link.rotation == null || ['same','opposite'].includes(link.rotation)) &&
      ((link.mode !== 'mirror' && link.rotation !== 'opposite') || (Array.isArray(link.axis) && link.axis.length === 2 &&
        link.axis.every(finitePoint) && Math.hypot(link.axis[1].x-link.axis[0].x, link.axis[1].y-link.axis[0].y) > 1e-6));
  }
  function reflectVector(v, axis) {
    const dx=axis[1].x-axis[0].x, dy=axis[1].y-axis[0].y, d=dx*dx+dy*dy;
    const along=(v.x*dx+v.y*dy)/d;
    return {x:2*along*dx-v.x, y:2*along*dy-v.y};
  }
  function reflectPoint(p, axis) {
    const v=reflectVector({x:p.x-axis[0].x,y:p.y-axis[0].y},axis);
    return {x:axis[0].x+v.x,y:axis[0].y+v.y};
  }
  function members(sheet, id) {
    return (sheet?.roads ?? []).flatMap(road => road.ends.flatMap((end,e) =>
      end.curveLink?.id === id ? [{road,end,e}] : []));
  }
  function unlink(sheet, link) {
    if (!link) return;
    for (const road of sheet.roads ?? []) for (const end of road.ends)
      if (end.curveLink?.id === link.id || (link.set && end.curveLink?.set === link.set)) delete end.curveLink;
  }
  function prune(sheet) {
    if (!sheet) return;
    const groups=new Map();
    for (const road of sheet.roads ?? []) for (const end of road.ends) if (end.curveLink) {
      if (!valid(end.curveLink)) { delete end.curveLink; continue; }
      const list=groups.get(end.curveLink.id) ?? [];
      list.push(end); groups.set(end.curveLink.id,list);
    }
    for (const ends of groups.values()) if (ends.length !== 2 || ends[0].curveLink.mode !== ends[1].curveLink.mode)
      for (const end of ends) delete end.curveLink;
  }
  const api={valid,reflectVector,reflectPoint,members,unlink,prune};
  if (typeof module !== 'undefined') module.exports=api;
  if (typeof window !== 'undefined') (window.StripeMaker ??= {}).curveLinks=api;
})();
