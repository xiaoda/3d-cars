import {useEffect,useRef,useState} from 'react';
import {createStudio,type Studio,type StudioStats} from './engine/studio';
import {A4,DEFAULT_SETTINGS,PAINTS,SOURCE_URL,MODEL_VERSION,MODEL_FILE_TAG,sanitizeSettings,type StudySettings,type CameraView} from './data/a4';
import CalibrationWorkspace from './components/CalibrationWorkspace';

declare global {interface Window {__A4_STUDY__?:Studio;}}
function Icon({name,size=18}:{name:string;size?:number}) {
  const paths:Record<string,React.ReactNode>={
    arrow:<><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    download:<><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>,
    cube:<><path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10"/></>,
    reset:<><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
    cross:<path d="m6 6 12 12M6 18 18 6"/>,
    book:<><path d="M4 3h7l1 2 1-2h7v17h-7l-1 1-1-1H4Zm8 2v16"/></>,
    orbit:<><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="2"/></>,
    chevron:<path d="m9 5 7 7-7 7"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.cube}</svg>;
}
const views:{id:CameraView;name:string;code:string}[]=[{id:'hero',name:'前侧视角',code:'01'},{id:'side',name:'正侧',code:'02'},{id:'front',name:'正前',code:'03'},{id:'rear',name:'正后',code:'04'},{id:'top',name:'俯视',code:'05'}];
function loadSettings(){try{return sanitizeSettings(JSON.parse(localStorage.getItem('a4-study-settings-v1')??'null'));}catch{return {...DEFAULT_SETTINGS};}}
export default function App(){
  const [workspace,setWorkspace]=useState<'studio'|'calibration'>(()=>location.hash==='#calibration'?'calibration':'studio');
  const host=useRef<HTMLDivElement>(null),studio=useRef<Studio|null>(null),dialog=useRef<HTMLDialogElement>(null);
  const [settings,setSettings]=useState<StudySettings>(loadSettings),[view,setView]=useState<CameraView>('hero');
  const [stats,setStats]=useState<StudioStats|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState('');
  const currentSettings=useRef(settings);currentSettings.current=settings;
  useEffect(()=>{
    if(workspace!=='studio')return;
    setStats(null);setError('');setView('hero');
    let instance:Studio;
    try{instance=createStudio(host.current!,setStats,setError);instance.update(currentSettings.current);studio.current=instance;window.__A4_STUDY__=instance;}
    catch(e){setError(`三维场景初始化失败：${e instanceof Error?e.message:String(e)}`);return;}
    return()=>{instance.dispose();studio.current=null;delete window.__A4_STUDY__;};
  },[workspace]);
  useEffect(()=>{studio.current?.update(settings);try{localStorage.setItem('a4-study-settings-v1',JSON.stringify(settings));}catch{/* 本地存储不可用时仍可使用 */}},[settings]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t);},[notice]);
  const change=(partial:Partial<StudySettings>)=>setSettings(s=>sanitizeSettings({...s,...partial}));
  const chooseView=(id:CameraView)=>{setView(id);change({rotate:false});studio.current?.setView(id);};
  async function download(type:'png'|'glb'){
    if(!studio.current||busy)return;setBusy(type);
    try{const blob=type==='png'?await studio.current.exportFrame():await studio.current.exportModel();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`audi-a4-study-${MODEL_FILE_TAG}.${type}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setNotice(type==='png'?'已导出 1920 × 1080 PNG 画面':'已导出标准材质 GLB 模型（保留当前颜色和转向）');}
    catch(e){setNotice(`导出失败：${e instanceof Error?e.message:String(e)}`);}finally{setBusy('');}
  }
  const selectedPaint=PAINTS.find(p=>p.id===settings.paint)??PAINTS[0];
  return <div className="app-shell">
    <header className="header">
      <a className="brand" href="#" aria-label="A4 形态研究室首页"><span className="brand-symbol"><i/><i/><i/></span><span>形态研究室<span className="brand-en">FORM / LAB</span></span></a>
      <nav className="workspace-switch" aria-label="研究工作区">{([{id:'studio',name:'摄影棚'},{id:'calibration',name:'外形校准'}] as const).map(w=><button key={w.id} className={workspace===w.id?'active':''} aria-pressed={workspace===w.id} onClick={()=>{setWorkspace(w.id);history.replaceState(null,'',w.id==='calibration'?'#calibration':'#studio');}}>{w.name}{w.id==='calibration'&&<small>V0.2</small>}</button>)}</nav>
      <div className="header-actions"><button className="text-button" aria-label="官方依据" onClick={()=>dialog.current?.showModal()}><Icon name="book"/> 官方依据</button>{workspace==='studio'&&<><button className="export-model" disabled={!stats||!!busy} onClick={()=>download('glb')}><Icon name="cube"/> {busy==='glb'?'导出中…':'导出车模'}</button><button className="primary-button" disabled={!stats||!!busy} onClick={()=>download('png')}><Icon name="download"/> {busy==='png'?'正在出图…':'保存画面'}</button></>}</div>
    </header>
    {workspace==='calibration'?<CalibrationWorkspace/>:<main className="workspace">
      <aside className="sidebar">
        <div className="specimen-id"><span>汽车形态研究</span><span>NO. 001</span></div>
        <div className="specimen-heading"><h1>Audi <em>A4</em><span>从二维资料，到三维形态。</span></h1><p>B9 中期改款 · 欧洲标准轴距三厢</p></div>
        <div className="prototype-badge"><span/>形体精修原型 <b>V {MODEL_VERSION}</b></div>
        <section className="control-section">
          <div className="section-title"><h2>表面研究</h2><span>01 / SURFACE</span></div>
          <div className="segmented" aria-label="渲染模式">{[{id:'paint',label:'材质'},{id:'clay',label:'白模'},{id:'wire',label:'线框'}].map(m=><button key={m.id} className={settings.mode===m.id?'active':''} aria-pressed={settings.mode===m.id} onClick={()=>change({mode:m.id as StudySettings['mode']})}>{m.label}</button>)}</div>
          <div className={`paint-picker ${settings.mode!=='paint'?'muted':''}`}><div className="field-label"><span>车身颜色</span><span>{selectedPaint.name}</span></div><div className="swatches">{PAINTS.map(p=><button key={p.id} style={{'--swatch':p.chip} as React.CSSProperties} className={settings.paint===p.id?'selected':''} aria-label={p.name} aria-pressed={settings.paint===p.id} disabled={settings.mode!=='paint'} onClick={()=>change({paint:p.id})}><span/></button>)}</div></div>
        </section>
        <section className="control-section vehicle-controls">
          <div className="section-title"><h2>车辆状态</h2><span>02 / STATE</span></div>
          <label className="toggle-row"><span>日行灯与尾灯</span><input type="checkbox" checked={settings.lights} onChange={e=>change({lights:e.target.checked})}/><i aria-hidden="true"/></label>
          <div className="steering-control"><label className="field-label" htmlFor="steering"><span>前轮转向</span><output>{settings.steering>0?'+':''}{settings.steering}°</output></label><input id="steering" type="range" min="-25" max="25" step="1" value={settings.steering} onChange={e=>change({steering:Number(e.target.value)})}/><div className="range-marks"><span>−25°</span><span>0°</span><span>+25°</span></div></div>
        </section>
        <section className="control-section dimension-section">
          <div className="section-title"><h2>尺寸基准</h2><span className="verified"><span/>官方数据</span></div>
          <dl className="dimensions-grid">{[['车长',A4.length],['车宽',A4.width],['车高',A4.height],['轴距',A4.wheelbase]].map(([name,n])=><div key={name}><dt>{name}</dt><dd>{Math.round(Number(n)*1000).toLocaleString('en-US')}<small>mm</small></dd></div>)}</dl>
          <label className="toggle-row ruler-toggle"><span>显示长度与轴距标尺</span><input type="checkbox" checked={settings.dimensions} onChange={e=>change({dimensions:e.target.checked})}/><i aria-hidden="true"/></label>
        </section>
        <div className="sidebar-note"><span className="note-number">i</span><p>尺寸来自官方 04/19 图纸。<br/>曲面、灯组与材质为视觉估算，<br/>不是原厂 CAD 或最终精细车模。</p></div>
        <button className="reset-button" onClick={()=>{setSettings({...DEFAULT_SETTINGS});chooseView('hero');}}><Icon name="reset" size={15}/>重置本次研究</button>
      </aside>
      <section className="stage" aria-label="三维摄影棚">
        <div className="viewport" ref={host}/>
        <div className="stage-top"><div className="stage-label"><span className="stage-index">01</span><div><strong>形态观察 / 摄影棚</strong><small>{view==='hero'?'透视相机 · 自由构图':'正交相机 · 比例检查'}</small></div></div><span className="stage-version">A4 / FORM STUDY — 2019</span></div>
        <div className="stage-caption" aria-hidden="true"><span>重建，而非复用。</span><small>所有车辆几何均由代码生成</small></div>
        <div className="stage-tools"><button className={settings.rotate?'orbit-button active':'orbit-button'} aria-pressed={settings.rotate} onClick={()=>{if(view!=='hero'){chooseView('hero');}change({rotate:!settings.rotate});}}><Icon name="orbit"/>{settings.rotate?'停止环绕':'自动环绕'}</button></div>
        {error&&<div className="stage-error" role="alert"><Icon name="cube" size={30}/><h2>暂时无法显示三维场景</h2><p>{error}</p><button className="primary-button" onClick={()=>window.location.reload()}>重新加载</button></div>}
        {!stats&&!error&&<div className="loading-state"><span className="loading-ring"/><p>正在构建曲面与摄影棚…</p></div>}
        <div className="camera-dock"><span className="dock-label">观察机位</span><div className="camera-options">{views.map(v=><button key={v.id} className={view===v.id?'active':''} aria-pressed={view===v.id} onClick={()=>chooseView(v.id)}><span>{v.code}</span>{v.name}{view===v.id&&<i/>}</button>)}</div><div className="dock-hint">{view === 'hero' ? '拖动旋转' : '右键平移'} <span>·</span> 滚轮缩放</div></div>
        <div className="stage-footer"><span><i className="status-dot"/>{stats?'场景就绪':'正在初始化'}<b>WEBGL 2</b></span><span title={stats?.gpu}>{stats?`${(stats.triangles/1000).toFixed(1)}k 三角面`:'—'} <i>/</i> {stats?.software?'软件渲染环境':'本地渲染'}</span></div>
      </section>
    </main>}
    <footer className="footer"><span>公开信息 → 参数约束 → 程序化曲面 → 视觉校验</span><span>外观研究原型 <i>·</i> 非 Audi 官方作品 <span className="footer-mark">A4 — 001</span></span></footer>
    <dialog ref={dialog} className="reference-dialog"><div className="dialog-header"><div><span className="eyebrow">REFERENCE / 01</span><h2>每一条尺寸，都有出处。</h2></div><button className="close-button" aria-label="关闭官方依据" onClick={()=>dialog.current?.close()}><Icon name="cross"/></button></div><div className="reference-content"><div className="reference-sheet"><img src="/references/audi-a4-dimensions.png" alt="Audi A4 官方 04/19 前后侧俯四视尺寸图"/></div><div className="reference-copy"><h3>官方尺寸图</h3><p>2019 年 4 月 · 空载尺寸 · 单位 mm</p><a href="/references/audi-a4-dimensions.pdf" target="_blank" rel="noreferrer">打开本地原始 PDF <Icon name="arrow" size={15}/></a><a href={SOURCE_URL} target="_blank" rel="noreferrer">访问 Audi 官方来源 <Icon name="arrow" size={15}/></a><hr/><h3>事实与估算，分开记录。</h3><dl><dt><span className="confidence fact"/>官方明确</dt><dd>长宽高、轴距、轮距、前后悬及含镜宽度。高度不含天线增加量。</dd><dt><span className="confidence estimate"/>图像估算</dt><dd>曲面截面、灯组轮廓、车窗曲率、轮胎与轮毂细节。</dd><dt><span className="confidence simplified"/>暂时简化</dt><dd>内饰、底盘、灯腔、门机构与车漆微观结构。没有毫米级表面精度保证。</dd></dl><div className="reference-warning">本轮不使用现成三维车模，不提取官网配置器模型，也不以 AI 图片作为建模依据。</div></div></div><div className="dialog-footer">素材仅作本地研究参考；公开发布与商业使用需另行核对相关条款。</div></dialog>
    {notice&&<div className="toast" role="status">{notice}</div>}
  </div>;
}
