import * as T from 'three';
import {buildCar} from './car';
import {DEFAULT_SETTINGS,MODEL_VERSION} from '../data/a4';
import {DEFAULT_CALIBRATION,fitFrame,getCalibrationView,pixelToPlane,planeToWorld,sanitizeCalibration,type CalibrationSettings,type Pair} from '../data/calibration';

/** 一个固定米制投影同时驱动图纸与模型；不提供拖动、旋转或单轴缩放。 */
export function createCalibration(host:HTMLElement,onReady:()=>void,onError:(s:string)=>void){
  const canvas=document.createElement('canvas');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','A4 官方尺寸图与程序化车模的等比叠加对照');
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('二维画布不可用');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setClearColor(0xffffff,0);renderer.outputColorSpace=T.SRGBColorSpace;
  const car=buildCar();car.update({...DEFAULT_SETTINGS,steering:0,rotate:false,lights:false});
  const scene=new T.Scene();scene.add(car.group);
  scene.add(new T.HemisphereLight(0xffffff,0xa2bac1,2.4));
  const light=new T.DirectionalLight(0xffffff,1.2);light.position.set(-3,6,4);scene.add(light);
  const replacements=new Map<T.Material,T.MeshLambertMaterial>();
  let triangles=0;
  car.group.traverse(o=>{if(!(o instanceof T.Mesh))return;
    triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
    const replace=(original:T.Material)=>{
      let material=replacements.get(original);
      if(!material){
        const c=(original as T.MeshStandardMaterial).color;
        const dark=c&&Math.max(c.r,c.g,c.b)<.12;
        material=new T.MeshLambertMaterial({color:dark?'#769bab':'#b3d7e3',side:T.DoubleSide});replacements.set(original,material);
      }return material;
    };
    o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);
  });
  const camera=new T.OrthographicCamera(-3,3,2,-2,.1,100);
  const sheet=new Image();let ready=false,disposed=false,exporting=false,contextLost=false;
  let settings:CalibrationSettings={...DEFAULT_CALIBRATION};
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'WebGL 2';
  host.appendChild(canvas);

  function draw(target:HTMLCanvasElement,width:number,height:number,exportLabel=false){
    if(disposed||contextLost)return;
    const c=target.getContext('2d')!;target.width=width;target.height=height;
    const definition=getCalibrationView(settings.view),f=fitFrame(settings.view,width,exportLabel?height-128:height),ppm=f.pixelsPerMetre;
    if(exportLabel)f.imageRect.y+=64;
    const at=(p:Pair):Pair=>[width/2+(p[0]-f.center[0])*ppm,height/2-(p[1]-f.center[1])*ppm];
    c.fillStyle='#fbfcfa';c.fillRect(0,0,width,height);
    // 半米方格；仅辅助观察，不改变参考图原始像素。
    c.strokeStyle='#e6ecea';c.lineWidth=1;c.beginPath();
    const left=f.center[0]-width/2/ppm,right=f.center[0]+width/2/ppm;
    const bottom=f.center[1]-height/2/ppm,top=f.center[1]+height/2/ppm;
    for(let x=Math.ceil(left*2)/2;x<=right;x+=.5){const px=at([x,0])[0];c.moveTo(px,0);c.lineTo(px,height);}
    for(let y=Math.ceil(bottom*2)/2;y<=top;y+=.5){const py=at([0,y])[1];c.moveTo(0,py);c.lineTo(width,py);}c.stroke();
    if(settings.mode!=='drawing'){
      const center=new T.Vector3(...planeToWorld(settings.view,f.center));
      const direction=settings.view==='front'?new T.Vector3(-1,0,0):settings.view==='rear'?new T.Vector3(1,0,0):settings.view==='top'?new T.Vector3(0,1,0):new T.Vector3(0,0,1);
      camera.up.set(...(settings.view==='top'?[0,0,-1]:[0,1,0]) as [number,number,number]);
      camera.position.copy(center).addScaledVector(direction,10);camera.lookAt(center);
      camera.left=-width/2/ppm;camera.right=width/2/ppm;camera.top=height/2/ppm;camera.bottom=-height/2/ppm;camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);renderer.render(scene,camera);c.drawImage(renderer.domElement,0,0,width,height);
    }
    if(ready&&settings.mode!=='model'){
      const [sx,sy,sw,sh]=definition.crop,r=f.imageRect;
      c.save();c.globalAlpha=settings.mode==='drawing'?1:settings.opacity;c.globalCompositeOperation='multiply';
      c.drawImage(sheet,sx,sy,sw,sh,r.x,r.y,r.width,r.height);c.restore();
    }
    const zero=at([0,0]);c.save();c.strokeStyle='#518997';c.lineWidth=1;c.setLineDash([7,5]);c.beginPath();
    c.moveTo(zero[0],0);c.lineTo(zero[0],height);c.moveTo(0,zero[1]);c.lineTo(width,zero[1]);c.stroke();c.restore();
    if(settings.points&&settings.mode!=='model'&&ready){
      for(const p of definition.landmarks){const [x,y]=at(pixelToPlane(settings.view,p.pixel));
        c.strokeStyle=p.kind==='dimension'?'#297285':'#b57133';c.fillStyle=p.kind==='dimension'?'#297285':'#b57133';c.lineWidth=1.3;
        c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(x-8,y);c.lineTo(x+8,y);c.moveTo(x,y-8);c.lineTo(x,y+8);c.stroke();
        c.font='600 11px monospace';c.fillText(p.id,x+10,y-9);
      }
    }
    if(exportLabel){
      c.fillStyle='#fbfcfa';c.fillRect(0,0,width,62);c.fillRect(0,height-44,width,44);
      c.fillStyle='#325662';c.font='500 22px sans-serif';c.fillText(`A4 外形校准 / ${definition.name} / ${definition.basis}`,28,35);
      const modeName={overlay:'叠加',model:'仅模型',drawing:'仅图纸'}[settings.mode];
      c.font='14px sans-serif';c.fillText(`${modeName} / 图纸 ${settings.mode==='drawing'?100:Math.round(settings.opacity*100)}% · 青色：v${MODEL_VERSION} 估算模型 · 黑线：Audi 04/19 图纸 · 橙点：人工读图 · 固定等比 / 非 CAD 精度`,28,height-20);
      c.textAlign='right';c.font='12px sans-serif';c.fillText('图纸 © AUDI AG · 仅本地研究 · 非官方模型',width-28,35);c.textAlign='left';
    }
  }
  function resize(){if(disposed||exporting||contextLost)return;const r=host.getBoundingClientRect();if(r.width<1||r.height<1)return;
    const ratio=Math.min(window.devicePixelRatio,1.5);canvas.style.width='100%';canvas.style.height='100%';
    draw(canvas,Math.round(r.width*ratio),Math.round(r.height*ratio));}
  const observer=new ResizeObserver(resize);observer.observe(host);
  const onLost=(e:Event)=>{e.preventDefault();contextLost=true;onError('校准显卡上下文已丢失，请重新加载页面。');};
  renderer.domElement.addEventListener('webglcontextlost',onLost);
  sheet.onload=()=>{if(disposed)return;if(sheet.naturalWidth!==1191||sheet.naturalHeight!==1684){onError('图纸分辨率与标定坐标不一致，已停止叠加。');return;}ready=true;resize();onReady();};
  sheet.onerror=()=>{if(!disposed)onError('官方图纸加载失败，无法完成校准或导出。请检查本地参考文件。');};
  sheet.src='/references/audi-a4-dimensions.png';resize();
  function update(value:CalibrationSettings){settings=sanitizeCalibration(value);resize();}
  async function exportFrame():Promise<Blob>{
    if(disposed||contextLost)throw new Error('校准渲染器不可用');if(!ready)throw new Error('图纸尚未就绪');if(exporting)throw new Error('正在导出');
    exporting=true;const out=document.createElement('canvas');
    try{draw(out,1920,1080,true);return await new Promise<Blob>((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('图片编码失败')),'image/png'));}
    finally{exporting=false;if(!disposed)resize();}
  }
  function dispose(){disposed=true;observer.disconnect();sheet.onload=null;sheet.onerror=null;
    renderer.domElement.removeEventListener('webglcontextlost',onLost);car.dispose();replacements.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();}
  return {update,exportFrame,dispose,inspect:()=>({ready,disposed,contextLost,settings:{...settings},triangles,gpu,
    definition:getCalibrationView(settings.view),frame:fitFrame(settings.view,canvas.width,canvas.height),canvas:[canvas.width,canvas.height],steering:0})};
}
export type CalibrationEngine=ReturnType<typeof createCalibration>;
