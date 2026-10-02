import {describe,it,expect} from 'vitest';
import {A4,AXLES,archBottom,halfWidth} from './a4';
import {BODY_END,bodySection,bodySidePoint,endCapPoint,endPerimeter,endSurfacePoint,rawSection} from './bodyShell';

const delta=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]);
const unit=(a:number[])=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
describe('v0.4 连续车身截面与圆角封口',()=>{
  it('饰件投影能反求圆角带上的位置，对轮廓外点显式拒绝',()=>{
    for(const end of [-1,1] as const)for(const u of [.12,.24,.36,.59,.70,.77,.89])for(const r of [.3,.89,.94,.98]){
      const p=endCapPoint(end,u,r),q=endSurfacePoint(end,p[2],p[1]);
      expect(Math.hypot(...delta(p,q))).toBeLessThan(1e-5);
    }
    expect(()=>endSurfacePoint(1,2,1)).toThrow('超出');
    expect(()=>endSurfacePoint(1,NaN,1)).toThrow('有限值');
    const wrap=endSurfacePoint(1,.863,.797);expect(wrap[0]).toBeLessThan(bodySection(BODY_END,.9)[0]);
  });
  it('左右镜像且始终在官方宽度与原估算半宽内',()=>{
    for(let x=-BODY_END;x<=BODY_END;x+=.089)for(let i=0;i<=50;i++){
      const a=bodySection(x,i/100),b=bodySection(x,1-i/100);
      expect(a[0]).toBeCloseTo(b[0],8);expect(a[1]).toBeCloseTo(b[1],8);expect(a[2]).toBeCloseTo(-b[2],8);
      expect(Math.abs(a[2])).toBeLessThanOrEqual(halfWidth(x)+1e-9);expect(Math.abs(a[2])).toBeLessThanOrEqual(A4.width/2+1e-9);
    }
  });
  it('轮拱只裁去底部，不抬升或压缩上半截面',()=>{
    for(const x of [AXLES.front-.2,AXLES.front,0,AXLES.rear,AXLES.rear+.2]){
      expect(bodySection(x,1)[1]).toBeCloseTo(archBottom(x),6);
      for(const y of [.79,.86]){
        const a=bodySidePoint(x,y,1,0);expect(a[1]).toBeCloseTo(y,6);
      }
    }
  });
  it('外侧截面高度严格递减、节点切线连续，不产生回折',()=>{
    const e=1e-5;
    for(const x of [-2.2,-1.482,-.6,.5,1.338,2.2]){
      let last=Infinity;for(let t=.56;t<=1;t+=.004){const p=rawSection(x,t);expect(p[1]).toBeLessThan(last);last=p[1];}
      for(const t of [.18,.34,.48,.56,.62,.74,.84,.93]){
        const a=delta(rawSection(x,t),rawSection(x,t-e)),b=delta(rawSection(x,t+e),rawSection(x,t));
        expect(Math.hypot(...delta(a,b))/e).toBeLessThan(.006);
      }
    }
  });
  it('圆角封口边界严格重合，切线顺接车身',()=>{
    const e=1e-5;
    for(const end of [-1,1] as const)for(const u of [.05,.15,.29,.42,.55,.7,.80]){
      const p=endCapPoint(end,u,1),edge=endPerimeter(end,u);
      expect(Math.hypot(...delta(p,edge))).toBeLessThan(1e-9);
      const capTangent=unit(delta(p,endCapPoint(end,u,1-e)));
      const bodyTangent=unit(delta(bodySection(end*BODY_END-end*e,u/.84),edge));
      expect(capTangent.reduce((sum,v,i)=>sum+v*bodyTangent[i],0)).toBeGreaterThan(.999);
    }
  });
  it('圆角带不超过总长，侧面定位与截面映射一致',()=>{
    for(const end of [-1,1] as const)for(let u=0;u<=1;u+=.02)for(let r=0;r<=1;r+=.025){
      const p=endCapPoint(end,u,r);expect(p.every(Number.isFinite)).toBe(true);expect(Math.abs(p[0])).toBeLessThanOrEqual(A4.length/2);
    }
    for(const x of [-1.7,-.6,.6,1.7])for(const v of [.82,.88,.94]){
      const p=bodySection(x,v),q=bodySidePoint(x,p[1],1,0);
      expect(Math.hypot(...delta(p,q))).toBeLessThan(1e-5);
    }
  });
});
