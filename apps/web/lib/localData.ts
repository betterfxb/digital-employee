/**
 * S23 本地持久化：绑定账号/导入数据/token密文 → data/local.json（原子写）
 * 授权状态机与操作日志仅内存（重启清空可接受）。仅服务端引用，禁入client组件。
 */
import fs from 'fs';
import path from 'path';
import { randomBytes, createHash } from 'crypto';
import { encryptToken, decryptToken } from './crypto';
import { mockAccounts, mockVideos, mockComments, seedSnapshot } from './mock';
import type { Account, Video, CommentItem, AuthLogItem } from './types';

export interface StoredToken {
  enc?: { cipher: string; iv: string; v: number };
  refreshEnc?: { cipher: string; iv: string; v: number };
  /** 仅生产缺TOKEN_MASTER_KEY时降级使用（live模式callback已前置拦截） */
  plain?: string;
  refreshPlain?: string;
  expires_at?: string;
  /** S26: 完整open_id（live拉作品/评论API参数；UI仍只展示mask） */
  open_id?: string;
}

interface LocalState {
  accounts: Account[]; videos: Video[]; comments: CommentItem[]; tokens: Record<string, StoredToken>;
  /** S25b 业务集合持久化（台账/回评/竞品/队列/设置/自定义话术/接待规则，重启不丢） */
  follows: unknown[]; replies: unknown[]; competitors: unknown[]; videoTasks: unknown[];
  settings: Record<string, unknown> | null; customScripts: unknown[]; replyRules: unknown[];
  /** S37 清空标记：清空/恢复后示例种子永不复活（仅全新安装有示例） */
  cleared_at?: string;
  /** S68 协作态持久化：已读/整视频已读/意图忽略覆盖——此前只在内存，重启即丢（真bug修复） */
  read_ids?: string[];
  all_read_videos?: string[];
  intent_overrides?: Record<string, { intent?: string; ignore?: boolean }>;
}

/** S30 数据目录外置（桌面端DATA_DIR指向%APPDATA%），默认兼容 cwd/data */
const FILE = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'local.json');
const state: LocalState = {
  accounts: [], videos: [], comments: [], tokens: {},
  follows: [], replies: [], competitors: [], videoTasks: [], settings: null, customScripts: [], replyRules: [],
};

function hydrate() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<LocalState>;
      if (Array.isArray(raw.accounts)) state.accounts = raw.accounts;
      if (Array.isArray(raw.videos)) state.videos = raw.videos;
      if (Array.isArray(raw.comments)) state.comments = raw.comments;
      if (raw.tokens && typeof raw.tokens === 'object') state.tokens = raw.tokens;
      if (Array.isArray(raw.follows)) state.follows = raw.follows;
      if (Array.isArray(raw.replies)) state.replies = raw.replies;
      if (Array.isArray(raw.competitors)) state.competitors = raw.competitors;
      if (Array.isArray(raw.videoTasks)) state.videoTasks = raw.videoTasks;
      if (raw.settings && typeof raw.settings === 'object') state.settings = raw.settings;
      if (Array.isArray(raw.customScripts)) state.customScripts = raw.customScripts;
      if (Array.isArray(raw.replyRules)) state.replyRules = raw.replyRules;
      if (typeof raw.cleared_at === 'string') state.cleared_at = raw.cleared_at;
      if (Array.isArray(raw.read_ids)) state.read_ids = raw.read_ids;
      if (Array.isArray(raw.all_read_videos)) state.all_read_videos = raw.all_read_videos;
      if (raw.intent_overrides && typeof raw.intent_overrides === 'object') state.intent_overrides = raw.intent_overrides as Record<string, { intent?: string; ignore?: boolean }>;
    }
  } catch { /* 文件损坏则忽略，保持内存态起跑 */ }
  // S37 清空/恢复后示例种子不复活（先清种子再注文件数据；仅全新安装有示例）
  if (state.cleared_at) { mockVideos.splice(0, mockVideos.length); mockComments.splice(0, mockComments.length); }
  state.accounts.forEach((a) => { if (!mockAccounts.some((x) => x.id === a.id)) mockAccounts.push(a); });
  state.videos.forEach((v) => { if (!mockVideos.some((x) => x.id === v.id)) mockVideos.push(v); });
  state.comments.forEach((c) => { if (!mockComments.some((x) => x.id === c.id)) mockComments.push(c); });
}
hydrate();

