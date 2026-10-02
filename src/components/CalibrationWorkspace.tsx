import {useEffect,useRef,useState} from 'react';
import {createCalibration,type CalibrationEngine} from '../engine/calibration';
import {CALIBRATION_VIEWS,DEFAULT_CALIBRATION,getCalibrationView,sanitizeCalibration,type CalibrationSettings} from '../data/calibration';
import {REFERENCE_PHOTOS,type ReferencePhoto} from '../data/references';
import {SOURCE_URL,MODEL_VERSION,MODEL_FILE_TAG} from '../data/a4';

declare global {interface Window {__A4_CALIBRATION__?:CalibrationEngine;}}
const STORAGE='a4-calibration-settings-v1';
function loadSettings(){try{return sanitizeCalibration(JSON.parse(localStorage.getItem(STORAGE)??'null'));}catch{return {...DEFAULT_CALIBRATION};}}

export default function CalibrationWorkspace(){
  const host=useRef<HTMLDivElement>(null),engine=useRef<CalibrationEngine|null>(null),dialog=useRef<HTMLDialogElement>(null);
  const [settings,setSettings]=useState<CalibrationSettings>(loadSettings),[ready,setReady]=useState(false),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[photo,setPhoto]=useState<ReferencePhoto|null>(null);
  const initialSettings=useRef(settings);
  useEffect(()=>{
    let instance:CalibrationEngine;
    try{instance=createCalibration(host.current!,()=>setReady(true),setError);instance.update(initialSettings.current);engine.current=instance;window.__A4_CALIBRATION__=instance;}
    catch(e){setError(`校准初始化失败：${e instanceof Error?e.message:String(e)}`);return;}
    return()=>{instance.dispose();engine.current=null;delete window.__A4_CALIBRATION__;};
  },[]);
  useEffect(()=>{engine.current?.update(settings);try{localStorage.setItem(STORAGE,JSON.stringify(settings));}catch{/* 存储失败不影响使用 */}},[settings]);
  useEffect(()=>{if(photo)dialog.current?.showModal();},[photo]);
  const change=(partial:Partial<CalibrationSettings>)=>setSettings(s=>sanitizeCalibration({...s,...partial}));
  const view=getCalibrationView(settings.view);
  async function download(){
    if(!engine.current||!ready||busy||error)return;setBusy(true);setNotice('');
    try{const blob=await engine.current.exportFrame(),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`a4-calibration-${settings.view}-${MODEL_FILE_TAG}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setNotice('已导出 1920 × 1080 校准 PNG。');}
    catch(e){setNotice(`导出失败：${e instanceof Error?e.message:String(e)}`);}finally{setBusy(false);}
  }
  return <main className="calibration-workspace">
    <div className="calibration-layout">
      <aside className="calibration-controls">
        <div className="specimen-id"><span>证据与形态</span><span>STUDY / 02</span></div>
        <h1>先对齐，<br/><em>再精修。</em></h1>
        <p className="calibration-intro">A4 四视外形校准<br/>工具 V0.2 / 车模 V{MODEL_VERSION} · 曲面精修</p>
        <section className="calibration-section"><div className="section-title"><h2>正交机位</h2><span>锁定尺度</span></div>
          <div className="calibration-views">{CALIBRATION_VIEWS.map(v=><button key={v.id} onClick={()=>change({view:v.id})} aria-pressed={settings.view===v.id} className={settings.view===v.id?'active':''}><span>{v.code}</span>{v.name}<b>↗</b></button>)}</div>
        </section>
        <section className="calibration-section"><div className="section-title"><h2>对照图层</h2><span>02 / COMPARE</span></div>
          <div className="segmented">{([{id:'overlay',label:'叠加'},{id:'model',label:'模型'},{id:'drawing',label:'图纸'}] as const).map(m=><button key={m.id} className={settings.mode===m.id?'active':''} aria-pressed={settings.mode===m.id} onClick={()=>change({mode:m.id})}>{m.label}</button>)}</div>
          <label className="field-label calibration-opacity" htmlFor="drawing-opacity"><span>图纸不透明度</span><output>{Math.round(settings.opacity*100)}%</output></label>
          <input id="drawing-opacity" type="range" min="0" max="100" step="1" disabled={settings.mode!=='overlay'} value={Math.round(settings.opacity*100)} onChange={e=>change({opacity:Number(e.target.value)/100})}/>
          <label className="toggle-row"><span>显示参考关键点</span><input type="checkbox" checked={settings.points} disabled={settings.mode==='model'} onChange={e=>change({points:e.target.checked})}/><i aria-hidden="true"/></label>
        </section>
        <section className="calibration-basis"><span className="eyebrow">PRIMARY CONSTRAINT</span><strong>{view.basis}</strong><p>{view.note}</p><small>单一等比变换 · 零转向 · 无镜头畸变</small></section>
        <button className="primary-button calibration-export" disabled={!ready||!!error||busy} onClick={download}>{busy?'正在导出…':'导出校准图'}<span>↓</span></button>
        <p className="calibration-status" role="status">{notice||'1920 × 1080 PNG · 含基准与来源标记'}</p>
      </aside>
      <section className="calibration-panel" aria-label="四视等比校准工作台">
        <div className="calibration-panel-top"><div><span className="eyebrow">ORTHOGRAPHIC / {view.code}</span><h2>{view.name} · 形态对照</h2></div><span className="scale-lock">1 : 1 等比关系<small>窗口自适应，非实物显示尺寸</small></span></div>
        <div className="calibration-canvas" ref={host}>
          {error?<div className="stage-error" role="alert"><h2>校准不可用</h2><p>{error}</p></div>:!ready?<div className="loading-state"><span className="loading-ring"/><p>正在载入官方图纸…</p></div>:null}
        </div>
        <div className="calibration-legend"><span><i className="legend-model"/>估算模型</span><span><i className="legend-drawing"/>官方图线</span><span><i className="legend-point"/>人工取点</span><span className="legend-lock">0.5 m 网格 / 相机锁定</span></div>
        <div className="calibration-observations"><span className="eyebrow">READ THE DIFFERENCE</span><p>观察车顶与立柱、机盖高度、轮拱和前后端轮廓。蓝色模型与黑色图线不重合的部分，就是下一轮要检查的区域。</p><p className="calibration-caution">图纸局部线条与尺寸标注并非完全一致；当前没有全车“还原率”，也不把人工读图结果当作毫米级实测。</p></div>
        <details className="landmark-list"><summary>查看当前基准点与坐标</summary><dl>{view.landmarks.map(p=><div key={p.id}><dt>{p.id} · {p.label}</dt><dd>{p.pixel[0].toFixed(1)}, {p.pixel[1].toFixed(1)} px <span>{p.kind==='dimension'?'尺寸辅助线':'人工估算'}</span></dd></div>)}</dl></details>
      </section>
    </div>
    <section className="reference-library" aria-labelledby="reference-library-title">
      <div className="reference-library-heading"><div><span className="eyebrow">SOURCE LIBRARY / 08</span><h2 id="reference-library-title">参考资料，不混用。</h2></div><p>1 份尺寸图 + 7 张官方照片<br/>发布年份不等于车辆生产年款</p></div>
      <div className="reference-scope"><strong>当前资料边界</strong><p>04/19 尺寸图是主基准，但未写明完整动力与外观套件。外观照片发布于 2022 年，只作同代形态辅助；2019 年照片用于内饰布局。尚未核定“2019 同配置完整外观参考集”。</p></div>
      <div className="reference-grid">
        <article className="reference-card reference-card-primary"><a className="reference-image" href="/references/audi-a4-dimensions.pdf" target="_blank" rel="noreferrer"><img src="/references/audi-a4-dimensions.png" alt="Audi A4 04/19 官方四视尺寸图整页" loading="lazy"/><span>主尺寸基准 ↗</span></a><div className="reference-card-body"><span className="reference-code">DIMENSIONS / 04·19</span><h3>官方四视尺寸图</h3><p>长宽高、轴距、前后悬、轮距</p><a href={SOURCE_URL} target="_blank" rel="noreferrer">Audi 原始来源 ↗</a></div></article>
        {REFERENCE_PHOTOS.map(p=><article className="reference-card" key={p.id}><button className="reference-image" onClick={()=>setPhoto(p)} aria-label={`查看 ${p.title}`}><img src={p.src} alt={p.title} loading="lazy"/><span>{p.role} ↗</span></button><div className="reference-card-body"><span className="reference-code">{p.id} / {p.published}</span><h3>{p.title}</h3><p>{p.role} · 非测量正交图</p><a href={p.source} target="_blank" rel="noreferrer">Audi 原始来源 ↗</a></div></article>)}
      </div>
      <p className="reference-rights">照片 © AUDI AG。官方页面注明可免费用于编辑用途；不据此推定三维模型、商业或再分发授权。研究参考使用；网站未对外部署。<a href="/references/manifest.json" target="_blank" rel="noreferrer">查看来源与 SHA-256 清单 ↗</a></p>
    </section>
    <dialog ref={dialog} className="reference-dialog photo-dialog" onClose={()=>setPhoto(null)}>{photo&&<><div className="dialog-header"><div><span className="eyebrow">{photo.id} / 官方照片</span><h2>{photo.title}</h2></div><button className="close-button" aria-label="关闭参考照片" onClick={()=>dialog.current?.close()}>×</button></div><img className="reference-full-photo" src={photo.src} alt={photo.title}/><div className="photo-details"><p>发布：{photo.published} · {photo.role} · © AUDI AG</p><p>{photo.note}</p><a href={photo.source} target="_blank" rel="noreferrer">查看官方素材页面 ↗</a></div></>}</dialog>
  </main>;
}
