import * as T from 'three';
import {FRONT_GRILLE,FRONT_LAMP,FRONT_INTAKE,FRONT_DEPTH,frontPoint,insetOutline,mirrorOutline,horizontalSpan} from '../data/frontShape';
import {surface,curvedPanel,mapPolyline,tube,reverseFaces,type Point} from './geometry';
import type {Outline} from './aperture';

type Add=(g:T.BufferGeometry,m:T.Material,name:string)=>T.Mesh;
interface Materials {paint:T.Material;chrome:T.Material;darkMetal:T.Material;black:T.Material;light:T.Material;lens:T.Material;optic:T.Material;}

/** 与车身裁切共用二维轮廓；所有前脸装饰都位于真实开口或其包边内。 */
export function buildFrontAssembly(add:Add,m:Materials){
  const covers:T.Mesh[]=[];
  const panel=(poly:Outline,depth:number,material:T.Material,name:string)=>{
    const g=curvedPanel(poly.map(p=>[...p]),(z,y)=>frontPoint(z,y,depth),{maxEdge:.025,analyticNormals:true});
    if(g.getAttribute('normal').getX(0)>0)reverseFaces(g);return add(g,material,name);
  };
  const band=(poly:Outline,a:number,b:number,da:number,db:number,material:T.Material,name:string)=>{
    const outside=insetOutline(poly,a),inside=insetOutline(poly,b);
    const g=surface((u,v)=>{
      const f=u*poly.length,i=Math.min(Math.floor(f),poly.length-1),t=f-i,j=(i+1)%poly.length;
      const p=outside[i].map((n,k)=>T.MathUtils.lerp(n,outside[j][k],t)),q=inside[i].map((n,k)=>T.MathUtils.lerp(n,inside[j][k],t));
      return frontPoint(T.MathUtils.lerp(p[0],q[0],v),T.MathUtils.lerp(p[1],q[1],v),T.MathUtils.lerp(da,db,v));
    },poly.length*12,3);
    if(g.getAttribute('normal').getX(0)>0)reverseFaces(g);return add(g,material,name);
  };
  const cavity=(poly:Outline,depth:number,name:string,backName:string,edge:T.Material)=>{
    band(poly,1.006,.958,-.001,.009,edge,`${name}倒角框`);
    band(poly,.958,.89,.009,depth,m.black,`${name}内壁`);
    panel(insetOutline(poly,.89),depth,m.black,backName);
  };
  const path=(points:Point[],radius:number,material:T.Material,name:string)=>{
    const o=add(tube(points,radius,false,false),material,name);o.castShadow=false;return o;
  };
  // 闭合薄盒而非圆管；前后厚度、上下表面及两端都存在。
  const blade=(z0:number,z1:number,y:number,height:number,depth:number,thickness:number,material:T.Material,name:string)=>{
    const g=new T.BoxGeometry(thickness,height,z1-z0,1,1,20),p=g.getAttribute('position');
    for(let i=0;i<p.count;i++)p.setXYZ(i,...frontPoint((z0+z1)/2+p.getZ(i),y+p.getY(i),depth+p.getX(i)));
    g.computeVertexNormals();return add(g,material,name);
  };
  cavity(FRONT_GRILLE,FRONT_DEPTH.grille,'格栅','Singleframe 格栅',m.chrome);
  const grilleInner=insetOutline(FRONT_GRILLE,.925);
  for(let i=0;i<6;i++){
    const y=.350+i*.059,[a,b]=horizontalSpan(grilleInner,y);
    blade(a,b,y,.014,.025,.022,m.darkMetal,`格栅横条${i}`);
    blade(a,b,y+.002,.003,.012,.003,m.chrome,`格栅横条亮边${i}`);
  }
  for(let i=-4;i<=4;i++){
    const z=i*.078;
    const g=new T.BoxGeometry(.013,.304,.004,1,16,1),p=g.getAttribute('position');
    for(let j=0;j<p.count;j++)p.setXYZ(j,...frontPoint(z+p.getZ(j),.50+p.getY(j),.042+p.getX(j)));
    g.computeVertexNormals();add(g,m.darkMetal,`格栅纵撑${i}`);
  }
  // 号牌有实体安装支架，四环与号牌的原尺寸/位置保持不动。
  blade(-.216,.216,.468,.101,.051,.09,m.black,'前号牌安装座');
  for(const side of [-1,1]){
    const lamp=mirrorOutline(FRONT_LAMP,side),intake=mirrorOutline(FRONT_INTAKE,side);
    cavity(lamp,FRONT_DEPTH.lamp,`前灯腔${side}`,`前灯腔背板${side}`,m.darkMetal);
    const cover=panel(insetOutline(lamp,.992),.002,m.lens,`前灯罩${side}`);cover.castShadow=false;cover.receiveShadow=false;covers.push(cover);
    // 选装 LED 风格的上长光导 + 五个短分段；不是额外的下沿发光框。
    path(mapPolyline([[.435,.679],[.61,.712],[.783,.742],[.791,.695]],(z,y)=>frontPoint(side*z,y,.018),false,.025),.004,m.light,`日行灯上沿${side}`);
    for(let j=0;j<5;j++){
      const z=.49+j*.055,y=.690+(z-.49)*.195;
      path([frontPoint(side*z,y,.020),frontPoint(side*(z+.010),y-.018,.020)],.004,m.light,`灯内分段${side}-${j}`);
    }
    for(const [i,z,y] of [[0,.613,.655],[1,.741,.674]]){
      // 双投射器反射杯沿腔深收束，透明外罩后能看到实体镜头。
      add(surface((u,v)=>{
        const a=u*Math.PI*2,rx=T.MathUtils.lerp(.037,.020,v),ry=T.MathUtils.lerp(.026,.018,v),power=T.MathUtils.lerp(.48,1,v);
        const corner=(n:number)=>Math.sign(n)*Math.abs(n)**power;
        return frontPoint(side*(z+corner(Math.cos(a))*rx),y+corner(Math.sin(a))*ry,.031+.031*v);
      },32,6,{flip:side===-1}),m.chrome,`灯内反射杯${side}-${i}`);
      const lens=add(new T.SphereGeometry(1,24,12),m.optic,`灯内透镜${side}-${i}`);
      lens.position.set(...frontPoint(side*z,y,.043));lens.scale.set(.012,.018,.021);
    }
    cavity(intake,FRONT_DEPTH.intake,`进气口${side}`,`前侧进气口${side}`,m.paint);
    // 图纸中的内侧斜叶片与外侧圆形单元仅作结构近似，不称作已核验的选装配置。
    for(let i=0;i<4;i++){
      const z=.587+i*.018;
      path(mapPolyline([[z,.336],[z+.031,.420]],(z,y)=>frontPoint(side*z,y,.032)),.005,m.darkMetal,`进气口斜叶片${side}-${i}`);
    }
    const fog=add(new T.SphereGeometry(1,24,12),m.optic,`前侧圆形灯单元${side}`);fog.position.set(...frontPoint(side*.756,.361,.052));fog.scale.set(.012,.025,.025);
    const bezel=add(new T.TorusGeometry(.029,.0035,6,32),m.darkMetal,`圆形灯座${side}`);bezel.rotation.y=Math.PI/2;bezel.position.set(...frontPoint(side*.756,.361,.046));
    path(mapPolyline([[side*.52,.263],[side*.85,.250]],(z,y)=>frontPoint(z,y,-.010)),.005,m.chrome,`前唇亮条${side}`);
  }
  return {covers};
}
