import raw from './evidence/skeleton.json';
import {isRecord,isVector,parseConstraint,type ScalarConstraint,type Vec3} from '../../modeling/types';
export type Skeleton = {id:string;points:Record<string,Vec3>;lines:string[][];constraints:ScalarConstraint[];wheelRadius:number};
export function parseSkeleton(input:unknown):Skeleton{
  if(!isRecord(input)||typeof input.id!=='string'||!isRecord(input.points)||!Array.isArray(input.lines)||!Array.isArray(input.constraints)||typeof input.wheelRadius!=='number'||!Number.isFinite(input.wheelRadius)||input.wheelRadius<=0)throw new Error('骨架结构无效');
  const points=input.points;
  if(!Object.keys(points).length||!Object.values(points).every(p=>isVector(p,3)))throw new Error('骨架点必须是有限米制坐标');
  if(!input.lines.every(line=>Array.isArray(line)&&line.length>=2&&line.every(id=>typeof id==='string'&&Object.hasOwn(points,id))))throw new Error('骨架连线引用不存在的点');
  return {...structuredClone(input),constraints:input.constraints.map(parseConstraint)} as Skeleton;
}
export const BMW_STUDY=parseSkeleton(raw);
