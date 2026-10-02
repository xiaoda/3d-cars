import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import viteConfig from '../../../../vite.config';

describe('宝马参考资料的本地存储边界', () => {
  it('原图目录必须被 Git 忽略', () => {
    const ignore = readFileSync(fileURLToPath(new URL('../../../../.gitignore', import.meta.url)), 'utf8');
    expect(ignore.split(/\r?\n/)).toContain('references-private/');
  });
  it('开发服务器拒绝提供原图目录，且保留已有拒绝项', () => {
    expect(viteConfig.server?.host).toBe('127.0.0.1');
    expect(viteConfig.server?.fs?.deny).toEqual(expect.arrayContaining([
      '.env', '.env.*', '**/.git/**', '**/.runtime/**', '**/tmp/**', '**/docs/**',
      '**/references-private/**',
    ]));
  });
});
