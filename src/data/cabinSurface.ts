import {deckHeight} from './a4';
import {roofPoint,cabinSidePoint,SIDE_WINDOW_OUTLINE} from './bodyShape';
import {bodySidePoint} from './bodyShell';
import evidence from './cabinEvidence.json';

type Point=[number,number,number];
type Pair=[number,number];
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

/** 共用车顶上的玻璃边界。弧度参考冻结俯视图，横向曲面仍为估算，不是照片标定结果。 */
export function windshieldPoint(end:-1|1,u:number,v:number):Point{
  const q=2*v-1,q2=q*q;
  const x0=end===-1?-1.02+.105*q2:1.16-.045*q2;
  const x1=end===-1?-.31+.045*q2:1.79-.12*q2;
  // 四角轻收，避免玻璃/密封在立柱转角形成尖锐的三角形。
  const inset=.95-.016*(2*u-1)**8;
  return roofPoint(lerp(x0,x1,u),q*inset,.003);
}

export function windshieldBoundary(end:-1|1):Point[]{
  const points:Point[]=[],n=40;
  for(let i=0;i<n;i++)points.push(windshieldPoint(end,0,i/n));
  for(let i=0;i<n;i++)points.push(windshieldPoint(end,i/n,1));
  for(let i=0;i<n;i++)points.push(windshieldPoint(end,1,1-i/n));
  for(let i=0;i<n;i++)points.push(windshieldPoint(end,1-i/n,0));
  return points;
}

/** 在二维轮廓上沿斜置的后门窗分隔条裁切，保留图纸侧窗的整体轮廓。 */
function clipPlane(poly:Pair[],a:number,b:number,c:number,keepLeft:boolean):Pair[]{
  const f=([x,y]:Pair)=>a*x+b*y-c;
  const inside=(p:Pair)=>keepLeft?f(p)<=0:f(p)>=0;
  const out:Pair[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
    if(ia)out.push([...a]);
    if(ia!==ib){const t=f(a)/(f(a)-f(b));out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t)]);}
  }
  return out;
}
export function sideWindowPanels():Pair[][]{
  // B 柱沿图纸向前倾斜，不再使用 x 恒定的两条竖线。
  const rear=clipPlane(SIDE_WINDOW_OUTLINE,1,-.35,-.105,false);
  return [clipPlane(SIDE_WINDOW_OUTLINE,1,-.35,-.18,true),clipPlane(rear,1,.5,1.678,true),clipPlane(rear,1,.5,1.702,false)];
}
export function bPillar():Pair[]{
  return clipPlane(clipPlane(SIDE_WINDOW_OUTLINE,1,-.35,-.18,false),1,-.35,-.105,true);
}
export function quarterDivider():Pair[]{
  return clipPlane(clipPlane(SIDE_WINDOW_OUTLINE,1,.5,1.678,false),1,.5,1.702,true);
}

/** 只返回车门下部开口；上框沿既有窗框走，避免叠加两圈门缝。 */
export function doorOutline(index:0|1):Pair[]{
  const raw=evidence.doors[index] as Pair[];
  // 门框路径跨过车顶。先循环旋转到上框，删除上半部后所得下框保持路径顺序。
  const start=raw.findIndex(([x,y])=>y>deckHeight(x)-.025);
  const ordered=[...raw.slice(start),...raw.slice(0,start)];
  return ordered.filter(([x,y],i)=>y<=deckHeight(x)-.025&&
    (i===0||Math.hypot(x-ordered[i-1][0],y-ordered[i-1][1])>1e-7));
}

/** 门框在座舱/肩线交界处平滑换用表面，不能固定 z 或连三维直线弦。 */
export function exteriorSidePoint(x:number,y:number,side:number,offset=.001):Point{
  const join=deckHeight(x)-.035;
  if(y<=join-.010)return bodySidePoint(x,y,side,offset);
  if(y>=join+.010)return cabinSidePoint(x,y,side,offset);
  const t=(y-join+.010)/.020,s=t*t*(3-2*t),a=bodySidePoint(x,y,side,offset),b=cabinSidePoint(x,y,side,offset);
  return [lerp(a[0],b[0],s),y,lerp(a[2],b[2],s)];
}
