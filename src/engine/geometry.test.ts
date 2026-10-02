import {describe,it,expect} from 'vitest';
import {mapPolyline,surface,curvedPanel,reverseFaces} from './geometry';
import {warpBodyX} from '../data/bodyShape';

describe('先采样后映射的曲面饰条',()=>{
  it('翻转索引及非索引网格时保持 UV 对应，连续翻转两次恢复原网格',()=>{
    const indexed=surface((u,v)=>[u,0,v],3,2),nonIndexed=indexed.toNonIndexed();
    for(const g of [indexed,nonIndexed]){
      const before=Object.fromEntries(Object.entries(g.attributes).map(([key,a])=>[key,Array.from(a.array)])),indices=g.index?Array.from(g.index.array):null;
      const y=g.getAttribute('normal').getY(0);reverseFaces(g);
      expect(g.getAttribute('normal').getY(0)).toBe(-y);
      if(indices)expect(g.index!.getX(1)).toBe(indices[2]);
      else expect(g.getAttribute('uv').getX(1)).toBe(before.uv[4]);
      reverseFaces(g);
      for(const [key,a] of Object.entries(g.attributes))expect(Array.from(a.array)).toEqual(before[key]);
      if(indices)expect(Array.from(g.index!.array)).toEqual(indices);g.dispose();
    }
  });
  it('细分贴面可使用解析映射法线，不把高光切成独立三角面',()=>{
    const g=curvedPanel([[0,0],[1,0],[1,1],[0,1]],(z,y)=>[z*z,y,z],{maxEdge:.1,analyticNormals:true});
    const p=g.getAttribute('position'),n=g.getAttribute('normal');
    for(let i=0;i<p.count;i++){
      const z=p.getZ(i),length=Math.hypot(1,2*z);
      expect(n.getX(i)).toBeCloseTo(-1/length,4);expect(n.getZ(i)).toBeCloseTo(2*z/length,4);
    }g.dispose();
  });
  it('数值微分法线与连续曲面相符，翻面时同步反转三角形和法线',()=>{
    for(const flip of [false,true]){
      const g=surface((u,v)=>[u,u*u,v],12,8,{analyticNormals:true,flip});
      const p=g.getAttribute('position'),n=g.getAttribute('normal'),sign=flip?-1:1;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),length=Math.hypot(2*x,1);
        expect(n.getX(i)).toBeCloseTo(sign*2*x/length,4);expect(n.getY(i)).toBeCloseTo(-sign/length,4);
        expect(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))).toBeCloseTo(1,5);
      }
      expect(g.index!.getX(1)).toBe(flip?1:9);g.dispose();
    }
  });
  it('保留端点，并让每个采样点落在非线性曲面上',()=>{
    const map=(z:number,y:number):[number,number,number]=>[warpBodyX(-2.381,z,y)-.027,y,z];
    const points=mapPolyline([[.52,.263],[.85,.250]],map);
    expect(points.length).toBeGreaterThan(10);
    expect(points[0]).toEqual(map(.52,.263));expect(points.at(-1)).toEqual(map(.85,.250));
    for(const [x,y,z] of points)expect(x).toBeCloseTo(warpBodyX(-2.381,z,y)-.027,9);
  });
  it('闭合轮廓不重复终点，仍包含四个角点',()=>{
    const p=mapPolyline([[0,0],[1,0],[1,1],[0,1]],(x,y)=>[x,y,0],true,.2);
    expect(p).toHaveLength(20);expect(p[0]).not.toEqual(p.at(-1));
    for(const corner of [[0,0,0],[1,0,0],[1,1,0],[0,1,0]])expect(p).toContainEqual(corner);
  });
});
