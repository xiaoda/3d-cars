import {describe,it,expect} from 'vitest';
import {roofPoint,roofHeight,SIDE_WINDOW_OUTLINE} from './bodyShape';
import {windshieldPoint,windshieldBoundary,sideWindowPanels,bPillar,doorOutline,exteriorSidePoint} from './cabinSurface';

describe('v0.5 座舱边界与真实曲面上的分缝',()=>{
  it('风挡横向边界有弧度，左右镜像且玻璃覆盖在共用车顶之外',()=>{
    for(const end of [-1,1] as const)for(const u of [0,.25,.5,.75,1])for(const v of [0,.2,.5]){
      const a=windshieldPoint(end,u,v),b=windshieldPoint(end,u,1-v);
      expect(a[0]).toBeCloseTo(b[0],8);expect(a[1]).toBeCloseTo(b[1],8);expect(a[2]).toBeCloseTo(-b[2],8);
      expect(a[1]).toBeLessThan(roofHeight(a[0])+.01);
      expect(a[1]).toBeGreaterThan(.95);expect(Math.abs(a[2])).toBeLessThan(.8);
      const q=a[2]/roofPoint(a[0],1)[2],base=roofPoint(a[0],q);
      expect(a[1]-base[1]).toBeCloseTo(.003,5);
    }
    expect(windshieldPoint(-1,0,0)[0]-windshieldPoint(-1,0,.5)[0]).toBeGreaterThan(.10);
    expect(windshieldPoint(1,1,.5)[0]-windshieldPoint(1,1,0)[0]).toBeGreaterThan(.08);
  });
  it('密封条边界完整闭合且只取自玻璃同一参数曲面',()=>{
    for(const end of [-1,1] as const){
      const border=windshieldBoundary(end);
      expect(border.length).toBeGreaterThan(60);
      expect(border.every(p=>p.every(Number.isFinite))).toBe(true);
      expect(border[0]).toEqual(windshieldPoint(end,0,0));
      for(let i=1;i<border.length;i++)expect(Math.hypot(...border[i].map((n,j)=>n-border[i-1][j]))).toBeLessThan(.07);
    }
  });
  it('侧窗分成前窗、后门窗与后三角窗，分割不改变原二维轮廓',()=>{
    const panels=sideWindowPanels();expect(panels).toHaveLength(3);
    for(const poly of panels){expect(poly.length).toBeGreaterThan(2);expect(poly.every(p=>p.every(Number.isFinite))).toBe(true);}
    const maxX=Math.max(...SIDE_WINDOW_OUTLINE.map(p=>p[0]));
    expect(Math.max(...panels[2].map(p=>p[0]))).toBeCloseTo(maxX,6);
    expect(panels[0].every(([x,y])=>x-.35*y<=-.18+1e-8)).toBe(true);
  });
  it('B 柱沿侧窗斜置，前后玻璃裁切与柱两侧共用同一条边界',()=>{
    const pillar=bPillar(),bottom=pillar.reduce((a,b)=>a[1]<b[1]?a:b),top=pillar.reduce((a,b)=>a[1]>b[1]?a:b);
    expect(top[0]-bottom[0]).toBeGreaterThan(.04);
    for(const [x,y] of pillar){expect(x-.35*y).toBeGreaterThanOrEqual(-.18-1e-8);expect(x-.35*y).toBeLessThanOrEqual(-.105+1e-8);}
  });
  it('图纸门框下半圈完整、有限，映射到实际蒙皮且左右对称',()=>{
    for(const index of [0,1] as const){
      const outline=doorOutline(index);expect(outline.length).toBeGreaterThan(25);
      expect(Math.min(...outline.map(p=>p[1]))).toBeGreaterThan(.2);
      expect(Math.min(...outline.map(p=>p[1]))).toBeLessThan(.35);
      if(index===0){
        // 图线 951 只有 B 柱边与底边，必须接上 950 的前沿，不能漏掉前门边界。
        expect(outline[0][1]).toBeGreaterThan(.9);expect(outline.at(-1)![1]).toBeGreaterThan(.9);
        expect(outline.at(-1)![0]).toBeLessThan(-.8);
      }
      for(const [x,y] of outline){
        const a=exteriorSidePoint(x,y,1),b=exteriorSidePoint(x,y,-1);
        expect(a.every(Number.isFinite)).toBe(true);expect(a[0]).toBeCloseTo(b[0],8);expect(a[1]).toBeCloseTo(b[1],8);expect(a[2]).toBeCloseTo(-b[2],8);
      }
    }
  });
});
