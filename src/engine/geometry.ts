import * as T from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
export type Point = [number,number,number];

export function surface(fn:(u:number,v:number)=>Point, nu=40,nv=16,options:{analyticNormals?:boolean;flip?:boolean}={}):T.BufferGeometry {
  const p:number[]=[],uv:number[]=[],ind:number[]=[];
  for(let i=0;i<=nu;i++) for(let j=0;j<=nv;j++) {p.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv);}
  for(let i=0;i<nu;i++) for(let j=0;j<nv;j++) {
    const a=i*(nv+1)+j,b=a+nv+1;
    if(options.flip)ind.push(a,a+1,b,b,a+1,b+1);else ind.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
  if(options.analyticNormals){
    // 用同一参数函数求切线，避免边界处只取一侧三角形造成接缝高光。
    const normals=g.getAttribute('normal'),a=new T.Vector3(),b=new T.Vector3(),n=new T.Vector3(),e=1e-5;
    for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){
      const u=i/nu,v=j/nv,um=Math.max(0,u-e),up=Math.min(1,u+e),vm=Math.max(0,v-e),vp=Math.min(1,v+e);
      a.fromArray(fn(up,v)).sub(new T.Vector3(...fn(um,v)));b.fromArray(fn(u,vp)).sub(new T.Vector3(...fn(u,vm)));n.crossVectors(a,b);
      if(n.lengthSq()>1e-24){n.normalize();if(options.flip)n.negate();normals.setXYZ(i*(nv+1)+j,n.x,n.y,n.z);}
    }
  }
  return g;
}

export function polygon(points:Point[],project:'xy'|'zy'='xy'):T.BufferGeometry {
  const contour=points.map(p=>new T.Vector2(project==='xy'?p[0]:p[2],p[1]));
  const indices=T.ShapeUtils.triangulateShape(contour,[]).flat();
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** 先在二维面细分，再映射曲面；避免大三角形穿入弯曲保险杠。 */
export function curvedPanel(points:[number,number][],map:(z:number,y:number)=>Point,options:{maxEdge?:number;analyticNormals?:boolean}={}):T.BufferGeometry {
  const flat=polygon(points.map(([z,y])=>[0,y,z]),'zy');
  const g=new TessellateModifier(options.maxEdge??.065,10).modify(flat);flat.dispose();
  const p=g.getAttribute('position'),source=options.analyticNormals?Array.from(p.array):[],sign=Math.sign(g.getAttribute('normal').getX(0));
  for(let i=0;i<p.count;i++)p.setXYZ(i,...map(p.getZ(i),p.getY(i)));
  g.computeVertexNormals();
  if(options.analyticNormals){
    const normals=g.getAttribute('normal'),a=new T.Vector3(),b=new T.Vector3(),n=new T.Vector3(),e=1e-5;
    for(let i=0;i<p.count;i++){
      const z=source[i*3+2],y=source[i*3+1];
      a.fromArray(map(z,y+e)).sub(new T.Vector3(...map(z,y-e)));b.fromArray(map(z+e,y)).sub(new T.Vector3(...map(z-e,y)));
      n.crossVectors(a,b).normalize().multiplyScalar(sign);normals.setXYZ(i,n.x,n.y,n.z);
    }
  }
  return g;
}

export function tube(points:Point[],radius=.005,closed=false,smooth=true):T.BufferGeometry {
  const curve=smooth ? new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal') : new T.CurvePath<T.Vector3>();
  if(!smooth) {
    const cp=curve as T.CurvePath<T.Vector3>;
    for(let i=1;i<points.length;i++)cp.add(new T.LineCurve3(new T.Vector3(...points[i-1]),new T.Vector3(...points[i])));
    if(closed)cp.add(new T.LineCurve3(new T.Vector3(...points.at(-1)!),new T.Vector3(...points[0])));
  }
  return new T.TubeGeometry(curve,Math.max(12,points.length*(smooth?8:2)),radius,6,closed);
}

/** 在二维边上先采样再投影，防止三维直线弦穿进弯曲的保险杠。 */
export function mapPolyline(points:ReadonlyArray<readonly [number,number]>,map:(a:number,b:number)=>Point,closed=false,step=.025):Point[]{
  const out:Point[]=[];
  const count=closed?points.length:points.length-1;
  for(let i=0;i<count;i++){
    const a=points[i],b=points[(i+1)%points.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
    for(let j=0;j<n;j++){const t=j/n;out.push(map(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));}
  }
  if(!closed)out.push(map(...points.at(-1)!));return out;
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
