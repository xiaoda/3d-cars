import {A4} from './a4';
import evidence from './bodyEvidence.json';

export type Profile=ReadonlyArray<readonly [number,number]>;
/** 保形三次 Hermite：局部极值处斜率归零，不用折线拼接车顶。 */
export function interpolateProfile(points:Profile,x:number):number {
  if(x<=points[0][0])return points[0][1];if(x>=points.at(-1)![0])return points.at(-1)![1];
  const slope=(j:number)=>{
    const delta=(i:number)=>(points[i+1][1]-points[i][1])/(points[i+1][0]-points[i][0]);
    if(j===0)return delta(0);if(j===points.length-1)return delta(j-1);
    const a=delta(j-1),b=delta(j);if(a*b<=0)return 0;
    const h0=points[j][0]-points[j-1][0],h1=points[j+1][0]-points[j][0],w0=2*h1+h0,w1=h1+2*h0;
    return (w0+w1)/(w0/a+w1/b);
  };
  for(let i=1;i<points.length;i++)if(x<=points[i][0]){
    const a=points[i-1],b=points[i],h=b[0]-a[0],t=(x-a[0])/h,t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*h*slope(i-1)+(-2*t3+3*t2)*b[1]+(t3-t2)*h*slope(i);
  }return points.at(-1)![1];
}

/** 图线给纵向观察约束；横向拱度、宽度与局部截面仍是人工估算。 */
export const ROOF_PROFILE:Profile=[
  [-1.05,.9672],[-.86,1.0751],[-.63,1.1993],[-.34,1.3357],[-.14,1.3877],
  [.10,1.4157],[.28,1.424],[.42,A4.height],[.55,1.4248],[.8,1.4133],
  [1,1.3914],[1.13,1.3661],[1.3,1.3138],[1.48,1.2475],[1.65,1.1746],[1.8,1.1056],[1.88,1.078],
];
export const roofHeight=(x:number)=>interpolateProfile(ROOF_PROFILE,x);
export const CABIN_RANGE=[-1.05,1.88] as const;
export function cabinHalfWidth(x:number,y:number){
  const rearTaper=Math.max(0,x-.75)*.052;
  const rise=y-1;
  // 原线性侧框像一块平板；保留上窄下宽，增加微小外凸并放宽上部收束。
  return .802-rise*.49+.010*Math.sin(Math.PI*Math.max(0,Math.min(1,rise/.44)))-rearTaper;
}
export function roofCrown(x:number){return .024*Math.min(1,Math.max(0,(roofHeight(x)-1.0)/.16));}
export function roofPoint(x:number,q:number,offset=0):[number,number,number]{
  const h=roofHeight(x),edge=h-roofCrown(x);
  return [x,h-roofCrown(x)*(.4*q*q+.6*q**10)+offset,cabinHalfWidth(x,edge)*q];
}
export function cabinSidePoint(x:number,y:number,side:number,offset=0):[number,number,number]{
  return [x,y,side*(cabinHalfWidth(x,y)+offset)];
}
export const SIDE_WINDOW_OUTLINE=evidence.sideWindowOutline as [number,number][];
export function windowSpan(x:number):[number,number]{
  const intersections:number[]=[];
  for(let i=0;i<SIDE_WINDOW_OUTLINE.length;i++){
    const a=SIDE_WINDOW_OUTLINE[i],b=SIDE_WINDOW_OUTLINE[(i+1)%SIDE_WINDOW_OUTLINE.length];
    if((x-a[0])*(x-b[0])<=0&&Math.abs(b[0]-a[0])>1e-8)intersections.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
  }
  if(intersections.length<2)throw new Error('取样位置不在侧窗轮廓内');
  return [Math.min(...intersections),Math.max(...intersections)];
}
/** 沿 B 柱切开同一条二维轮廓，避免前后窗使用不一致的顶边。 */
export function clipWindow(points:ReadonlyArray<readonly [number,number]>,limit:number,keepLeft:boolean):[number,number][] {
  const out:[number,number][]=[];const inside=(p:readonly [number,number])=>keepLeft?p[0]<=limit:p[0]>=limit;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],ia=inside(a),ib=inside(b);
    if(ia)out.push([a[0],a[1]]);
    if(ia!==ib){const t=(limit-a[0])/(b[0]-a[0]);out.push([limit,a[1]+(b[1]-a[1])*t]);}
  }return out;
}
const smoothstep=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
/** 前端中部较平，圆角集中在两侧；不移动车轮或拉伸图纸。 */
export function warpBodyX(x:number,z:number,y=0):number {
  const q=Math.abs(z)/.93;
  const front=Math.max(0,(-x-1.9)/.481)**1.16*(.024+.38*q**4);
  const rear=Math.max(0,(x-1.85)/.531)**1.15*(.012+.135*q**4+.105*smoothstep(.75,1.05,y));
  return x+front-rear;
}
