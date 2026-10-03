import {parsePatch,type CubicPatch,type Vec3} from './types';
export const mix=(a:Vec3,b:Vec3,t:number):Vec3=>a.map((x,i)=>x+(b[i]-x)*t) as Vec3;
export const subtract=(a:Vec3,b:Vec3):Vec3=>a.map((x,i)=>x-b[i]) as Vec3;
export const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function parameter(t:number){if(!Number.isFinite(t)||t<0||t>1)throw new Error('曲面参数必须在 [0,1] 内');}
function basis(t:number){const s=1-t;return [s*s*s,3*t*s*s,3*t*t*s,t*t*t];}
function derivative(t:number){const s=1-t;return [-3*s*s,3*s*s-6*t*s,6*t*s-3*t*t,3*t*t];}
/** 行为 u，列为 v；法线遵循 du × dv，不通过面内平均掩盖折线。 */
export function evaluatePatch(patch:CubicPatch,u:number,v:number){
  parameter(u);parameter(v);const p=parsePatch(patch),bu=basis(u),bv=basis(v),du=derivative(u),dv=derivative(v);
  const point:Vec3=[0,0,0],a:Vec3=[0,0,0],b:Vec3=[0,0,0];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let d=0;d<3;d++){
    point[d]+=p.points[i*4+j][d]*bu[i]*bv[j];a[d]+=p.points[i*4+j][d]*du[i]*bv[j];b[d]+=p.points[i*4+j][d]*bu[i]*dv[j];
  }
  const n=cross(a,b),length=Math.hypot(...n);if(!Number.isFinite(length)||length<1e-12)throw new Error(`${p.id}：退化切平面 (${u}, ${v})`);
  return {point,du:a,dv:b,normal:n.map(x=>x/length) as Vec3};
}
function splitCurve(c:Vec3[],t:number){
  const a=mix(c[0],c[1],t),b=mix(c[1],c[2],t),d=mix(c[2],c[3],t),e=mix(a,b,t),f=mix(b,d,t),g=mix(e,f,t);
  return [[c[0],a,e,g],[g,f,d,c[3]]];
}
export function splitPatch(patch:CubicPatch,axis:'u'|'v',t:number):[CubicPatch,CubicPatch]{
  parameter(t);if(t===0||t===1||!['u','v'].includes(axis))throw new Error('细分点必须严格位于面内');
  const p=parsePatch(patch),out=[{id:`${p.id}-${axis}0`,points:[] as Vec3[]},{id:`${p.id}-${axis}1`,points:[] as Vec3[]}];
  for(let k=0;k<4;k++){
    const indices=Array.from({length:4},(_,i)=>axis==='u'?i*4+k:k*4+i),curves=splitCurve(indices.map(i=>p.points[i]),t);
    for(let side=0;side<2;side++)indices.forEach((index,i)=>out[side].points[index]=curves[side][i]);
  }
  return out as [CubicPatch,CubicPatch];
}
/** 四条三次边界的 Coons 控制网；相邻角点必须已经相同。 */
export function coonsPatch(id:string,u0:Vec3[],u1:Vec3[],v0:Vec3[],v1:Vec3[]):CubicPatch{
  for(const c of [u0,u1,v0,v1])if(c.length!==4||c.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x))))throw new Error('边界必须是四个有限三维控制点');
  for(const [a,b] of [[u0[0],v0[0]],[u0[3],v1[0]],[u1[0],v0[3]],[u1[3],v1[3]]])if(Math.hypot(...subtract(a,b))>1e-10)throw new Error('Coons 边界角点不一致');
  const points:Vec3[]=[];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    const u=i/3,v=j/3,ac=mix(u0[j],u1[j],u),bd=mix(v0[i],v1[i],v),bilinear=mix(mix(u0[0],u0[3],v),mix(u1[0],u1[3],v),u);
    points.push(ac.map((x,d)=>x+bd[d]-bilinear[d]) as Vec3);
  }
  return parsePatch({id,points});
}
