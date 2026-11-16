// Optional rigid placement of a lane-anchored item. Paths are transformed as
// coordinates (not SVG transforms), preserving vector PDF output and picking.
(() => {
  const spin=(p,a)=>{const c=Math.cos(a),s=Math.sin(a);return {x:p.x*c-p.y*s,y:p.x*s+p.y*c};};
  const apply=(item,p)=>{
    const t=item?.placementTransform;if(!t)return p;
    const q=spin(p,t.angle*Math.PI/180);
    return {...p,x:q.x+t.x,y:q.y+t.y,...(p.tangent?{tangent:spin(p.tangent,t.angle*Math.PI/180)}:{})};
  };
  function rotate(item,degrees,pivot,baseMoves=false) {
    const t=item.placementTransform??{angle:0,x:0,y:0};
    if(baseMoves&&!item.placementTransform)return;
    const a=degrees*Math.PI/180, rp=spin(pivot,a), delta={x:pivot.x-rp.x,y:pivot.y-rp.y}, rt=spin(t,a);
    const correction=baseMoves?spin(delta,t.angle*Math.PI/180):{x:0,y:0};
    item.placementTransform={angle:(t.angle+(baseMoves?0:degrees))%360,x:rt.x+delta.x-correction.x,y:rt.y+delta.y-correction.y};
  }
  function translate(item,dx,dy,baseMoves=false) {
    const t=item.placementTransform??{angle:0,x:0,y:0};
    if(baseMoves&&!item.placementTransform)return;
    const correction=baseMoves?spin({x:dx,y:dy},t.angle*Math.PI/180):{x:0,y:0};
    item.placementTransform={angle:t.angle,x:t.x+dx-correction.x,y:t.y+dy-correction.y};
  }
  const api={apply,rotate,translate};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')(window.StripeMaker??={}).itemTransform=api;
})();
