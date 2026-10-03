import {describe,expect,it} from 'vitest';
import report from '../../../docs/research/bmw-g20/stage1-camera-report.json';
import evidence from '../../../docs/research/bmw-g20/config-lock.json';
import {BASE_CAMERAS,PHOTOS,defaultState,parseStudyState,pointResiduals,summarizeResiduals,verifyReferenceMeta} from './studyData';
import {BMW_STUDY} from './config';
describe('BMW 三机位与本地状态',()=>{
  it('三张开发图的 Three.js 投影与离线 OpenCV 初值一致，留出图未进入拟合',()=>{
    expect(PHOTOS).toHaveLength(3);
    for(const photo of PHOTOS){
      expect(evidence.fitSourceIds).toContain(photo.sourceId);
      expect(evidence.holdoutSourceIds).not.toContain(photo.sourceId);
      const camera=BASE_CAMERAS.find(c=>c.sourceId===photo.sourceId)!;
      const expected=report.reports.find(r=>r.sourceId===photo.sourceId)!;
      const residuals=pointResiduals(photo,camera);
      for(const [i,p] of residuals.entries()){
        expect(p.usable).toBe(true);
        expect(p.predicted![0]).toBeCloseTo(expected.points[i].projected[0],5);
        expect(p.predicted![1]).toBeCloseTo(expected.points[i].projected[1],5);
      }
      expect(Math.sqrt(residuals.reduce((s,p)=>s+p.errorPx!**2,0)/residuals.length)).toBeCloseTo(expected.rmsPx,5);
    }
  });
  it('状态保存往返，返回独立副本',()=>{
    const state=defaultState(),parsed=parseStudyState(JSON.parse(JSON.stringify(state)));
    expect(parsed).toEqual(state);expect(parsed.cameras).not.toBe(BASE_CAMERAS);
  });
  it('用户批准仅限相机研究，原厂配置与后续曲面关不被自动放行',()=>{
    expect(evidence.status).toBe('partial');
    expect(evidence.studyApproval.allowCameraStudy).toBe(true);
    expect(evidence.studyApproval.allowDetailedSurfaces).toBe(false);
    expect(evidence.dimensions.every(d=>d.transferToReference==='pending')).toBe(true);
  });
  it('不接受旧骨架、重复/未知相机、伪造原图尺寸及非法内参',()=>{
    for(const state of [null,{}, {...defaultState(),skeletonId:'old'},{...defaultState(),cameras:[BASE_CAMERAS[0],BASE_CAMERAS[0],BASE_CAMERAS[2]]},{...defaultState(),cameras:[{...BASE_CAMERAS[0],sourceId:'__proto__'},...BASE_CAMERAS.slice(1)]},{...defaultState(),cameras:[{...BASE_CAMERAS[0],imageWidth:400},...BASE_CAMERAS.slice(1)]},{...defaultState(),cameras:[{...BASE_CAMERAS[0],fovY:NaN},...BASE_CAMERAS.slice(1)]}]) expect(()=>parseStudyState(state)).toThrow();
  });
  it('相同分辨率的错误图也不能被当成目标照片',()=>{
    const p=PHOTOS[0],meta={width:p.imageWidth,height:p.imageHeight,sha256:p.sha256};
    expect(()=>verifyReferenceMeta(meta,p)).not.toThrow();
    expect(()=>verifyReferenceMeta({...meta,sha256:'0'.repeat(64)},p)).toThrow();
    expect(()=>verifyReferenceMeta({...meta,width:100},p)).toThrow();
  });
  it('基线按固定对应点集合统计，与既有 OpenCV 报告一致',()=>{
    for(const photo of PHOTOS){
      const result=summarizeResiduals(pointResiduals(photo,BASE_CAMERAS.find(c=>c.sourceId===photo.sourceId)!));
      expect(result.status).toBe('complete');
      expect(result.requiredCount).toBe(photo.points.length);
      expect(result.inFrameCount).toBe(photo.points.length);
      expect(result.rmsPx).toBeCloseTo(report.reports.find(r=>r.sourceId===photo.sourceId)!.rmsPx,5);
    }
  });
  it('裁剪不能丢掉高误差点：分母固定，画外点仍计入 RMS',()=>{
    const p=PHOTOS[0],camera=BASE_CAMERAS[0];
    const original=summarizeResiduals(pointResiduals(p,camera));
    const cropped=summarizeResiduals(pointResiduals(p,{...camera,crop:{x:0,y:0,width:500,height:500}}));
    expect(cropped.requiredCount).toBe(original.requiredCount);
    expect(cropped.inFrameCount).toBe(0);
    expect(cropped.status).toBe('outside-frame');
    expect(cropped.rmsPx).toBeCloseTo(original.rmsPx!,5);
  });
  it('必需点在相机平面上时，整组 RMS 不可用且可安全序列化',()=>{
    const p=PHOTOS[0],camera={...BASE_CAMERAS[0],position:BMW_STUDY.points[p.points[0].id]};
    const residuals=pointResiduals(p,camera),result=summarizeResiduals(residuals);
    expect(residuals[0].predicted).toBeNull();
    expect(residuals[0].errorPx).toBeNull();
    expect(residuals[0].reason).toBe('non-projectable');
    expect(result.status).toBe('invalid-projection');
    expect(result.rmsPx).toBeNull();
    expect(result.requiredCount).toBe(p.points.length);
    expect(JSON.parse(JSON.stringify(residuals))).toEqual(residuals);
  });
  it('拒绝拿其他机位或其他原图尺寸的相机评估同一份标注',()=>{
    expect(()=>pointResiduals(PHOTOS[0],BASE_CAMERAS[1])).toThrow();
    expect(()=>pointResiduals(PHOTOS[0],{...BASE_CAMERAS[0],imageWidth:5000})).toThrow();
  });
  it('缩短远平面不能排除误差点后输出部分 RMS',()=>{
    const residuals=pointResiduals(PHOTOS[0],{...BASE_CAMERAS[0],far:1});
    expect(residuals.every(p=>p.reason==='depth-clipped')).toBe(true);
    const result=summarizeResiduals(residuals);
    expect(result.status).toBe('invalid-projection');
    expect(result.requiredCount).toBe(6);expect(result.rmsPx).toBeNull();
  });
  it('投影仍在画内、目标标注被裁掉时也不能显示完整匹配',()=>{
    const p=structuredClone(PHOTOS[0]),c=BASE_CAMERAS[0];
    const original=pointResiduals(p,c),point=original[0];
    // 裁剪边界落在该点目标与投影之间，保留投影而裁掉目标。
    const targetX=point.target[0],projectedX=point.predicted![0],mid=(targetX+projectedX)/2;
    const crop=projectedX<targetX?{x:0,y:0,width:mid,height:c.imageHeight}:{x:mid,y:0,width:c.imageWidth-mid,height:c.imageHeight};
    const residuals=pointResiduals(p,{...c,crop});
    expect(residuals[0].reason).toBe('outside-frame');
    expect(summarizeResiduals(residuals).status).toBe('outside-frame');
    expect(summarizeResiduals(residuals).rmsPx).toBeCloseTo(summarizeResiduals(original).rmsPx!,5);
  });
  it('遮挡与非相机标注只能由预先标注决定，不由当前相机决定是否计分',()=>{
    const photo=structuredClone(PHOTOS[0]);
    photo.points[0].visibility='occluded';photo.points[1].use='display-only';
    const residuals=pointResiduals(photo,BASE_CAMERAS[0]),result=summarizeResiduals(residuals);
    expect(residuals[0].required).toBe(false);expect(residuals[1].required).toBe(false);
    expect(result.requiredCount).toBe(photo.points.length-2);
    expect(result.status).toBe('complete');
    expect(summarizeResiduals([]).status).toBe('no-correspondences');
    expect(summarizeResiduals([]).rmsPx).toBeNull();
  });
});
