import {A4,AXLES} from './a4';

export type CalibrationView='side'|'front'|'rear'|'top';
export type Pair=[number,number];
export interface Landmark {id:string;label:string;pixel:Pair;kind:'dimension'|'manual';}
export interface CalibrationDefinition {
  id:CalibrationView;name:string;code:string;crop:[number,number,number,number];
  origin:Pair;pixelsPerMetre:number;basis:string;note:string;landmarks:Landmark[];
}
const sideScale=(878.834-306.843)/A4.wheelbase;
export const CALIBRATION_VIEWS:CalibrationDefinition[]=[
  {id:'side',name:'正侧',code:'01',crop:[108,667,998,371],
    origin:[306.843-AXLES.front*sideScale,969.96],pixelsPerMetre:sideScale,
    basis:'轴距 2,820 mm',note:'前后轴辅助线定尺度，地面定高度零点。车长用作二次核对；橙点为人工读图，不是 CAD 坐标。',
    landmarks:[{id:'F',label:'前轴地面投影',pixel:[306.843,969.96],kind:'dimension'},{id:'R',label:'后轴地面投影',pixel:[878.834,969.96],kind:'dimension'},
      {id:'A',label:'前风挡下沿附近',pixel:[395,775],kind:'manual'},{id:'B',label:'前车顶转折附近',pixel:[535,704],kind:'manual'},
      {id:'C',label:'B 柱顶部附近',pixel:[666,686],kind:'manual'},{id:'D',label:'后车顶转折附近',pixel:[814,707],kind:'manual'},{id:'E',label:'后风挡下沿附近',pixel:[982,752],kind:'manual'}]},
  {id:'front',name:'正前',code:'02',crop:[94,275,430,357],
    origin:[(118.553+492.068)/2,572.77],pixelsPerMetre:(492.068-118.553)/A4.width,
    basis:'车身宽 1,847 mm',note:'轮距图线按主尺度换算约 1,553 mm，与标注 1,572 mm 相差约 −19 mm。这是图线校核残差，不能直接算作模型误差。',
    landmarks:[{id:'L',label:'左侧车宽辅助线',pixel:[118.553,572.77],kind:'dimension'},{id:'R',label:'右侧车宽辅助线',pixel:[492.068,572.77],kind:'dimension'},
      {id:'A',label:'左侧车顶转折附近',pixel:[192,289],kind:'manual'},{id:'B',label:'右侧车顶转折附近',pixel:[420,289],kind:'manual'}]},
  {id:'rear',name:'正后',code:'03',crop:[680,275,440,357],
    origin:[(693.191+1102.170)/2,573.94],pixelsPerMetre:(1102.170-693.191)/A4.mirrorWidth,
    basis:'含镜宽 2,022 mm',note:'轮距图线按主尺度换算约 1,528 mm，与标注 1,555 mm 相差约 −27 mm。保留原图等比，不用横向拉伸掩盖差异。',
    landmarks:[{id:'L',label:'左侧含镜宽辅助线',pixel:[693.191,573.94],kind:'dimension'},{id:'R',label:'右侧含镜宽辅助线',pixel:[1102.170,573.94],kind:'dimension'},
      {id:'A',label:'左侧车顶转折附近',pixel:[792,289],kind:'manual'},{id:'B',label:'右侧车顶转折附近',pixel:[1010,289],kind:'manual'}]},
  {id:'top',name:'俯视',code:'04',crop:[110,1065,995,425],
    origin:[(124.346+1090.432)/2,1274.6],pixelsPerMetre:(1090.432-124.346)/A4.length,
    basis:'车长 4,762 mm',note:'纵向按长度辅助线标定；横向中心 1274.6 px 为人工估算。图中外后视镜姿态与投影细节未核定，不用于验证展开镜宽。',
    landmarks:[{id:'F',label:'车头端基准',pixel:[124.346,1274.6],kind:'dimension'},{id:'R',label:'车尾端基准',pixel:[1090.432,1274.6],kind:'dimension'},
      {id:'A',label:'前风挡前缘附近',pixel:[376,1274.6],kind:'manual'},{id:'B',label:'后风挡后缘附近',pixel:[955,1274.6],kind:'manual'}]},
];
export const getCalibrationView=(id:CalibrationView)=>CALIBRATION_VIEWS.find(v=>v.id===id)!;
export function pixelToPlane(id:CalibrationView,p:Pair):Pair {const v=getCalibrationView(id);return [(p[0]-v.origin[0])/v.pixelsPerMetre,(v.origin[1]-p[1])/v.pixelsPerMetre];}
export function planeToPixel(id:CalibrationView,p:Pair):Pair {const v=getCalibrationView(id);return [v.origin[0]+p[0]*v.pixelsPerMetre,v.origin[1]-p[1]*v.pixelsPerMetre];}
export function planeToWorld(id:CalibrationView,[h,v]:Pair):[number,number,number] {
  if(id==='front')return [0,v,h];if(id==='rear')return [0,v,-h];if(id==='top')return [h,0,-v];return [h,v,0];
}
export function fitFrame(id:CalibrationView,width:number,height:number){
  const v=getCalibrationView(id),[x,y,w,h]=v.crop;
  const padding=Math.min(40,width*.055,height*.06);
  const scale=Math.min((width-2*padding)/w,(height-2*padding)/h);
  return {pixelsPerMetre:scale*v.pixelsPerMetre,center:pixelToPlane(id,[x+w/2,y+h/2]),
    imageRect:{x:(width-w*scale)/2,y:(height-h*scale)/2,width:w*scale,height:h*scale}};
}
export interface CalibrationSettings {view:CalibrationView;mode:'overlay'|'model'|'drawing';opacity:number;points:boolean;}
export const DEFAULT_CALIBRATION:CalibrationSettings={view:'side',mode:'overlay',opacity:.8,points:true};
export function sanitizeCalibration(value:unknown):CalibrationSettings {
  const v=(value&&typeof value==='object'?value:{}) as Partial<CalibrationSettings>;
  return {view:CALIBRATION_VIEWS.some(d=>d.id===v.view)?v.view!:DEFAULT_CALIBRATION.view,
    mode:['overlay','model','drawing'].includes(v.mode??'')?v.mode!:DEFAULT_CALIBRATION.mode,
    opacity:typeof v.opacity==='number'&&Number.isFinite(v.opacity)?Math.max(0,Math.min(1,v.opacity)):DEFAULT_CALIBRATION.opacity,
    points:typeof v.points==='boolean'?v.points:DEFAULT_CALIBRATION.points};
}
