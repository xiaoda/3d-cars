import {describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Mesh,Raycaster,Vector3} from 'three';
import {buildFrontCorner,makeFrontCornerPatches} from '../../vehicles/bmw-g20/frontCorner';
import {evaluatePatch} from '../../modeling/bezier';
import {inspectPatchGraph} from '../../modeling/patchGraph';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const signature=(model:ReturnType<typeof buildFrontCorner>)=>model.group.children.map(o=>{
  const m=o as Mesh;
  return [m.name,Array.from(m.geometry.getAttribute('position').array),Array.from(m.geometry.getAttribute('normal').array),Array.from(m.geometry.index!.array)];
});

describe('BMW 小样第一轮修正：不以改变相机掩盖形状差距',()=>{
  it('原始小样控制网、连接和实际网格逐值保持',()=>{
    const {patches,edges,opening}=makeFrontCornerPatches(0,'baseline');
    expect(hash({patches,edges,opening})).toBe('b9c9fcfbfcb8f21469a992a60357329596934b60d36b61301480f24f89ea63ad');
    const model=buildFrontCorner(0,24,'baseline');
    try{expect(hash(signature(model))).toBe('02c061a96cd5207a09db9c20a421fe059446393c8404f7ff220e9c5e965ba002');}
    finally{model.dispose();}
  });

  it('拒绝未知版本，默认使用修正版且不污染再次生成的基线',()=>{
    const before=makeFrontCornerPatches(0,'baseline');
    expect(()=>makeFrontCornerPatches(0,'unknown' as 'refined')).toThrow(/版本/);
    const refined=makeFrontCornerPatches();
    expect(refined.patches).toHaveLength(13);
    expect(refined.patches).not.toEqual(before.patches);
    expect(makeFrontCornerPatches(0,'baseline')).toEqual(before);
  });

  it('机盖三带在全局参数中位置/切向匹配，保留前后边与中线',()=>{
    const base=makeFrontCornerPatches(0,'baseline'),next=makeFrontCornerPatches(0,'refined');
    const ids=['hood-v0','hood-feature','hood-v1'],ranges=[[0,.54],[.54,.62],[.62,1]];
    const p=ids.map(id=>next.patches.find(p=>p.id===id)!);
    expect(p.every(Boolean)).toBe(true);
    const originalAt=(u:number,v:number)=>evaluatePatch(base.patches[v<=.62?0:1],u,v<=.62?v/.62:(v-.62)/.38);
    for(let i=0;i<3;i++)for(const u of [0,1])for(let k=0;k<=12;k++){
      const v=k/12,a=evaluatePatch(p[i],u,v).point,b=originalAt(u,ranges[i][0]+v*(ranges[i][1]-ranges[i][0])).point;
      a.forEach((value,d)=>expect(value).toBeCloseTo(b[d],11));
    }
    for(const u of [0,.2,.5,.8,1]){
      expect(evaluatePatch(p[0],u,0).normal[2]).toBeCloseTo(0,10);
      for(let i=0;i<2;i++){
        const a=evaluatePatch(p[i],u,1),b=evaluatePatch(p[i+1],u,0);
        a.dv.forEach((x,d)=>expect(x/(ranges[i][1]-ranges[i][0])).toBeCloseTo(b.dv[d]/(ranges[i+1][1]-ranges[i+1][0]),9));
      }
    }
    // 高度检查只验证参数生效，不代表实车高度或还原率。
    const ridge=evaluatePatch(p[0],.5,1).point[1]-originalAt(.5,.54).point[1];
    expect(ridge).toBeGreaterThan(.02);expect(ridge).toBeLessThan(.045);
  });

  it('翼子板肩部使用真实 G1，不是平均法线；灯外端短边收紧但不退化',()=>{
    const next=makeFrontCornerPatches(0,'refined'),base=makeFrontCornerPatches(0,'baseline');
    const result=inspectPatchGraph(next.patches,next.edges);
    const seam=result.seams.find(s=>s.patchA==='fender-crown'&&s.patchB==='fender-side')!;
    expect(seam.continuity).toBe('smooth');expect(seam.angleDeg).toBeLessThan(.001);
    const length=(curve:number[][])=>Math.hypot(...curve[3].map((x,i)=>x-curve[0][i]));
    expect(length(next.opening[2])).toBeLessThan(length(base.opening[2])*.65);
    expect(length(next.opening[2])).toBeGreaterThan(.005);
  });

  it.each(['baseline','refined'] as const)('%s：双侧灯口和 ±40 mm 控制实验均安全，全部开放边有声明',revision=>{
    const baseline=makeFrontCornerPatches(0,revision);
    for(const bulge of [-.04,0,.04]){
      const generated=makeFrontCornerPatches(bulge,revision),model=buildFrontCorner(bulge,24,revision);
      try{
        expect(generated.opening).toEqual(baseline.opening);
        for(const p of generated.patches.filter(p=>!p.id.startsWith('hood-')))expect(p).toEqual(baseline.patches.find(b=>b.id===p.id));
        expect(model.diagnostics.maxGap).toBeLessThan(1e-7);
        expect(model.diagnostics.maxSmoothAngleDeg).toBeLessThan(1);
        expect([...model.diagnostics.boundaries].sort()).toEqual(Object.keys(generated.boundaryPolicy).sort());
        expect(model.triangleCount).toBeLessThan(30000);
        model.group.updateMatrixWorld(true);
        for(const side of [-1,1]){
          expect(new Raycaster(new Vector3(-3,.675,.69*side),new Vector3(1,0,0),0,1.3).intersectObject(model.group,true)).toHaveLength(0);
          expect(new Raycaster(new Vector3(-3,.61,.69*side),new Vector3(1,0,0),0,1.3).intersectObject(model.group,true).length).toBeGreaterThan(0);
        }
      }finally{model.dispose();}
    }
  });

  it('恢复修正版得到同一网格，而不是保存实验结果或把旧版覆盖',()=>{
    const a=buildFrontCorner(),b=buildFrontCorner(.04),c=buildFrontCorner();
    try{expect(hash(signature(a))).toBe(hash(signature(c)));expect(hash(signature(a))).not.toBe(hash(signature(b)));}
    finally{a.dispose();b.dispose();c.dispose();}
  });

  it('照片相机和标注保持本轮开始时的完整数据基线',()=>{
    for(const [name,expected] of [
      ['cameras.json','45d9d1b8dd847317ffae1c5c28460029fb3b54977b6d0ec1d5c39f8011ce558d'],
      ['landmarks.json','98cc50f510415d09859a004b078fc0168394c3343b60a51c4b9d4482edc7b5d2'],
    ]){
      // 完整 JSON 内容哈希，避免 Git 的 CRLF/LF 平台差异被误判成相机变化。
      const raw=readFileSync(new URL(`../../vehicles/bmw-g20/evidence/${name}`,import.meta.url),'utf8');
      expect(hash(JSON.parse(raw))).toBe(expected);
    }
  });
});
