/**
 * S79 CSV/TSV 解析共享层（前后端同用，禁引fs/服务端模块）：
 * - 分隔符自动识别（Excel复制粘贴=TSV；另存CSV=逗号）
 * - GBK/UTF-8 编码嗅探（中文Excel默认ANSI=GBK，file.text()会乱码）
 * - 列名别名归一（与导入路由同源，消除「前端严格匹配/后端支持别名」的不一致）
 * - 日期归一（2026-10-18 / 2026-10-18 12:00:00 / 2026年10月18日 → MM-DD；相对时间原样放行）
 */

/** 列名别名表（规范名 ← 常见导出写法） */
export const COL_ALIASES: Record<string, string[]> = {
  标题: ['视频标题', '作品标题'],
  发布时间: ['发布日期', '日期'],
  播放: ['播放量', '观看量', '观看'],
  点赞: ['点赞量', '获赞', '获赞数'],
  评论: ['评论数', '评论量'],
  转发: ['转发数', '分享', '分享数'],
  昵称: ['用户昵称', '用户', '评论用户', '客户昵称'],
  内容: ['评论内容', '正文'],
  视频标题: ['所属视频', '作品标题'],
  时间: ['评论时间'],
  提醒: ['下次提醒', '下次提醒时间'],
  金额: ['成交金额'],
  状态: ['跟进状态'],
  联系方式: ['电话', '微信', '微信号'],
};

/** 各导入类型的必需规范列（前端预检与后端校验共用同一张表） */
export const REQUIRED_COLS: Record<'videos' | 'comments' | 'leads', string[]> = {
  videos: ['标题'],
  comments: ['昵称', '内容', '视频标题'],
  leads: ['昵称'], // S118 存量客户名单导入
};

/** 编码嗅探解码：严格UTF-8失败→GBK（中文Excel ANSI导出）；去BOM。供客户端 file.arrayBuffer() 后调用 */
export function decodeTextBuffer(buf: ArrayBuffer): string {
  let td: TextDecoder;
  try {
    td = new TextDecoder('utf-8', { fatal: true });
    return stripBom(td.decode(buf));
  } catch {
    td = new TextDecoder('gbk');
    return stripBom(td.decode(new Uint8Array(buf)));
  }
}
const stripBom = (s: string) => s.replace(/^\uFEFF/, '');

/** 分隔符识别：按表头行制表符/逗号数量定夺（制表符多→TSV，即Excel复制粘贴产物） */
export function detectDelim(text: string): ',' | '\t' {
  const head = text.split(/\r?\n/, 1)[0] ?? '';
  const tabs = (head.match(/\t/g) || []).length;
  const commas = (head.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

/** CSV解析：支持引号转义/逗号换行/BOM/TSV（不传则自动识别），返回二维数组 */
export function parseCsv(text: string, delim?: ',' | '\t'): string[][] {
  const d = delim ?? detectDelim(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** 表头→规范列索引映射（别名指向同一列） */
export function colMap(header: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  header.forEach((h, i) => { const k = h.trim(); if (k !== '') m[k] = i; });
  for (const [canon, aliasList] of Object.entries(COL_ALIASES)) {
    if (m[canon] !== undefined) continue;
    const hit = aliasList.find((a) => m[a] !== undefined);
    if (hit !== undefined) m[canon] = m[hit];
  }
  return m;
}

/** 缺失的必需规范列（空数组=可导入）；kind决定校验哪套列 */
export function missingCols(kind: 'videos' | 'comments' | 'leads', headerRow: string[]): string[] {
  const m = colMap(headerRow);
  return REQUIRED_COLS[kind].filter((c) => m[c] === undefined);
}

/** 缺列报错文案：带别名提示+用户实际表头（客户一眼知道怎么改） */
export function missingColError(kindName: string, missing: string[], actualHeader: string[]): string {
  const aliasHint = missing.map((c) => `「${c}」支持：${[c, ...(COL_ALIASES[c] || [])].join('/')}`).join('；');
  return `${kindName}缺少必需列 ${missing.map((c) => `「${c}」`).join('')}。${aliasHint}。你文件的表头是：${actualHeader.map((h) => h.trim()).join(',') || '(空)'}`;
}

/** 日期归一：绝对日期（Excel常见形态）→ MM-DD；相对时间（刚刚/2小时前/昨天）原样；识别不了原样放行 */
export function normalizeDateTime(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/^(刚刚|昨天|前天|\d+\s*(分钟|小时|天|周|个月|年)前|\d+岁?)$/.test(t)) return t;
  // 2026-10-18 / 2026/10/18 / 2026.10.18 / 2026年10月18日，可带时间后缀
  const m = t.match(/^(?:20\d{2})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/);
  if (m) {
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    if (+mm <= 12 && +dd <= 31) return `${mm}-${dd}`;
  }
  // 已是 MM-DD / MM/DD
  const m2 = t.match(/^(\d{1,2})\s*[-/月.]\s*(\d{1,2})日?/);
  if (m2 && +m2[1] <= 12 && +m2[2] <= 31) return `${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  return t;
}
