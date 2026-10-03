import {evaluatePatch,subtract} from './bezier';
import {parsePatch,type CubicPatch,type PatchEdge} from './types';
export type EdgeName=PatchEdge['edgeA'];
export const EDGE_NAMES:EdgeName[]=['u0','u1','v0','v1'];
export const edgeIndices=(edge:EdgeName)=>edge==='u0'?[0,1,2,3]:edge==='u1'?[12,13,14,15]:edge==='v0'?[0,4,8,12]:[3,7,11,15];
export const edgeUV=(edge:EdgeName,t:number):[number,number]=>edge==='u0'?[0,t]:edge==='u1'?[1,t]:edge==='v0'?[t,0]:[t,1];
export function inspectPatchGraph(patches:CubicPatch[],edges:PatchEdge[]){
  if(!patches.length)throw new Error('面片图不能为空');
  const map=new Map(patches.map(p=>[p.id,parsePatch(p)]));if(map.size!==patches.length)throw new Error('面片 ID 重复');
  const used=new Set<string>();let maxGap=0,maxSmoothAngleDeg=0;
  const seams=edges.map(e=>{
    const a=map.get(e.patchA),b=map.get(e.patchB);
    if(!a||!b||a===b||!EDGE_NAMES.includes(e.edgeA)||!EDGE_NAMES.includes(e.edgeB)||!['smooth','crease'].includes(e.continuity)||typeof e.reverse!=='boolean')throw new Error('无效共边引用；面板缝须作为显式开放边界');
    for(const key of [`${e.patchA}:${e.edgeA}`,`${e.patchB}:${e.edgeB}`]){if(used.has(key))throw new Error(`共边重复配对 ${key}`);used.add(key);}
    let gap=0,angle=0;
    const ai=edgeIndices(e.edgeA),bi=edgeIndices(e.edgeB);if(e.reverse)bi.reverse();
    for(let i=0;i<4;i++)gap=Math.max(gap,Math.hypot(...subtract(a.points[ai[i]],b.points[bi[i]])));
    if(gap>1e-7)throw new Error(`共边不一致 ${e.patchA}/${e.patchB}: ${gap} m`);
    for(let i=0;i<=32;i++){
      const af=evaluatePatch(a,...edgeUV(e.edgeA,i/32)),bf=evaluatePatch(b,...edgeUV(e.edgeB,e.reverse?1-i/32:i/32));
      gap=Math.max(gap,Math.hypot(...subtract(af.point,bf.point)));
      const dot=af.normal.reduce((s,v,j)=>s+v*bf.normal[j],0);angle=Math.max(angle,Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI);
    }
    if(e.continuity==='smooth'&&angle>1)throw new Error(`光滑共边法线不连续 ${e.patchA}/${e.patchB}: ${angle}°`);
    maxGap=Math.max(maxGap,gap);if(e.continuity==='smooth')maxSmoothAngleDeg=Math.max(maxSmoothAngleDeg,angle);
    return {...e,gap,angleDeg:angle};
  });
  return {maxGap,maxSmoothAngleDeg,seams,boundaries:patches.flatMap(p=>EDGE_NAMES.filter(e=>!used.has(`${p.id}:${e}`)).map(e=>`${p.id}:${e}`))};
}
