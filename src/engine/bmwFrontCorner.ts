import * as T from 'three';
export type SurfaceMode='clay'|'normals'|'stripes';
/** 条纹来自反射方向的解析函数，只是连续性诊断，不是实车光学仿真。 */
export function createSurfaceMaterials(){
  const clay=new T.MeshStandardMaterial({color:0xbec6c2,roughness:.43,metalness:0,side:T.DoubleSide});
  const rimClay=new T.MeshStandardMaterial({color:0x7c8983,roughness:.65,metalness:0,side:T.DoubleSide});
  const normals=new T.MeshNormalMaterial({side:T.DoubleSide});
  const stripes=new T.ShaderMaterial({side:T.DoubleSide,
    vertexShader:`varying vec3 worldPoint; varying vec3 worldNormal;
      void main(){ vec4 p=modelMatrix*vec4(position,1.0); worldPoint=p.xyz; worldNormal=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*p; }`,
    fragmentShader:`varying vec3 worldPoint; varying vec3 worldNormal;
      void main(){ vec3 n=normalize(worldNormal)*(gl_FrontFacing?1.0:-1.0);vec3 r=reflect(normalize(worldPoint-cameraPosition),n);
      float wave=sin(atan(r.x,r.z)*18.0+r.y*7.0);float band=smoothstep(-0.12,0.12,wave);
      vec3 color=mix(vec3(0.055,0.12,0.14),vec3(0.90,0.94,0.88),band);gl_FragColor=vec4(color,1.0); }`});
  const materials={clay,normals,stripes};
  return {apply(group:T.Group,mode:SurfaceMode){group.traverse(o=>{if(o instanceof T.Mesh)o.material=mode==='clay'&&o.name.startsWith('rim-')?rimClay:materials[mode];});},dispose(){Object.values(materials).forEach(m=>m.dispose());rimClay.dispose();}};
}
export function addSurfaceLights(scene:T.Scene){
  scene.add(new T.HemisphereLight(0xdce9f0,0x263a31,.7));
  for(const [position,intensity] of [[[-3,2.5,4],2.4],[[2,1.6,-3],.6]] as const){const light=new T.DirectionalLight(0xffffff,intensity);light.position.set(position[0],position[1],position[2]);scene.add(light);}
}
