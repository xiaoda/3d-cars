import {PerspectiveCamera,Vector3} from 'three';
import {isFiniteNumber,isRecord,isText,isVector,type Quat,type Vec2,type Vec3} from './types';
export type PhotoCamera = {sourceId:string; position:Vec3; quaternion:Quat; fovY:number; imageWidth:number; imageHeight:number; crop:{x:number;y:number;width:number;height:number}; near:number;far:number};
export function parseCamera(value:unknown):PhotoCamera{
  if(!isRecord(value)||!isText(value.sourceId)||!isVector(value.position,3)||!isVector(value.quaternion,4)||Math.abs(Math.hypot(...value.quaternion)-1)>1e-4) throw new Error('相机位姿无效');
  if(!isFiniteNumber(value.fovY)||value.fovY<5||value.fovY>120||!isFiniteNumber(value.near)||!isFiniteNumber(value.far)||value.near<=0||value.far<=value.near) throw new Error('相机视场角或裁切平面无效');
  for(const key of ['imageWidth','imageHeight']) if(!isFiniteNumber(value[key])||!Number.isInteger(value[key])||value[key]<=0||value[key]>20000) throw new Error('原图尺寸无效');
  const c=value.crop;
  if(!isRecord(c)||!['x','y','width','height'].every(k=>isFiniteNumber(c[k]))) throw new Error('裁剪区域无效');
  const {x,y,width,height}=c as PhotoCamera['crop'];
  if(x<0||y<0||width<=0||height<=0||x+width>Number(value.imageWidth)||y+height>Number(value.imageHeight)) throw new Error('裁剪区域超出原图');
  return structuredClone(value) as PhotoCamera;
}
/** 原图坐标左上角为零，像素中心按连续坐标解释；不提供图像单轴拉伸。 */
export function makePhotoCamera(input:PhotoCamera):PerspectiveCamera{
  const c=parseCamera(input),camera=new PerspectiveCamera(c.fovY,c.imageWidth/c.imageHeight,c.near,c.far);
  camera.position.set(...c.position);camera.quaternion.set(...c.quaternion);
  camera.setViewOffset(c.imageWidth,c.imageHeight,c.crop.x,c.crop.y,c.crop.width,c.crop.height);
  camera.updateMatrixWorld(true);return camera;
}
export function projectPoint(p:Vec3,c:PhotoCamera,visibility:'visible'|'occluded'|'uncertain'='visible'):{pixel:Vec2;inFrame:boolean;usable:boolean}{
  if(!isVector(p,3))throw new Error('三维点必须有限');
  const camera=makePhotoCamera(c),point=new Vector3(...p),local=point.clone().applyMatrix4(camera.matrixWorldInverse);
  const ndc=point.project(camera),pixel:Vec2=[(ndc.x+1)*c.crop.width/2,(1-ndc.y)*c.crop.height/2];
  const inFrame=local.z<=-c.near&&local.z>=-c.far&&Math.abs(ndc.x)<=1&&Math.abs(ndc.y)<=1;
  // 骨架没有可用遮挡面；遮挡状态由标注显式提供，不假装实现了自动遮挡判定。
  return {pixel,inFrame,usable:inFrame&&visibility==='visible'};
}
function assertPixel(p:Vec2,width:number,height:number){if(!isVector(p,2)||!isFiniteNumber(width)||!isFiniteNumber(height)||width<=0||height<=0)throw new Error('像素坐标或图像尺寸无效');}
export function pixelToNormalized(p:Vec2,width:number,height:number):Vec2{assertPixel(p,width,height);return [p[0]/width,p[1]/height];}
export function normalizedToPixel(p:Vec2,width:number,height:number):Vec2{assertPixel(p,width,height);return [p[0]*width,p[1]*height];}
