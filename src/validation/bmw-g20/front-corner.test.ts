import {describe,expect,it} from 'vitest';
import {buildFrontCorner,makeFrontCornerPatches,FRONT_CORNER_DATA} from '../../vehicles/bmw-g20/frontCorner';
import {Mesh,Raycaster,Vector3} from 'three';
import config from '../../../docs/research/bmw-g20/config-lock.json';

describe('BMW 局部曲面小样',()=>{
  it('授权仅为有限局部白模，不把资料、相机或完整造型关标记通过',()=>{
    expect(config.status).toBe('partial');expect(config.studyApproval.allowDetailedSurfaces).toBe(false);
    expect(config.surfaceStudyApproval.allowFrontCornerPrototype).toBe(true);
    expect(config.surfaceStudyApproval.allowFullCar).toBe(false);
    expect(config.surfaceStudyApproval.cameraPolicy.qualitativeOnly).toEqual(['P90549635']);
    expect(FRONT_CORNER_DATA.sourceIds.every(s=>!config.holdoutSourceIds.includes(s))).toBe(true);
  });
  it('共边、法线、三角形通过；所有开放边有明确的截断/开口用途',()=>{
    const model=buildFrontCorner();expect(model.diagnostics.maxGap).toBeLessThan(1e-7);
    expect(model.diagnostics.maxSmoothAngleDeg).toBeLessThan(1);
    expect([...model.diagnostics.boundaries].sort()).toEqual(Object.keys(model.boundaryPolicy).sort());
    expect(model.triangleCount).toBeLessThan(30000);expect(model.triangleCount).toBeGreaterThan(1000);
    model.dispose();
  });
  it('左右镜像位置及法线正确，不靠负缩放或 DoubleSide 隐藏反面',()=>{
    const model=buildFrontCorner();const meshes=model.group.children.filter(o=>o instanceof Mesh) as Mesh[];
    const left=meshes.filter(o=>o.name.endsWith('-left')),right=meshes.filter(o=>o.name.endsWith('-right'));
    expect(left.length).toBe(13);expect(right.length).toBe(13);
    left.forEach((mesh,i)=>{const a=mesh.geometry.getAttribute('position'),b=right[i].geometry.getAttribute('position'),an=mesh.geometry.getAttribute('normal'),bn=right[i].geometry.getAttribute('normal');
      for(let j=0;j<a.count;j++){expect(a.getX(j)).toBe(b.getX(j));expect(a.getY(j)).toBe(b.getY(j));expect(a.getZ(j)).toBeCloseTo(-b.getZ(j),8);expect(an.getZ(j)).toBeCloseTo(-bn.getZ(j),8);}
      const ai=mesh.geometry.index!.array,bi=right[i].geometry.index!.array;
      for(let j=0;j<ai.length;j+=3){expect(ai[j]).toBe(bi[j]);expect(ai[j+1]).toBe(bi[j+2]);}
    });model.dispose();
  });
  it('灯口中心前后贯通，有内返边但没有封口黑面',()=>{
    const model=buildFrontCorner();model.group.updateMatrixWorld(true);
    const ray=new Raycaster(new Vector3(-3,.675,.69),new Vector3(1,0,0),0,1.3);
    expect(ray.intersectObject(model.group,true)).toHaveLength(0);
    expect(model.group.children.some(o=>o.name.startsWith('rim-'))).toBe(true);model.dispose();
  });
  it('中心镜像接边的横向法线为零，不在机盖中线制造隐藏折脊',()=>{
    const model=buildFrontCorner(),mesh=model.group.children[0] as Mesh,p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');
    for(let row=0;row<=24;row++){const i=row*25;expect(p.getZ(i)).toBe(0);expect(n.getZ(i)).toBeCloseTo(0,8);}
    model.dispose();
  });
  it('局部拱度只改变机盖面内，灯口/外边保持原位，恢复可再生同一网格',()=>{
    const base=makeFrontCornerPatches(0),edited=makeFrontCornerPatches(.04);
    expect(base.patches[0].points).not.toEqual(edited.patches[0].points);
    for(const p of base.patches.filter(p=>!p.id.startsWith('hood-')))expect(p).toEqual(edited.patches.find(e=>e.id===p.id));
    const a=buildFrontCorner(.04),negative=buildFrontCorner(-.04),b=buildFrontCorner(0),c=buildFrontCorner(0);
    expect(a.diagnostics.maxSmoothAngleDeg).toBeLessThan(1);
    const positions=(m:ReturnType<typeof buildFrontCorner>)=>(m.group.children[0] as Mesh).geometry.getAttribute('position').array;
    expect(positions(b)).toEqual(positions(c));expect(positions(a)).not.toEqual(positions(b));
    expect(negative.diagnostics.maxGap).toBeLessThan(1e-7);
    a.dispose();negative.dispose();b.dispose();c.dispose();expect(()=>makeFrontCornerPatches(.1)).toThrow();
  });
});
