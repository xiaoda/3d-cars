import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {buildCar} from './car';
import {FRONT_DEPTH,frontPoint} from '../data/frontShape';
import {DEFAULT_SETTINGS} from '../data/a4';

describe('v0.6 车头凹腔装配',()=>{
  it('格栅与左右灯/进气口是真实开口，背板在原蒙皮后',()=>{
    const car=buildCar();car.group.updateMatrixWorld(true);
    const shell=[car.group.getObjectByName('车身连续曲面')!,car.group.getObjectByName('前端封口')!];
    const samples:[string,number,number,number][]=[['Singleframe 格栅',0,.55,FRONT_DEPTH.grille]];
    for(const side of [-1,1])samples.push([`前灯腔背板${side}`,side*.65,.67,FRONT_DEPTH.lamp],[`前侧进气口${side}`,side*.72,.37,FRONT_DEPTH.intake]);
    for(const [name,z,y,depth] of samples){
      const ray=new T.Raycaster(new T.Vector3(-5,y,z),new T.Vector3(1,0,0));ray.far=5+frontPoint(z,y,depth+.015)[0];
      expect(ray.intersectObjects(shell),`${name} 不能有完整蒙皮遮挡`).toHaveLength(0);
      const hit=ray.intersectObject(car.group.getObjectByName(name)!)[0];expect(hit).toBeTruthy();
      expect(hit.point.x-frontPoint(z,y)[0]).toBeCloseTo(depth,2);
    }car.dispose();
  });
  it('灯罩透明且不投实心阴影，白模露出凹腔，恢复材质后可导出',()=>{
    const car=buildCar(),lamp=car.group.getObjectByName('前灯罩1') as T.Mesh;
    expect((lamp.material as T.MeshPhysicalMaterial).transparent).toBe(true);
    expect((lamp.material as T.MeshPhysicalMaterial).opacity).toBeLessThan(.3);
    expect(lamp.castShadow).toBe(false);
    expect(car.group.getObjectByName('灯内反射杯1-0')).toBeTruthy();
    expect(car.group.getObjectByName('格栅内壁')).toBeTruthy();
    car.update({...DEFAULT_SETTINGS,mode:'clay'});expect(lamp.visible).toBe(false);
    car.update(DEFAULT_SETTINGS);expect(lamp.visible).toBe(true);car.dispose();
  });
  it('左右凹腔壁面、倒角和背板绕序朝向可见腔内，不靠 DoubleSide 掩盖反法线',()=>{
    const car=buildCar();
    const names=['格栅倒角框','格栅内壁','Singleframe 格栅',...[-1,1].flatMap(side=>[`前灯腔${side}倒角框`,`前灯腔${side}内壁`,`前灯腔背板${side}`,`进气口${side}内壁`,`前侧进气口${side}`,`灯内反射杯${side}-0`,`灯内反射杯${side}-1`])];
    for(const name of names){
      const mesh=car.group.getObjectByName(name) as T.Mesh,g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal');
      for(let i=0;i<n.count;i+=13)expect(n.getX(i),`${name} normal ${i}`).toBeLessThan(0);
      const count=g.index?.count??p.count;
      for(let i=0;i<count;i+=39){const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j);if(ids.some(id=>id>=p.count))continue;
        const [a,b,c]=ids.map(id=>new T.Vector3().fromBufferAttribute(p,id)),face=b.sub(a).cross(c.sub(a));
        expect(face.x,`${name} face ${i}`).toBeLessThanOrEqual(0);
      }
    }car.dispose();
  });
});
