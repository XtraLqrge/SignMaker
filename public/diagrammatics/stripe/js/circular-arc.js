// Constant-radius road geometry. Angles are signed degrees in sheet coordinates.
(() => {
  function geometry(a,b,degrees,loop) {
    if(Math.abs(degrees)===360 && loop){
      const radius=loop.radius,heading=loop.heading,sign=Math.sign(degrees),angle=sign*Math.PI*2,center={x:a.x-heading.y*radius*sign,y:a.y+heading.x*radius*sign};
      const point=f=>{const t=angle*f,c=Math.cos(t),s=Math.sin(t),v={x:a.x-center.x,y:a.y-center.y};return {x:f===1?a.x:center.x+v.x*c-v.y*s,y:f===1?a.y:center.y+v.x*s+v.y*c,tangent:{x:heading.x*c-heading.y*s,y:heading.x*s+heading.y*c}};};
      return {point,radius,length:radius*Math.PI*2,angle,center};
    }
    const angle=degrees*Math.PI/180,chord=Math.hypot(b.x-a.x,b.y-a.y);
    const u=chord?{x:(b.x-a.x)/chord,y:(b.y-a.y)/chord}:{x:1,y:0},n={x:-u.y,y:u.x};
    const radius=Math.abs(angle)>1e-12?chord/(2*Math.sin(Math.abs(angle)/2)):Infinity;
    const point=f=>{
      const t=(f-.5)*angle,tangent={x:u.x*Math.cos(t)+n.x*Math.sin(t),y:u.y*Math.cos(t)+n.y*Math.sin(t)};
      // Chord-relative arithmetic avoids subtracting huge centers for shallow arcs.
      const reach=Math.abs(angle)>1e-12?chord*Math.sin(f*angle/2)/Math.sin(angle/2):chord*f;
      const turn=(f-1)*angle/2,x=reach*Math.cos(turn),y=reach*Math.sin(turn);
      return {x:a.x+u.x*x+n.x*y,y:a.y+u.y*x+n.y*y,tangent};
    };
    const length=Number.isFinite(radius)?radius*Math.abs(angle):chord;
    const p=point(0),sign=Math.sign(angle);
    const center=Number.isFinite(radius)?{x:a.x-p.tangent.y*radius*sign,y:a.y+p.tangent.x*radius*sign}:null;
    return {point,radius,length,angle,center};
  }
  function sample(a,b,degrees,loop) {
    const arc=geometry(a,b,degrees,loop),count=Math.min(2000,Math.max(32,Math.ceil(arc.length/8),Math.ceil(Math.abs(degrees))));
    return Array.from({length:count+1},(_,i)=>arc.point(i/count));
  }
  // Fit a true circle of the requested radius tangent to the two meeting
  // lane axes. Tangency points may slide along those axes; the host curves
  // and their joint anchors remain unchanged.
  function fitTangents(a, b, startDirection, endDirection, radius, degrees) {
    const unit = p => { const n=Math.hypot(p.x,p.y);return n>1e-9?{x:p.x/n,y:p.y/n}:null; };
    const d=unit(startDirection),e=unit(endDirection);
    if(!d||!e||!Number.isFinite(radius)||radius<=0||!degrees||Math.abs(degrees)>=359.9)return null;
    const cross=(u,v)=>u.x*v.y-u.y*v.x,den=cross(d,e),sign=Math.sign(degrees);
    if(Math.abs(den)<1e-5)return null;
    let angle=Math.atan2(den,d.x*e.x+d.y*e.y);
    if(angle*sign<0)angle+=sign*Math.PI*2;
    // Opposite turning directions are not a small endpoint refit.
    if(Math.abs(angle*180/Math.PI-degrees)>90)return null;
    const n={x:-d.y,y:d.x},m={x:-e.y,y:e.x};
    const p={x:a.x+sign*radius*n.x,y:a.y+sign*radius*n.y};
    const q={x:b.x+sign*radius*m.x,y:b.y+sign*radius*m.y};
    const along=cross({x:q.x-p.x,y:q.y-p.y},e)/den;
    const center={x:p.x+d.x*along,y:p.y+d.y*along};
    const start={x:center.x-sign*radius*n.x,y:center.y-sign*radius*n.y};
    const end={x:center.x-sign*radius*m.x,y:center.y-sign*radius*m.y};
    return {start,end,center,radius,degrees:angle*180/Math.PI,
      startOffset:along,endOffset:(end.x-b.x)*e.x+(end.y-b.y)*e.y};
  }
  // An offset of an existing cubic lane, continuing straight along its tangent
  // beyond either end when the fitted circle needs a short extension.
  function laneCurve({a,c0,c1,b,lateral=0}) {
    const unit=p=>{const n=Math.hypot(p.x,p.y)||1;return {x:p.x/n,y:p.y/n};};
    const rawPosition=t=>{
      const u=1-t,d={x:3*u*u*(c0.x-a.x)+6*u*t*(c1.x-c0.x)+3*t*t*(b.x-c1.x),
        y:3*u*u*(c0.y-a.y)+6*u*t*(c1.y-c0.y)+3*t*t*(b.y-c1.y)};
      const dd={x:6*u*(c1.x-2*c0.x+a.x)+6*t*(b.x-2*c1.x+c0.x),y:6*u*(c1.y-2*c0.y+a.y)+6*t*(b.y-2*c1.y+c0.y)};
      const length=Math.hypot(d.x,d.y),fallback=t<.5?[c0,c1,b].map(p=>({x:p.x-a.x,y:p.y-a.y})):[c1,c0,a].map(p=>({x:b.x-p.x,y:b.y-p.y}));
      const tangent=unit(length>1e-9?d:fallback.find(p=>Math.hypot(p.x,p.y)>1e-9)??{x:1,y:0});
      const factor=length>1e-9?1-lateral*(d.x*dd.y-d.y*dd.x)/length**3:1;
      const speed=(length>1e-9?length:Math.hypot(b.x-a.x,b.y-a.y))*factor;
      return {x:u*u*u*a.x+3*u*u*t*c0.x+3*u*t*t*c1.x+t*t*t*b.x-tangent.y*lateral,
        y:u*u*u*a.y+3*u*u*t*c0.y+3*u*t*t*c1.y+t*t*t*b.y+tangent.x*lateral,
        tangent:speed<0?{x:-tangent.x,y:-tangent.y}:tangent,speed:Math.abs(speed)};
    };
    const position=t=>{
      if(t>=0&&t<=1)return rawPosition(t);
      // Outside a host's physical extent, continue its endpoint tangent rather
      // than extrapolating a cubic into a reverse bend that isn't on the sheet.
      const e=t<0?0:1,p=rawPosition(e);
      return {x:p.x+p.tangent.x*p.speed*(t-e),y:p.y+p.tangent.y*p.speed*(t-e),tangent:p.tangent};
    };
    return t=>{
      const {x,y,tangent}=position(t);
      return {x,y,tangent};
    };
  }
  function sampleCurve(curve, from, to) {
    const a=curve(from),b=curve(to),count=Math.min(400,Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.5),Math.ceil(Math.abs(to-from)*256)));
    return Array.from({length:count+1},(_,i)=>curve(from+(to-from)*i/count));
  }
  // A circle is tangent to both host lanes where their radius-offset curves
  // intersect. Solve those two parameters instead of extending the old mouth
  // tangents: long setbacks must follow the host's actual Bézier curvature.
  function fitCurves(first, second, radius, degrees, seed) {
    if(!Number.isFinite(radius)||radius<=0||!degrees||Math.abs(degrees)>=359.9)return null;
    const sign=Math.sign(degrees),cross=(a,b)=>a.x*b.y-a.y*b.x;
    const center=(curve,t)=>{const p=curve(t);return {x:p.x-sign*radius*p.tangent.y,y:p.y+sign*radius*p.tangent.x};};
    const error=(t,u)=>{const p=center(first,t),q=center(second,u);return {x:p.x-q.x,y:p.y-q.y};};
    const speed=(curve,t)=>{const a=curve(t-1e-4),b=curve(t+1e-4);return Math.hypot(b.x-a.x,b.y-a.y)/2e-4;};
    const a=first(1),b=second(0),linear=fitTangents(a,b,a.tangent,b.tangent,radius,degrees);
    const guess=seed??(linear?[1+linear.startOffset/Math.max(1,speed(first,1)),linear.endOffset/Math.max(1,speed(second,0))]:[1,0]);
    const clamp=(t,e)=>Math.max(e?-.5:0,Math.min(e?1:1.5,t));
    for(const initial of [guess,[1,0]]) {
      let t=clamp(initial[0],0),u=clamp(initial[1],1);
      for(let iteration=0;iteration<32;iteration++) {
        const f=error(t,u),norm=Math.hypot(f.x,f.y);
        if(norm<1e-8){
          const start=first(t),end=second(u),d=start.tangent,e=end.tangent;
          let angle=Math.atan2(cross(d,e),d.x*e.x+d.y*e.y);if(angle*sign<0)angle+=sign*Math.PI*2;
          const sweep=angle*180/Math.PI;
          if(Math.abs(sweep-degrees)>90||Math.abs(sweep)>=359.9)break;
          const distance=(curve,lo,hi)=>{const points=sampleCurve(curve,lo,hi);return Math.sign(hi-lo)*points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);};
          return {start,end,center:center(first,t),radius,degrees:sweep,parameters:[t,u],
            startOffset:distance(first,1,t),endOffset:distance(second,0,u)};
        }
        const h=1e-4,pa=center(first,t-h),pb=center(first,t+h),qa=center(second,u-h),qb=center(second,u+h);
        const x={x:(pb.x-pa.x)/(2*h),y:(pb.y-pa.y)/(2*h)},y={x:(qa.x-qb.x)/(2*h),y:(qa.y-qb.y)/(2*h)},den=cross(x,y);
        if(Math.abs(den)<1e-10)break;
        const dt=(-f.x*y.y+f.y*y.x)/den,du=(-x.x*f.y+x.y*f.x)/den;
        let accepted=false;
        for(let step=Math.min(1,.25/Math.max(Math.abs(dt),Math.abs(du)));step>1e-5;step/=2){
          const nextT=clamp(t+dt*step,0),nextU=clamp(u+du*step,1),next=error(nextT,nextU);
          if(Math.hypot(next.x,next.y)<norm){t=nextT;u=nextU;accepted=true;break;}
        }
        if(!accepted)break;
      }
    }
    return null;
  }
  function fit(points,make) {
    if(points.length<2)return 0;
    const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
    const a=points[0],b=points.at(-1),samples=Array.from({length:15},(_,n)=>{const d=distances.at(-1)*(n+1)/16;let i=distances.findIndex(v=>v>=d);i=Math.max(1,i);const f=(d-distances[i-1])/(distances[i]-distances[i-1]||1);return {x:points[i-1].x+(points[i].x-points[i-1].x)*f,y:points[i-1].y+(points[i].y-points[i-1].y)*f};});
    const score=angle=>{const g=make?make(a,b,angle):geometry(a,b,angle);return samples.reduce((sum,p,i)=>{const q=g.point((i+1)/16);return sum+(p.x-q.x)**2+(p.y-q.y)**2;},0);};
    let best=0,error=score(0);for(let angle=-350;angle<=350;angle+=10){const next=score(angle);if(next<error){best=angle;error=next;}}
    let lo=Math.max(-359.9,best-10),hi=Math.min(359.9,best+10);for(let i=0;i<28;i++){const x=lo+(hi-lo)/3,y=hi-(hi-lo)/3;if(score(x)<score(y))hi=y;else lo=x;}
    const angle=(lo+hi)/2;return Math.abs(angle)<.01?0:angle;
  }
  const api={geometry,sample,fit,fitTangents,laneCurve,sampleCurve,fitCurves};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')(window.StripeMaker??={}).circularArc=api;
})();
