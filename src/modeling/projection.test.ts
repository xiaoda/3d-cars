import {describe,expect,it} from 'vitest';
import {parseCamera,projectPoint,pixelToNormalized,normalizedToPixel,type PhotoCamera} from './projection';
const camera=():PhotoCamera=>({sourceId:'synthetic',position:[0,0,5],quaternion:[0,0,0,1],fovY:90,imageWidth:800,imageHeight:400,crop:{x:0,y:0,width:800,height:400},near:.1,far:100});
describe('透视投影与标注坐标',()=>{
  it('已知相机投影中心、左右及垂直方向；不镜像',()=>{
    expect(projectPoint([0,0,0],camera()).pixel).toEqual([400,200]);
    const [x,y]=projectPoint([1,1,0],camera()).pixel;
    expect(x).toBeCloseTo(440,8);expect(y).toBeCloseTo(160,8);
    expect(projectPoint([-1,0,0],camera()).pixel[0]).toBeCloseTo(360,8);
  });
  it('图像比例改变时不做非均匀拉伸',()=>{
    const c={...camera(),imageWidth:400,crop:{x:0,y:0,width:400,height:400}};
    const p=projectPoint([1,1,0],c).pixel;
    expect(p[0]).toBeCloseTo(240,8);expect(p[1]).toBeCloseTo(160,8);
  });
  it('裁剪只平移原像素，不改变局部比例',()=>{
    const c={...camera(),crop:{x:100,y:50,width:600,height:300}};
    const p=projectPoint([1,1,0],c).pixel;
    expect(p[0]).toBeCloseTo(340,8);expect(p[1]).toBeCloseTo(110,8);
  });
  it('相机背面、裁剪外、标注遮挡及不确定点不能计入可信残差',()=>{
    expect(projectPoint([0,0,6],camera()).usable).toBe(false);
    expect(projectPoint([100,0,0],camera()).inFrame).toBe(false);
    expect(projectPoint([0,0,0],camera(),'occluded').usable).toBe(false);
    expect(projectPoint([0,0,0],camera(),'uncertain').usable).toBe(false);
    expect(projectPoint([0,0,0],camera()).usable).toBe(true);
  });
  it('原像素与归一化坐标往返',()=>{
    expect(pixelToNormalized([100,50],800,400)).toEqual([.125,.125]);
    expect(normalizedToPixel([.125,.125],800,400)).toEqual([100,50]);
    expect(()=>pixelToNormalized([1,2],0,400)).toThrow();
    expect(()=>normalizedToPixel([NaN,0],800,400)).toThrow();
  });
  it('运行时拒绝非法相机及退化四元数',()=>{
    for(const c of [null,{}, {...camera(),fovY:0},{...camera(),imageWidth:0},{...camera(),position:[0,NaN,0]}, {...camera(),quaternion:[0,0,0,0]}, {...camera(),near:100}, {...camera(),crop:{x:-1,y:0,width:800,height:400}}]) expect(()=>parseCamera(c)).toThrow();
    expect(()=>projectPoint([NaN,0,0],camera())).toThrow();
  });
});
