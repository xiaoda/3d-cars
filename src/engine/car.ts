import * as T from 'three';
import {A4, AXLES, archBottom, halfWidth, deckHeight, PAINTS, type StudySettings} from '../data/a4';
import {surface, polygon, curvedPanel, tube, mesh, type Point} from './geometry';

/** 所有网格在这里生成。曲面是估算，不是 Audi 原厂 CAD。 */
export function buildCar() {
  const group=new T.Group();group.name='Audi A4 · 程序化外观研究';
  const physical=(color:string,metalness:number,roughness:number)=>new T.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:1,clearcoatRoughness:.15,side:T.DoubleSide});
  const paint=physical('#aaaead',.68,.29);
  const glass=physical('#172421',.37,.105);
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

  // 跨截面从左轮拱下沿，经车身顶面，到右轮拱下沿。下沿按车轮位置抬升，保留实际轮拱缺口。
  // 长度基准包含前后饰件；基础蒙皮略内收，为格栅、号牌及饰条留出真实几何空间。
  const warpedX=(x:number,z:number)=>x+Math.max(0,(-x-1.90)/.481)*(.024+.205*(z/.93)**2)-Math.max(0,(x-1.85)/.531)*(.012+.112*(z/.93)**2);
  const sectionAt=(x:number,v:number):Point=>{
    const w=halfWidth(x),d=deckHeight(x),bottom=archBottom(x);
    const keys=[[-.946,bottom],[-.967,bottom+(d-.175-bottom)*.43],[-1,d-.175],[-.982,d-.091],[-.88,d-.035],[-.56,d-.007],[0,d],[.56,d-.007],[.88,d-.035],[.982,d-.091],[1,d-.175],[.967,bottom+(d-.175-bottom)*.43],[.946,bottom]];
    const f=v*(keys.length-1),i=Math.min(keys.length-2,Math.floor(f)),t=f-i;
    const z=w*T.MathUtils.lerp(keys[i][0],keys[i+1][0],t);
    const baseY=T.MathUtils.lerp(keys[i][1],keys[i+1][1],t);
    const noseLift=Math.max(0,(-x-1.90)/.481)*.17*(z/w)**2*T.MathUtils.clamp((baseY-bottom)/(d-bottom),0,1);
    return [warpedX(x,z),baseY+noseLift,z];
  };
  add(surface((u,v)=>sectionAt((u-.5)*A4.length,v),220,72),paint,'车身连续曲面');
  for(const end of [-1,1]) {
    const x=end*A4.length/2;
    add(surface((u,v)=>{
      let edge:Point;
      if(u<.84)edge=sectionAt(x,u/.84);
      else {const a=sectionAt(x,1),b=sectionAt(x,0),t=(u-.84)/.16;edge=[x,T.MathUtils.lerp(a[1],b[1],t),T.MathUtils.lerp(a[2],b[2],t)];}
      const z=edge[2]*v;return [warpedX(x,z),.51+(edge[1]-.51)*v,z];
    },96,20),paint,end===-1?'前端封口':'后端封口');
  }
  box([3.8,.08,1.24],[0,.19,0],black,'底部简化遮挡');

  const roofProfile=[[-.96,1.002],[-.86,1.035],[-.63,1.197],[-.34,1.374],[-.14,1.412],[.28,1.428],[.67,1.423],[.90,1.394],[1.13,1.239],[1.48,1.035],[1.63,1.000]];
  const roofH=(x:number)=>{
    for(let i=1;i<roofProfile.length;i++) if(x<=roofProfile[i][0]) {
      const a=roofProfile[i-1],b=roofProfile[i];return T.MathUtils.lerp(a[1],b[1],Math.max(0,(x-a[0])/(b[0]-a[0])));
    }
    return 1;
  };
  const cabinZ=(y:number)=>.793-(y-1)*.53;
  add(surface((u,v)=>{const x=-.96+2.59*u,q=2*v-1,h=roofH(x);return [x,h-.026*q*q,cabinZ(h)*q];},100,32),paint,'车顶与前后柱曲面');
  for(const side of [-1,1]) {
    const pts:Point[]=roofProfile.map(([x,y])=>[x,y-.018,side*cabinZ(y)]);
    pts.push([1.63,.999,side*.793],[-.96,.999,side*.793]);
    add(polygon(pts),paint,`座舱侧框${side}`);
    const windows=[
      [[-.796,1.037],[-.290,1.355],[-.095,1.381],[.335,1.389],[.346,1.037]],
      [[.410,1.037],[.402,1.389],[.743,1.380],[.884,1.355],[1.354,1.046]],
    ];
    windows.forEach((poly,i)=>{
      const p:Point[]=poly.map(([x,y])=>[x,y,side*(cabinZ(y)+.008)]);
      add(polygon(p),glass,`侧窗-${side}-${i}`);
      path(p,.003,black,`侧窗密封-${side}-${i}`,true,false);
    });
    const outline:Point[]=[[-.828,1.023],[-.311,1.368],[-.105,1.399],[.742,1.399],[.902,1.374],[1.404,1.027],[.4,1.019]].map(([x,y])=>[x,y,side*(cabinZ(y)+.011)]);
    path(outline,.0035,chrome,`窗框亮条${side}`,true,false);
    // B 柱为独立深色部件，不以整块贴图替代窗面。
    const bp:Point[]=[[.346,1.032],[.333,1.393],[.399,1.393],[.411,1.032]].map(([x,y])=>[x,y,side*(cabinZ(y)+.012)]);
    add(polygon(bp),black,`B柱${side}`);
  }
  for(const [name,x0,x1] of [['前挡风玻璃',-.852,-.194],['后挡风玻璃',.963,1.466]] as const) {
    add(surface((u,v)=>{const x=T.MathUtils.lerp(x0,x1,u),h=roofH(x),q=(v*2-1)*.943;return [x,h-.026*q*q+.005,cabinZ(h)*q];},28,36),glass,name);
  }
  // 细节全部为网格/曲线生成。天线简化，未实现可见内部结构。
  const antenna=add(new T.SphereGeometry(1,16,10),paint,'简化车顶天线');antenna.position.set(.915,1.397,0);antenna.scale.set(.074,.027,.021);

  for(const side of [-1,1]) {
    // 门缝、下裙与肩线。深度跟随估算的侧面宽度。
    const sideZ=(x:number,y:number)=>side*(halfWidth(x)*(y>.83?.98:y<.35?.963:1.002));
    const doorLines=[
      [[-.90,.97],[-.84,.76],[-.91,.38],[-.87,.23]],
      [[.37,.995],[.39,.81],[.36,.42],[.35,.23]],
      [[1.44,1.00],[1.54,.88],[1.68,.70]],
      [[-.90,.23],[.35,.23],[.97,.25]],
    ];
    doorLines.forEach((line,i)=>path(line.map(([x,y])=>[x,y,sideZ(x,y)]),.0026,seam,`门缝${side}-${i}`));
    path([[-.98,.216,side*.898],[.30,.205,side*.881],[.948,.223,side*.91]],.018,paint,`侧裙${side}`);
    for(const x of [.15,1.015]) {
      const handle=add(new T.CapsuleGeometry(.013,.114,4,10),chrome,`门把手${side}-${x}`);handle.rotation.z=Math.PI/2;handle.position.set(x,.916,side*(halfWidth(x)*.994+.005));
    }
    path([[-.77,1.034,side*.790],[-.79,1.04,side*.899],[-.735,1.044,side*.963]],.013,black,`后视镜支架${side}`);
    const mirror=add(new T.SphereGeometry(1,28,14),paint,`后视镜${side}`);mirror.position.set(-.72,1.066,side*.916);mirror.scale.set(.112,.049,.095);
    const mirrorGlass=add(new T.SphereGeometry(1,24,12),chrome,`镜片${side}`);mirrorGlass.position.set(-.623,1.063,side*.916);mirrorGlass.scale.set(.006,.034,.078);
    path([[-.80,1.063,side*.983],[-.72,1.061,side*1.008],[-.655,1.063,side*.994]],.0035,light,`后视镜转向灯${side}`);
    // 轮拱收边，贴合实际开口而非画一个黑色圆遮挡实体车身。
    for(const axle of [AXLES.front,AXLES.rear]) {
      const pts:Point[]=[];
      for(let i=0;i<=48;i++) {const a=i/48*Math.PI,x=axle+Math.cos(a)*A4.archRadius;pts.push([x,A4.wheelRadius+Math.sin(a)*A4.archRadius,side*halfWidth(x)*.948]);}
      path(pts,.007,paint,`轮拱边缘${side}-${axle}`);
    }
  }
  // 机盖压线与后备厢边界。
  for(const side of [-1,1]) {
    const hood:Point[]=[],trunk:Point[]=[];
    for(let i=0;i<=24;i++) {
      const p=sectionAt(-2.25+1.36*i/24,side===1?.69:.31);p[1]+=.0015;hood.push(p);
      const q=sectionAt(1.59+.69*i/24,side===1?.72:.28);q[1]+=.0015;trunk.push(q);
    }
    path(hood,.0016,seam,`机盖压线${side}`,false,false);
    path(trunk,.0015,seam,`后备厢侧缝${side}`,false,false);
  }

  const frontX=(z:number)=>warpedX(-A4.length/2,z)-.004;
  const fp=(z:number,y:number,offset=0):Point=>[frontX(z)-offset,y,z];
  const grille2D:[number,number][]=[[-.345,.680],[.345,.680],[.490,.574],[.365,.321],[-.365,.321],[-.490,.574]];
  const grille:Point[]=grille2D.map(([z,y])=>fp(z,y,.004));
  add(curvedPanel(grille2D,(z,y)=>fp(z,y,.006)),black,'Singleframe 格栅');
  const grilleBorder:Point[]=[];
  for(let i=0;i<grille2D.length;i++){const a=grille2D[i],b=grille2D[(i+1)%grille2D.length];for(let j=0;j<14;j++)grilleBorder.push(fp(T.MathUtils.lerp(a[0],b[0],j/14),T.MathUtils.lerp(a[1],b[1],j/14),.012));}
  path(grilleBorder,.007,chrome,'六边形格栅边框',true,false);
  for(let i=0;i<6;i++) {
    const y=.35+i*.059,w=y<.57?.369+(y-.35)*.45:.461-(y-.57)*1.2;
    path(Array.from({length:25},(_,j)=>fp(-w+2*w*j/24,y,.014)),.0065,darkMetal,`格栅横条${i}`,false,false);
  }
  for(let i=-4;i<=4;i++) {const z=i*.082;path([fp(z,.337,.014),fp(z,.661,.014)],.0025,darkMetal,`格栅纵条${i}`);}
  // 四环只是程序化几何标识，本站不是品牌官方作品。
  for(let i=0;i<4;i++) {
    const ring=add(new T.TorusGeometry(.034,.0038,8,40),chrome,`前四环${i}`);ring.rotation.y=Math.PI/2;ring.position.set(-2.375,.605,(i-1.5)*.057);
    const rr=add(new T.TorusGeometry(.025,.0030,8,32),chrome,`后四环${i}`);rr.rotation.y=Math.PI/2;rr.position.set(2.374,.897,(i-1.5)*.042);
  }
  for(const side of [-1,1]) {
    const lamp2D:[number,number][]=[[.407,.681],[.800,.759],[.817,.620],[.623,.593],[.463,.617]];
    const lamp:Point[]=lamp2D.map(([z,y])=>fp(side*z,y,.016));
    add(curvedPanel(lamp2D,(z,y)=>fp(side*z,y,.016)),glass,`前灯罩${side}`);path(lamp,.0035,chrome,`前灯罩边框${side}`,true,false);
    path([[.429,.679],[.61,.712],[.786,.744],[.793,.692]].map(([z,y])=>fp(side*z,y,.027)),.0045,light,`日行灯上沿${side}`,false,false);
    path([[.482,.630],[.641,.609],[.799,.636]].map(([z,y])=>fp(side*z,y,.027)),.003,light,`日行灯下沿${side}`,false,false);
    for(let j=0;j<5;j++) {const z=.49+j*.057;path([fp(side*z,.691+(z-.49)*.18,.029),fp(side*(z+.014),.670+(z-.49)*.18,.029)],.005,light,`灯内分段${side}-${j}`,false,false);}
    for(const z of [.626,.738]) {
      const lens:[number,number][]=[[z-.037,.686],[z+.034,.686],[z+.038,.639],[z-.028,.637]];
      add(curvedPanel(lens,(z,y)=>fp(side*z,y,.030)),darkMetal,`灯内透镜${side}-${z}`);
      path(lens.map(([z,y])=>fp(side*z,y,.032)),.0025,chrome,`透镜边缘${side}-${z}`,true,false);
    }
    const intake2D:[number,number][]=[[.570,.477],[.850,.478],[.850,.282],[.505,.300]];
    const intake:Point[]=intake2D.map(([z,y])=>fp(side*z,y,.014));
    add(curvedPanel(intake2D,(z,y)=>fp(side*z,y,.014)),black,`前侧进气口${side}`);path(intake,.005,paint,`进气口包围${side}`,true,false);
    for(let j=0;j<3;j++){const y=.32+j*.058;path([fp(side*.575,y,.027),fp(side*.830,y+.01,.027)],.005,darkMetal,`进气口横条${side}-${j}`);}
    path([fp(side*.52,.263,.009),fp(side*.85,.250,.009)],.007,chrome,`前唇亮条${side}`);
    // 后灯采用分层网格，灯带与灯罩独立。
    const rp=(z:number,y:number,off=0):Point=>[warpedX(A4.length/2,z)+.004+off,y,side*z];
    const rear2D:[number,number][]=[[.397,.86],[.835,.899],[.863,.797],[.594,.764],[.434,.786]];
    add(curvedPanel(rear2D,(z,y)=>rp(z,y,.007)),new T.MeshPhysicalMaterial({color:'#51121a',roughness:.21,metalness:.3,clearcoat:1,side:T.DoubleSide}),`后灯罩${side}`);
    path([[.446,.824],[.590,.804],[.850,.830],[.861,.874]].map(([z,y])=>rp(z,y,.012)),.009,tail,`后灯带${side}`,false,false);
    for(let j=0;j<6;j++){const z=.55+j*.045;path([rp(z,.825,.012),rp(z+.008,.860,.012)],.005,tail,`后灯分段${side}-${j}`);}
    const exhaust:[number,number][]=[[.518,.337],[.780,.337],[.759,.278],[.548,.278]];
    add(curvedPanel(exhaust,(z,y)=>rp(z,y,.013)),black,`排气口简化${side}`);
    path(exhaust.map(([z,y])=>rp(z,y,.019)),.0065,chrome,`排气饰框${side}`,true,false);
  }
  const rearPoint=(z:number,y:number,offset=.009):Point=>[warpedX(A4.length/2,z)+offset,y,z];
  add(curvedPanel([[-.82,.415],[.82,.415],[.80,.222],[-.80,.222]],(z,y)=>rearPoint(z,y,.007)),darkMetal,'后下包围');
  const bumperLine=Array.from({length:41},(_,i)=>rearPoint(-.85+i*.0425,.478,.010));
  path(bumperLine,.002,seam,'后保险杠接缝',false,false);
  for(const side of [-1,1])path([[side*.59,.864],[side*.565,.744],[side*.52,.634],[side*.30,.625],[0,.625]].map(([z,y])=>rearPoint(z,y,.010)),.002,seam,`后备厢开口${side}`,false,false);
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
