import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {buildCar} from './car';
import {A4,AXLES,DEFAULT_SETTINGS} from '../data/a4';

describe('纯代码车模的几何与生命周期',()=>{
  it('官方车身宽长约束与轴心位置正确',()=>{
    const car=buildCar();
    const body=car.group.getObjectByName('车身连续曲面') as T.Mesh;
    body.geometry.computeBoundingBox();
    const size=body.geometry.boundingBox!.getSize(new T.Vector3());
    // 整车尺寸包括外侧饰件，不能只检查蒙皮然后忽略突出物。
    const overall=new T.Box3().setFromObject(car.group).getSize(new T.Vector3());
    expect(overall.x).toBeCloseTo(A4.length,3);
    expect(overall.y).toBeCloseTo(A4.height,3);
    expect(overall.z).toBeCloseTo(A4.mirrorWidth,3);
    expect(size.x).toBeLessThan(A4.length);
    expect(size.z).toBeCloseTo(A4.width,2);
    const front=car.group.getObjectByName('前轮-1')!;
    const rear=car.group.getObjectByName('后轮-1')!;
    expect(front.position.x).toBeCloseTo(AXLES.front,6);
    expect(rear.position.x-front.position.x).toBeCloseTo(A4.wheelbase,6);
    car.dispose();
  });
  it('所有曲面顶点、法线均有效，复杂度受控',()=>{
    const car=buildCar();let triangles=0;
    car.group.traverse(o=>{if(o instanceof T.Mesh){
      for(const attr of ['position','normal']){
        const a=o.geometry.getAttribute(attr);expect(a).toBeTruthy();
        for(const n of a.array)expect(Number.isFinite(n)).toBe(true);
      }
      triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
    }});
    expect(triangles).toBeGreaterThan(10000);expect(triangles).toBeLessThan(250000);car.dispose();
  });
  it('模式和转向更新不产生新几何，只有前轮转向',()=>{
    const car=buildCar();const count=car.group.children.length;
    car.update({...DEFAULT_SETTINGS,mode:'clay',steering:25});
    expect(car.group.children.length).toBe(count);
    expect(car.group.getObjectByName('前轮-1')!.rotation.y).not.toBe(0);
    expect(car.group.getObjectByName('后轮-1')!.rotation.y).toBe(0);
    car.update({...DEFAULT_SETTINGS,mode:'wire'});car.update(DEFAULT_SETTINGS);car.dispose();
  });
  it('曲面格栅始终在保险杠之前，而非被大三角形遮挡',()=>{
    const car=buildCar();car.group.updateMatrixWorld(true);
    const grille=car.group.getObjectByName('Singleframe 格栅')!;
    const bumper=car.group.getObjectByName('前端封口')!;
    for(const z of [-.4,-.2,0,.2,.4]) {
      const ray=new T.Raycaster(new T.Vector3(-5,.55,z),new T.Vector3(1,0,0));
      const g=ray.intersectObject(grille)[0],b=ray.intersectObject(bumper)[0];
      expect(g).toBeTruthy();expect(b).toBeTruthy();expect(g.distance).toBeLessThan(b.distance);
    }
    car.dispose();
  });
  it('导出法线为单位向量，包含参数曲面极点',()=>{
    const car=buildCar();const invalid:string[]=[];
    car.group.traverse(o=>{if(o instanceof T.Mesh){
      const n=o.geometry.getAttribute('normal');
      for(let i=0;i<n.count;i++)if(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)>.001){invalid.push(o.name);break;}
    }});
    car.dispose();expect(invalid).toEqual([]);
  });
});
