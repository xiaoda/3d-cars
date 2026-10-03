import {describe, expect, it} from 'vitest';
import {parseConstraint, parsePatch} from './types';
const fact = () => ({id:'wheelbase',value:2.851,unit:'m',kind:'official',refs:[{sourceId:'BMW2024_SPECS',page:11}]});
describe('证据与控制网契约', () => {
  it('接受带来源的官方值和显式未知值', () => {
    expect(parseConstraint(fact()).value).toBe(2.851);
    expect(parseConstraint({...fact(),value:null,kind:'unknown',refs:[]}).value).toBeNull();
  });
  it.each([NaN,Infinity,-Infinity,null])('拒绝非有限官方值 %s', value => expect(()=>parseConstraint({...fact(),value})).toThrow());
  it.each([{refs:[]},{refs:[{sourceId:''}]},{refs:[{sourceId:'spec',page:0}]}])('拒绝缺少有效官方出处 %j', ({refs}) => expect(()=>parseConstraint({...fact(),refs})).toThrow());
  it('拒绝未知单位和无效置信类型',()=>{
    expect(()=>parseConstraint({...fact(),unit:'mm'})).toThrow();
    expect(()=>parseConstraint({...fact(),kind:'guess'})).toThrow();
    expect(()=>parseConstraint({...fact(),tolerance:-1})).toThrow();
    expect(()=>parseConstraint({...fact(),kind:'unknown'})).toThrow();
  });
  it('控制网要求 16 个有限三维点，返回深拷贝',()=>{
    const points=Array.from({length:16},(_,i)=>[i%4,0,Math.floor(i/4)]);
    const patch=parsePatch({id:'test',points});
    expect(patch.points).toHaveLength(16);expect(patch.points).not.toBe(points);
    expect(()=>parsePatch({id:'test',points:points.slice(1)})).toThrow();
    expect(()=>parsePatch({id:'test',points:[...points.slice(1),[1,NaN,2]]})).toThrow();
    expect(()=>parsePatch({id:'test',points:[...points.slice(1),[1,2]]})).toThrow();
  });
  it.each([null,[],{},'bad'])('拒绝无效输入 %j',value=>{
    expect(()=>parseConstraint(value)).toThrow();expect(()=>parsePatch(value)).toThrow();
  });
});
