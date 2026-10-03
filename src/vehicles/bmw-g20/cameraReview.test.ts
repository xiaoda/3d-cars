import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import data from './evidence/camera-alternatives.json';
import report from '../../../docs/research/bmw-g20/camera-review-round1.json';
import evidence from '../../../docs/research/bmw-g20/config-lock.json';
import {ALTERNATIVE_CAMERAS,applyCameraChoice,identifyCameraChoice,parseCameraAlternatives} from './cameraReview';
import {BASE_CAMERAS,PHOTOS,defaultState,parseStudyState,pointResiduals,summarizeResiduals} from './studyData';

describe('BMW 相机多解复核',()=>{
  it('原骨架、标注及主相机未变，报告只使用开发图，不自动提升候选',()=>{
    expect(report.hashEncoding).toBe('sha256-utf8-lf');
    for(const [name,expected] of Object.entries(report.inputHashes)){
      const text=readFileSync(new URL(`./evidence/${name}`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
      expect(createHash('sha256').update(text).digest('hex')).toBe(expected);
    }
    expect(report.policy.allowAutoPromotion).toBe(false);
    expect(evidence.studyApproval.allowDetailedSurfaces).toBe(false);
    expect(report.reports.map(p=>p.sourceId)).toEqual(PHOTOS.map(p=>p.sourceId));
    expect(report.reports.every(p=>!evidence.holdoutSourceIds.includes(p.sourceId))).toBe(true);
  });
  it('候选 Three.js 逐点投影与离线 OpenCV 一致，固定分母不变',()=>{
    expect(ALTERNATIVE_CAMERAS).toHaveLength(1);
    const candidate=ALTERNATIVE_CAMERAS[0],photo=PHOTOS.find(p=>p.sourceId===candidate.sourceId)!;
    const expected=report.reports.find(p=>p.sourceId===candidate.sourceId)!.candidates.find(c=>c.id===candidate.candidateId)!;
    const residuals=pointResiduals(photo,candidate.camera),summary=summarizeResiduals(residuals);
    expect(summary.requiredCount).toBe(4);expect(summary.status).toBe('complete');
    expect(summary.rmsPx).toBeCloseTo(candidate.rmsPx,5);
    residuals.forEach((p,i)=>{
      expect(p.predicted![0]).toBeCloseTo(expected.projected[i][0],5);
      expect(p.predicted![1]).toBeCloseTo(expected.projected[i][1],5);
    });
  });
  it('选择候选仅改变同机位，恢复不影响其他机位且不突变原数据',()=>{
    const original=defaultState(),snapshot=structuredClone(original),alternative=ALTERNATIVE_CAMERAS[0];
    const changed=applyCameraChoice(original,alternative.sourceId,alternative.id);
    expect(original).toEqual(snapshot);
    expect(changed.cameras.slice(0,2)).toEqual(original.cameras.slice(0,2));
    expect(identifyCameraChoice(changed.cameras[2])).toBe(alternative.id);
    const restored=applyCameraChoice(changed,alternative.sourceId,'baseline');
    expect(restored).toEqual(original);expect(identifyCameraChoice(restored.cameras[2])).toBe('baseline');
    changed.cameras[2].position[0]=20;
    expect(ALTERNATIVE_CAMERAS[0].camera.position[0]).not.toBe(20);
    expect(BASE_CAMERAS).toEqual(snapshot.cameras);
  });
  it('保存/导入后的候选可识别，手工修改标为自定义，属性顺序不影响识别',()=>{
    const candidate=ALTERNATIVE_CAMERAS[0];
    const saved=parseStudyState(JSON.parse(JSON.stringify(applyCameraChoice(defaultState(),candidate.sourceId,candidate.id))));
    expect(identifyCameraChoice(saved.cameras[2])).toBe(candidate.id);
    const reordered=Object.fromEntries(Object.entries(candidate.camera).reverse()) as typeof candidate.camera;
    expect(identifyCameraChoice(reordered)).toBe(candidate.id);
    saved.cameras[2].position[0]+=.1;expect(identifyCameraChoice(saved.cameras[2])).toBe('custom');
  });
  it('拒绝跨机位套用候选与未知选择',()=>{
    expect(()=>applyCameraChoice(defaultState(),PHOTOS[0].sourceId,ALTERNATIVE_CAMERAS[0].id)).toThrow();
    expect(()=>applyCameraChoice(defaultState(),'unknown','baseline')).toThrow();
    expect(()=>applyCameraChoice(defaultState(),PHOTOS[2].sourceId,'unknown')).toThrow();
  });
  it('候选数据校验版本、来源、相机尺寸、重复 ID、保留 ID 与有限误差',()=>{
    const candidate=data.alternatives[0];
    expect(parseCameraAlternatives(data)).toHaveLength(1);
    for(const invalid of [null,{}, {...data,skeletonId:'old'}, {...data,schemaVersion:2},
      {...data,alternatives:[candidate,candidate]},
      ...[{...candidate,id:'baseline'},{...candidate,id:'custom'},{...candidate,rmsPx:NaN},
        {...candidate,sourceId:PHOTOS[0].sourceId},{...candidate,sourceId:'unknown'},
        {...candidate,camera:{...candidate.camera,imageWidth:100}},
        {...candidate,camera:{...candidate.camera,position:[100,0,1]}}].map(c=>({...data,alternatives:[c]}))
    ])expect(()=>parseCameraAlternatives(invalid)).toThrow();
  });
  it('四点的多解和重复标注敏感性保留在报告，不删掉被先验拒绝的低残差解',()=>{
    const near=report.reports.find(p=>p.sourceId==='P90549635')!;
    expect(near.candidates.some(c=>c.method==='AP3P'&&c.branchIndex>0)).toBe(true);
    expect(near.candidates.some(c=>c.rmsPx<17&&c.rejections.some(r=>r==='height-prior'))).toBe(true);
    const repeated=near.candidates.filter(c=>c.annotation==='repeat');
    expect(repeated.length).toBeGreaterThan(0);
    expect(repeated.every(c=>c.rejections.length>0)).toBe(true);
  });
});
