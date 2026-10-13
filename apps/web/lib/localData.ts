/**
 * S23 本地持久化：绑定账号/导入数据/token密文 → data/local.json（原子写）
 * 授权状态机与操作日志仅内存（重启清空可接受）。仅服务端引用，禁入client组件。
 */
import fs from 'fs';
import path from 'path';
import { randomBytes, createHash } from 'crypto';
import { encryptToken, decryptToken } from './crypto';
import { mockAccounts, mockVideos, mockComments } from './mock';
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
}

const FILE = path.join(process.cwd(), 'data', 'local.json');
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
    }
  } catch { /* 文件损坏则忽略，保持内存态起跑 */ }
  state.accounts.forEach((a) => { if (!mockAccounts.some((x) => x.id === a.id)) mockAccounts.push(a); });
  state.videos.forEach((v) => { if (!mockVideos.some((x) => x.id === v.id)) mockVideos.push(v); });
  state.comments.forEach((c) => { if (!mockComments.some((x) => x.id === c.id)) mockComments.push(c); });
}
hydrate();

/** S25b 业务集合引用（store模块体尾部注入水合；repo变更点调persistCollections） */
export interface CollectionRefs {
  follows: { id: string }[]; replies: { id: string }[]; competitors: { id: string }[]; videoTasks: { id: string }[];
  settings: object; customScripts: { id: string }[]; replyRules: { id: string }[];
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
  flushLocal();
}

export function flushLocal() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

export function rememberAccount(a: Account) {
  state.accounts = state.accounts.filter((x) => x.id !== a.id).concat(a);
  flushLocal();
}

export function rememberVideo(v: Video) {
  state.videos = state.videos.filter((x) => x.id !== v.id).concat(v);
  flushLocal();
}

export function rememberComment(c: CommentItem) {
  state.comments = state.comments.filter((x) => x.id !== c.id).concat(c);
  flushLocal();
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
