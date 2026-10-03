import * as T from 'three';
import data from './patches/front-corner.json';
import {mix,splitPatch} from '../../modeling/bezier';
import {edgeIndices,type EdgeName} from '../../modeling/patchGraph';
import {tessellatePatches} from '../../modeling/tessellation';
import {parsePatch,type CubicPatch,type PatchEdge,type Vec3} from '../../modeling/types';
export const FRONT_CORNER_DATA=data;
const add=(a:Vec3,b:number[]):Vec3=>a.map((x,i)=>x+b[i]) as Vec3;
const line=(a:Vec3,b:Vec3)=>[a,mix(a,b,1/3),mix(a,b,2/3),b];
const edge=(p:CubicPatch,name:EdgeName)=>edgeIndices(name).map(i=>p.points[i]);
const strip=(id:string,a:Vec3[],b:Vec3[]):CubicPatch=>parsePatch({id,points:Array.from({length:4},(_,i)=>a.map((p,j)=>mix(p,b[j],i/3))).flat()});

export function makeFrontCornerPatches(bulge=0){
  if(!Number.isFinite(bulge)||Math.abs(bulge)>.04)throw new Error('拱度控制点实验仅允许 ±40 mm');
  const hood=parsePatch(data.hood);for(const index of [6,10])hood.points[index][1]+=bulge;
  const [inner,outer]=splitPatch(hood,'v',data.hoodSplitV),crown=parsePatch(data.crown);
  const side=strip('fender-side',edge(crown,'v1'),data.wingLower as Vec3[]);
  // side 的行沿纵向，列沿下降方向；strip 的参数排列须转置。
  side.points=side.points.map((_,i)=>side.points[(i%4)*4+Math.floor(i/4)]);
  const topA=edge(outer,'u1'),topB=edge(crown,'u1');
  const lowA=topA.map((p,i)=>add(p,[[-.005,-.1,0],[-.01,-.11,.006],[-.035,-.105,.008],[-.055,-.105,.008]][i]));
  const lowB=data.lampLowerOuter.map(p=>[...p] as Vec3);lowB[0]=lowA[3];
  const lowerA=strip('lamp-lower-inner',lowA,lowA.map(p=>add(p,data.lowerBandOffset)));
  const lowerB=strip('lamp-lower-outer',lowB,lowB.map(p=>add(p,data.lowerBandOffset)));
  const opening=[topA,topB,edge(side,'u1'),[...lowB].reverse(),[...lowA].reverse(),line(lowA[0],topA[0])];
  const rims=opening.map((c,i)=>strip(`rim-${i}`,c,c.map(p=>add(p,data.rimDepth))));
  const patches=[inner,outer,crown,side,lowerA,lowerB,...rims],edges:PatchEdge[]=[];
  const join=(a:CubicPatch,ea:EdgeName,b:CubicPatch,eb:EdgeName,continuity:'smooth'|'crease'='crease',reverse=false)=>edges.push({patchA:a.id,edgeA:ea,patchB:b.id,edgeB:eb,continuity,reverse});
  join(inner,'v1',outer,'v0','smooth');join(outer,'v1',crown,'v0');join(crown,'v1',side,'v0');join(lowerA,'v1',lowerB,'v0');
  join(outer,'u1',rims[0],'u0');join(crown,'u1',rims[1],'u0');join(side,'u1',rims[2],'u0');
  join(lowerB,'u0',rims[3],'u0','crease',true);join(lowerA,'u0',rims[4],'u0','crease',true);
  rims.forEach((p,i)=>join(p,'v1',rims[(i+1)%rims.length],'v0'));
  return {patches,edges,opening};
}

export function buildFrontCorner(bulge=0,segments=24){
  const {patches,edges}=makeFrontCornerPatches(bulge),result=tessellatePatches(patches,edges,segments);
  const actual=[...result.diagnostics.boundaries].sort(),declared=Object.keys(data.boundaryPolicy).sort();
  if(JSON.stringify(actual)!==JSON.stringify(declared))throw new Error('实际开放边界与局部小样声明不一致');
  const group=new T.Group();group.name=data.id;
  const material=new T.MeshStandardMaterial({color:0xd9ded9,roughness:.48,metalness:0,side:T.DoubleSide});
  const controlGroup=new T.Group();controlGroup.name='control-net';
  const lineMaterial=new T.LineBasicMaterial({color:0x66d7ca,transparent:true,opacity:.7,depthTest:false});
  for(const mirror of [false,true])for(const [i,m] of result.meshes.entries()){
    const positions=m.positions.map((x,k)=>mirror&&k%3===2?-x:x),normals=m.normals.map((x,k)=>mirror&&k%3===2?-x:x),indices=[...m.indices];
    if(mirror)for(let j=0;j<indices.length;j+=3)[indices[j+1],indices[j+2]]=[indices[j+2],indices[j+1]];
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,material);mesh.name=`${m.id}-${mirror?'right':'left'}`;mesh.userData={patchId:m.id,evidenceKind:'approximation',bulge};group.add(mesh);
    if(m.id.startsWith('rim-'))continue;
    const points=patches[i].points.map(p=>new T.Vector3(p[0],p[1],mirror?-p[2]:p[2]));
    for(let k=0;k<4;k++)for(const dir of [0,1]){
      const g=new T.BufferGeometry().setFromPoints(Array.from({length:4},(_,j)=>points[dir?k*4+j:j*4+k]));controlGroup.add(new T.Line(g,lineMaterial));
    }
  }
  return {group,controlGroup,patches,diagnostics:result.diagnostics,triangleCount:result.triangleCount*2,
    dispose(){group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});controlGroup.traverse(o=>{if(o instanceof T.Line)o.geometry.dispose();});material.dispose();lineMaterial.dispose();}};
}
