import {A4,AXLES,archBottom,deckHeight,halfWidth} from './a4';
import {interpolateProfile,warpBodyX,type Profile} from './bodyShape';

type Point=[number,number,number];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
/** 预留 55 mm 的纵向过渡带，不把硬封口贴在车身截面末端。均为估算。 */
export const BODY_END=A4.length/2-.055;
const FILLET_START=.88;
/** 保险杠底部略上收，避免车尾像垂直到地面的方盒。非实测离地间隙。 */
const sillHeight=(x:number)=>.185+.075*smooth(1.80,A4.length/2,x)+.040*smooth(1.9,A4.length/2,-x);
export const bodyBottom=(x:number)=>Math.max(archBottom(x),sillHeight(x));
/** 在轮拱边界增加纵向站位，收边不依赖均匀网格偶然落点。 */
export const BODY_STATIONS=Array.from(new Set([
  ...Array.from({length:241},(_,i)=>-BODY_END+2*BODY_END*i/240),
  ...[AXLES.front,AXLES.rear].flatMap(a=>[
    ...Array.from({length:33},(_,i)=>a+A4.archRadius*Math.cos(i*Math.PI/32)),
    a-A4.archRadius-1e-5,a+A4.archRadius+1e-5,
  ]),
])).sort((a,b)=>a-b);

function makeRawSection(x:number){
  const w=halfWidth(x),d=deckHeight(x),sill=sillHeight(x);
  const lobes=[AXLES.front,AXLES.rear].map(a=>Math.exp(-(((x-a)/.48)**2)));
  const fender=1-(1-lobes[0])*(1-lobes[1]);
  // 上肩保留受控曲率变化；门板中段轻收，轮拱附近更饱满，下侧裙再次外展。
  // 这些是横截面的人工估算，官方二维图没有提供此方向的测量。
  const keys=[
    [0,0,d],[.18,.42,d-.004],[.34,.73,d-.018],[.48,.928,d-.050],
    [.56,1,d-.105],[.62,.991+fender*.004,d-.150],
    [.74,.955+fender*.034,lerp(sill,d-.15,.55)],
    [.84,.948+fender*.035,lerp(sill,d-.15,.30)],
    [.93,.961+fender*.017,sill+.05],[1,.932,sill],
  ];
  const zp:Profile=keys.map(([t,z])=>[t,z]),yp:Profile=keys.map(([t,,y])=>[t,y]);
  return (t:number):Point=>{
    const q=interpolateProfile(zp,clamp(t)),baseY=interpolateProfile(yp,clamp(t)),z=q*w;
    // 原 max(0,-x-1.90) 在翼子板起点引入斜率跳变。C1 权重在入口/端点均平缓收束。
    const lift=smooth(1.78,A4.length/2,-x)*.125*q*q*clamp((baseY-sill)/(d-sill));
    const y=baseY+lift;return [warpBodyX(x,z,y),y,z];
  };
}
export const rawSection=(x:number,t:number):Point=>makeRawSection(x)(t);

/** 裁切现有横截面而不是改变控制点高度，保持轮拱之上的肩线不随开口变形。 */
export function makeBodySection(x:number):(v:number)=>Point{
  const raw=makeRawSection(x),bottom=bodyBottom(x);let limit=1;
  if(bottom>sillHeight(x)){let a=.56,b=1;for(let i=0;i<28;i++){const t=(a+b)/2;if(raw(t)[1]>bottom)a=t;else b=t;}limit=(a+b)/2;}
  // 上肩保留固定参数网格，避免每个轮拱截面的采样错位使反射出现锯齿。
  return (v:number)=>{const q=Math.abs(2*v-1),t=q<=.62?q:.62+(q-.62)/.38*(limit-.62),p=raw(t);return [p[0],p[1],v<.5?-p[2]:p[2]];};
}
export const bodySection=(x:number,v:number):Point=>makeBodySection(x)(v);

/** 由上半部横向比例求蒙皮点，机盖边界不再随意选择截面网格索引。 */
export function bodyTopPoint(x:number,widthFraction:number,offset=.0015):Point{
  if(!Number.isFinite(x)||!Number.isFinite(widthFraction)||Math.abs(widthFraction)>1)throw new Error('顶面坐标必须有限，宽度比例须在 [-1,1]');
  const raw=makeRawSection(x),target=halfWidth(x)*Math.abs(widthFraction);let a=0,b=.56;
  for(let i=0;i<28;i++){const t=(a+b)/2;if(raw(t)[2]<target)a=t;else b=t;}
  const p=raw((a+b)/2);return [p[0],p[1]+offset,Math.sign(widthFraction)*p[2]];
}

export function bodySidePoint(x:number,y:number,side:number,offset=.002):Point{
  const raw=makeRawSection(x),bottom=bodyBottom(x),target=Math.max(bottom,y);
  let a=.34,b=1;for(let i=0;i<28;i++){const t=(a+b)/2;if(raw(t)[1]>target)a=t;else b=t;}
  const p=raw((a+b)/2);return [p[0],p[1],side*(p[2]+offset)];
}

