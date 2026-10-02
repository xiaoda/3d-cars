import {describe,it,expect} from 'vitest';
import {CALIBRATION_VIEWS,pixelToPlane,planeToPixel,planeToWorld,fitFrame,sanitizeCalibration,DEFAULT_CALIBRATION} from './calibration';
import {A4,AXLES} from './a4';

describe('官方图纸的等比标定',()=>{
  it('侧视以前后轴的 2820 mm 为唯一等比尺度',()=>{
    expect(pixelToPlane('side',[306.843,969.96])[0]).toBeCloseTo(AXLES.front,6);
    expect(pixelToPlane('side',[878.834,969.96])[0]).toBeCloseTo(AXLES.rear,6);
    expect(pixelToPlane('side',[306.843,969.96])[1]).toBe(0);
  });
  it('正前用车宽、正后用含镜宽度作为基准，不各自拉伸 X/Y',()=>{
    expect(pixelToPlane('front',[492.068,572.77])[0]-pixelToPlane('front',[118.553,572.77])[0]).toBeCloseTo(A4.width,6);
    expect(pixelToPlane('rear',[1102.170,573.94])[0]-pixelToPlane('rear',[693.191,573.94])[0]).toBeCloseTo(A4.mirrorWidth,6);
    for(const v of CALIBRATION_VIEWS){
      const a=pixelToPlane(v.id,[200,300]),x=pixelToPlane(v.id,[300,300]),y=pixelToPlane(v.id,[200,400]);
      expect(x[0]-a[0]).toBeCloseTo(a[1]-y[1],8);
    }
  });
  it('俯视按车长约束，且映射可逆',()=>{
    expect(pixelToPlane('top',[1090.432,1274.6])[0]-pixelToPlane('top',[124.346,1274.6])[0]).toBeCloseTo(A4.length,6);
    for(const v of CALIBRATION_VIEWS){const p:[number,number]=[321.4,732.8];const q=planeToPixel(v.id,pixelToPlane(v.id,p));expect(q[0]).toBeCloseTo(p[0],8);expect(q[1]).toBeCloseTo(p[1],8);}
  });
  it('前后方向不镜像，俯视向上是世界 -Z',()=>{
    expect(planeToWorld('side',[1,2])).toEqual([1,2,0]);
    expect(planeToWorld('front',[1,2])).toEqual([0,2,1]);
    expect(planeToWorld('rear',[1,2])).toEqual([0,2,-1]);
    expect(planeToWorld('top',[1,2])).toEqual([1,0,-2]);
  });
  it('窄屏/宽屏均完整包含参考窗口，保持等比',()=>{
    for(const v of CALIBRATION_VIEWS)for(const [w,h] of [[390,500],[1440,650],[1920,1080]]){
      const f=fitFrame(v.id,w,h);expect(f.pixelsPerMetre).toBeGreaterThan(0);
      expect(f.imageRect.x).toBeGreaterThanOrEqual(0);expect(f.imageRect.y).toBeGreaterThanOrEqual(0);
      expect(f.imageRect.x+f.imageRect.width).toBeLessThanOrEqual(w+.001);
      expect(f.imageRect.y+f.imageRect.height).toBeLessThanOrEqual(h+.001);
      expect(f.imageRect.width/f.imageRect.height).toBeCloseTo(v.crop[2]/v.crop[3],6);
    }
  });
  it('拒绝坏设置，不允许非法透明度或无效视角',()=>{
    expect(sanitizeCalibration(null)).toEqual(DEFAULT_CALIBRATION);
    expect(sanitizeCalibration({view:'hero',mode:'bad',opacity:NaN})).toEqual(DEFAULT_CALIBRATION);
    expect(sanitizeCalibration({opacity:2}).opacity).toBe(1);
    expect(sanitizeCalibration({opacity:-1}).opacity).toBe(0);
  });
  it('主尺度下保留图纸轮距残差，不篡改官方数值来强行贴合',()=>{
    const front=pixelToPlane('front',[462.521,0])[0]-pixelToPlane('front',[148.543,0])[0];
    const rear=pixelToPlane('rear',[1054.967,0])[0]-pixelToPlane('rear',[745.818,0])[0];
    expect((front-A4.frontTrack)*1000).toBeCloseTo(-19.4,0);
    expect((rear-A4.rearTrack)*1000).toBeCloseTo(-26.6,0);
    expect(A4.frontTrack).toBe(1.572);expect(A4.rearTrack).toBe(1.555);
  });
  it('同一像素的图纸屏幕位置与世界投影位置一致',()=>{
    for(const v of CALIBRATION_VIEWS){
      const f=fitFrame(v.id,1200,600),p:[number,number]=[v.crop[0]+36,v.crop[1]+72];
      const world=pixelToPlane(v.id,p);
      const projected=[600+(world[0]-f.center[0])*f.pixelsPerMetre,300-(world[1]-f.center[1])*f.pixelsPerMetre];
      const drawn=[f.imageRect.x+36*f.imageRect.width/v.crop[2],f.imageRect.y+72*f.imageRect.height/v.crop[3]];
      expect(projected[0]).toBeCloseTo(drawn[0],8);expect(projected[1]).toBeCloseTo(drawn[1],8);
    }
  });
});
