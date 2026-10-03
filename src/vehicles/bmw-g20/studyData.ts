import landmarks from './evidence/landmarks.json';
import cameras from './evidence/cameras.json';
import {parseCamera,projectPoint,type PhotoCamera} from '../../modeling/projection';
import {BMW_STUDY} from './config';
import {isFiniteNumber,isRecord,isVector,type Vec2} from '../../modeling/types';
export type PhotoDefinition = typeof landmarks.photos[number];
export const PHOTOS = landmarks.photos;
export const BASE_CAMERAS = cameras.cameras.map(parseCamera);
export const STORAGE_KEY='bmw-g20-camera-study-v1';
export type StudyState={schemaVersion:1;skeletonId:string;cameras:PhotoCamera[]};
export function defaultState():StudyState{return {schemaVersion:1,skeletonId:BMW_STUDY.id,cameras:structuredClone(BASE_CAMERAS)};}
export function parseStudyState(input:unknown):StudyState{
  if(!isRecord(input)||input.schemaVersion!==1||input.skeletonId!==BMW_STUDY.id||!Array.isArray(input.cameras)||input.cameras.length!==BASE_CAMERAS.length)throw new Error('参数文件版本与本轮骨架不符');
  const parsed=input.cameras.map(parseCamera);
  if(new Set(parsed.map(c=>c.sourceId)).size!==BASE_CAMERAS.length)throw new Error('相机 ID 重复');
  for(const c of parsed){
    const p=PHOTOS.find(p=>p.sourceId===c.sourceId);
    if(!p||p.imageWidth!==c.imageWidth||p.imageHeight!==c.imageHeight||c.position.some(v=>Math.abs(v)>50))throw new Error('相机来源、尺度或原图尺寸无效');
  }
  return {schemaVersion:1,skeletonId:BMW_STUDY.id,cameras:parsed};
}
export function verifyReferenceMeta(actual:{width:number;height:number;sha256:string},photo:PhotoDefinition):void{
  if(actual.width!==photo.imageWidth||actual.height!==photo.imageHeight)throw new Error('图片分辨率不符；请选原始高清图，不要使用缩略图或裁剪图');
  if(actual.sha256!==photo.sha256)throw new Error('图片 SHA-256 不符；已拒绝将其他照片套入当前相机');
}
export function pointResiduals(photo:PhotoDefinition,camera:PhotoCamera){
  if(photo.sourceId!==camera.sourceId||photo.imageWidth!==camera.imageWidth||photo.imageHeight!==camera.imageHeight)throw new Error('标注与相机的来源或原图尺寸不一致');
  return photo.points.map(p=>{
    if(!['visible','occluded','uncertain'].includes(p.visibility))throw new Error('标注可见性无效');
    const predicted=projectPoint(BMW_STUDY.points[p.id],camera,p.visibility as 'visible'|'occluded'|'uncertain');
    const target:Vec2=[p.pixel[0]-camera.crop.x,p.pixel[1]-camera.crop.y];
    const required=p.use==='camera'&&p.visibility==='visible';
    const targetInFrame=target[0]>=0&&target[0]<=camera.crop.width&&target[1]>=0&&target[1]<=camera.crop.height;
    const rawError=predicted.pixel&&predicted.inDepthRange?Math.hypot(predicted.pixel[0]-target[0],predicted.pixel[1]-target[1]):null;
    const errorPx=rawError!==null&&Number.isFinite(rawError)?rawError:null;
    const reason=!required?'excluded':!predicted.pixel?'non-projectable':!predicted.inDepthRange?'depth-clipped':errorPx===null?'non-projectable':!predicted.inFrame||!targetInFrame?'outside-frame':'ok';
    return {id:p.id,predicted:predicted.pixel,target,required,reason,usable:required&&reason==='ok',errorPx};
  });
}
/** 分母只由原始标注决定；画外点仍计分，任一必需点不可投影就不给部分 RMS。 */
export function summarizeResiduals(residuals:ReturnType<typeof pointResiduals>){
  const required=residuals.filter(p=>p.required),invalid=required.filter(p=>p.errorPx===null);
  const inFrameCount=required.filter(p=>p.usable).length;
  const status=required.length===0?'no-correspondences':invalid.length?'invalid-projection':inFrameCount<required.length?'outside-frame':'complete';
  const rmsPx=required.length&&!invalid.length?Math.hypot(...required.map(p=>p.errorPx!))/Math.sqrt(required.length):null;
  return {status,requiredCount:required.length,inFrameCount,invalidCount:invalid.length,rmsPx};
}
export function validateStudyData():void {
  if(landmarks.skeletonId!==BMW_STUDY.id||cameras.skeletonId!==BMW_STUDY.id||PHOTOS.length!==BASE_CAMERAS.length)throw new Error('骨架版本或相机数量不一致');
  for(const p of PHOTOS){
    const c=BASE_CAMERAS.find(c=>c.sourceId===p.sourceId);
    if(!c||p.role!=='fit'||c.imageWidth!==p.imageWidth||c.imageHeight!==p.imageHeight||!/^[a-f0-9]{64}$/.test(p.sha256)||p.roi.width<=0)throw new Error('照片与相机不一致');
    for(const pt of p.points)if(!BMW_STUDY.points[pt.id]||pt.kind!=='fixed'||!isVector(pt.pixel,2)||!isVector(pt.repeatPixel,2)||!isFiniteNumber(pt.uncertaintyPx)||pt.uncertaintyPx<=0)throw new Error('标注结构无效');
  }
}
validateStudyData();
