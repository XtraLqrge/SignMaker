// Geometrically trim marking centerlines against joined traveled-way polygons.
// Boundary-coincident lines remain visible; only strictly interior spans disappear.
(() => {
  const EPS = 1e-7;
  const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
  const at = (a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  // A trim reads a polygon many times. Prepare edge arithmetic once for that
  // synchronous call, without keeping vectors across later in-place edits.
  function prepare(polygon) {
    const bounds={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
    return {bounds,edges:polygon.map((a,i)=>{
      bounds.x0=Math.min(bounds.x0,a.x);bounds.y0=Math.min(bounds.y0,a.y);
      bounds.x1=Math.max(bounds.x1,a.x);bounds.y1=Math.max(bounds.y1,a.y);
      const b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y;
      return {a,b,dx,dy,boundary:EPS*Math.max(1,Math.hypot(dx,dy)),squared:dx*dx+dy*dy};
    })};
  }
  function inside(p, prepared) {
    const {bounds,edges}=prepared;
    if(p.x<bounds.x0||p.x>bounds.x1||p.y<bounds.y0||p.y>bounds.y1)return false;
    let hit=false;
    for(let i=0,j=edges.length-1;i<edges.length;j=i++) {
      const {a,b,dx,dy,boundary,squared}=edges[j],vx=p.x-a.x,vy=p.y-a.y;
      if(Math.abs(dx*vy-dy*vx) <= boundary &&
        vx*dx+vy*dy >= -EPS && vx*dx+vy*dy <= squared+EPS) return false;
      if((a.y>p.y)!==(b.y>p.y) && p.x<dx*vy/dy+a.x) hit=!hit;
    }
    return hit;
  }
  // Bounding boxes, cached per polygon: a segment only tests the polygons it can touch.
  const boxes=new WeakMap();
  function box(polygon) {
    let b=boxes.get(polygon);
    if(!b) {
      b={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
      for(const p of polygon) {b.x0=Math.min(b.x0,p.x);b.y0=Math.min(b.y0,p.y);b.x1=Math.max(b.x1,p.x);b.y1=Math.max(b.y1,p.y);}
      boxes.set(polygon,b);
    }
    return b;
  }
  function trim(points, polygons) {
    const result=[],prepared=new Map();let walked=0,current=null;
    const read=polygon=>{let value=prepared.get(polygon);if(!value)prepared.set(polygon,value=prepare(polygon));return value;};
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],d=sub(b,a),length=Math.hypot(d.x,d.y);
      if(length<EPS) continue;
      const cuts=[0,1],pad=EPS*Math.max(1,length);
      const x0=Math.min(a.x,b.x)-pad,x1=Math.max(a.x,b.x)+pad,y0=Math.min(a.y,b.y)-pad,y1=Math.max(a.y,b.y)+pad;
      const near=polygons.filter(polygon=>{const q=box(polygon);return q.x0<=x1&&q.x1>=x0&&q.y0<=y1&&q.y1>=y0;}).map(read);
      for(const polygon of near) for(const {a:p,b:q,dx,dy} of polygon.edges) {
        const vx=p.x-a.x,vy=p.y-a.y,den=d.x*dy-d.y*dx;
        if(Math.abs(den)<EPS) {
          if(Math.abs(vx*d.y-vy*d.x)<EPS) for(const point of [p,q]) {
            const t=((point.x-a.x)*d.x+(point.y-a.y)*d.y)/(length*length);
            if(t>0&&t<1) cuts.push(t);
          }
          continue;
        }
        const t=(vx*dy-vy*dx)/den,u=(vx*d.y-vy*d.x)/den;
        if(t>0&&t<1&&u>=-EPS&&u<=1+EPS) cuts.push(t);
      }
      cuts.sort((a,b)=>a-b);
      for(let j=1;j<cuts.length;j++) {
        const lo=cuts[j-1],hi=cuts[j];if(hi-lo<EPS) continue;
        const midpoint=at(a,b,(lo+hi)/2);
        if(near.some(p=>inside(midpoint,p))) {current=null;continue;}
        if(!current) {current={points:[at(a,b,lo)],distance:walked+lo*length};result.push(current);}
        current.points.push(at(a,b,hi));
      }
      walked+=length;
    }
    return result;
  }
  const api={trim};
  if(typeof module!=='undefined') module.exports=api;
  else (window.StripeMaker??={}).markingTrim=api;
})();
