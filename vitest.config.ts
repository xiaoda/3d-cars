import {defineConfig} from 'vitest/config';

// 只发现正式源码的测试，避免把本地快照 / 备份当作当前实现再跑一遍。
export default defineConfig({test:{include:['src/**/*.test.ts']}});
