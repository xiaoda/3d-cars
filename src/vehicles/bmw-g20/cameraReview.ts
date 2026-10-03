import data from './evidence/camera-alternatives.json';
import {parseCamera,type PhotoCamera} from '../../modeling/projection';
import {isFiniteNumber,isRecord,isText} from '../../modeling/types';
import {BMW_STUDY} from './config';
import {BASE_CAMERAS,PHOTOS,parseStudyState,type StudyState} from './studyData';

export type CameraAlternative={id:string;sourceId:string;label:string;candidateId:string;camera:PhotoCamera;rmsPx:number;note:string};

export function parseCameraAlternatives(input:unknown):CameraAlternative[]{
  if(!isRecord(input)||input.schemaVersion!==1||input.skeletonId!==BMW_STUDY.id||!Array.isArray(input.alternatives))throw new Error('候选与本轮骨架版本不符');
  const ids=new Set<string>();
  return input.alternatives.map(value=>{
    if(!isRecord(value)||!isText(value.id)||!isText(value.sourceId)||!isText(value.label)||!isText(value.candidateId)||!isText(value.note)||!isFiniteNumber(value.rmsPx)||value.rmsPx<0)throw new Error('候选结构无效');
    if(ids.has(value.id)||['baseline','custom'].includes(value.id))throw new Error('候选 ID 重复或占用保留值');
    ids.add(value.id);
    const camera=parseCamera(value.camera),photo=PHOTOS.find(p=>p.sourceId===value.sourceId);
    if(!photo||camera.sourceId!==photo.sourceId||camera.imageWidth!==photo.imageWidth||camera.imageHeight!==photo.imageHeight||camera.position.some(v=>Math.abs(v)>50))throw new Error('候选来源、尺寸或尺度不符');
    return {id:value.id,sourceId:value.sourceId,label:value.label,candidateId:value.candidateId,camera,rmsPx:value.rmsPx,note:value.note};
  });
}

export const ALTERNATIVE_CAMERAS=parseCameraAlternatives(data);

/** 列出字段后比较，避免 JSON 导入的属性顺序或额外元数据影响识别。 */
function cameraValues(c:PhotoCamera){return [c.sourceId,...c.position,...c.quaternion,c.fovY,c.imageWidth,c.imageHeight,c.crop.x,c.crop.y,c.crop.width,c.crop.height,c.near,c.far];}
export function identifyCameraChoice(camera:PhotoCamera):string{
  const values=cameraValues(camera),same=(c:PhotoCamera)=>cameraValues(c).every((v,i)=>v===values[i]);
  if(BASE_CAMERAS.some(same))return 'baseline';
  return ALTERNATIVE_CAMERAS.find(c=>same(c.camera))?.id??'custom';
}

/** 选择是审阅操作，不改主基线、不改变其余机位；调用者负责锁定编辑控件。 */
export function applyCameraChoice(state:StudyState,sourceId:string,choiceId:string):StudyState{
  const next=parseStudyState(state);
  const camera=choiceId==='baseline'?BASE_CAMERAS.find(c=>c.sourceId===sourceId):ALTERNATIVE_CAMERAS.find(c=>c.id===choiceId&&c.sourceId===sourceId)?.camera;
  if(!camera)throw new Error('当前机位没有这个候选');
  return {...next,cameras:next.cameras.map(c=>c.sourceId===sourceId?structuredClone(camera):c)};
}
