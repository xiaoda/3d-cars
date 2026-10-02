import {endSurfacePoint} from './bodyShell';
import type {Outline} from '../engine/aperture';
import type {Point} from '../engine/geometry';

/** 04/19 图纸横条格栅前脸的人工轮廓近似，不是某个完整选装包的实测 CAD。
 * 深度、倒角、灯内结构均为估算；不混入 S line 蜂窝与机盖下狭缝。
 */
export const FRONT_GRILLE:Outline=[[-.345,.680],[.345,.680],[.490,.574],[.365,.321],[-.365,.321],[-.490,.574]];
export const FRONT_LAMP:Outline=[[.407,.681],[.800,.759],[.817,.620],[.623,.593],[.463,.617]];
export const FRONT_INTAKE:Outline=[[.570,.465],[.835,.475],[.843,.285],[.664,.277],[.505,.310]];
export const FRONT_DEPTH={grille:.105,lamp:.085,intake:.095} as const;
export const FRONT_CUT_LIMIT=-1.80;
export const mirrorOutline=(poly:Outline,side:number):[number,number][]=>poly.map(([z,y])=>[side*z,y]);
export const FRONT_OPENINGS:readonly Outline[]=[FRONT_GRILLE,...[-1,1].flatMap(side=>[mirrorOutline(FRONT_LAMP,side),mirrorOutline(FRONT_INTAKE,side)])];
/** 正值朝车内，负值向车外；所有部件共用同一基面，避免各自猜 x。 */
export function frontPoint(z:number,y:number,depth=0):Point{return [endSurfacePoint(-1,z,y)[0]+depth,y,z];}
export function insetOutline(poly:Outline,factor:number):[number,number][]{
  const center=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
  return poly.map(([z,y])=>[center[0]+(z-center[0])*factor,center[1]+(y-center[1])*factor]);
}
export function horizontalSpan(poly:Outline,y:number):[number,number]{
  const hits:number[]=[];
  poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length];if((y-a[1])*(y-b[1])<=0&&Math.abs(b[1]-a[1])>1e-9)hits.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));});
  if(hits.length<2)throw new Error('水平线超出开口');return [Math.min(...hits),Math.max(...hits)];
}
