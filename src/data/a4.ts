/** 单位：米。官方数字与估算值分区，禁止用视觉估算覆盖原始尺寸。 */
export const A4 = Object.freeze({
  length: 4.762, width: 1.847, height: 1.428, wheelbase: 2.820,
  frontOverhang: 0.899, rearOverhang: 1.043,
  frontTrack: 1.572, rearTrack: 1.555, mirrorWidth: 2.022,
  // 以下为第一轮视觉估算，不是原厂轮胎/轮毂规格。
  wheelRadius: 0.333, wheelWidth: 0.238, rimRadius: 0.232, archRadius: 0.383,
});
export const AXLES = Object.freeze({ front: -A4.length / 2 + A4.frontOverhang, rear: A4.length / 2 - A4.rearOverhang });
export const SOURCE_URL = 'https://www.audi-mediacenter.com/en/publications/dimensions/dimensions-a4-1391/download';
export const MODEL_VERSION='0.6';
export const MODEL_FILE_TAG='v06';

/** 以下截面系依据官方侧/俯视轮廓手动估算：[纵坐标, 半宽, 车身上表面中心高度]。 */
const sections = [
  [-2.381, .892, .699], [-2.30, .898, .763], [-2.15, .902, .834],
  [-1.88, .907, .911], [-1.48, .9235, .959], [-1.10, .909, .973],
  [-.80, .900, .991], [-.40, .896, 1.001], [.10, .895, 1.012],
  [.62, .907, 1.026], [1.10, .921, 1.043], [1.338, .9235, 1.057],
  [1.67, .912, 1.068], [1.94, .902, 1.068], [2.20, .891, 1.042], [2.381, .874, 1.014],
];
export function sampleProfile(x: number, column: number): number {
  if (x <= sections[0][0]) return sections[0][column];
  for (let i=1; i<sections.length; i++) {
    if (x <= sections[i][0]) {
      const a=sections[i-1], b=sections[i], t=(x-a[0])/(b[0]-a[0]);
      // 限制端点斜率的三次 Hermite 插值，避免高光在截面连接处折断。
      const slope=(j:number)=>{
        if(j===0)return (sections[1][column]-sections[0][column])/(sections[1][0]-sections[0][0]);
        if(j===sections.length-1)return (sections[j][column]-sections[j-1][column])/(sections[j][0]-sections[j-1][0]);
        const l=(sections[j][column]-sections[j-1][column])/(sections[j][0]-sections[j-1][0]);
        const r=(sections[j+1][column]-sections[j][column])/(sections[j+1][0]-sections[j][0]);
        return l*r<=0?0:2*l*r/(l+r);
      };
      const h=b[0]-a[0],t2=t*t,t3=t2*t;
      return Math.max(Math.min(a[column],b[column]),Math.min(Math.max(a[column],b[column]),
        (2*t3-3*t2+1)*a[column]+(t3-2*t2+t)*h*slope(i-1)+(-2*t3+3*t2)*b[column]+(t3-t2)*h*slope(i)));
    }
  }
  return sections.at(-1)![column];
}
export const halfWidth = (x:number) => sampleProfile(x,1);
export const deckHeight = (x:number) => sampleProfile(x,2);
export function archBottom(x:number):number {
  let y=.185;
  for(const axle of [AXLES.front, AXLES.rear]) {
    const d=Math.abs(x-axle), r=A4.archRadius;
    if(d<r) y=Math.max(y, A4.wheelRadius+Math.sqrt(r*r-d*d));
  }
  return y;
}
export type ViewMode = 'paint'|'clay'|'wire';
export type CameraView = 'hero'|'side'|'front'|'rear'|'top';
export const PAINTS = [
  {id:'silver',name:'冰川银 · 近似',color:'#aaaead',chip:'#b7bcb8'},
  {id:'graphite',name:'石墨灰 · 近似',color:'#333c3b',chip:'#414b49'},
  {id:'blue',name:'深海蓝 · 近似',color:'#294f69',chip:'#315b73'},
  {id:'red',name:'朱砂红 · 近似',color:'#8b292b',chip:'#a3383b'},
  {id:'white',name:'陶瓷白 · 近似',color:'#deded6',chip:'#e6e5dc'},
] as const;

export interface StudySettings { mode:ViewMode; paint:string; lights:boolean; steering:number; rotate:boolean; dimensions:boolean; }
export const DEFAULT_SETTINGS:StudySettings = {mode:'paint',paint:'silver',lights:true,steering:0,rotate:false,dimensions:false};
export function sanitizeSettings(value: unknown): StudySettings {
  const v=(value && typeof value==='object' ? value : {}) as Partial<StudySettings>;
  return {
    mode:['paint','clay','wire'].includes(v.mode??'') ? v.mode! : 'paint',
    paint:PAINTS.some(p=>p.id===v.paint) ? v.paint! : 'silver',
    lights:typeof v.lights==='boolean' ? v.lights : true,
    steering:typeof v.steering==='number'&&Number.isFinite(v.steering) ? Math.max(-25,Math.min(25,v.steering)) : 0,
    rotate:typeof v.rotate==='boolean' ? v.rotate : false,
    dimensions:typeof v.dimensions==='boolean' ? v.dimensions : false,
  };
}
