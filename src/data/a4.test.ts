import { describe, expect, it } from 'vitest';
import { A4, AXLES, archBottom, halfWidth, sanitizeSettings, DEFAULT_SETTINGS } from './a4';

describe('奥迪 A4 官方尺寸约束', () => {
  it('前悬、轴距、后悬闭合为车长', () => {
    expect(A4.frontOverhang + A4.wheelbase + A4.rearOverhang).toBeCloseTo(A4.length, 8);
  });
  it('前后轴间距正确', () => {
    expect(AXLES.rear - AXLES.front).toBeCloseTo(2.82, 8);
    expect(AXLES.front).toBeCloseTo(-1.482, 8);
    expect(AXLES.rear).toBeCloseTo(1.338, 8);
  });
  it('轮拱确实为车轮留出空间', () => {
    expect(archBottom(AXLES.front)).toBeGreaterThan(A4.wheelRadius * 2);
    expect(archBottom(0)).toBeLessThan(0.25);
  });
  it('车宽和曲线不会越界或生成非数值', () => {
    for(let x=-A4.length/2; x<=A4.length/2; x+=0.02) {
      expect(Number.isFinite(halfWidth(x))).toBe(true);
      expect(halfWidth(x)).toBeLessThanOrEqual(A4.width/2 + 1e-6);
      expect(halfWidth(x)).toBeGreaterThan(0.6);
    }
  });
});

describe('本地设置校验',()=>{
  it('空值和未知字段不会污染初始状态',()=>{
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({mode:'invalid',paint:'missing',lights:'yes'})).toEqual(DEFAULT_SETTINGS);
  });
  it('无效角度回到零，合法数值被限制在范围内',()=>{
    expect(sanitizeSettings({steering:NaN}).steering).toBe(0);
    expect(sanitizeSettings({steering:Infinity}).steering).toBe(0);
    expect(sanitizeSettings({steering:70}).steering).toBe(25);
    expect(sanitizeSettings({steering:-70}).steering).toBe(-25);
  });
});
