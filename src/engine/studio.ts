import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildCar} from './car';
import {A4,AXLES,DEFAULT_SETTINGS,MODEL_VERSION,type CameraView,type StudySettings} from '../data/a4';

export interface StudioStats {triangles:number;drawCalls:number;gpu:string;software:boolean;}
export function createStudio(host:HTMLElement,onStats:(s:StudioStats)=>void,onError:(message:string)=>void) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label','可交互的奥迪 A4 三维研究模型。拖动旋转，滚轮缩放。');
  renderer.domElement.setAttribute('role','img');host.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#efefe9');scene.fog=new T.Fog('#efefe9',18,45);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.84;room.dispose();pmrem.dispose();
  const car=buildCar();scene.add(car.group);
  let modelTriangles=0;
  car.group.traverse(o=>{if(o instanceof T.Mesh)modelTriangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#e1e3d9',roughness:.91,metalness:0}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.006;ground.receiveShadow=true;scene.add(ground);
  scene.add(new T.HemisphereLight('#f7faff','#6b7568',1.1));
  const key=new T.DirectionalLight('#fff7e8',3.25);key.position.set(-3,7,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.025;key.shadow.bias=-.00015;key.shadow.radius=4;scene.add(key);
  const fill=new T.DirectionalLight('#d7e7f1',1.8);fill.position.set(2,3,-5);scene.add(fill);
  const front=new T.DirectionalLight('#ffffff',.55);front.position.set(-5,1,-2);scene.add(front);
  const perspective=new T.PerspectiveCamera(33,1,.05,100);perspective.position.set(-6.5,2.6,6.0);
  const orthographic=new T.OrthographicCamera(-3,3,2,-2,.05,100);
  let camera:T.PerspectiveCamera|T.OrthographicCamera=perspective, view:CameraView='hero';
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.69,0);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=4.4;controls.maxDistance=15;controls.minPolarAngle=.06;controls.maxPolarAngle=Math.PI/2-.025;controls.autoRotateSpeed=.6;controls.enablePan=true;controls.update();
  let settings:StudySettings={...DEFAULT_SETTINGS},dirty=true,disposed=false,exporting=false,frameId=0;
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'WebGL 2';
  const software=/swiftshader|llvmpipe|software/i.test(gpu);

  const dimensions=new T.Group();dimensions.visible=false;scene.add(dimensions);
  const rulerMat=new T.LineBasicMaterial({color:'#7a8874',transparent:true,opacity:.65,depthTest:false});
  const rulerLines:T.Line[]=[],rulerLabels:T.Sprite[]=[];
  const line=(pts:T.Vector3[])=>{const l=new T.Line(new T.BufferGeometry().setFromPoints(pts),rulerMat);l.renderOrder=10;dimensions.add(l);rulerLines.push(l);};
  line([new T.Vector3(-A4.length/2,.018,1.22),new T.Vector3(A4.length/2,.018,1.22)]);
  line([new T.Vector3(AXLES.front,.018,-1.13),new T.Vector3(AXLES.rear,.018,-1.13)]);
  for(const x of [-A4.length/2,A4.length/2])line([new T.Vector3(x,.018,.98),new T.Vector3(x,.018,1.35)]);
  for(const x of [AXLES.front,AXLES.rear])line([new T.Vector3(x,.018,-.92),new T.Vector3(x,.018,-1.25)]);
  const labelTextures:T.Texture[]=[];
  function label(text:string,x:number,z:number){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#50614d';ctx.font='500 45px monospace';ctx.textAlign='center';ctx.fillText(text,256,70);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;labelTextures.push(tex);const material=new T.SpriteMaterial({map:tex,transparent:true,depthTest:false});const sprite=new T.Sprite(material);sprite.scale.set(.92,.20,1);sprite.position.set(x,.15,z);sprite.renderOrder=11;dimensions.add(sprite);rulerLabels.push(sprite);
  }
  label('4 762 mm',0,1.44);label('2 820 mm',(AXLES.front+AXLES.rear)/2,-1.37);
  function updateRulers(){
    dimensions.visible=settings.dimensions&&view!=='front'&&view!=='rear';
    rulerLabels.forEach((s,i)=>{s.position.y=view==='side'?-.10-i*.20:.15;});
    rulerLines.forEach((l,i)=>{l.position.y=view==='side'&&[1,4,5].includes(i)?-.18:0;});
  }

  function updateProjection(width:number,height:number){
    const ratio=width/height;perspective.aspect=ratio;perspective.zoom=Math.min(1,ratio/1.20);perspective.updateProjectionMatrix();
    const size=view==='front'||view==='rear'?Math.max(2.10,2.8/ratio):view==='top'?Math.max(3.1,6.1/ratio):Math.max(2.1,6.1/ratio);
    orthographic.left=-size*ratio/2;orthographic.right=size*ratio/2;orthographic.top=size/2;orthographic.bottom=-size/2;orthographic.updateProjectionMatrix();
  }
  function resize(){if(disposed||exporting)return;const {width,height}=host.getBoundingClientRect();if(width<1||height<1)return;renderer.setSize(width,height);updateProjection(width,height);dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  controls.addEventListener('change',()=>{dirty=true;});
  const onLost=(e:Event)=>{e.preventDefault();onError('显卡上下文已丢失。请关闭其他高负载页面后刷新重试。');};renderer.domElement.addEventListener('webglcontextlost',onLost);
  function emitStats(){onStats({triangles:modelTriangles,drawCalls:renderer.info.render.calls,gpu,software});}
  let sent=false,lastTime=performance.now();
  function tick(){
    if(disposed)return;frameId=requestAnimationFrame(tick);
    const now=performance.now(),delta=Math.min(.1,(now-lastTime)/1000);lastTime=now;
    if(exporting||document.hidden)return;
    const moved=controls.update(delta);
    if(dirty||moved||controls.autoRotate){renderer.render(scene,camera);dirty=false;if(!sent){emitStats();sent=true;}}
  }
  tick();
  function setView(next:CameraView){
    // 清空上一机位的惯性与自动旋转，避免“正交机位”残留几度偏转。
    controls.autoRotate=false;controls.enableDamping=false;controls.update();controls.enableDamping=true;settings={...settings,rotate:false};
    view=next;camera=next==='hero'?perspective:orthographic;camera.up.set(0,1,0);orthographic.zoom=1;controls.object=camera;controls.target.set(0,.70,0);controls.enableRotate=next==='hero';
    if(next==='hero')camera.position.set(-6.5,2.6,6.0);
    if(next==='side')camera.position.set(0,.70,9);
    if(next==='front')camera.position.set(-9,.70,0);
    if(next==='rear')camera.position.set(9,.70,0);
    if(next==='top'){camera.position.set(0,9,0);camera.up.set(0,0,-1);controls.target.set(0,0,0);}
    controls.minPolarAngle=next==='hero'?.06:0;controls.maxPolarAngle=next==='hero'?Math.PI/2-.025:Math.PI;
    camera.lookAt(controls.target);controls.update();updateRulers();resize();dirty=true;
  }
  function update(next:StudySettings){settings={...next};car.update(settings);controls.autoRotate=next.rotate;updateRulers();dirty=true;}
  /** 仅用于可复现的本地曲面检查；保持现有灯光、材质与导出尺寸。 */
  function setInspectionPose(position:[number,number,number],target:[number,number,number]=[0,.70,0]){
    if(![...position,...target].every(Number.isFinite)||Math.hypot(...position.map((n,i)=>n-target[i]))<.1)throw new Error('检查机位坐标无效');
    setView('hero');controls.enableDamping=false;perspective.position.set(...position);controls.target.set(...target);controls.update();controls.enableDamping=true;dirty=true;
  }
  async function exportFrame():Promise<Blob>{
    if(exporting)throw new Error('已有导出任务正在运行');exporting=true;
    const ratio=renderer.getPixelRatio();
    try{
      renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);updateProjection(1920,1080);renderer.render(scene,camera);
      return await new Promise<Blob>((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('图片编码失败')),'image/png'));
    } finally {exporting=false;if(!disposed){renderer.setPixelRatio(ratio);resize();dirty=true;}}
  }
  async function exportModel():Promise<Blob>{
    const snapshot={...settings};
    const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
    // 使用独立几何和材质，不与正在交互的场景共享引用；GLB 始终输出标准材质。
    const exportCar=buildCar();exportCar.update({...snapshot,mode:'paint'});
    exportCar.group.userData={source:'依据 Audi 官方 04/19 尺寸图的程序化近似；非原厂模型',modelVersion:MODEL_VERSION,units:'metres',coordinateSystem:'X longitudinal (front negative), Y up, Z lateral'};
    try{
      const data=await new GLTFExporter().parseAsync(exportCar.group,{binary:true});
      if(!(data instanceof ArrayBuffer))throw new Error('模型导出格式错误');
      return new Blob([data],{type:'model/gltf-binary'});
    }finally{exportCar.dispose();}
  }
  function dispose(){
    disposed=true;cancelAnimationFrame(frameId);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',onLost);
    car.dispose();ground.geometry.dispose();ground.material.dispose();environment.dispose();key.shadow.dispose();
    dimensions.traverse(o=>{if(o instanceof T.Line)o.geometry.dispose();if(o instanceof T.Sprite)o.material.dispose();});rulerMat.dispose();labelTextures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  }
  return {update,setView,setInspectionPose,exportFrame,exportModel,dispose,inspect:()=>({view,settings:{...settings},gpu,software,triangles:modelTriangles,renderTriangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,camera:camera.position.toArray(),target:controls.target.toArray()})};
}
export type Studio=ReturnType<typeof createStudio>;
