export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type EvidenceRef = {sourceId: string; page?: number; region?: string};
export type ScalarConstraint = {id: string; value: number | null; unit: 'm' | 'rad'; kind: 'official' | 'multi-view' | 'approximation' | 'unknown'; refs: EvidenceRef[]; tolerance?: number};
export type CubicPatch = {id: string; points: Vec3[]};
export type PatchEdge = {patchA: string; edgeA: 'u0' | 'u1' | 'v0' | 'v1'; patchB: string; edgeB: 'u0' | 'u1' | 'v0' | 'v1'; reverse: boolean; continuity: 'smooth' | 'crease' | 'panel-gap'};
export const isRecord = (v:unknown):v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v);
export const isFiniteNumber = (v:unknown):v is number => typeof v==='number' && Number.isFinite(v);
export const isText = (v:unknown):v is string => typeof v==='string' && v.trim().length>0;
export function isVector(v:unknown,length:number):v is number[]{return Array.isArray(v)&&v.length===length&&v.every(isFiniteNumber);}
export function parseConstraint(value: unknown): ScalarConstraint {
  if(!isRecord(value)||!isText(value.id)||!['m','rad'].includes(String(value.unit))||!['official','multi-view','approximation','unknown'].includes(String(value.kind))||!Array.isArray(value.refs)) throw new Error('参数结构、单位或置信类型无效');
  if(value.kind==='unknown' ? value.value!==null : !isFiniteNumber(value.value)) throw new Error('未知值必须为 null，已知值必须有限');
  if(value.tolerance!==undefined&&(!isFiniteNumber(value.tolerance)||value.tolerance<0)) throw new Error('容差必须为有限非负值');
  if(value.kind==='official'&&value.refs.length===0) throw new Error('官方参数缺少来源');
  for(const ref of value.refs) if(!isRecord(ref)||!isText(ref.sourceId)||(ref.page!==undefined&&(!Number.isInteger(ref.page)||Number(ref.page)<1))||(ref.region!==undefined&&!isText(ref.region))) throw new Error('参数来源无效');
  return structuredClone(value) as ScalarConstraint;
}
export function parsePatch(value: unknown): CubicPatch {
  if(!isRecord(value)||!isText(value.id)||!Array.isArray(value.points)||value.points.length!==16||!value.points.every(p=>isVector(p,3))) throw new Error('三次面片必须提供 4×4 个有限控制点');
  return structuredClone(value) as CubicPatch;
}
