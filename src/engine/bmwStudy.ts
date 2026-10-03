import * as T from 'three';
import {BMW_STUDY} from '../vehicles/bmw-g20/config';
import {BASE_CAMERAS,PHOTOS,pointResiduals,type PhotoDefinition} from '../vehicles/bmw-g20/studyData';
import {makePhotoCamera,type PhotoCamera} from '../modeling/projection';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildFrontCorner,type FrontCornerRevision} from '../vehicles/bmw-g20/frontCorner';
import {addSurfaceLights,createSurfaceMaterials,type SurfaceMode} from './bmwFrontCorner';

export type BmwViewSettings={photo:PhotoDefinition;camera:PhotoCamera;mode:'overlay'|'skeleton'|'reference';opacity:number;points:boolean;silhouette:boolean;object:'skeleton'|'surface';inspection:'photo'|'free';surfaceMode:SurfaceMode;controlNet:boolean;bulge:number;surfaceOpacity:number;revision:FrontCornerRevision};
export type FrontCornerStats={patchCount:number;triangles:number;maxGap:number;maxSmoothAngleDeg:number;revision:FrontCornerRevision};
export type FrontView='left'|'right'|'front'|'side'|'back';
/** 只有骨架线和圆形轮心占位，没有借用 A4 车身或加入任何精细车头。 */
export function buildBmwSkeleton(){
  const group=new T.Group();group.name=BMW_STUDY.id;
  const bodyMaterial=new T.LineBasicMaterial({color:0x68ded0,transparent:true,opacity:.92});
  const wheelMaterial=new T.LineBasicMaterial({color:0xf2bd74});
  for(const ids of BMW_STUDY.lines){
    const geometry=new T.BufferGeometry().setFromPoints(ids.map(id=>new T.Vector3(...BMW_STUDY.points[id])));
    group.add(new T.Line(geometry,bodyMaterial));
  }
  for(const [id,center] of Object.entries(BMW_STUDY.points).filter(([id])=>id.startsWith('hub-'))){
    const geometry=new T.BufferGeometry().setFromPoints(Array.from({length:65},(_,i)=>{
      const a=i/64*Math.PI*2;return new T.Vector3(center[0]+BMW_STUDY.wheelRadius*Math.cos(a),center[1]+BMW_STUDY.wheelRadius*Math.sin(a),center[2]);
    }));
    const wheel=new T.Line(geometry,wheelMaterial);wheel.name=id;group.add(wheel);
  }
  return {group,dispose(){group.traverse(o=>{if(o instanceof T.Line)o.geometry.dispose();});bodyMaterial.dispose();wheelMaterial.dispose();}};
}