/** S25b 业务集合引用（store模块体尾部注入水合；repo变更点调persistCollections） */
export interface CollectionRefs {
  follows: { id: string }[]; replies: { id: string }[]; competitors: { id: string }[]; videoTasks: { id: string }[];
  settings: object; customScripts: { id: string }[]; replyRules: { id: string }[];
  /** S68 协作态（可选注入） */
  readIds?: Set<string>;
  allReadVideos?: Set<string>;
  intentOverrides?: Map<string, { intent?: string; ignore?: boolean }>;
}
let collRefs: CollectionRefs | null = null;

/** store数组定义完成后调用：文件数据注入内存数组（按id去重，防mock初始项与文件副本重复） */
export function hydrateCollections(refs: CollectionRefs) {
  collRefs = refs;
  const merge = <T extends { id: string }>(arr: T[], saved: unknown[]) => {
    saved.forEach((s) => { const o = s as T; if (o && typeof o.id === 'string' && !arr.some((x) => x.id === o.id)) arr.push(o); });
  };
  merge(refs.follows, state.follows);
  merge(refs.replies, state.replies);
  merge(refs.competitors, state.competitors);
  merge(refs.videoTasks, state.videoTasks);
  if (state.settings) Object.assign(refs.settings, state.settings);
  merge(refs.customScripts, state.customScripts);
  merge(refs.replyRules, state.replyRules);
  // S68 协作态水合（本地const承接避免闭包内null收窄丢失——S47同款坑）
  const rids = refs.readIds;
  if (rids && Array.isArray(state.read_ids)) state.read_ids.forEach((id) => rids.add(id));
  const ravs = refs.allReadVideos;
  if (ravs && Array.isArray(state.all_read_videos)) state.all_read_videos.forEach((id) => ravs.add(id));
  const rio = refs.intentOverrides;
  if (rio && state.intent_overrides && typeof state.intent_overrides === 'object') {
    Object.entries(state.intent_overrides).forEach(([k, v]) => rio.set(k, v));
  }
}

/** repo变更点调用：内存集合→文件（全量序列化） */
export function persistCollections() {
  if (!collRefs) return;
  state.follows = collRefs.follows;
  state.replies = collRefs.replies;
  state.competitors = collRefs.competitors;
  state.videoTasks = collRefs.videoTasks;
  state.settings = collRefs.settings as Record<string, unknown>;
  state.customScripts = collRefs.customScripts;
  state.replyRules = collRefs.replyRules;
  // S68 协作态回写
  if (collRefs.readIds) state.read_ids = [...collRefs.readIds];
  if (collRefs.allReadVideos) state.all_read_videos = [...collRefs.allReadVideos];
  if (collRefs.intentOverrides) state.intent_overrides = Object.fromEntries(collRefs.intentOverrides);
  flushLocal();
}

export function flushLocal() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

/** S37 清空业务数据（保留账号授权/tokens/设置）：文件+内存数组同清，即时生效 */
export function clearBusinessData() {
  state.videos = []; state.comments = [];
  state.follows = []; state.replies = []; state.competitors = []; state.videoTasks = [];
  state.customScripts = []; state.replyRules = [];
  // S68 协作态随业务数据一并清（已读/意图属于评论）
  state.read_ids = []; state.all_read_videos = []; state.intent_overrides = {};
  state.cleared_at = new Date().toISOString();
  mockVideos.splice(0, mockVideos.length);
  mockComments.splice(0, mockComments.length);
  const refs = collRefs;
  if (refs) {
    refs.follows.length = 0; refs.replies.length = 0; refs.competitors.length = 0;
    refs.videoTasks.length = 0; refs.customScripts.length = 0; refs.replyRules.length = 0;
    refs.readIds?.clear(); refs.allReadVideos?.clear(); refs.intentOverrides?.clear();
  }
  flushLocal();
}

