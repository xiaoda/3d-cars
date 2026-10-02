import * as T from 'three';

export type Outline=ReadonlyArray<readonly [number,number]>; // [z,y]，单位米
type Vertex={id:number;p:number[];n:number[];uv:number[]};
type Plane=(v:Vertex)=>number;

/** 对凸多边形棱柱做真实三角面差集，不使用黑色贴面伪造开口。
 * 仅接受 position / normal / uv 的静态车身几何；保留原属性前缀供共边回归使用。
 * x >= frontLimit 的几何永不移除，跨界三角形精确分割。输入归调用者所有。
 */
export function cutApertures(input:T.BufferGeometry,outlines:readonly Outline[],frontLimit:number):T.BufferGeometry {
  if(!Number.isFinite(frontLimit))throw new Error('开口纵向限制必须有限');
  const holes=outlines.map(points=>{
    if(points.length<3||!points.every(p=>p.every(Number.isFinite)))throw new Error('轮廓至少需要三个有限坐标');
    const area=points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0);
    if(Math.abs(area)<1e-12)throw new Error('轮廓须为非退化凸多边形');
    const sign=Math.sign(area),planes:Plane[]=[v=>frontLimit-v.p[0]];
    points.forEach((a,i)=>{
      const b=points[(i+1)%points.length],dz=b[0]-a[0],dy=b[1]-a[1];
      if(Math.hypot(dz,dy)<1e-9||points.some(p=>sign*(dz*(p[1]-a[1])-dy*(p[0]-a[0]))< -1e-10))throw new Error('轮廓须为凸多边形且无重复边');
      planes.push(v=>sign*(dz*(v.p[1]-a[1])-dy*(v.p[2]-a[0])));
    });
    return {planes,minZ:Math.min(...points.map(p=>p[0])),maxZ:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))};
  });
  if(Object.keys(input.attributes).some(k=>!['position','normal','uv'].includes(k))||Object.keys(input.morphAttributes).length||input.groups.length)throw new Error('开口裁切仅支持无分组的 position / normal / uv 静态几何');
  const source=input.getAttribute('position'),normal=input.getAttribute('normal'),uv=input.getAttribute('uv');
  if(!source||!normal||!uv)throw new Error('开口裁切缺少 position / normal / uv');
  const positions=Array.from(source.array),normals=Array.from(normal.array),uvs=Array.from(uv.array),indices:number[]=[];
  const read=(id:number):Vertex=>({id,p:[source.getX(id),source.getY(id),source.getZ(id)],n:[normal.getX(id),normal.getY(id),normal.getZ(id)],uv:[uv.getX(id),uv.getY(id)]});
  const interpolate=(a:Vertex,b:Vertex,t:number):Vertex=>{
    if(t<1e-12)return a;if(t>1-1e-12)return b;
    const mix=(x:number[],y:number[])=>x.map((v,i)=>v+(y[i]-v)*t),n=mix(a.n,b.n),length=Math.hypot(...n);
    return {id:-1,p:mix(a.p,b.p),n:length>1e-12?n.map(v=>v/length):[...a.n],uv:mix(a.uv,b.uv)};
  };
  const split=(poly:Vertex[],plane:Plane):[Vertex[],Vertex[]]=>{
    const inside:Vertex[]=[],outside:Vertex[]=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a),db=plane(b),ia=da>=0,ib=db>=0;
      (ia?inside:outside).push(a);
      if(ia!==ib){const v=interpolate(a,b,da/(da-db));inside.push(v);outside.push(v);}
    }return [inside,outside];
  };
  const write=(v:Vertex)=>{if(v.id<0){v.id=positions.length/3;positions.push(...v.p);normals.push(...v.n);uvs.push(...v.uv);}return v.id;};
  const emit=(poly:Vertex[])=>{
    for(let i=1;i<poly.length-1;i++){
      const [a,b,c]=[poly[0],poly[i],poly[i+1]],ab=b.p.map((v,j)=>v-a.p[j]),ac=c.p.map((v,j)=>v-a.p[j]);
      if(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])<1e-14)continue;
      indices.push(write(a),write(b),write(c));
    }
  };
  const count=input.index?.count??source.count;
  for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(j=>input.index?input.index.getX(i+j):i+j);
    const candidates=holes.filter(h=>ids.some(id=>source.getX(id)<frontLimit)&&
      !ids.every(id=>source.getZ(id)<h.minZ)&&!ids.every(id=>source.getZ(id)>h.maxZ)&&!ids.every(id=>source.getY(id)<h.minY)&&!ids.every(id=>source.getY(id)>h.maxY));
    if(!candidates.length){indices.push(...ids);continue;}
    let parts=[ids.map(read)];
    for(const hole of candidates){
      const remaining:Vertex[][]=[];
      for(let polygon of parts){
        for(const plane of hole.planes){
          const [inside,outside]=split(polygon,plane);if(outside.length>=3)remaining.push(outside);polygon=inside;if(polygon.length<3)break;
        } // 留在所有半空间内的最后一块即孔内片，丢弃。
      }parts=remaining;
    }
    parts.forEach(emit);
  }
  const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));result.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));result.setIndex(indices);return result;
}
