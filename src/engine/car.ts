import * as T from 'three';
import {cutApertures} from './aperture';
import {buildFrontAssembly} from './frontAssembly';
import {FRONT_OPENINGS,FRONT_CUT_LIMIT} from '../data/frontShape';
import {A4, AXLES, deckHeight, PAINTS, type StudySettings} from '../data/a4';
import {surface, polygon, curvedPanel, tube, mesh, mapPolyline, reverseFaces, type Point} from './geometry';
import {CABIN_RANGE,SIDE_WINDOW_OUTLINE,roofHeight,roofCrown,roofPoint,cabinSidePoint,warpBodyX} from '../data/bodyShape';
import {windshieldPoint,windshieldBoundary,sideWindowPanels,bPillar,quarterDivider,doorOutline,exteriorSidePoint} from '../data/cabinSurface';
import {BODY_STATIONS,makeBodySection,bodySidePoint,bodyTopPoint,endCapPoint,endCapRadius,endSurfacePoint} from '../data/bodyShell';

/** 所有网格在这里生成。曲面是估算，不是 Audi 原厂 CAD。 */
export function buildCar() {
  const group=new T.Group();group.name='Audi A4 · 程序化外观研究';
  const physical=(color:string,metalness:number,roughness:number)=>new T.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:1,clearcoatRoughness:.15,side:T.DoubleSide});
  const paint=physical('#aaaead',.68,.29);
  const glass=physical('#172421',.37,.105);
  const lens=new T.MeshPhysicalMaterial({color:'#d7e3e5',metalness:.05,roughness:.10,clearcoat:1,transparent:true,opacity:.15,depthWrite:false,side:T.DoubleSide});
  const optic=physical('#647b83',.30,.12);
  const chrome=physical('#c5c9c6',.96,.20);
  const rim=physical('#aeb3b2',.9,.27);
  const darkMetal=physical('#252b2b',.72,.35);
  const black=new T.MeshStandardMaterial({color:'#141918',roughness:.78,side:T.DoubleSide});
  const rubber=new T.MeshStandardMaterial({color:'#202321',roughness:.94,side:T.DoubleSide});
  const seam=new T.MeshStandardMaterial({color:'#343a38',roughness:.8});
  const light=new T.MeshStandardMaterial({color:'#e7f2ed',emissive:'#dfefed',emissiveIntensity:1.8});
  const tail=new T.MeshStandardMaterial({color:'#9b1720',emissive:'#f61626',emissiveIntensity:.7});
  const brake=new T.MeshStandardMaterial({color:'#535956',metalness:.82,roughness:.62});
  const clay=new T.MeshStandardMaterial({color:'#828c83',roughness:.86,side:T.DoubleSide});
  const clayDark=new T.MeshStandardMaterial({color:'#3a463d',roughness:.88,side:T.DoubleSide});
  const wire=new T.MeshBasicMaterial({color:'#536b55',wireframe:true,transparent:true,opacity:.26});
  const originals=new Map<T.Mesh,T.Material|T.Material[]>();
  const add=(g:T.BufferGeometry,m:T.Material,name:string,parent:T.Group=group)=>{const o=mesh(g,m,name);parent.add(o);originals.set(o,m);return o;};
  const path=(pts:Point[],r:number,m:T.Material,name:string,closed=false,smooth=true,parent:T.Group=group)=>{const o=add(tube(pts,r,closed,smooth),m,name,parent);o.castShadow=false;o.receiveShadow=false;return o;};
  const box=(size:Point,pos:Point,m:T.Material,name:string,parent:T.Group=group)=>{const o=add(new T.BoxGeometry(...size),m,name,parent);o.position.set(...pos);return o;};

  // 连续横截面 + 外围圆角带；只裁去轮拱下方，不压缩轮拱上方的肩线。
  const warpedX=warpBodyX;
  const sections=new Map<number,ReturnType<typeof makeBodySection>>();
  const shell=(u:number,v:number):Point=>{
    const f=u*(BODY_STATIONS.length-1),i=Math.min(Math.floor(f),BODY_STATIONS.length-2),x=T.MathUtils.lerp(BODY_STATIONS[i],BODY_STATIONS[i+1],f-i);
    let s=sections.get(x);if(!s){s=makeBodySection(x);sections.set(x,s);}return s(v);
  };
  const trimFront=(g:T.BufferGeometry)=>{const result=cutApertures(g,FRONT_OPENINGS,FRONT_CUT_LIMIT);g.dispose();return result;};
  add(trimFront(surface(shell,BODY_STATIONS.length-1,100,{analyticNormals:true,flip:true})),paint,'车身连续曲面');sections.clear();
  for(const end of [-1,1] as const){const cap=surface((u,v)=>{
    // 前 100 段与车身的 100 个横截面分段逐点相同，余下 20 段闭合底边。
    const perimeter=u<=5/6?u/(5/6)*.84:.84+(u-5/6)*.96;
    return endCapPoint(end,perimeter,endCapRadius(end,v));
  },120,32,{analyticNormals:true,flip:end===1});add(end===-1?trimFront(cap):cap,paint,end===-1?'前端封口':'后端封口');}
  box([3.8,.08,1.24],[0,.19,0],black,'底部简化遮挡');

  const cabinX=(u:number)=>T.MathUtils.lerp(...CABIN_RANGE,u);
  add(surface((u,v)=>roofPoint(cabinX(u),2*v-1),140,40,{analyticNormals:true,flip:true}),paint,'车顶与前后柱曲面');
  for(const side of [-1,1]) {
    const sidePanel=(poly:[number,number][],offset:number)=>{
      const g=curvedPanel(poly,(x,y)=>cabinSidePoint(x,y,side,offset),{analyticNormals:true});
      return g.getAttribute('normal').getZ(0)*side<0?reverseFaces(g):g;
    };
    add(surface((u,v)=>{
      const x=cabinX(u),top=roofHeight(x)-roofCrown(x),base=deckHeight(x)-.035;
      return cabinSidePoint(x,T.MathUtils.lerp(base,top,v),side);
    },140,16,{analyticNormals:true,flip:side===-1}),paint,`座舱侧框${side}`);
    const windows=sideWindowPanels();
    windows.forEach((poly,i)=>{
      const p:Point[]=poly.map(([x,y])=>cabinSidePoint(x,y,side,.004));
      add(sidePanel(poly,.003),glass,`侧窗-${side}-${i}`);
      path(p,.0025,black,`侧窗密封-${side}-${i}`,true,false);
    });
    const outline:Point[]=SIDE_WINDOW_OUTLINE.map(([x,y])=>cabinSidePoint(x,y,side,.008));
    path(outline,.003,chrome,`窗框亮条${side}`,true,false);
    // B 柱为独立深色部件，不以整块贴图替代窗面。
    add(sidePanel(bPillar(),.005),black,`B柱${side}`);
    add(sidePanel(quarterDivider(),.004),black,`后三角窗分隔${side}`);
  }
  for(const [name,end] of [['前挡风玻璃',-1],['后挡风玻璃',1]] as const) {
    add(surface((u,v)=>windshieldPoint(end,u,v),56,36,{analyticNormals:true,flip:true}),glass,name);
    path(windshieldBoundary(end),.003,black,`${name}密封`,true,false);
  }
  // 细节全部为网格/曲线生成。天线简化，未实现可见内部结构。
  const antenna=add(new T.SphereGeometry(1,16,10),paint,'简化车顶天线');antenna.position.set(1.105,roofHeight(1.105)+.005,0);antenna.scale.set(.074,.027,.021);

  const sidePoint=bodySidePoint;
  for(const side of [-1,1]) {
    // 门缝、下裙与肩线。深度跟随估算的侧面宽度。
    for(const index of [0,1] as const){
      path(mapPolyline(doorOutline(index),(x,y)=>exteriorSidePoint(x,y,side,.0015),false,.022),.0018,seam,`门缝${side}-${index}`,false,false);
    }
    path(mapPolyline([[-.98,.216],[.30,.205],[.948,.223]],(x,y)=>sidePoint(x,y,side,.006)),.010,paint,`侧裙${side}`,false,false);
    for(const x of [.10,1.015]) {
      const handle=add(new T.CapsuleGeometry(.013,.114,4,10),chrome,`门把手${side}-${x}`);handle.rotation.z=Math.PI/2;handle.position.set(...sidePoint(x,.916,side,.009));
    }
    path([[-.78,1.019,side*.790],[-.70,1.002,side*.900],[-.63,1.013,side*.963]],.013,black,`后视镜支架${side}`);
    const mirror=add(new T.SphereGeometry(1,28,14),paint,`后视镜${side}`);mirror.position.set(-.63,1.027,side*.916);mirror.scale.set(.115,.043,.095);
    const mirrorGlass=add(new T.SphereGeometry(1,24,12),chrome,`镜片${side}`);mirrorGlass.position.set(-.531,1.024,side*.916);mirrorGlass.scale.set(.006,.030,.078);
    path([[-.71,1.024,side*.983],[-.63,1.021,side*1.008],[-.565,1.024,side*.994]],.0035,light,`后视镜转向灯${side}`);
    // 轮拱收边，贴合实际开口而非画一个黑色圆遮挡实体车身。
    for(const axle of [AXLES.front,AXLES.rear]) {
      const pts:Point[]=[];
      for(let i=0;i<=64;i++) {const a=i/64*Math.PI,x=axle+Math.cos(a)*A4.archRadius;pts.push(sidePoint(x,A4.wheelRadius+Math.sin(a)*A4.archRadius,side,.002));}
      path(pts,.004,paint,`轮拱边缘${side}-${axle}`,false,false);
    }
  }
  // 机盖压线与后备厢边界。
  for(const side of [-1,1]) {
    const hood:Point[]=[],trunk:Point[]=[];
    for(let i=0;i<=24;i++) {
      const t=i/24;
      hood.push(bodyTopPoint(-2.30+1.35*t,side*(.42+.43*t)));
      trunk.push(bodyTopPoint(1.87+.43*t,side*(.80-.15*t)));
    }
    path(hood,.0016,seam,`机盖压线${side}`,false,false);
    path(trunk,.0015,seam,`后备厢侧缝${side}`,false,false);
  }

  const frontAssembly=buildFrontAssembly(add,{paint,chrome,darkMetal,black,light,lens,optic});
  // 四环只是程序化几何标识，本站不是品牌官方作品。
  for(let i=0;i<4;i++) {
    const ring=add(new T.TorusGeometry(.034,.0038,8,40),chrome,`前四环${i}`);ring.rotation.y=Math.PI/2;ring.position.set(-2.375,.605,(i-1.5)*.057);
    const rz=(i-1.5)*.042;const rr=add(new T.TorusGeometry(.025,.0030,8,32),chrome,`后四环${i}`);rr.rotation.y=Math.PI/2;rr.position.set(warpedX(A4.length/2,rz,.897)+.010,.897,rz);
  }
  for(const side of [-1,1]) {
    // 后灯采用分层网格，灯带与灯罩独立。
    const rp=(z:number,y:number,off=0):Point=>[endSurfacePoint(1,z,y)[0]+.004+off,y,side*z];
    const rear2D:[number,number][]=[[.397,.86],[.835,.899],[.863,.797],[.594,.764],[.434,.786]];
    add(curvedPanel(rear2D,(z,y)=>rp(z,y,.007),{maxEdge:.03,analyticNormals:true}),new T.MeshPhysicalMaterial({color:'#51121a',roughness:.21,metalness:.3,clearcoat:1,side:T.DoubleSide}),`后灯罩${side}`);
    path(mapPolyline([[.446,.824],[.590,.804],[.850,.830],[.861,.874]],(z,y)=>rp(z,y,.017)),.009,tail,`后灯带${side}`,false,false);
    for(let j=0;j<6;j++){const z=.55+j*.045;path([rp(z,.825,.012),rp(z+.008,.860,.012)],.005,tail,`后灯分段${side}-${j}`);}
    const exhaust:[number,number][]=[[.518,.337],[.780,.337],[.759,.278],[.548,.278]];
    add(curvedPanel(exhaust,(z,y)=>rp(z,y,.013)),black,`排气口简化${side}`);
    path(mapPolyline(exhaust,(z,y)=>rp(z,y,.014),true),.0065,chrome,`排气饰框${side}`,true,false);
  }
  const rearPoint=(z:number,y:number,offset=.009):Point=>[endSurfacePoint(1,z,y)[0]+offset,y,z];
  add(curvedPanel([[-.82,.415],[.82,.415],[.80,.265],[-.80,.265]],(z,y)=>rearPoint(z,y,.009),{maxEdge:.025,analyticNormals:true}),darkMetal,'后下包围');
  const bumperLine=Array.from({length:41},(_,i)=>rearPoint(-.85+i*.0425,.478,.010));
  path(bumperLine,.002,seam,'后保险杠接缝',false,false);
  for(const side of [-1,1])path(mapPolyline([[side*.59,.864],[side*.565,.744],[side*.52,.634],[side*.30,.625],[0,.625]],(z,y)=>rearPoint(z,y,.010)),.002,seam,`后备厢开口${side}`,false,false);
  box([.017,.091,.420],[-2.3725,.468,0],new T.MeshStandardMaterial({color:'#dedfd7',roughness:.65}),'前号牌底板');
  box([.018,.106,.420],[2.372,.552,0],new T.MeshStandardMaterial({color:'#dedfd7',roughness:.65}),'后号牌底板');

  const frontWheels:T.Group[]=[];
  for(const [front,axle,track] of [[true,AXLES.front,A4.frontTrack],[false,AXLES.rear,A4.rearTrack]] as const) for(const side of [-1,1]) {
    const wg=new T.Group();wg.name=`${front?'前':'后'}轮${side}`;wg.position.set(axle,A4.wheelRadius,side*track/2);group.add(wg);if(front)frontWheels.push(wg);
    const profile=[ [.216,-.110],[.248,-.121],[.307,-.117],[.326,-.094],[.333,-.070],[.333,.070],[.326,.094],[.307,.117],[.248,.121],[.216,.110] ].map(([r,z])=>new T.Vector2(r,z));
    const tire=add(new T.LatheGeometry(profile,64),rubber,'胎面',wg);tire.rotation.x=Math.PI/2;
    const barrel=add(new T.CylinderGeometry(.231,.231,.204,56,1,true),darkMetal,'轮辋内桶',wg);barrel.rotation.x=Math.PI/2;
    const z=side*.121;
    const hoop=add(new T.TorusGeometry(.230,.008,8,64),rim,'轮辋边缘',wg);hoop.position.z=z;
    for(const r of [.275,.301]) {const ring=add(new T.TorusGeometry(r,.0018,4,64),rubber,'胎侧细线',wg);ring.position.z=side*.12;}
    const disc=add(new T.CylinderGeometry(.176,.176,.018,48),brake,'制动盘',wg);disc.rotation.x=Math.PI/2;disc.position.z=side*.067;
    const caliper=box([.048,.137,.044],[.115,.034,side*.080],darkMetal,'卡钳',wg);caliper.rotation.z=-.22;
    for(let i=0;i<5;i++) {
      const angle=i*Math.PI*2/5+.19;
      for(const split of [-1,1]) {
        const polar=(r:number,a:number):Point=>[Math.sin(a)*r,Math.cos(a)*r,z];
        const p=[polar(.052,angle-.15),polar(.106,angle+split*.12-.07),polar(.224,angle+split*.20-.032),polar(.224,angle+split*.20+.032),polar(.11,angle+split*.12+.07),polar(.052,angle+.15)];
        add(polygon(p),rim,`双辐轮辐${i}-${split}`,wg);
        path([polar(.057,angle),polar(.12,angle+split*.12),polar(.223,angle+split*.20)],.003,chrome,'轮辐高光边',false,true,wg);
      }
      const bolt=add(new T.CylinderGeometry(.008,.008,.009,8),darkMetal,'轮毂螺栓',wg);bolt.rotation.x=Math.PI/2;bolt.position.set(Math.sin(angle)*.038,Math.cos(angle)*.038,z+side*.006);
    }
    const hub=add(new T.CylinderGeometry(.052,.052,.025,40),rim,'轮毂中心',wg);hub.rotation.x=Math.PI/2;hub.position.z=z;
    for(let i=0;i<4;i++){const r=add(new T.TorusGeometry(.009,.0014,5,16),chrome,'轮毂四环',wg);r.position.set((i-1.5)*.014,0,z+side*.017);}
    // 胎面用细窄几何环线表现，不烘焙含有固定光照的照片。
    for(const dz of [-.046,0,.046]) {const tread=add(new T.TorusGeometry(.3317,.0012,4,64),black,'胎面沟槽',wg);tread.position.z=dz;}
  }

  function update(s:StudySettings) {
    const p=PAINTS.find(p=>p.id===s.paint)??PAINTS[0];paint.color.set(p.color);
    originals.forEach((original,o)=>{
      if(s.mode==='wire')o.material=wire;
      else if(s.mode==='clay')o.material=original===glass||original===rubber||original===black?clayDark:clay;
      else o.material=original;
    });
    frontAssembly.covers.forEach(o=>o.visible=s.mode!=='clay');
    light.emissiveIntensity=s.lights?1.8:0;light.color.set(s.lights?'#e7f2ed':'#a5b0ad');tail.emissiveIntensity=s.lights?.9:0;
    frontWheels.forEach(w=>w.rotation.y=T.MathUtils.degToRad(s.steering));
  }
  function dispose(){
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>([paint,glass,chrome,rim,darkMetal,black,rubber,seam,light,tail,brake,clay,clayDark,wire]);
    group.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});
    originals.forEach(m=>{for(const mat of Array.isArray(m)?m:[m])materials.add(mat);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());originals.clear();
  }
  return {group,update,dispose};
}
