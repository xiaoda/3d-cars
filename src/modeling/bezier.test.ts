import {describe,expect,it} from 'vitest';
import {evaluatePatch,splitPatch,coonsPatch} from './bezier';
import type {CubicPatch,Vec3} from './types';
const plane:CubicPatch={id:'plane',points:Array.from({length:16},(_,k)=>[-Math.floor(k/4),0,k%4] as Vec3)};
describe('三次 Bézier 曲面',()=>{
  it('插值四角，平面一阶导数和单位法线正确',()=>{
    for(const u of [0,.37,1])for(const v of [0,.64,1]){
      const r=evaluatePatch(plane,u,v);expect(r.point[0]).toBeCloseTo(-3*u,12);expect(r.point[2]).toBeCloseTo(3*v,12);
      expect(r.du[0]).toBeCloseTo(-3,12);expect(r.dv[2]).toBeCloseTo(3,12);r.normal.forEach((x,i)=>expect(x).toBeCloseTo(i===1?1:0,12));
    }
  });
  it('曲面解析导数与中心有限差分一致',()=>{
    const p=structuredClone(plane);p.points[5][1]=.3;p.points[10][1]=.8;const h=1e-5,r=evaluatePatch(p,.35,.63);
    for(const [axis,d] of [['u',r.du],['v',r.dv]] as const){
      const a=evaluatePatch(p,.35+(axis==='u'?h:0),.63+(axis==='v'?h:0)).point,b=evaluatePatch(p,.35-(axis==='u'?h:0),.63-(axis==='v'?h:0)).point;
      for(let i=0;i<3;i++)expect(d[i]).toBeCloseTo((a[i]-b[i])/(2*h),8);
    }
  });
  it('精确细分保持曲面位置，子面片边界相接',()=>{
    const p=structuredClone(plane);p.points[6][1]=.7;
    for(const axis of ['u','v'] as const){const [a,b]=splitPatch(p,axis,.62);for(const t of [0,.2,.8,1]){
      expect(evaluatePatch(a,axis==='u'?1:t,axis==='v'?1:t).point).toEqual(evaluatePatch(b,axis==='u'?0:t,axis==='v'?0:t).point);
      const actual=evaluatePatch(a,.4,.7).point,want=evaluatePatch(p,axis==='u'?.4*.62:.4,axis==='v'?.7*.62:.7).point;
      actual.forEach((x,i)=>expect(x).toBeCloseTo(want[i],12));
    }}
  });
  it('Coons 边界严格保持四条输入曲线',()=>{
    const p=coonsPatch('coons',plane.points.slice(0,4),plane.points.slice(12),[0,4,8,12].map(i=>plane.points[i]),[3,7,11,15].map(i=>plane.points[i]));
    expect(evaluatePatch(p,.3,.7).point[0]).toBeCloseTo(-.9,12);
    expect(evaluatePatch(p,.3,.7).point[2]).toBeCloseTo(2.1,12);
    expect(()=>coonsPatch('bad',plane.points.slice(0,4),plane.points.slice(12),plane.points.slice(0,4),plane.points.slice(12))).toThrow();
  });
  it('拒绝非法控制网、参数及退化法线',()=>{
    expect(()=>evaluatePatch({id:'bad',points:[[0,0,0]]},0,0)).toThrow();
    for(const t of [NaN,-.1,1.1])expect(()=>evaluatePatch(plane,t,.5)).toThrow();
    expect(()=>evaluatePatch({id:'flat',points:Array(16).fill([0,0,0])},.5,.5)).toThrow(/退化/);
    expect(()=>splitPatch(plane,'u',0)).toThrow();
  });
});
