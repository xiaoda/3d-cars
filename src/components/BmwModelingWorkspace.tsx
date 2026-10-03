import {useEffect,useMemo,useRef,useState} from 'react';
import {createBmwStudy,type BmwViewSettings} from '../engine/bmwStudy';
import {BASE_CAMERAS,PHOTOS,STORAGE_KEY,defaultState,parseStudyState,pointResiduals,summarizeResiduals,verifyReferenceMeta} from '../vehicles/bmw-g20/studyData';
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
  const [notice,setNotice]=useState(initial.notice),[error,setError]=useState(''),[ready,setReady]=useState(false);
  const [imageStatus,setImageStatus]=useState('未载入原图'),[loading,setLoading]=useState(false);
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createBmwStudy>|null>(null);
  const pending=useRef(0),alive=useRef(false),imageUrl=useRef<string|null>(null);
  const photo=PHOTOS.find(p=>p.sourceId===sourceId)!,camera=study.cameras.find(c=>c.sourceId===sourceId)!;
  const residuals=useMemo(()=>pointResiduals(photo,camera),[photo,camera]);
  const summary=summarizeResiduals(residuals),rms=summary.rmsPx;
  const reviewMessage=summary.status==='complete'?'固定对应点均在画内；仅表示可以计算误差，不代表相机视觉验收通过。':summary.status==='outside-frame'?'存在画外投影或被裁掉的标注：仍按全部固定对应点计算 RMS，不能靠隐藏误差点过关。':summary.status==='invalid-projection'?'必需点位于相机平面、背面或深度范围外：整组 RMS 不可用，请恢复或修正相机。':'没有可评估的固定对应点。';
  const reasonLabels:Record<string,string>={'ok':'画内','outside-frame':'画外 / 裁剪外','depth-clipped':'深度范围外','non-projectable':'不可投影','excluded':'预先排除'};
  const changed=JSON.stringify(camera)!==JSON.stringify(BASE_CAMERAS.find(c=>c.sourceId===sourceId));
  const settings={photo,camera,mode,opacity,points,silhouette};
  const latest=useRef(settings);latest.current=settings;
  useEffect(()=>{
    alive.current=true;
    try{const instance=createBmwStudy(host.current!,setError);engine.current=instance;instance.update(latest.current);setReady(true);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    return()=>{alive.current=false;pending.current++;engine.current?.dispose();engine.current=null;if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);imageUrl.current=null;};
  },[]);
  useEffect(()=>{engine.current?.update({photo,camera,mode,opacity,points,silhouette});},[photo,camera,mode,opacity,points,silhouette]);
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
  async function importParameters(file:File|undefined){
    if(!file)return;
    try{if(file.size>65536)throw new Error('参数文件超过 64 KB');const next=parseStudyState(JSON.parse(await file.text()));if(!alive.current)return;setStudy(next);setLocked(true);setNotice('参数已导入并锁定；点击保存可保留到下次打开。');}
    catch(e){if(alive.current)setNotice(`导入失败：${e instanceof Error?e.message:String(e)}`);}
  }
  return <main className="bmw-workspace">
    <div className="bmw-heading"><div><span className="bmw-eyebrow">NO. 002 / CAMERA STUDY</span><h1>BMW <em>G20</em><span>先校准观察，再塑造曲面。</span></h1></div><p>阶段 01 · 官图样车外观研究<br/><strong>骨架实验，不是完整车模</strong></p></div>
    <div className="bmw-layout">
      <aside className="bmw-controls" aria-label="宝马对比控制">
        <section><h2><b>01</b> 参考机位</h2><div className="bmw-photo-options">{PHOTOS.map((p,i)=><button key={p.sourceId} aria-pressed={p.sourceId===sourceId} onClick={()=>{setSourceId(p.sourceId);setNotice('');}}><span>{String(i+1).padStart(2,'0')}</span><div>{p.title}<small>{p.sourceId} · 开发集</small></div><i>↗</i></button>)}</div>
          <label className="bmw-file-label">{loading?'正在校验…':'选择当前机位原图'}<input aria-label="选择 BMW 官方原图" type="file" accept="image/jpeg,image/png" disabled={loading||!ready} onChange={e=>{void openPhoto(e.target.files?.[0]);e.target.value='';}}/></label>
          <p className="bmw-help">请选择 <code>{sourceId}.jpg</code>。按尺寸和哈希核对，不通过开发服务器读取私有目录。</p>
        </section>
        <section><h2><b>02</b> 对比显示</h2><div className="bmw-modes" aria-label="BMW 对比模式">{([{id:'overlay',name:'叠加'},{id:'skeleton',name:'骨架'},{id:'reference',name:'原图'}] as const).map(m=><button key={m.id} aria-pressed={mode===m.id} onClick={()=>setMode(m.id)}>{m.name}</button>)}</div>
          <label className="bmw-range">原图不透明度 <output>{Math.round(opacity*100)}%</output><input aria-label="BMW 原图不透明度" type="range" min="0" max="1" step=".05" value={opacity} disabled={mode!=='overlay'} onChange={e=>setOpacity(Number(e.target.value))}/></label>
          <label className="bmw-check"><input type="checkbox" checked={points} onChange={e=>setPoints(e.target.checked)}/> 显示锚点与残差线</label>
          <label className="bmw-check"><input type="checkbox" checked={silhouette} onChange={e=>setSilhouette(e.target.checked)}/> 显示粗轮廓标注（非三维点）</label>
        </section>
        <section><h2><b>03</b> 相机参数 <span>{changed?'已修改':'基线'}</span></h2>
          <label className="bmw-check bmw-lock"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)}/> 锁定相机</label>
          <div className="bmw-camera-fields">{camera.position.map((v,i)=><label key={i}>位置 {['X','Y','Z'][i]} / m<input aria-label={`相机位置 ${['X','Y','Z'][i]}`} type="number" step=".02" min="-50" max="50" value={Number(v.toFixed(4))} disabled={locked} onChange={e=>{const position=[...camera.position] as PhotoCamera['position'];position[i]=Number(e.target.value);changeCamera({position});}}/></label>)}<label>垂直视场角 / °<input aria-label="相机垂直视场角" type="number" step=".1" min="5" max="120" value={Number(camera.fovY.toFixed(4))} disabled={locked} onChange={e=>changeCamera({fovY:Number(e.target.value)})}/></label></div>
          <p className="bmw-help">旋转沿用当前初值；尺度固定，未进行完整镜头标定。EXIF 只作先验。</p>
          <div className="bmw-action-row"><button onClick={save}>保存参数</button><button onClick={()=>{setStudy(s=>({...s,cameras:s.cameras.map(c=>c.sourceId===sourceId?structuredClone(BASE_CAMERAS.find(c=>c.sourceId===sourceId)!):c)}));setLocked(true);setNotice('已恢复当前机位基线，其他机位未改变。');}}>恢复此机位</button></div>
          <div className="bmw-action-row"><button onClick={()=>downloadJson(study)}>导出 JSON</button><label className="bmw-import">导入 JSON<input aria-label="导入 BMW 相机参数" type="file" accept=".json,application/json" onChange={e=>{void importParameters(e.target.files?.[0]);e.target.value='';}}/></label></div>
        </section>
      </aside>
      <section className="bmw-panel" aria-label="宝马相机与骨架对比">
        <div className="bmw-panel-heading"><div><span className="bmw-eyebrow">{sourceId} / PERSPECTIVE</span><h2>{photo.title}</h2></div><div className="bmw-panel-status">{locked?'相机已锁定':'相机编辑中'}<small>{imageStatus}</small></div></div>
        <div className="bmw-viewport-wrap"><div className="bmw-canvas" ref={host}/>{imageStatus==='未载入原图'&&<div className="bmw-empty-note">{mode==='reference'?'原图尚未载入，当前仅显示已开启的标注':'当前显示共用骨架和已有标注'}<br/><span>选择原图后进行同角度叠加，不会自动读取本机文件</span></div>}{error&&<div className="bmw-error" role="alert">{error}</div>}</div>
        <div className="bmw-legend"><span><i className="bmw-cyan"/>共用三维骨架</span><span><i className="bmw-amber"/>人工二维锚点</span><span><i className="bmw-red"/>重投影残差</span><small>−X 车头 · +Y 向上 · +Z 左侧 · m</small></div>
        <div className="bmw-metrics"><div><span>固定锚点 RMS</span><strong>{rms===null?'—':rms.toFixed(1)}<small>px</small></strong></div><div><span>相对车身 ROI 宽</span><strong>{rms===null?'—':(rms/photo.roi.width*100).toFixed(2)}<small>%</small></strong></div><div><span>画内 / 固定对应点</span><strong>{summary.inFrameCount}<small>/ {summary.requiredCount}</small></strong></div><p>这是<strong>近似骨架的拟合内残差</strong>，不是车身表面精度或独立验证。没有精细模型，不能据此判断还原度。</p></div>
        <div className="bmw-review-status" data-status={summary.status} role="status">{reviewMessage}{sourceId==='P90549635'&&<p>近侧机位只有 4 个对应点；初值焦距位于试验下界，姿态与深度约束较弱，必须重点叠图复核。</p>}</div>
        <details className="bmw-residuals"><summary>逐点残差与标注重复性</summary><table><thead><tr><th>锚点</th><th>状态</th><th>残差 / px</th><th>重复选点差 / px</th></tr></thead><tbody>{residuals.map((p,i)=><tr key={p.id}><td>{i+1}. {p.id}</td><td>{reasonLabels[p.reason]}</td><td>{p.required&&p.errorPx!==null?p.errorPx.toFixed(1):'—'}</td><td>{photo.points[i].repeatDeltaPx.toFixed(1)}</td></tr>)}</tbody></table></details>
        <div className="bmw-notice" role="status">{notice||'研究状态：原厂动力及选装仍未知；当前三个机位共用一套骨架。'}</div>
      </section>
    </div>
    <div className="bmw-boundary"><strong>本阶段的边界</strong><p>轴距与高度是有来源的尺度假设；不是照片样车的精确测量。玻璃角点、轮毂端面位置和粗轮廓仍需复核。4 张留出图未参与本批初始化，也尚未完成独立视觉验收。<br/>原图只存在于当前浏览器内存，不写入 localStorage、不上传、不进入公开构建。</p></div>
  </main>;
}
