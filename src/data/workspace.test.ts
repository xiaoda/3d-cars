import {expect,it} from 'vitest';
import {workspaceFromHash} from './workspace';
it('BMW 入口独立，原摄影棚和校准链接不回退',()=>{
  expect(workspaceFromHash('#bmw')).toBe('bmw');
  expect(workspaceFromHash('#calibration')).toBe('calibration');
  for(const hash of ['','#','#studio','#unknown'])expect(workspaceFromHash(hash)).toBe('studio');
});
