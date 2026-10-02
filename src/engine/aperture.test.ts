import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {cutApertures} from './aperture';
import {surface} from './geometry';

const square=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]] as const;
const plane=(x=-2)=>surface((u,v)=>[x,2*u-1,2*v-1],4,4);
const area=(g:T.BufferGeometry)=>{
  const p=g.getAttribute('position'),i=g.index!;let sum=0;
  for(let j=0;j<i.count;j+=3){const a=new T.Vector3().fromBufferAttribute(p,i.getX(j)),b=new T.Vector3().fromBufferAttribute(p,i.getX(j+1)),c=new T.Vector3().fromBufferAttribute(p,i.getX(j+2));sum+=b.sub(a).cross(c.sub(a)).length()/2;}
  return sum;
};
describe('前段投影开口',()=>{
  it('真正移除孔内三角面，孔外仍可射线命中，面积正确',()=>{
    const g=cutApertures(plane(),[square],-1),m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));
    expect(area(g)).toBeCloseTo(3,6);
    expect(new T.Raycaster(new T.Vector3(-5,0,0),new T.Vector3(1,0,0)).intersectObject(m)).toHaveLength(0);
    expect(new T.Raycaster(new T.Vector3(-5,.8,.8),new T.Vector3(1,0,0)).intersectObject(m).length).toBeGreaterThan(0);
  });
  it('支持顺逆轮廓、多个孔，保留顶点前缀及单位法线和 UV',()=>{
    const input=plane(),p=input.getAttribute('position');
    const holes=[[[-.8,-.8],[-.3,-.8],[-.3,-.3],[-.8,-.3]],[[.3,.3],[.3,.8],[.8,.8],[.8,.3]]] as [number,number][][];
    const g=cutApertures(input,holes,-1);expect(area(g)).toBeCloseTo(3.5,6);
    expect(Array.from(g.getAttribute('position').array).slice(0,p.array.length)).toEqual(Array.from(p.array));
    const n=g.getAttribute('normal'),uv=g.getAttribute('uv');
    for(let j=0;j<n.count;j++){expect(Math.hypot(n.getX(j),n.getY(j),n.getZ(j))).toBeCloseTo(1,6);expect(n.getX(j)).toBeGreaterThan(.999);expect(uv.getX(j)).toBeGreaterThanOrEqual(0);expect(uv.getX(j)).toBeLessThanOrEqual(1);}
  });
  it('只切 x 限制前的部分，包括跨越限制平面的三角形',()=>{
    const untouched=plane(0),g=cutApertures(untouched,[square],-1);expect(area(g)).toBeCloseTo(4,6);
    const slope=surface((u,v)=>[-2+2*u,2*u-1,2*v-1],1,1);
    const clipped=cutApertures(slope,[square],-1);
    expect(area(clipped)).toBeCloseTo(3.5*Math.SQRT2,6);
  });
  it('拒绝非凸、重复边、非有限轮廓，不修改输入',()=>{
    const input=plane(),before=Array.from(input.index!.array);
    expect(()=>cutApertures(input,[[[0,0],[1,0],[.2,.2],[1,1],[0,1]]],-1)).toThrow('凸');
    expect(()=>cutApertures(input,[[[0,0],[0,0],[1,1]]],-1)).toThrow();
    expect(()=>cutApertures(input,[[[0,0],[1,0],[NaN,1]]],-1)).toThrow('有限');
    cutApertures(input,[square],-1);expect(Array.from(input.index!.array)).toEqual(before);
  });
});