/** S38 备份：全量业务数据JSON快照（含账号/授权引用/设置/台账） */
export function backupAll(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
}

/** S38 恢复：校验后整体替换（文件+内存数组即时生效；tokens随文件走） */
export function restoreBackup(data: Record<string, unknown>): { ok: boolean; error: string | null } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: '备份格式不对' };
  if (!['accounts', 'videos', 'comments'].every((k) => k in data)) return { ok: false, error: '缺少必要字段（不是本系统的备份文件）' };
  const arrKeys = ['accounts', 'videos', 'comments', 'follows', 'replies', 'competitors', 'videoTasks', 'customScripts', 'replyRules'];
  for (const k of arrKeys) if (k in data && !Array.isArray(data[k])) return { ok: false, error: `字段${k}格式不对` };
  const arr = <T>(k: string): T[] => (Array.isArray(data[k]) ? (data[k] as T[]) : []);
  // S47 修复：备份只含文件态（种子从不入文件）→ 恢复以「种子 ∪ 备份」重建（id去重，备份优先）；
  // 备份带 cleared_at（客户清空后备份）则不并种子，保持清空语义
  const clearedBackup = typeof data.cleared_at === 'string';
  const mergeBy = <T extends { id: string }>(seed: T[], saved: T[]): T[] => {
    const out = [...seed];
    saved.forEach((s) => { const i = out.findIndex((x) => x.id === s.id); if (i > -1) out[i] = s; else out.push(s); });
    return out;
  };
  const noSeed = <T,>(x: T[]): T[] => (clearedBackup ? [] : x);
  state.accounts = mergeBy(noSeed(seedSnapshot.accounts as unknown as { id: string }[]), arr('accounts')) as unknown as Account[];
  state.videos = mergeBy(noSeed(seedSnapshot.videos as unknown as { id: string }[]), arr('videos')) as unknown as Video[];
  state.comments = mergeBy(noSeed(seedSnapshot.comments as unknown as { id: string }[]), arr('comments')) as unknown as CommentItem[];
  state.tokens = (data.tokens && typeof data.tokens === 'object' ? data.tokens : {}) as Record<string, StoredToken>;
  state.follows = arr<unknown>('follows');
  state.replies = arr<unknown>('replies');
  state.competitors = arr<unknown>('competitors');
  state.videoTasks = arr<unknown>('videoTasks');
  state.customScripts = arr<unknown>('customScripts');
  state.replyRules = arr<unknown>('replyRules');
  state.settings = (data.settings && typeof data.settings === 'object' ? data.settings : null) as Record<string, unknown> | null;
  // S47修：cleared_at 严格跟随备份——备份没有即回到「从未清空」态（S37原设计无脑设now会永久污染环境致种子永灭）
  state.cleared_at = typeof data.cleared_at === 'string' ? data.cleared_at : undefined;
  // 内存态同步（避免重启才能生效）
  mockAccounts.splice(0, mockAccounts.length, ...state.accounts);
  mockVideos.splice(0, mockVideos.length, ...state.videos);
  mockComments.splice(0, mockComments.length, ...state.comments);
  const refs = collRefs;
  if (refs) {
    refs.follows.length = 0; refs.follows.push(...(state.follows as { id: string }[]));
    refs.replies.length = 0; refs.replies.push(...(state.replies as { id: string }[]));
    refs.competitors.length = 0; refs.competitors.push(...(state.competitors as { id: string }[]));
    refs.videoTasks.length = 0; refs.videoTasks.push(...(state.videoTasks as { id: string }[]));
    refs.customScripts.length = 0; refs.customScripts.push(...(state.customScripts as { id: string }[]));
    refs.replyRules.length = 0; refs.replyRules.push(...(state.replyRules as { id: string }[]));
    // S68 协作态按备份回放（缺失字段=清空，以备份时点为准）
    const rids = refs.readIds;
    if (rids) { rids.clear(); (state.read_ids || []).forEach((id) => rids.add(id)); }
    const ravs = refs.allReadVideos;
    if (ravs) { ravs.clear(); (state.all_read_videos || []).forEach((id) => ravs.add(id)); }
    const rio = refs.intentOverrides;
    if (rio) { rio.clear(); Object.entries(state.intent_overrides || {}).forEach(([k, v]) => rio.set(k, v)); }
    if (state.settings) {
      const s = refs.settings as Record<string, unknown>;
      Object.keys(s).forEach((k) => { delete s[k]; });
      Object.assign(s, state.settings);
    }
  }
  flushLocal();
  return { ok: true, error: null };
}

