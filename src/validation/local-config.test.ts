import {expect,it} from 'vitest';
import config from '../../vite.config';

it('本地 MCP 配置和私有参考不由开发服务器公开，且只监听回环地址',()=>{
  expect(config.server?.host).toBe('127.0.0.1');
  expect(config.server?.fs?.deny).toContain('**/.codex/**');
  expect(config.server?.fs?.deny).toContain('**/references-private/**');
  expect(config.server?.fs?.deny).toContain('**/.runtime/**');
});