export function createBmwStudy(host:HTMLElement,onError:(message:string)=>void,onStats?:(stats:FrontCornerStats)=>void){
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  if(!context)throw new Error('二维标注画布不可用');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','BMW 局部曲面、三维骨架与原始照片对照；自由检查可拖动旋转');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;
  const skeleton=buildBmwSkeleton(),scene=new T.Scene();scene.add(skeleton.group);
  let surface=buildFrontCorner();scene.add(surface.group,surface.controlGroup);addSurfaceLights(scene);
  const materials=createSurfaceMaterials();
  const freeCamera=new T.PerspectiveCamera(35,1,.05,100),controls=new OrbitControls(freeCamera,canvas);
  controls.enableDamping=false;controls.minDistance=.6;controls.maxDistance=15;controls.target.set(-1.43,.8,0);freeCamera.position.set(-3.8,2.0,3.0);controls.update();
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  let disposed=false,lost=false,reference:HTMLImageElement|null=null;
  let settings:BmwViewSettings={photo:PHOTOS[0],camera:BASE_CAMERAS[0],mode:'overlay',opacity:.75,points:true,silhouette:false,object:'surface',inspection:'free',surfaceMode:'clay',controlNet:false,bulge:0,surfaceOpacity:.65,revision:'refined'};
  const report=()=>onStats?.({patchCount:surface.patches.length*2,triangles:surface.triangleCount,maxGap:surface.diagnostics.maxGap,maxSmoothAngleDeg:surface.diagnostics.maxSmoothAngleDeg,revision:surface.revision});
  host.appendChild(canvas);
  function draw(){
    if(disposed||lost||!context)return;
    const bounds=host.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;
    const dpr=Math.min(devicePixelRatio,1.5),w=Math.round(bounds.width*dpr),h=Math.round(bounds.height*dpr);
    canvas.width=w;canvas.height=h;canvas.style.width='100%';canvas.style.height='100%';
    const c=context,crop=settings.camera.crop,scale=Math.min(w/crop.width,h/crop.height);
    const fw=crop.width*scale,fh=crop.height*scale,x=(w-fw)/2,y=(h-fh)/2;
    c.fillStyle='#132c33';c.fillRect(0,0,w,h);
    const free=settings.inspection==='free';controls.enabled=free;
    skeleton.group.visible=settings.object==='skeleton';surface.group.visible=settings.object==='surface';surface.controlGroup.visible=settings.object==='surface'&&settings.controlNet;
    materials.apply(surface.group,settings.surfaceMode);
    if(free){
      freeCamera.aspect=w/h;freeCamera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(35/2))*Math.max(1,1.4/freeCamera.aspect)));
      freeCamera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.render(scene,freeCamera);c.drawImage(renderer.domElement,0,0,w,h);return;
    }
    c.strokeStyle='#254047';c.lineWidth=1;
    for(let gx=0;gx<w;gx+=48*dpr){c.beginPath();c.moveTo(gx,0);c.lineTo(gx,h);c.stroke();}
    for(let gy=0;gy<h;gy+=48*dpr){c.beginPath();c.moveTo(0,gy);c.lineTo(w,gy);c.stroke();}
    c.save();c.beginPath();c.rect(x,y,fw,fh);c.clip();
    if(reference&&settings.mode!=='skeleton'){
      c.globalAlpha=settings.mode==='reference'?1:settings.opacity;
      c.drawImage(reference,crop.x,crop.y,crop.width,crop.height,x,y,fw,fh);c.globalAlpha=1;
    }
    if(settings.mode!=='reference'){
      renderer.setSize(Math.max(1,Math.round(fw)),Math.max(1,Math.round(fh)),false);
      renderer.render(scene,makePhotoCamera(settings.camera));c.globalAlpha=settings.object==='surface'&&settings.mode==='overlay'?settings.surfaceOpacity:1;c.drawImage(renderer.domElement,x,y,fw,fh);c.globalAlpha=1;
    }
    const at=(p:number[])=>[x+(p[0]-crop.x)*scale,y+(p[1]-crop.y)*scale];
    if(settings.silhouette){
      c.strokeStyle='#eebb76';c.setLineDash([5*dpr,5*dpr]);c.lineWidth=1.3*dpr;c.beginPath();
      settings.photo.silhouette.points.forEach((p,i)=>{const [px,py]=at(p);if(i)c.lineTo(px,py);else c.moveTo(px,py);});c.closePath();c.stroke();c.setLineDash([]);
    }
    if(settings.points){
      const residuals=pointResiduals(settings.photo,settings.camera);
      residuals.forEach((p,i)=>{
        const ax=x+p.target[0]*scale,ay=y+p.target[1]*scale;
        c.lineWidth=1.4*dpr;
        if(p.usable&&p.predicted&&settings.mode!=='reference'){
          const bx=x+p.predicted[0]*scale,by=y+p.predicted[1]*scale;
          c.strokeStyle='#fb857b';c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
          c.strokeStyle='#80f7e3';c.beginPath();c.moveTo(bx-5*dpr,by);c.lineTo(bx+5*dpr,by);c.moveTo(bx,by-5*dpr);c.lineTo(bx,by+5*dpr);c.stroke();
        }
        c.fillStyle='#f7c382';c.beginPath();c.arc(ax,ay,3.5*dpr,0,Math.PI*2);c.fill();
        c.font=`600 ${11*dpr}px monospace`;c.fillStyle='#fff3dd';c.fillText(String(i+1),ax+7*dpr,ay-7*dpr);
      });
    }
    c.restore();c.strokeStyle='#618186';c.lineWidth=1;c.strokeRect(x+.5,y+.5,fw-1,fh-1);
  }
  const observer=new ResizeObserver(draw);observer.observe(host);
  controls.addEventListener('change',draw);
  const onLost=(event:Event)=>{event.preventDefault();lost=true;onError('WebGL 上下文丢失，请刷新 BMW 工作台。');};
  renderer.domElement.addEventListener('webglcontextlost',onLost);
  draw();report();
  return {
    update(next:BmwViewSettings){
      if(next.photo.sourceId!==settings.photo.sourceId)reference=null;
      if(next.bulge!==settings.bulge||next.revision!==settings.revision){
        try{
          const replacement=buildFrontCorner(next.bulge,24,next.revision);
          scene.remove(surface.group,surface.controlGroup);surface.dispose();surface=replacement;
          scene.add(surface.group,surface.controlGroup);report();
        }catch(e){onError(`曲面更新失败，保留上一个可用模型：${e instanceof Error?e.message:String(e)}`);return;}
      }
      if(!lost)onError('');
      settings=next;draw();
    },
    setFreeView(view:FrontView){
      const positions:Record<FrontView,[number,number,number]>={left:[-3.8,2.0,3.0],right:[-3.8,2,-3.0],front:[-4.5,1.3,0],side:[-1.8,1.1,3.6],back:[1.0,1.5,2.3]};
      controls.target.set(-1.43,.8,0);freeCamera.position.set(...positions[view]);controls.update();draw();
    },
    setImage(image:HTMLImageElement|null){reference=image;draw();},
    dispose(){disposed=true;observer.disconnect();controls.removeEventListener('change',draw);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',onLost);reference=null;skeleton.dispose();surface.dispose();materials.dispose();renderer.dispose();canvas.remove();},
  };
}
