import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {buildCar} from './car';
import {A4,AXLES,DEFAULT_SETTINGS} from '../data/a4';
import {windowSpan} from '../data/bodyShape';
import {BODY_STATIONS,bodySidePoint} from '../data/bodyShell';

describe('纯代码车模的几何与生命周期',()=>{
  it('新车身与端面法线朝外，轮拱收边位于共享截面上',()=>{
    const car=buildCar(),body=car.group.getObjectByName('车身连续曲面') as T.Mesh;
    const normals=body.geometry.getAttribute('normal');
    const center=BODY_STATIONS.findIndex(x=>Math.abs(x)<1e-8);
    expect(center).toBeGreaterThan(0);
    expect(normals.getY(center*101+50)).toBeGreaterThan(.98);
    expect(normals.getZ(center*101+83)).toBeGreaterThan(.8);
    for(const [name,end] of [['前端封口',-1],['后端封口',1]] as const){
      const cap=car.group.getObjectByName(name) as T.Mesh,n=cap.geometry.getAttribute('normal');
      expect(n.getX(50*33+16)*end).toBeGreaterThan(.8);
    }
    for(const axle of [AXLES.front,AXLES.rear])for(const side of [-1,1]){
      const rim=car.group.getObjectByName(`轮拱边缘${side}-${axle}`) as T.Mesh;
      const p=rim.geometry.getAttribute('position');
      // Tube 的所有顶点距离用于收边的车身横截面不超过半径 + 数值 / 采样误差。
      for(let i=0;i<p.count;i+=11){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),expected=bodySidePoint(x,y,side,.002);
        expect(Math.abs(z-expected[2])).toBeLessThan(.012);
      }
    }
    car.dispose();
  });
  it('实际网格端部边界逐顶点相合，平滑区域两侧法线一致',()=>{
    const car=buildCar(),body=car.group.getObjectByName('车身连续曲面') as T.Mesh;
    const bp=body.geometry.getAttribute('position'),bn=body.geometry.getAttribute('normal');
    for(const [name,row] of [['前端封口',0],['后端封口',BODY_STATIONS.length-1]] as const){
      const cap=car.group.getObjectByName(name) as T.Mesh,cp=cap.geometry.getAttribute('position'),cn=cap.geometry.getAttribute('normal');
      for(let j=0;j<=100;j++){
        const a=row*101+j,b=j*33+32;
        expect(new T.Vector3().fromBufferAttribute(bp,a).distanceTo(new T.Vector3().fromBufferAttribute(cp,b))).toBeLessThan(1e-6);
        if(j>0&&j<100)expect(new T.Vector3().fromBufferAttribute(bn,a).dot(new T.Vector3().fromBufferAttribute(cn,b))).toBeGreaterThan(.998);
      }
    }car.dispose();
  });
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
  it('侧窗位于共用侧框之外，B 柱不突出原始窗顶',()=>{
    const car=buildCar();car.group.updateMatrixWorld(true);
    for(const [x,y,i] of [[-.3,1.15,0],[.75,1.15,1]]){
      const ray=new T.Raycaster(new T.Vector3(x,y,5),new T.Vector3(0,0,-1));
      const glass=ray.intersectObject(car.group.getObjectByName(`侧窗-1-${i}`)!)[0];
      const frame=ray.intersectObject(car.group.getObjectByName('座舱侧框1')!)[0];
      expect(glass).toBeTruthy();expect(frame).toBeTruthy();expect(glass.distance).toBeLessThan(frame.distance);
    }
    const b=new T.Box3().setFromObject(car.group.getObjectByName('B柱1')!);
    expect(b.max.y).toBeLessThanOrEqual(Math.max(windowSpan(.30)[1],windowSpan(.375)[1])+1e-6);car.dispose();
  });
  it('前后灯罩跟随新保险杠曲面，不被车身遮住',()=>{
    const car=buildCar();car.group.updateMatrixWorld(true);
    for(const side of [-1,1]){
      const front=new T.Raycaster(new T.Vector3(-5,.67,side*.65),new T.Vector3(1,0,0));
      const f=front.intersectObject(car.group.getObjectByName(`前灯罩${side}`)!)[0],fb=front.intersectObject(car.group.getObjectByName('前端封口')!)[0];
      expect(f).toBeTruthy();expect(fb).toBeTruthy();expect(f.distance).toBeLessThan(fb.distance);
      const rear=new T.Raycaster(new T.Vector3(5,.83,side*.65),new T.Vector3(-1,0,0));
      const r=rear.intersectObject(car.group.getObjectByName(`后灯罩${side}`)!)[0],rb=rear.intersectObject(car.group.getObjectByName('后端封口')!)[0];
      expect(r).toBeTruthy();expect(rb).toBeTruthy();expect(r.distance).toBeLessThan(rb.distance);
    }car.dispose();
  });
  it('灯罩覆盖区域密集射线检查：背后有车身且没有蒙皮穿出',()=>{
    const car=buildCar();car.group.updateMatrixWorld(true);
    for(const [prefix,end] of [['前',-1],['后',1]] as const)for(const side of [-1,1]){
      const lamp=car.group.getObjectByName(`${prefix}灯罩${side}`)!;
      const shell=car.group.getObjectByName('车身连续曲面')!,cap=car.group.getObjectByName(`${prefix}端封口`)!;let samples=0;
      for(let y=.59;y<=.92;y+=.03)for(let z=.42;z<=.865;z+=.03){
        const ray=new T.Raycaster(new T.Vector3(end*5,y,side*z),new T.Vector3(-end,0,0)),hit=ray.intersectObject(lamp)[0];
        if(!hit)continue;samples++;const body=ray.intersectObjects([shell,cap])[0];expect(body).toBeTruthy();expect(hit.distance).toBeLessThan(body.distance);
      }
      expect(samples).toBeGreaterThan(30);
    }car.dispose();
  });
});
