import {describe,expect,it} from 'vitest';
import {splitPatch} from './bezier';
import {inspectPatchGraph} from './patchGraph';
import {tessellatePatches} from './tessellation';
import type {CubicPatch,PatchEdge,Vec3} from './types';
const p:CubicPatch={id:'p',points:Array.from({length:16},(_,k)=>[-Math.floor(k/4),Math.sin(k)*.03,k%4] as Vec3)};
const [a,b]=splitPatch(p,'v',.5);
const edge:PatchEdge={patchA:a.id,edgeA:'v1',patchB:b.id,edgeB:'v0',reverse:false,continuity:'smooth'};
describe('面片图与确定性网格',()=>{
  it('光滑共边通过 G0 / G1 检查，给出剩余边界',()=>{
    const r=inspectPatchGraph([a,b],[edge]);expect(r.maxGap).toBeLessThan(1e-12);expect(r.maxSmoothAngleDeg).toBeLessThan(1e-5);expect(r.boundaries).toHaveLength(6);
  });
  it('支持反向共边，绕序错误不能伪装光滑',()=>{
    const reversed={...b,id:'rev',points:[...b.points.slice(12),...b.points.slice(8,12),...b.points.slice(4,8),...b.points.slice(0,4)]};
    expect(()=>inspectPatchGraph([a,reversed],[{...edge,patchB:'rev',reverse:true}])).toThrow(/法线/);
    expect(inspectPatchGraph([a,reversed],[{...edge,patchB:'rev',reverse:true,continuity:'crease'}]).maxGap).toBeLessThan(1e-12);
    expect(()=>inspectPatchGraph([a,reversed],[{...edge,patchB:'rev',continuity:'crease'}])).toThrow(/共边/);
  });
  it('错误面片、重复连接、缺口或伪光滑必须报错',()=>{
    expect(()=>inspectPatchGraph([a,b],[edge,edge])).toThrow();
    expect(()=>inspectPatchGraph([a,b],[{...edge,patchB:'none'}])).toThrow();
    const bad=structuredClone(b);bad.points[0][1]+=.01;
    expect(()=>inspectPatchGraph([a,bad],[edge])).toThrow(/共边/);
    const bent=structuredClone(b);[1,5,9,13].forEach(i=>bent.points[i][1]+=.1);
    expect(()=>inspectPatchGraph([a,bent],[edge])).toThrow(/法线/);
    expect(()=>inspectPatchGraph([a,bent],[{...edge,continuity:'crease'}])).not.toThrow();
  });
  it('共享采样严格相同、索引绕序符合解析法线、网格确定',()=>{
    const first=tessellatePatches([a,b],[edge],12),second=tessellatePatches([a,b],[edge],12);
    expect(first).toEqual(second);expect(first.meshes).toHaveLength(2);
    const aa=first.meshes[0],bb=first.meshes[1];
    for(let i=0;i<=12;i++)for(let d=0;d<3;d++)expect(aa.positions[(i*13+12)*3+d]).toBe(bb.positions[i*13*3+d]);
    expect(first.triangleCount).toBe(576);expect(first.minDoubleArea).toBeGreaterThan(0);
  });
  it('拒绝不合法密度而非生成 T 接点，拒绝退化面',()=>{
    for(const n of [0,2.5,257,NaN])expect(()=>tessellatePatches([a,b],[edge],n)).toThrow();
    expect(()=>tessellatePatches([{id:'bad',points:Array(16).fill([0,0,0])}],[],12)).toThrow();
  });
});
