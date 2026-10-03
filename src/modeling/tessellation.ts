import {cross,evaluatePatch,subtract} from './bezier';
import {inspectPatchGraph,type EdgeName} from './patchGraph';
import type {CubicPatch,PatchEdge,Vec3} from './types';
export type PatchMesh={id:string;positions:number[];normals:number[];indices:number[]};
function vertex(edge:EdgeName,k:number,n:number){return edge==='u0'?k:edge==='u1'?n*(n+1)+k:edge==='v0'?k*(n+1):k*(n+1)+n;}
/** 本阶段全图统一密度，明确拒绝自适应 T 接点。共享位置，折线保留各自解析法线。 */
export function tessellatePatches(patches:CubicPatch[],edges:PatchEdge[],segments=24){
  if(!Number.isInteger(segments)||segments<2||segments>256)throw new Error('统一分段数须为 2–256 的整数');
  const diagnostics=inspectPatchGraph(patches,edges),n=segments;
  const meshes:PatchMesh[]=patches.map(p=>{
    const positions:number[]=[],normals:number[]=[],indices:number[]=[];
    for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const r=evaluatePatch(p,i/n,j/n);positions.push(...r.point);normals.push(...r.normal);}
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);}
    return {id:p.id,positions,normals,indices};
  });
  const map=new Map(meshes.map(m=>[m.id,m]));
  // 并查集使相交的多条共边角点也使用同一份位置，消除顺序相关的覆盖。
  const count=(n+1)**2,parent=Array.from({length:meshes.length*count},(_,i)=>i);
  const find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
  for(const e of edges){const ai=meshes.indexOf(map.get(e.patchA)!),bi=meshes.indexOf(map.get(e.patchB)!);
    for(let k=0;k<=n;k++){const a=find(ai*count+vertex(e.edgeA,k,n)),b=find(bi*count+vertex(e.edgeB,e.reverse?n-k:k,n));parent[Math.max(a,b)]=Math.min(a,b);}
  }
  meshes.forEach((m,i)=>{for(let k=0;k<count;k++){const id=find(i*count+k),source=meshes[Math.floor(id/count)];for(let d=0;d<3;d++)m.positions[k*3+d]=source.positions[(id%count)*3+d];}});
  let minDoubleArea=Infinity,triangleCount=0;
  for(const m of meshes)for(let i=0;i<m.indices.length;i+=3){
    const [a,b,c]=m.indices.slice(i,i+3).map(k=>m.positions.slice(k*3,k*3+3) as Vec3),normal=cross(subtract(b,a),subtract(c,a)),area=Math.hypot(...normal);
    if(!Number.isFinite(area)||area<1e-14)throw new Error(`退化三角形 ${m.id}:${i/3}`);
    // 每个顶点解析法线都应与面绕序同向；不能用 DoubleSide 掩盖翻面。
    for(const k of m.indices.slice(i,i+3))if(normal.reduce((s,v,d)=>s+v*m.normals[k*3+d],0)<=0)throw new Error(`回折或反向三角形 ${m.id}:${i/3}`);
    minDoubleArea=Math.min(minDoubleArea,area);triangleCount++;
  }
  return {meshes,diagnostics,triangleCount,minDoubleArea};
}
