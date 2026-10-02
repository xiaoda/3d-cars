import {describe,it,expect} from 'vitest';
import {A4} from './a4';
import {ROOF_PROFILE,SIDE_WINDOW_OUTLINE,interpolateProfile,roofHeight,cabinHalfWidth,warpBodyX,cabinSidePoint,clipWindow,windowSpan} from './bodyShape';

describe('v0.3 人工形体参数与连续性',()=>{
  it('有界三次插值通过控制点且不产生过冲',()=>{
    for(const [x,y] of ROOF_PROFILE)expect(roofHeight(x)).toBeCloseTo(y,8);
    for(let i=1;i<ROOF_PROFILE.length;i++){
      const [x0,y0]=ROOF_PROFILE[i-1],[x1,y1]=ROOF_PROFILE[i];
      for(let j=0;j<=20;j++){const y=roofHeight(x0+(x1-x0)*j/20);expect(y).toBeGreaterThanOrEqual(Math.min(y0,y1)-1e-9);expect(y).toBeLessThanOrEqual(Math.max(y0,y1)+1e-9);}
    }
    expect(interpolateProfile(ROOF_PROFILE,-100)).toBe(ROOF_PROFILE[0][1]);
    expect(interpolateProfile(ROOF_PROFILE,100)).toBe(ROOF_PROFILE.at(-1)![1]);
  });
  it('内部车顶节点一阶导数连续，消除折线式后风挡',()=>{
    const e=1e-5;
    for(const [x] of ROOF_PROFILE.slice(1,-1)){
      const l=(roofHeight(x)-roofHeight(x-e))/e,r=(roofHeight(x+e)-roofHeight(x))/e;
      expect(Math.abs(l-r)).toBeLessThan(.001);
    }
  });
  it('后半段按事先选定图线观察区间延后收束，不超过官方车高',()=>{
    expect(roofHeight(1.13)).toBeGreaterThan(1.32);expect(roofHeight(1.13)).toBeLessThan(1.39);
    expect(roofHeight(1.48)).toBeGreaterThan(1.17);expect(roofHeight(1.48)).toBeLessThan(1.26);
    expect(roofHeight(1.8)).toBeGreaterThan(1.06);expect(roofHeight(1.8)).toBeLessThan(1.13);
    for(let x=-1.05;x<=1.86;x+=.01)expect(roofHeight(x)).toBeLessThanOrEqual(A4.height);
  });
  it('前端曲面纵向不折返，圆角内收且左右对称',()=>{
    for(const z of [0,.4,.75,.9]){let last=-Infinity;for(let x=-A4.length/2;x<=2.381;x+=.005){const next=warpBodyX(x,z,.8);expect(next).toBeGreaterThan(last);expect(next).toBeCloseTo(warpBodyX(x,-z,.8),8);last=next;}}
    expect(warpBodyX(-2.381,.88,.8)).toBeGreaterThan(-2.10);
    expect(warpBodyX(-2.381,0,.8)).toBeLessThan(-2.34);
  });
  it('侧窗与座舱映射共用横向曲面，左右镜像且顶窄底宽',()=>{
    for(const x of [-.6,0,.6,1.2]){
      expect(cabinHalfWidth(x,1.05)).toBeGreaterThan(cabinHalfWidth(x,1.38));
      const a=cabinSidePoint(x,1.15,1),b=cabinSidePoint(x,1.15,-1);
      expect(a[0]).toBe(b[0]);expect(a[1]).toBe(b[1]);expect(a[2]).toBe(-b[2]);
    }
  });
  it('B 柱切口保持原图线边界，不让柱顶伸到窗框之外',()=>{
    for(const [x,left] of [[.30,true],[.375,false]] as const){
      const clipped=clipWindow(SIDE_WINDOW_OUTLINE,x,left),[bottom,top]=windowSpan(x);
      const cut=clipped.filter(p=>Math.abs(p[0]-x)<1e-8);
      expect(cut).toHaveLength(2);expect(Math.min(...cut.map(p=>p[1]))).toBeCloseTo(bottom,8);expect(Math.max(...cut.map(p=>p[1]))).toBeCloseTo(top,8);
      expect(top).toBeLessThan(roofHeight(x)-.04);
      expect(clipped.every(p=>left?p[0]<=x+1e-8:p[0]>=x-1e-8)).toBe(true);
    }
    expect(()=>windowSpan(-100)).toThrow('不在侧窗轮廓内');
  });
});