/** 封口内面仍与前后灯组共用 v0.3 映射，圆角只发生在外围。 */
export function endFacePoint(end:-1|1,z:number,y:number):Point{return [warpBodyX(end*A4.length/2,z,y),y,z];}
function perimeterAt(x:number,u:number):Point{
  const section=makeBodySection(x);
  if(u<=.84)return section(u/.84);
  const a=section(1),b=section(0),t=(u-.84)/.16,z=lerp(a[2],b[2],t),y=lerp(a[1],b[1],t);
  return [warpBodyX(x,z,y),y,z];
}
export const endPerimeter=(end:-1|1,u:number):Point=>perimeterAt(end*BODY_END,u);

/** 内面 → 三次 Hermite 圆角带 → 侧面；交界处位置与切线共用。 */
export function endCapPoint(end:-1|1,u:number,r:number):Point{
  const edge=endPerimeter(end,u),radial=(v:number)=>endFacePoint(end,edge[2]*v,.51+(edge[1]-.51)*v);
  if(r<=FILLET_START)return radial(r);
  const h=1-FILLET_START,t=(r-FILLET_START)/h,t2=t*t,t3=t2*t,e=1e-5;
  const a=radial(FILLET_START),am=radial(FILLET_START-e),ap=radial(FILLET_START+e);
  const em=perimeterAt(end*BODY_END-e,u),ep=perimeterAt(end*BODY_END+e,u);
  return a.map((n,i)=>{
    const da=(ap[i]-am[i])/(2*e)*h,db=-end*(ep[i]-em[i])/(2*e)*.070;
    return (2*t3-3*t2+1)*n+(t3-2*t2+t)*da+(-2*t3+3*t2)*edge[i]+(t3-t2)*db;
  }) as Point;
}

const capAngles=new Map<number,{angle:number;u:number}[]>();
/** 在圆角封口 / 相邻翼子板上反求 (z,y) 的 x，避免饰条仍贴在旧虚拟平面上。 */
export function endSurfacePoint(end:-1|1,z:number,y:number):Point{
  if(!Number.isFinite(z)||!Number.isFinite(y))throw new Error('饰件坐标必须为有限值');
  let samples=capAngles.get(end);
  const start=endPerimeter(end,0),startAngle=Math.atan2(start[2],start[1]-.51);
  const angle=(p:Point)=>{const a=Math.atan2(p[2],p[1]-.51);return a<startAngle?a+Math.PI*2:a;};
  if(!samples){samples=Array.from({length:129},(_,i)=>({u:i/128,angle:i===128?startAngle+Math.PI*2:angle(endPerimeter(end,i/128))}));capAngles.set(end,samples);}
  if(Math.hypot(z,y-.51)<1e-9)return endFacePoint(end,z,y);
  const theta=angle([0,y,z]);let lo=0,hi=samples.length-1;
  while(hi-lo>1){const m=Math.floor((lo+hi)/2);if(samples[m].angle<theta)lo=m;else hi=m;}
  let u=lerp(samples[lo].u,samples[hi].u,(theta-samples[lo].angle)/(samples[hi].angle-samples[lo].angle));
  const edge=endPerimeter(end,u);let r=clamp(Math.hypot(z,y-.51)/Math.hypot(edge[2],edge[1]-.51));
  for(let i=0;i<10;i++){
    const p=endCapPoint(end,u,r),dy=y-p[1],dz=z-p[2];if(Math.hypot(dy,dz)<1e-8)return [p[0],y,z];
    const e=1e-5,um=clamp(u-e),up=clamp(u+e),rm=clamp(r-e),rp=clamp(r+e);
    const a=endCapPoint(end,um,r),b=endCapPoint(end,up,r),c=endCapPoint(end,u,rm),d=endCapPoint(end,u,rp);
    const yu=(b[1]-a[1])/(up-um),zu=(b[2]-a[2])/(up-um),yr=(d[1]-c[1])/(rp-rm),zr=(d[2]-c[2])/(rp-rm),det=yu*zr-yr*zu;
    if(Math.abs(det)<1e-12)break;
    u=clamp(u+(dy*zr-dz*yr)/det);r=clamp(r+(yu*dz-zu*dy)/det);
  }
  const p=endCapPoint(end,u,r);
  if(Math.hypot(p[1]-y,p[2]-z)>.001){
    // 外灯角会绕到侧面：在末端 450 mm 内找真实侧面交点，而不是把饰件悬在外面。
    const side=z<0?-1:1,target=Math.abs(z),at=(distance:number)=>bodySidePoint(end*(BODY_END-distance),y,side,0);
    let previous=at(0);
    for(let step=1;step<=18;step++){
      const distance=step*.025,next=at(distance);
      if((Math.abs(previous[2])-target)*(Math.abs(next[2])-target)<=0&&Math.abs(next[1]-y)<1e-6){
        let a=distance-.025,b=distance;
        for(let i=0;i<26;i++){const mid=(a+b)/2;if(Math.abs(at(mid)[2])<target)a=mid;else b=mid;}
        const point=at((a+b)/2);if(Math.abs(point[1]-y)<1e-6)return [point[0],y,z];
      }
      previous=next;
    }
    throw new Error(`饰件超出${end===1?'后':'前'}封口轮廓：z=${z.toFixed(3)}, y=${y.toFixed(3)}`);
  }
  return [p[0],y,z];
}
