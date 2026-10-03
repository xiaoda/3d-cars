import {describe,expect,it} from 'vitest';
import report from '../../../docs/research/bmw-g20/stage1-camera-report.json';
import evidence from '../../../docs/research/bmw-g20/config-lock.json';
import {BASE_CAMERAS,PHOTOS,defaultState,parseStudyState,pointResiduals,verifyReferenceMeta} from './studyData';
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
        expect(p.predicted[0]).toBeCloseTo(expected.points[i].projected[0],5);
        expect(p.predicted[1]).toBeCloseTo(expected.points[i].projected[1],5);
      }
      expect(Math.sqrt(residuals.reduce((s,p)=>s+p.errorPx**2,0)/residuals.length)).toBeCloseTo(expected.rmsPx,5);
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
});
