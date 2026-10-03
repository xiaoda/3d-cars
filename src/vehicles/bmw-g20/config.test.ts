import {describe,expect,it} from 'vitest';
import {BMW_STUDY,parseSkeleton} from './config';
describe('BMW 共用米制骨架',()=>{
  it('各照片共享同一骨架，轴距固定且不是已证实装车尺寸',()=>{
    const p=BMW_STUDY.points;
    expect(p['hub-rear-left'][0]-p['hub-front-left'][0]).toBeCloseTo(2.851,8);
    expect(BMW_STUDY.constraints.every(x=>x.kind!=='official')).toBe(true);
    expect(p['hub-front-left'][2]).toBe(-p['hub-front-right'][2]);
    expect(p['nose-left'][0]).toBeLessThan(p['tail-left'][0]);
  });
  it('拒绝 NaN、非法边及没有出处的尺度假设',()=>{
    expect(()=>parseSkeleton({...BMW_STUDY,points:{bad:[0,NaN,0]}})).toThrow();
    expect(()=>parseSkeleton({...BMW_STUDY,lines:[['missing','nose-left']]})).toThrow();
    expect(()=>parseSkeleton({...BMW_STUDY,constraints:[{id:'x',value:1,kind:'official',unit:'m',refs:[]}]})).toThrow();
  });
});
