import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateEvidence} from './validateEvidence';

function fixture() {
  const source = {
    id: 'PHOTO-1', kind: 'photo', url: 'https://mediapool.bmwgroup.com/example',
    role: 'fit', appliesTo: ['reference-car'], publicResource: false,
    publicationPermission: 'not-verified', permissionEvidence: null,
    storage: {mode: 'local-private', path: 'references-private/bmw-g20/photos/test.jpg', sha256: 'a'.repeat(64), bytes: 10},
    pixels: {width: 100, height: 100}, review: {imageReviewed: true},
  };
  return {
    manifest: {schemaVersion: 1, sources: [source, {
      ...structuredClone(source), id: 'SPEC-1', kind: 'document', role: 'auxiliary',
      appliesTo: ['specification-car'],
    }]},
    config: {
      schemaVersion: 1, id: 'reference-car', status: 'partial',
      contexts: ['reference-car', 'specification-car'],
      gate: {state: 'needs-review', allowModeling: false, blockerIds: ['U01']},
      fitSourceIds: ['PHOTO-1'], holdoutSourceIds: [] as string[],
      assertions: [{id: 'paint', value: 'blue' as string | null, status: 'observed', sourceIds: ['PHOTO-1']}],
      dimensions: [{id: 'wheelbase', value: 2851, unit: 'mm', appliesTo: 'specification-car', sourceId: 'SPEC-1', page: 11, transferToReference: 'pending'}],
    },
  };
}

describe('宝马证据清单检查', () => {
  it('允许诚实记录的未完成资料审计，不把未知当错误数据', () => {
    const {manifest, config} = fixture();
    expect(validateEvidence(manifest, config)).toEqual([]);
  });
  it.each([null, [], 'bad', {schemaVersion: 2}])('拒绝无效根结构 %j', input => {
    expect(validateEvidence(input, null).length).toBeGreaterThan(0);
  });
  const invalidCases: [string, (data: ReturnType<typeof fixture>) => void][] = [
    ['重复来源 ID', d => d.manifest.sources.push(structuredClone(d.manifest.sources[0]))],
    ['未知单位', d => { d.config.dimensions[0].unit = 'pixels'; }],
    ['非有限尺寸', d => { d.config.dimensions[0].value = NaN; }],
    ['负尺寸', d => { d.config.dimensions[0].value = -1; }],
    ['无配置适用范围', d => { d.config.dimensions[0].appliesTo = ''; }],
    ['尺寸套用到非来源配置', d => { d.config.dimensions[0].appliesTo = 'reference-car'; }],
    ['规格页码缺失', d => { d.config.dimensions[0].page = 0; }],
    ['不存在的来源', d => { d.config.dimensions[0].sourceId = 'missing'; }],
    ['未核定尺寸被确认到照片车', d => { d.config.dimensions[0].transferToReference = 'confirmed'; }],
    ['未获授权图片公开', d => { d.manifest.sources[0].publicResource = true; }],
    ['授权缺少证据', d => { d.manifest.sources[0].publicResource = true; d.manifest.sources[0].publicationPermission = 'granted'; }],
    ['非官方来源 URL', d => { d.manifest.sources[0].url = 'https://example.org/file'; }],
    ['非 HTTPS URL', d => { d.manifest.sources[0].url = 'http://mediapool.bmwgroup.com/file'; }],
    ['URL 内嵌凭据', d => { d.manifest.sources[0].url = 'https://name:secret@mediapool.bmwgroup.com/file'; }],
    ['路径越界', d => { d.manifest.sources[0].storage.path = 'references-private/bmw-g20/../../public/x.jpg'; }],
    ['编码路径越界', d => { d.manifest.sources[0].storage.path = 'references-private/bmw-g20/%2e%2e/x.jpg'; }],
    ['丢失校验和', d => { d.manifest.sources[0].storage.sha256 = ''; }],
    ['无效图片尺寸', d => { d.manifest.sources[0].pixels.width = 0; }],
    ['拟合与留出重复', d => { d.config.holdoutSourceIds.push('PHOTO-1'); }],
    ['重复拟合 ID', d => { d.config.fitSourceIds.push('PHOTO-1'); }],
    ['拟合集角色不符', d => { d.manifest.sources[0].role = 'auxiliary'; }],
    ['未目视图充当主证据', d => { d.manifest.sources[0].review.imageReviewed = false; }],
    ['效果草图充当照片', d => { d.manifest.sources[0].kind = 'design-sketch'; }],
    ['未知配置标作确认', d => { d.config.assertions[0].value = null; d.config.assertions[0].status = 'verified'; }],
    ['事实无来源', d => { d.config.assertions[0].sourceIds = []; }],
    ['资料未锁定却放行建模', d => { d.config.gate.allowModeling = true; d.config.gate.state = 'passed'; }],
  ];
  it.each(invalidCases)('拒绝：%s', (_name, change) => {
    const data = fixture();
    change(data);
    expect(validateEvidence(data.manifest, data.config).length).toBeGreaterThan(0);
  });
});

describe('实际宝马资料清单', () => {
  const root = new URL('../../../../', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('docs/research/bmw-g20/sources.json', root), 'utf8'));
  const config = JSON.parse(readFileSync(new URL('docs/research/bmw-g20/config-lock.json', root), 'utf8'));
  it('元数据满足证据规则，不靠下载原图才能运行常规测试', () => {
    expect(validateEvidence(manifest, config)).toEqual([]);
  });
  it.skipIf(!existsSync(new URL('references-private/bmw-g20/', root)))('本地已归档文件的长度和 SHA-256 与清单一致', () => {
    // 先验证全部路径；不能对未校验的 JSON 路径直接读文件。
    expect(validateEvidence(manifest, config)).toEqual([]);
    for (const source of manifest.sources) {
      if (source.storage.mode !== 'local-private') continue;
      const bytes = readFileSync(fileURLToPath(new URL(source.storage.path, root)));
      expect(bytes.byteLength, source.id).toBe(source.storage.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), source.id).toBe(source.storage.sha256);
    }
  });
});
