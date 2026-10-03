type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonempty);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const integer = (value: unknown): value is number => positive(value) && Number.isInteger(value);
const officialHosts = new Set(['www.press.bmwgroup.com', 'mediapool.bmwgroup.com', 'www.bmw.de']);

function officialUrl(value: unknown): boolean {
  if (!nonempty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && officialHosts.has(url.hostname) && !url.username && !url.password && !url.port;
  } catch { return false; }
}

function privatePath(value: unknown): boolean {
  if (!nonempty(value) || !value.startsWith('references-private/bmw-g20/')) return false;
  // 清单只接受未编码、正斜线相对路径；不解析或读取任意来源路径。
  return !/[\\%:?\x00-\x1f]/.test(value) && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

/** 只检查证据结构、来源边界和关卡一致性；不能证明照片真实或模型像实车。 */
export function validateEvidence(manifest: unknown, config: unknown): string[] {
  const issues: string[] = [];
  if (!isRow(manifest) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.sources)) {
    return ['资料清单结构或版本无效'];
  }
  if (!isRow(config) || config.schemaVersion !== 1 || !nonempty(config.id) || !strings(config.contexts)
    || !config.contexts.includes(config.id) || !Array.isArray(config.dimensions) || !Array.isArray(config.assertions)
    || !isRow(config.gate) || !strings(config.gate.blockerIds)) return ['配置锁定表结构或版本无效'];
  const contexts = config.contexts;
  const byId = new Map<string, Row>();
  for (const source of manifest.sources) {
    if (!isRow(source) || !nonempty(source.id)) { issues.push('来源缺少 ID'); continue; }
    const fail = (reason: string) => issues.push(`${source.id}: ${reason}`);
    if (byId.has(source.id)) fail('来源 ID 重复');
    byId.set(source.id, source);
    if (!['photo', 'document', 'web', 'drawing', 'design-sketch'].includes(String(source.kind))) fail('来源类型无效');
    if (!['fit', 'holdout', 'auxiliary', 'excluded'].includes(String(source.role))) fail('用途无效');
    if (!officialUrl(source.url)) fail('要求无凭据的官方 HTTPS 来源');
    if (!strings(source.appliesTo) || !source.appliesTo.length || source.appliesTo.some(id => !contexts.includes(id))) fail('配置范围无效');
    if (typeof source.publicResource !== 'boolean' || !['not-verified', 'granted'].includes(String(source.publicationPermission))) fail('发布权限状态无效');
    if (source.publicationPermission === 'granted' && !nonempty(source.permissionEvidence)) fail('授权没有证据');
    if (source.publicResource === true && source.publicationPermission !== 'granted') fail('未核实授权的资料不可公开');
    const storage = source.storage;
    if (!isRow(storage)) fail('缺少存储记录');
    else if (storage.mode === 'local-private') {
      if (!privatePath(storage.path)) fail('本地路径越界或格式无效');
      if (!nonempty(storage.sha256) || !/^[a-f0-9]{64}$/.test(storage.sha256)) fail('SHA-256 无效');
      if (!integer(storage.bytes)) fail('文件长度无效');
    } else if (storage.mode === 'remote-only') {
      if (storage.path !== null || storage.sha256 !== null || storage.bytes !== null) fail('未下载来源不可伪造本地元数据');
    } else fail('未知存储模式');
    if (source.kind === 'photo' && (!isRow(source.pixels) || !integer(source.pixels.width) || !integer(source.pixels.height))) fail('照片尺寸无效');
    if (source.role === 'fit' || source.role === 'holdout') {
      if (source.kind !== 'photo' || !isRow(source.review) || source.review.imageReviewed !== true) fail('拟合和留出集只接受已经目视的照片');
      if (!isRow(storage) || storage.mode !== 'local-private') fail('主证据必须有可复核的本地原图');
    }
  }
  const fit = strings(config.fitSourceIds) ? config.fitSourceIds : [];
  const holdout = strings(config.holdoutSourceIds) ? config.holdoutSourceIds : [];
  if (!strings(config.fitSourceIds) || !strings(config.holdoutSourceIds)) issues.push('数据集列表无效');
  if (new Set([...fit, ...holdout]).size !== fit.length + holdout.length) issues.push('拟合/留出集 ID 重复或交叉');
  for (const [role, ids] of [['fit', fit], ['holdout', holdout]] as const) {
    for (const id of ids) if (byId.get(id)?.role !== role) issues.push(`${id}: 数据集角色不一致或来源不存在`);
    for (const [id, source] of byId) if (source.role === role && !ids.includes(id)) issues.push(`${id}: 来源未登记到对应数据集`);
  }
  const uniqueIds = (rows: unknown[], label: string) => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!isRow(row) || !nonempty(row.id) || seen.has(row.id)) issues.push(`${label}: ID 缺失或重复`);
      else seen.add(row.id);
    }
  };
  uniqueIds(config.dimensions, '尺寸');
  uniqueIds(config.assertions, '配置事实');
  for (const dimension of config.dimensions) {
    if (!isRow(dimension)) { issues.push('尺寸条目无效'); continue; }
    const source = nonempty(dimension.sourceId) ? byId.get(dimension.sourceId) : undefined;
    if (!positive(dimension.value) || !['mm', 'm', 'in'].includes(String(dimension.unit))) issues.push(`${dimension.id}: 尺寸或单位无效`);
    if (!nonempty(dimension.appliesTo) || !contexts.includes(dimension.appliesTo) || !source
      || !strings(source.appliesTo) || !source.appliesTo.includes(dimension.appliesTo)) issues.push(`${dimension.id}: 尺寸与来源的配置范围不符`);
    if (!source || !['document', 'drawing'].includes(String(source.kind)) || !integer(dimension.page)) issues.push(`${dimension.id}: 缺少可复查的规格来源及页码`);
    if (!['pending', 'confirmed'].includes(String(dimension.transferToReference))
      || (dimension.transferToReference === 'confirmed' && dimension.appliesTo !== config.id)) issues.push(`${dimension.id}: 不可跨配置确认尺寸`);
  }
  for (const assertion of config.assertions) {
    if (!isRow(assertion)) { issues.push('配置事实条目无效'); continue; }
    if (!['verified', 'observed', 'inferred', 'unknown'].includes(String(assertion.status))) issues.push(`${assertion.id}: 置信状态无效`);
    if (!strings(assertion.sourceIds) || assertion.sourceIds.some(id => !byId.has(id))) issues.push(`${assertion.id}: 来源 ID 无效`);
    if (assertion.status !== 'unknown' && (!nonempty(assertion.value) || !strings(assertion.sourceIds) || !assertion.sourceIds.length)) issues.push(`${assertion.id}: 非未知结论必须有值和证据`);
  }
  const gate = config.gate;
  if (!['partial', 'locked'].includes(String(config.status)) || !['needs-review', 'passed'].includes(String(gate.state))
    || typeof gate.allowModeling !== 'boolean') issues.push('关卡状态无效');
  if (gate.allowModeling === true || gate.state === 'passed') {
    if (gate.allowModeling !== true || gate.state !== 'passed' || config.status !== 'locked'
      || !strings(gate.blockerIds) || gate.blockerIds.length || fit.length < 2 || holdout.length < 1) issues.push('资料关未满足，禁止自动放行');
  }
  return issues;
}
