// Euler spirals: curvature varies linearly with arc length. The dimensionless
// endpoint curvatures are angles (degrees); scaling fits the endpoint chord.
(() => {
  function geometry(a,b,profile) {
    const k0=profile.start*Math.PI/180,k1=profile.end*Math.PI/180,N=1024,h=1/N;
    const heading=t=>k0*t+(k1-k0)*t*t/2;
    const integral=(lo,hi)=>{const m=(lo+hi)/2,w=(hi-lo)/6;return {x:w*(Math.cos(heading(lo))+4*Math.cos(heading(m))+Math.cos(heading(hi))),y:w*(Math.sin(heading(lo))+4*Math.sin(heading(m))+Math.sin(heading(hi)))};};
    const table=[{x:0,y:0}];for(let i=1;i<=N;i++){const d=integral((i-1)*h,i*h),p=table.at(-1);table.push({x:p.x+d.x,y:p.y+d.y});}
    const chord=Math.hypot(b.x-a.x,b.y-a.y),last=table.at(-1),length=chord/Math.hypot(last.x,last.y),rotation=Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(last.y,last.x),c=Math.cos(rotation),s=Math.sin(rotation);
    const point=f=>{f=Math.max(0,Math.min(1,f));const i=Math.min(N,Math.floor(f*N)),d=integral(i*h,f),p={x:table[i].x+d.x,y:table[i].y+d.y},t=rotation+heading(f);return {x:a.x+length*(p.x*c-p.y*s),y:a.y+length*(p.x*s+p.y*c),tangent:{x:Math.cos(t),y:Math.sin(t)}};};
    const radius=Math.abs(k1)>1e-12?length/Math.abs(k1):Infinity;
    return {point,length,radius,angle:(k0+k1)/2};
  }
  function sample(a,b,profile){const g=geometry(a,b,profile),n=Math.min(2000,Math.max(64,Math.ceil(g.length/8),Math.ceil(Math.abs(g.angle)*180/Math.PI)));return Array.from({length:n+1},(_,i)=>g.point(i/n));}
  function split(p,f){const middle=p.start+(p.end-p.start)*f;return [{start:p.start*f,end:middle*f},{start:middle*(1-f),end:p.end*(1-f)}];}
  const api={geometry,sample,split};if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')(window.StripeMaker??={}).clothoid=api;
})();
