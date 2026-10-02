import * as T from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
export type Point = [number,number,number];

export function surface(fn:(u:number,v:number)=>Point, nu=40,nv=16):T.BufferGeometry {
  const p:number[]=[],uv:number[]=[],ind:number[]=[];
  for(let i=0;i<=nu;i++) for(let j=0;j<=nv;j++) {p.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv);}
  for(let i=0;i<nu;i++) for(let j=0;j<nv;j++) {
    const a=i*(nv+1)+j,b=a+nv+1;
    ind.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();return g;
}

export function polygon(points:Point[],project:'xy'|'zy'='xy'):T.BufferGeometry {
  const contour=points.map(p=>new T.Vector2(project==='xy'?p[0]:p[2],p[1]));
  const indices=T.ShapeUtils.triangulateShape(contour,[]).flat();
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** 先在二维面细分，再映射曲面；避免大三角形穿入弯曲保险杠。 */
export function curvedPanel(points:[number,number][],map:(z:number,y:number)=>Point):T.BufferGeometry {
  const flat=polygon(points.map(([z,y])=>[0,y,z]),'zy');
  const g=new TessellateModifier(.065,8).modify(flat);flat.dispose();
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setXYZ(i,...map(p.getZ(i),p.getY(i)));
  g.computeVertexNormals();return g;
}

export function tube(points:Point[],radius=.005,closed=false,smooth=true):T.BufferGeometry {
  const curve=smooth ? new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal') : new T.CurvePath<T.Vector3>();
  if(!smooth) {
    const cp=curve as T.CurvePath<T.Vector3>;
    for(let i=1;i<points.length;i++)cp.add(new T.LineCurve3(new T.Vector3(...points[i-1]),new T.Vector3(...points[i])));
    if(closed)cp.add(new T.LineCurve3(new T.Vector3(...points.at(-1)!),new T.Vector3(...points[0])));
  }
  return new T.TubeGeometry(curve,Math.max(12,points.length*8),radius,6,closed);
}

export function mesh(g:T.BufferGeometry,m:T.Material,name:string):T.Mesh {
  // 参数曲面的收拢点或未被三角化引用的共线点可能具有零法线；
  // 使用相邻有效法线补齐，并归一化 LatheGeometry 的端点法线，保证 glTF 合规。
  const normals=g.getAttribute('normal');
  if(normals){
    const n=new T.Vector3();
    for(let i=0;i<normals.count;i++){
      n.fromBufferAttribute(normals,i);
      if(n.lengthSq()<1e-12){
        for(let j=i+1;j<normals.count;j++){n.fromBufferAttribute(normals,j);if(n.lengthSq()>1e-12)break;}
        if(n.lengthSq()<1e-12)n.set(0,1,0);
      }
      n.normalize();normals.setXYZ(i,n.x,n.y,n.z);
    }
  }
  const o=new T.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;return o;
}
