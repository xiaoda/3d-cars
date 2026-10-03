import {useEffect,useMemo,useRef,useState} from 'react';
import {createBmwStudy,type BmwViewSettings,type FrontCornerStats,type FrontView} from '../engine/bmwStudy';
import {BASE_CAMERAS,PHOTOS,STORAGE_KEY,defaultState,parseStudyState,pointResiduals,summarizeResiduals,verifyReferenceMeta} from '../vehicles/bmw-g20/studyData';
import {ALTERNATIVE_CAMERAS,applyCameraChoice,identifyCameraChoice} from '../vehicles/bmw-g20/cameraReview';
import {parseCamera,type PhotoCamera} from '../modeling/projection';
import './bmw-workspace.css';

function loadSaved(){
  try{const raw=localStorage.getItem(STORAGE_KEY);return {study:raw?parseStudyState(JSON.parse(raw)):defaultState(),notice:''};}
  catch{return {study:defaultState(),notice:'旧参数或本地存储无效，已使用本轮基线；A4 设置未更改。'};}
}
function downloadJson(value:unknown){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='bmw-g20-camera-study-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function BmwModelingWorkspace(){
  const [initial]=useState(loadSaved),[study,setStudy]=useState(initial.study);
  const [sourceId,setSourceId]=useState(PHOTOS[0].sourceId),[locked,setLocked]=useState(true);
  const [mode,setMode]=useState<BmwViewSettings['mode']>('overlay'),[opacity,setOpacity]=useState(.75);
  const [points,setPoints]=useState(true),[silhouette,setSilhouette]=useState(false);
  const [object,setObject]=useState<BmwViewSettings['object']>('surface'),[inspection,setInspection]=useState<BmwViewSettings['inspection']>('free');
  const [surfaceMode,setSurfaceMode]=useState<BmwViewSettings['surfaceMode']>('clay'),[controlNet,setControlNet]=useState(false),[bulge,setBulge]=useState(0),[surfaceOpacity,setSurfaceOpacity]=useState(.65);
  const [surfaceStats,setSurfaceStats]=useState<FrontCornerStats|null>(null);
  const [notice,setNotice]=useState(initial.notice),[error,setError]=useState(''),[ready,setReady]=useState(false);
  const [imageStatus,setImageStatus]=useState('未载入原图'),[loading,setLoading]=useState(false);
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createBmwStudy>|null>(null);
  const pending=useRef(0),alive=useRef(false),imageUrl=useRef<string|null>(null);
  const photo=PHOTOS.find(p=>p.sourceId===sourceId)!,camera=study.cameras.find(c=>c.sourceId===sourceId)!;
  const residuals=useMemo(()=>pointResiduals(photo,camera),[photo,camera]);
  const summary=summarizeResiduals(residuals),rms=summary.rmsPx;
  const reviewMessage=summary.status==='complete'?'固定对应点均在画内；仅表示可以计算误差，不代表相机视觉验收通过。':summary.status==='outside-frame'?'存在画外投影或被裁掉的标注：仍按全部固定对应点计算 RMS，不能靠隐藏误差点过关。':summary.status==='invalid-projection'?'必需点位于相机平面、背面或深度范围外：整组 RMS 不可用，请恢复或修正相机。':'没有可评估的固定对应点。';
  const reasonLabels:Record<string,string>={'ok':'画内','outside-frame':'画外 / 裁剪外','depth-clipped':'深度范围外','non-projectable':'不可投影','excluded':'预先排除'};
  const cameraChoice=identifyCameraChoice(camera),alternatives=ALTERNATIVE_CAMERAS.filter(c=>c.sourceId===sourceId);
  const baseline=BASE_CAMERAS.find(c=>c.sourceId===sourceId)!;
  const baselineRms=useMemo(()=>summarizeResiduals(pointResiduals(photo,baseline)).rmsPx,[photo,baseline]);
  const settings={photo,camera,mode,opacity,points,silhouette,object,inspection,surfaceMode,controlNet,bulge,surfaceOpacity};
  const latest=useRef(settings);latest.current=settings;
  useEffect(()=>{
    alive.current=true;
    try{const instance=createBmwStudy(host.current!,setError,setSurfaceStats);engine.current=instance;instance.update(latest.current);setReady(true);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    return()=>{alive.current=false;pending.current++;engine.current?.dispose();engine.current=null;if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);imageUrl.current=null;};
  },[]);
  useEffect(()=>{engine.current?.update({photo,camera,mode,opacity,points,silhouette,object,inspection,surfaceMode,controlNet,bulge,surfaceOpacity});},[photo,camera,mode,opacity,points,silhouette,object,inspection,surfaceMode,controlNet,bulge,surfaceOpacity]);
  useEffect(()=>{
    pending.current++;engine.current?.setImage(null);setImageStatus('未载入原图');setLoading(false);setLocked(true);
    if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);imageUrl.current=null;
  },[sourceId]);
  async function openPhoto(file:File|undefined){
    if(!file)return;
    const ticket=++pending.current;setLoading(true);setNotice('正在本机核对原图 SHA-256…');
    let url:string|undefined;
    try{
      if(file.size>32*1024*1024||file.size===0||!['image/jpeg','image/png'].includes(file.type))throw new Error('请选择 32 MB 以内的原始 JPG/PNG 图片');
      const data=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',data);
      const sha256=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
      if(sha256!==photo.sha256)throw new Error(`不是 ${photo.sourceId} 的原始文件，已拒绝加载。`);
      url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
      verifyReferenceMeta({width:image.naturalWidth,height:image.naturalHeight,sha256},photo);
      if(!alive.current||ticket!==pending.current){URL.revokeObjectURL(url);return;}
      if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);imageUrl.current=url;url=undefined;
      engine.current?.setImage(image);setImageStatus('原图已校验 · 仅本机');setNotice('已按原图比例叠加；没有上传或修改照片。');
    }catch(e){if(url)URL.revokeObjectURL(url);if(alive.current&&ticket===pending.current)setNotice(e instanceof Error?e.message:String(e));}
    finally{if(alive.current&&ticket===pending.current)setLoading(false);}
  }
  function changeCamera(change:Partial<PhotoCamera>){
    if(locked)return;
    try{const next=parseCamera({...camera,...change});if(next.position.some(p=>Math.abs(p)>50))throw new Error('相机位置超出 50 m 研究边界');setStudy(s=>({...s,cameras:s.cameras.map(c=>c.sourceId===sourceId?next:c)}));setNotice('参数已修改，残差实时更新；尚未保存。');}
    catch(e){setNotice(e instanceof Error?e.message:String(e));}
  }
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(parseStudyState(study)));setNotice('BMW 相机参数已保存到本浏览器；不含照片，A4 设置未更改。');}catch(e){setNotice(`保存失败：${e instanceof Error?e.message:String(e)}`);}}
  function selectCamera(choiceId:string){
    setStudy(s=>applyCameraChoice(s,sourceId,choiceId));setLocked(true);
    setNotice(choiceId==='baseline'?'已恢复当前机位基线，其他机位未改变；尚未保存。':'已切换到替代相机并锁定；原图、骨架及其他机位未变。候选不等于通过验收，尚未保存。');
  }
  async function importParameters(file:File|undefined){
    if(!file)return;
    try{if(file.size>65536)throw new Error('参数文件超过 64 KB');const next=parseStudyState(JSON.parse(await file.text()));if(!alive.current)return;setStudy(next);setLocked(true);setNotice('参数已导入并锁定；点击保存可保留到下次打开。');}
    catch(e){if(alive.current)setNotice(`导入失败：${e instanceof Error?e.message:String(e)}`);}
  }
  return <main className="bmw-workspace">
    <div className="bmw-heading"><div><span className="bmw-eyebrow">NO. 002 / SURFACE PROOF</span><h1>BMW <em>G20</em><span>机盖 · 灯角 · 翼子板</span></h1></div><p>阶段 02 · 分区曲面技术小样<br/><strong>局部白模，不是完整车头</strong></p></div>
    <div className="bmw-layout">
      <aside className="bmw-controls" aria-label="宝马对比控制">
        <section><h2><b>01</b> 参考机位</h2><div className="bmw-photo-options">{PHOTOS.map((p,i)=><button key={p.sourceId} aria-pressed={p.sourceId===sourceId&&inspection==='photo'} onClick={()=>{setSourceId(p.sourceId);setInspection('photo');setNotice('');}}><span>{String(i+1).padStart(2,'0')}</span><div>{p.title}<small>{p.sourceId} · {i===2?'仅定性参考':'临时工作机位'}</small></div><i>↗</i></button>)}</div>
          <label className="bmw-file-label">{loading?'正在校验…':'选择当前机位原图'}<input aria-label="选择 BMW 官方原图" type="file" accept="image/jpeg,image/png" disabled={loading||!ready} onChange={e=>{void openPhoto(e.target.files?.[0]);e.target.value='';}}/></label>
          <p className="bmw-help">请选择 <code>{sourceId}.jpg</code>。按尺寸和哈希核对，不通过开发服务器读取私有目录。</p>
        </section>
        <section><h2><b>02</b> 照片对比显示</h2><div className="bmw-modes" aria-label="BMW 对比模式">{([{id:'overlay',name:'叠加'},{id:'skeleton',name:'模型'},{id:'reference',name:'原图'}] as const).map(m=><button key={m.id} disabled={inspection==='free'} aria-pressed={mode===m.id} onClick={()=>setMode(m.id)}>{m.name}</button>)}</div>
          <label className="bmw-range">原图不透明度 <output>{Math.round(opacity*100)}%</output><input aria-label="BMW 原图不透明度" type="range" min="0" max="1" step=".05" value={opacity} disabled={mode!=='overlay'||inspection==='free'} onChange={e=>setOpacity(Number(e.target.value))}/></label>
          <label className="bmw-range">曲面叠加不透明度 <output>{Math.round(surfaceOpacity*100)}%</output><input aria-label="BMW 曲面不透明度" type="range" min="0" max="1" step=".05" value={surfaceOpacity} disabled={object!=='surface'||mode!=='overlay'||inspection==='free'} onChange={e=>setSurfaceOpacity(Number(e.target.value))}/></label>
          <label className="bmw-check"><input type="checkbox" disabled={inspection==='free'} checked={points} onChange={e=>setPoints(e.target.checked)}/> 显示锚点与残差线</label>
          <label className="bmw-check"><input type="checkbox" disabled={inspection==='free'} checked={silhouette} onChange={e=>setSilhouette(e.target.checked)}/> 显示粗轮廓标注（非三维点）</label>
        </section>
        <section><h2><b>03</b> 相机参数 <span>{cameraChoice==='baseline'?'基线':cameraChoice==='custom'?'自定义':'候选 · 未签收'}</span></h2>
          {alternatives.length>0&&<div className="bmw-camera-review" aria-label="相机多解比较">
            <div className="bmw-candidate-options"><button aria-pressed={cameraChoice==='baseline'} onClick={()=>selectCamera('baseline')}>原基线</button>{alternatives.map(c=><button key={c.id} aria-pressed={cameraChoice===c.id} onClick={()=>selectCamera(c.id)}>{c.label}</button>)}</div>
            <p>同一原图、同一骨架，比较不同位姿。原基线 X 为 {baseline.position[0].toFixed(3)} m，EXIF 候选为 {alternatives[0].camera.position[0].toFixed(3)} m（−X 指向车头），前后位置存在歧义。</p>
            <p>原基线 RMS {baselineRms?.toFixed(1)??'—'} px，候选 {alternatives[0].rmsPx.toFixed(1)} px；低残差不能证明真实相机。第一轮重复选点复核未找到满足同一高度先验的解，暂不冻结此机位。</p>
          </div>}
          <label className="bmw-check bmw-lock"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)}/> 锁定相机</label>
          <div className="bmw-camera-fields">{camera.position.map((v,i)=><label key={i}>位置 {['X','Y','Z'][i]} / m<input aria-label={`相机位置 ${['X','Y','Z'][i]}`} type="number" step=".02" min="-50" max="50" value={Number(v.toFixed(4))} disabled={locked} onChange={e=>{const position=[...camera.position] as PhotoCamera['position'];position[i]=Number(e.target.value);changeCamera({position});}}/></label>)}<label>垂直视场角 / °<input aria-label="相机垂直视场角" type="number" step=".1" min="5" max="120" value={Number(camera.fovY.toFixed(4))} disabled={locked} onChange={e=>changeCamera({fovY:Number(e.target.value)})}/></label></div>
          <p className="bmw-help">以下为照片相机，不控制自由视角。旋转沿用当前初值；尺度固定，EXIF 只作先验。A / B 临时使用，C 不参与曲面拟合。</p>
          <div className="bmw-action-row"><button onClick={save}>保存参数</button><button onClick={()=>selectCamera('baseline')}>恢复此机位</button></div>
          <div className="bmw-action-row"><button onClick={()=>downloadJson(study)}>导出 JSON</button><label className="bmw-import">导入 JSON<input aria-label="导入 BMW 相机参数" type="file" accept=".json,application/json" onChange={e=>{void importParameters(e.target.files?.[0]);e.target.value='';}}/></label></div>
        </section>
      </aside>
      <section className="bmw-panel" aria-label="宝马局部曲面与照片对比">
        <div className="bmw-panel-heading"><div><span className="bmw-eyebrow">{inspection==='free'?'LOCAL SURFACE / ORBIT':`${sourceId} / PERSPECTIVE`}</span><h2>{inspection==='free'?'局部白模 · 自由检查':photo.title}</h2></div><div className="bmw-panel-status">{inspection==='free'?'独立自由相机':locked?'相机已锁定':'相机编辑中'}<small>{imageStatus}</small></div></div>
        <div className="bmw-surface-tools">
          <div className="bmw-tool-row"><div className="bmw-modes" aria-label="研究对象">{([{id:'surface',label:'局部曲面'},{id:'skeleton',label:'骨架'}] as const).map(o=><button key={o.id} aria-pressed={object===o.id} onClick={()=>setObject(o.id)}>{o.label}</button>)}</div><div className="bmw-modes" aria-label="观察方式"><button aria-pressed={inspection==='free'} onClick={()=>setInspection('free')}>自由检查</button><button aria-pressed={inspection==='photo'} onClick={()=>setInspection('photo')}>照片对照</button></div></div>
          {object==='surface'&&<><div className="bmw-tool-row"><div className="bmw-modes" aria-label="曲面诊断">{([{id:'clay',label:'白模'},{id:'normals',label:'法线'},{id:'stripes',label:'反射条纹'}] as const).map(m=><button key={m.id} aria-pressed={surfaceMode===m.id} onClick={()=>setSurfaceMode(m.id)}>{m.label}</button>)}</div><label className="bmw-check"><input type="checkbox" checked={controlNet} onChange={e=>setControlNet(e.target.checked)}/> 控制网</label></div>
          <details className="bmw-bulge"><summary>局部控制实验 · 不改变灯口边界</summary><label className="bmw-range">机盖内部控制点高度 <output>{Math.round(bulge*1000)} mm</output><input aria-label="机盖拱度实验" type="range" min="-.04" max=".04" step=".005" value={bulge} onChange={e=>setBulge(Number(e.target.value))}/></label><button onClick={()=>setBulge(0)}>恢复曲面基线</button><p>只改变同一母面内部两点，随后精确分区；不是实车尺寸参数，不保存实验值。</p></details></>}
          {inspection==='free'&&<div className="bmw-free-views">{([{id:'left',label:'左前高位'},{id:'right',label:'右前高位'},{id:'front',label:'正前'},{id:'side',label:'侧前'},{id:'back',label:'背面'}] as {id:FrontView;label:string}[]).map(v=><button key={v.id} onClick={()=>engine.current?.setFreeView(v.id)}>{v.label}</button>)}<small>拖动旋转 · 滚轮缩放</small></div>}
        </div>
        <div className="bmw-viewport-wrap"><div className="bmw-canvas" ref={host}/>{inspection==='photo'&&imageStatus==='未载入原图'&&<div className="bmw-empty-note">{mode==='reference'?'原图尚未载入，当前仅显示已开启的标注':`当前仅显示${object==='surface'?'局部曲面':'共用骨架'}和已有标注`}<br/><span>选择原图后进行同角度叠加，不会自动读取本机文件</span></div>}{error&&<div className="bmw-error" role="alert">{error}</div>}</div>
        <div className="bmw-legend"><span><i className={object==='surface'?'bmw-surface-key':'bmw-cyan'}/>{object==='surface'?'局部曲面 · 双侧镜像':'共用三维骨架'}</span>{inspection==='photo'?<><span><i className="bmw-amber"/>人工二维锚点</span><span><i className="bmw-red"/>骨架重投影残差</span></>:<span>自由视角不计算照片误差</span>}<small>−X 车头 · +Y 向上 · +Z 左侧 · m</small></div>
        {surfaceStats&&object==='surface'&&<div className="bmw-surface-stats"><span>{surfaceStats.patchCount} 块面片 · {surfaceStats.triangles.toLocaleString()} 三角面</span><span>共边差 {surfaceStats.maxGap.toExponential(1)} m</span><span>光滑接边法线差 {surfaceStats.maxSmoothAngleDeg.toFixed(4)}°</span><p>这里只验证声明的接边。灯口贯通；双肾、保险杠、完整轮拱及灯内件未建。条纹是诊断图，不是实车反射仿真。</p></div>}
        {inspection==='photo'&&<><div className="bmw-metrics"><div><span>骨架锚点 RMS</span><strong>{rms===null?'—':rms.toFixed(1)}<small>px</small></strong></div><div><span>相对车身 ROI 宽</span><strong>{rms===null?'—':(rms/photo.roi.width*100).toFixed(2)}<small>%</small></strong></div><div><span>画内 / 固定对应点</span><strong>{summary.inFrameCount}<small>/ {summary.requiredCount}</small></strong></div><p>这是<strong>旧骨架的相机拟合残差</strong>，不是新增曲面的形状精度。曲面修改不会降低这个数值，不能据此判断还原度。</p></div>
        <div className="bmw-review-status" data-status={summary.status} role="status">{reviewMessage}{sourceId==='P90549635'&&<p>近侧机位只有 4 个对应点；原基线焦距位于试验下界。本轮发现另一低机位候选与明显选点敏感性，请在相机参数区比较，不能仅按 RMS 决定。</p>}</div>
        <details className="bmw-residuals"><summary>逐点残差与标注重复性</summary><table><thead><tr><th>锚点</th><th>状态</th><th>残差 / px</th><th>重复选点差 / px</th></tr></thead><tbody>{residuals.map((p,i)=><tr key={p.id}><td>{i+1}. {p.id}</td><td>{reasonLabels[p.reason]}</td><td>{p.required&&p.errorPx!==null?p.errorPx.toFixed(1):'—'}</td><td>{photo.points[i].repeatDeltaPx.toFixed(1)}</td></tr>)}</tbody></table></details></>}
        <div className="bmw-notice" role="status">{notice||'研究状态：局部技术小样待审阅。原厂动力及选装仍未知；所有视角使用同一套控制网。'}</div>
      </section>
    </div>
    <div className="bmw-boundary"><strong>本阶段的边界</strong><p>已获准缩小为局部曲面技术小样；A / B 是临时工作机位，C 仅作定性参考，完整相机关未通过。曲面来自照片观察与手工控制网，不是原厂 CAD。<br/>4 张留出图未参与本轮拟合；没有完成完整车头及零售展示验收。原图仅在当前浏览器内存，不上传、不保存、不进入公开构建。</p></div>
  </main>;
}
