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
  return photo.points.map(p=>{
    const predicted=projectPoint(BMW_STUDY.points[p.id],camera,p.visibility as 'visible');
    const target:Vec2=[p.pixel[0]-camera.crop.x,p.pixel[1]-camera.crop.y];
    return {id:p.id,predicted:predicted.pixel,target,usable:predicted.usable,errorPx:Math.hypot(predicted.pixel[0]-target[0],predicted.pixel[1]-target[1])};
  });
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