export function rememberAccount(a: Account) {
  state.accounts = state.accounts.filter((x) => x.id !== a.id).concat(a);
  flushLocal();
}

let batching = false;
/**
 * S58 批量导入合并落盘：批内只改内存，结束一次性flush。
 * 修压测发现的线性劣化（每行全量写盘：2000行=2000次文件重写，单批200行从500ms涨到2s）
 */
export function withBatch<T>(fn: () => T): T {
  batching = true;
  try { return fn(); } finally { batching = false; flushLocal(); }
}

export function rememberVideo(v: Video) {
  state.videos = state.videos.filter((x) => x.id !== v.id).concat(v);
  if (!batching) flushLocal();
}

export function rememberComment(c: CommentItem) {
  state.comments = state.comments.filter((x) => x.id !== c.id).concat(c);
  if (!batching) flushLocal();
}

export function recordToken(accountId: string, t: { access: string; refresh?: string; expires_at?: string; open_id?: string }) {
  const rec: StoredToken = { expires_at: t.expires_at, open_id: t.open_id };
  try {
    rec.enc = encryptToken(t.access);
    if (t.refresh) rec.refreshEnc = encryptToken(t.refresh);
  } catch {
    rec.plain = t.access;
    rec.refreshPlain = t.refresh;
    console.warn('[localData] TOKEN_MASTER_KEY缺失，token降级明文落盘（live模式应前置报错）');
  }
  state.tokens[accountId] = rec;
  flushLocal();
}

export function readToken(accountId: string): { access: string | null; refresh: string | null; expires_at?: string; open_id?: string } {
  const r = state.tokens[accountId];
  if (!r) return { access: null, refresh: null };
  try {
    return {
      access: r.enc ? decryptToken(r.enc) : r.plain || null,
      refresh: r.refreshEnc ? decryptToken(r.refreshEnc) : r.refreshPlain || null,
      expires_at: r.expires_at,
      open_id: r.open_id,
    };
  } catch { return { access: null, refresh: null, expires_at: r.expires_at, open_id: r.open_id }; }
}

export function randomHex(n: number): string { return randomBytes(n).toString('hex'); }
export function hash6(s: string): string { return createHash('sha256').update(s).digest('hex').slice(0, 6); }

/** 操作日志（内存，绑定/导入实时追加） */
export const authLogs: AuthLogItem[] = [
  { at: '10-09 09:41', op: '扫码授权成功', by: '店长', result: '有效期30天' },
  { at: '10-08 06:02', op: '每日STAT同步', by: '系统', result: '38视频 · 成功' },
  { at: '10-07 22:14', op: 'token预刷新', by: '系统', result: '成功' },
];

export function pushAuthLog(op: string, by: string, result: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  authLogs.unshift({ at: `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`, op, by, result });
  if (authLogs.length > 50) authLogs.pop();
}

/** 一次性授权state（mock与live共用，10分钟过期即弃） */
export const pendingAuthStates = new Map<string, { nick: string; at: number }>();

export function createState(nick: string): string {
  const now = Date.now();
  pendingAuthStates.forEach((v, k) => { if (now - v.at > 600_000) pendingAuthStates.delete(k); });
  const s = randomHex(8);
  pendingAuthStates.set(s, { nick: nick.slice(0, 20), at: now });
  return s;
}
