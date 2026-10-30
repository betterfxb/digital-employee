/**
 * S122 数据自愈纯函数（零IO，可入 crypto-test 单测）：
 * local.json 损坏时从 data/backups/ 里选一份最新且健全的有效快照恢复。
 * 选份口径：auto/manual 混排按 mtime 新→旧（manual 也是完整快照，无优先理由）；
 * 健全口径：核心集合（accounts/videos/comments/tokens）类型齐全——宁可不恢复（人工介入），
 * 不可拿一份半套数据静默覆盖。解析失败/不健全的份自动跳到下一份。
 */

export interface BackupCandidate { name: string; mtime: string }

/** 合法备份名（与 autoBackup 的轮转命名一致），防目录里混入杂物被当快照 */
const NAME_RE = /^(auto-\d{4}-\d{2}-\d{2}|manual-\d{4}-\d{2}-\d{2}-\d{6})\.json$/;

/** 恢复候选顺序：白名单过滤 + mtime 降序；同 mtime 按名称降序兜底（确定性可测） */
export function recoveryOrder(files: BackupCandidate[]): string[] {
  return files
    .filter((f) => NAME_RE.test(f.name))
    .sort((a, b) => (a.mtime === b.mtime ? (a.name < b.name ? 1 : -1) : a.mtime < b.mtime ? 1 : -1))
    .map((f) => f.name);
}

/** 快照是否健全：四个核心集合类型齐全即可（业务集合缺失只丢增量，不算损坏） */
export function isSaneState(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return Array.isArray(r.accounts) && Array.isArray(r.videos) && Array.isArray(r.comments) && !!r.tokens && typeof r.tokens === 'object';
}

/** S141 备份演练：七个业务集合计数（-1=该键非数组，结构异常） */
export const VERIFIED_KEYS = ['accounts', 'videos', 'comments', 'follows', 'replies', 'campaigns', 'drafts'] as const;

export function countsOf(d: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!d || typeof d !== 'object') return out;
  for (const k of VERIFIED_KEYS) out[k] = Array.isArray((d as Record<string, unknown>)[k]) ? ((d as Record<string, unknown>)[k] as unknown[]).length : -1;
  return out;
}

export interface DiffRow { key: string; now: number; snap: number; lost: number }

/** 丢失=备份比当前多（业务数据无正常删除路径，多出来=流失嫌疑）；备份少=备份后又有新增，属正常漂移 */
export function diffCounts(cur: Record<string, number>, snap: Record<string, number>): DiffRow[] {
  return VERIFIED_KEYS.map((k) => ({ key: k, now: cur[k] ?? -1, snap: snap[k] ?? -1, lost: Math.max(0, (snap[k] ?? 0) - (cur[k] ?? 0)) }));
}
