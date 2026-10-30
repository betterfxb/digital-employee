/**
 * S9 持久化抽象层：Repository接口 + 内存实现
 * 路由只依赖本文件，不直连store/Prisma。切换：DATA_BACKEND=memory（默认）/prisma（目标态，需DB落地，见prisma/schema.prisma）。
 */
import { readIds, allReadVideos, intentOverrides, follows, competitors, seenEvents, dlq, syncJobs, activeAccountId, setActiveAccountId, pausedTasks, settings, videoTasks, customScripts, replyRules, replies, campaigns, drafts, viewOf } from './store';
import { hashPassword } from './accessPw';
import { autoCfgOf, mergeAutoCfg } from './autoCfg';
import { sanitizeViews } from './commentViews';
import { mockComments, mockAccounts, mockVideos, mockScripts } from './mock';
import { persistCollections } from './localData'; // S25b: 业务集合变更落盘
import type { Account, Video, CommentItem, Follow, Competitor, DlqItem } from './types';

export interface FollowInput { peer_nick: string; source_video_id: string; next_remind_at: string; status: string; amount?: number; contact?: string; source?: 'import' }
export interface CompetitorInput { source: string; url: string; remark: string; kind?: string }
export interface IntentPatch { intent?: string; ignore?: boolean }
export interface CommentFilter { video_id: string; intent: string; keyword: string; unreadOnly: boolean }
export interface VideoRepo { list(accountId: string): Video[] }

export interface CommentRepo {
  list(f: CommentFilter): CommentItem[];
  markRead(ids: string[], valid: Set<string>): number;
  markAllRead(videoId: string): void;
  setIntent(id: string, patch: IntentPatch): Record<string, unknown> | null;
  exists(id: string): boolean;
}
export interface FollowRepo { list(status: string): Follow[]; create(input: FollowInput): Follow; update(id: string, patch: { status?: string; amount?: number; tags?: string[]; note?: string; next_remind_at?: string; contact?: string; cost?: number; touch?: string }): Follow | null }
export interface CompetitorRepo { list(): Competitor[]; create(input: CompetitorInput): Competitor; update(id: string, patch: { play?: number; like?: number; remark?: string }): Competitor | null }
export interface EventRepo {
  /** 接收事件，返回true=首次，false=重复（幂等） */
  receive(eventId: string): boolean;
  pushDlq(reason: string, body: string): void;
  dlq(): DlqItem[];
}
export interface SyncRepo { enqueue(): { task_id: string; scheduled: boolean }; count(): number }
export interface AccountRepo { list(): Account[]; getActive(): string; getActiveAccount(): Account; switch(id: string): boolean; rename(id: string, nickname: string): boolean }
export interface TaskRepo { isPaused(type: string): boolean; setPaused(type: string, paused: boolean): void; lastRun(type: string): string | null }
export interface SettingsRepo {
  get(): Record<string, unknown>;
  update(patch: { service_name?: string; font_size?: number; theme_color?: string; price_list?: unknown; auto_reply_enabled?: boolean; desktop_autostart?: boolean; weekly_goal?: number; lock_idle_minutes?: number; auto_config?: unknown; comment_views?: unknown }): Record<string, unknown>;
  /** S69 设置/取消访问密码（pw='' → 清除），返回 changed_at 或 null */
  setAccessPassword(pw: string): string | null;
}
export interface VideoTask { id: string; video_id: string; title: string; follow: boolean; like_done: boolean; fav_done: boolean; paused: boolean; interval_min: number; last_check: string | null; created_at: string }
export interface VideoTaskRepo {
  list(): VideoTask[];
  create(video_id: string, title: string): VideoTask | null;
  update(id: string, patch: Partial<Pick<VideoTask, 'follow' | 'like_done' | 'fav_done' | 'paused' | 'interval_min'>>): VideoTask | null;
  remove(id: string): boolean;
}
export interface Script { id: string; category: string; title: string; content: string; deleted?: boolean; used?: number; pinned?: boolean }
export interface ScriptRepo { list(mode?: 'active' | 'trash'): Script[]; create(category: string, title: string, content: string): Script | null; remove(id: string): boolean; restore(id: string): boolean; /** S107 使用计数与置顶（仅自定义话术，内置不计数防伪造热度） */ use(id: string): Script | null; pin(id: string, v: boolean): Script | null }
export interface ReplyRule { id: string; keyword: string; reply: string; enabled: boolean; deleted?: boolean }
export interface ReplyRuleRepo {
  list(mode?: 'active' | 'trash'): ReplyRule[];
  create(keyword: string, reply: string): ReplyRule | null;
  update(id: string, patch: { reply?: string; enabled?: boolean }): ReplyRule | null;
  remove(id: string): boolean;
  restore(id: string): boolean;
}
export interface Reply { id: string; comment_id: string; content: string; at: string; variant?: number }
export interface ReplyRepo { list(comment_id: string): Reply[]; all(): Reply[]; create(comment_id: string, content: string, variant?: number): Reply | null }
/** S87 营销活动：人工执行checklist+期间复盘（数据层只管存储，统计在lib/marketing纯函数） */
export interface Campaign { id: string; name: string; note?: string; keyword?: string; start_at: string; end_at: string; checklist: { text: string; done: boolean }[]; created_at: string }
export interface CampaignRepo { list(): Campaign[]; create(input: { name: string; note?: string; keyword?: string; start_at: string; end_at: string; checklist?: { text: string; done: boolean }[] }): Campaign | null; update(id: string, patch: { name?: string; note?: string; keyword?: string; start_at?: string; end_at?: string; checklist?: { text: string; done: boolean }[] }): Campaign | null; remove(id: string): boolean }
/** S108 草稿收件箱：自动起草/手动暂存的话术待确认队列——系统只管队列，复制与发送在人 */
export interface Draft { id: string; comment_id: string; nick: string; text: string; via: string; at: string; status: 'pending' | 'done' | 'discarded'; handled_at?: string }
export interface DraftRepo { list(status?: string): Draft[]; create(input: { comment_id: string; nick: string; text: string; via: string }): Draft | null; setStatus(id: string, status: 'pending' | 'done' | 'discarded'): Draft | null; hasComment(comment_id: string): boolean; pendingCount(): number }
export interface Repos { comments: CommentRepo; videos: VideoRepo; follows: FollowRepo; competitors: CompetitorRepo; events: EventRepo; sync: SyncRepo; accounts: AccountRepo; tasks: TaskRepo; settings: SettingsRepo; videoTasks: VideoTaskRepo; scripts: ScriptRepo; replyRules: ReplyRuleRepo; replies: ReplyRepo; campaigns: CampaignRepo; drafts: DraftRepo }

const memory: Repos = {
  videos: {
    list: (accountId) => mockVideos.filter((v) => v.account_id === accountId),
  },
  comments: {
    list: (f) => mockComments.map(viewOf).filter((c) => (!f.video_id || c.video_id === f.video_id) && (!f.intent || c.intent === f.intent) && (!f.keyword || c.content.includes(f.keyword)) && (!f.unreadOnly || !c.is_read_local)),
    // S68 修：协作态写内存后必须落盘（此前重启即丢已读/意图）
    markRead: (ids, valid) => { let n = 0; ids.forEach((id) => { if (valid.has(id)) { readIds.add(id); n++; } }); if (n > 0) persistCollections(); return n; },
    markAllRead: (videoId) => { allReadVideos.add(videoId); persistCollections(); },
    setIntent: (id, patch) => { const next = { ...(intentOverrides.get(id) || {}), ...patch }; intentOverrides.set(id, next); persistCollections(); return { id, ...next }; },
    exists: (id) => mockComments.some((c) => c.id === id),
  },
  follows: {
    list: (status) => (status ? follows.filter((f) => f.status === status) : follows),
    create: (input) => { const item = { id: `f-${Date.now().toString(36)}`, created_at: new Date().toISOString(), ...input }; follows.push(item); persistCollections(); return item; },
    update: (id, patch) => {
      const f = follows.find((x) => x.id === id);
      if (!f) return null;
      // S49 先算变更动作再落值（顺序反了会漏记状态变更）
      const acts: string[] = [];
      if (patch.status !== undefined && patch.status !== f.status) acts.push(`状态改为「${patch.status}」`);
      if (patch.amount !== undefined) acts.push(`记成交 ¥${patch.amount}`);
      if (patch.cost !== undefined) acts.push(`记成本 ¥${patch.cost}`); // S132
      if (patch.tags !== undefined) acts.push(`标签更新为「${patch.tags.join('、') || '无'}」`);
      if (patch.note !== undefined) acts.push('更新跟进纪要');
      if (patch.next_remind_at !== undefined && patch.next_remind_at !== f.next_remind_at) acts.push(`提醒时间改为「${patch.next_remind_at}」`);
      if (patch.contact !== undefined && patch.contact !== f.contact) acts.push('更新联系方式'); // S115
      if (patch.touch !== undefined) acts.push(`记了联系：${patch.touch}`); // S138 提醒消失的喂入口：只记动作不改任何字段
      if (patch.status !== undefined) f.status = patch.status;
      if (patch.amount !== undefined) f.amount = patch.amount;
      if (patch.cost !== undefined) f.cost = patch.cost; // S132
      if (patch.tags !== undefined) f.tags = patch.tags;
      if (patch.note !== undefined) f.note = patch.note;
      if (patch.next_remind_at !== undefined) f.next_remind_at = patch.next_remind_at;
      if (patch.contact !== undefined) f.contact = patch.contact; // S115
      if (acts.length > 0) {
        f.history = [{ at: new Date().toISOString(), act: acts.join('；') }, ...(f.history || [])].slice(0, 20);
      }
      persistCollections();
      return f;
    },
  },
  competitors: {
    list: () => competitors,
    create: (input) => { const item = { id: `cp-${Date.now().toString(36)}`, play: 0, like: 0, ...input }; competitors.push(item); persistCollections(); return item; },
    // S53 更新前把当前值记入历史（有变化才留痕），支持竞品变化追踪
    update: (id, patch) => {
      const c = competitors.find((x) => x.id === id);
      if (!c) return null;
      const changed = (patch.play !== undefined && patch.play !== c.play) || (patch.like !== undefined && patch.like !== c.like) || (patch.remark !== undefined && patch.remark !== c.remark);
      if (changed) {
        c.history = [{ at: new Date().toISOString(), play: c.play, like: c.like }, ...(c.history || [])].slice(0, 20);
      }
      if (patch.play !== undefined) c.play = patch.play;
      if (patch.like !== undefined) c.like = patch.like;
      if (patch.remark !== undefined) c.remark = patch.remark;
      persistCollections();
      return c;
    },
  },
  events: {
    receive: (eventId) => { if (seenEvents.has(eventId)) return false; seenEvents.add(eventId); return true; },
    pushDlq: (reason, body) => { dlq.push({ id: `dlq-${Date.now().toString(36)}`, reason, at: new Date().toISOString(), body: body.slice(0, 500) }); },
    dlq: () => dlq,
  },
  sync: {
    enqueue: () => { const task_id = `sync-${Date.now().toString(36)}`; syncJobs.push({ task_id, at: new Date().toISOString() }); return { task_id, scheduled: true }; },
    count: () => syncJobs.length,
  },
  accounts: {
    list: () => mockAccounts.map((a) => ({ ...a, active: a.id === activeAccountId })),
    getActive: () => activeAccountId,
    getActiveAccount: () => mockAccounts.find((a) => a.id === activeAccountId) || mockAccounts[0],
    switch: (id) => { if (!mockAccounts.some((a) => a.id === id)) return false; setActiveAccountId(id); return true; },
    rename: (id, nickname) => { const a = mockAccounts.find((x) => x.id === id); if (!a) return false; a.nickname = nickname; return true; },
  },
  tasks: {
    isPaused: (type) => pausedTasks.has(type),
    setPaused: (type, paused) => { if (paused) pausedTasks.add(type); else pausedTasks.delete(type); },
    lastRun: (type) => (type === 'statsSync' && syncJobs.length > 0 ? syncJobs[syncJobs.length - 1].at : null),
  },
  settings: {
    get: () => {
      const acc = mockAccounts.find((a) => a.id === activeAccountId) || mockAccounts[0];
      return { shop_name: acc.nickname, service_name: settings.service_name, font_size: settings.font_size, theme_color: settings.theme_color, password_changed_at: settings.password_changed_at, price_list: settings.price_list, password_hash: settings.password_hash, auto_reply_enabled: settings.auto_reply_enabled, desktop_autostart: settings.desktop_autostart, weekly_goal: settings.weekly_goal, lock_idle_minutes: settings.lock_idle_minutes, auto_config: autoCfgOf(settings), comment_views: sanitizeViews(settings.comment_views) };
    },
    update: (patch) => {
      if (typeof patch.service_name === 'string') settings.service_name = patch.service_name;
      if (typeof patch.font_size === 'number') settings.font_size = patch.font_size;
      if (typeof patch.weekly_goal === 'number') settings.weekly_goal = patch.weekly_goal; // S133
      if (typeof patch.lock_idle_minutes === 'number') settings.lock_idle_minutes = patch.lock_idle_minutes; // S150
      if (typeof patch.theme_color === 'string') settings.theme_color = patch.theme_color;
      if (Array.isArray(patch.price_list)) settings.price_list = patch.price_list as { tier: string; price: string }[];
      if (typeof patch.auto_reply_enabled === 'boolean') settings.auto_reply_enabled = patch.auto_reply_enabled;
      if (typeof patch.desktop_autostart === 'boolean') settings.desktop_autostart = patch.desktop_autostart; // S104
      if (patch.auto_config && typeof patch.auto_config === 'object') settings.auto_config = mergeAutoCfg(patch.auto_config as Record<string, unknown>) as unknown as Record<string, unknown>;
      if (patch.comment_views !== undefined) settings.comment_views = sanitizeViews(patch.comment_views); // S93
      persistCollections();
      const acc = mockAccounts.find((a) => a.id === activeAccountId) || mockAccounts[0];
      return { shop_name: acc.nickname, service_name: settings.service_name, font_size: settings.font_size, theme_color: settings.theme_color, password_changed_at: settings.password_changed_at, price_list: settings.price_list, password_hash: settings.password_hash, auto_reply_enabled: settings.auto_reply_enabled, desktop_autostart: settings.desktop_autostart, weekly_goal: settings.weekly_goal, lock_idle_minutes: settings.lock_idle_minutes, auto_config: autoCfgOf(settings), comment_views: sanitizeViews(settings.comment_views) };
    },
    // S69 设置/取消访问密码（scrypt哈希，原文永不落盘）
    setAccessPassword: (pw) => {
      if (!pw) {
        settings.password_hash = null;
        settings.password_changed_at = null;
        persistCollections();
        return null;
      }
      settings.password_hash = hashPassword(pw);
      settings.password_changed_at = new Date().toISOString();
      persistCollections();
      return settings.password_changed_at as string;
    },
  },
  videoTasks: {
    list: () => videoTasks,
    create: (video_id, title) => {
      if (videoTasks.some((t) => t.video_id === video_id)) return null;
      const item: VideoTask = { id: `vt-${Date.now().toString(36)}`, video_id, title, follow: true, like_done: false, fav_done: false, paused: false, interval_min: 5, last_check: null, created_at: new Date().toISOString().slice(5, 10) };
      videoTasks.push(item);
      persistCollections();
      return item;
    },
    update: (id, patch) => {
      const t = videoTasks.find((x) => x.id === id);
      if (!t) return null;
      if (typeof patch.follow === 'boolean') t.follow = patch.follow;
      if (typeof patch.like_done === 'boolean') t.like_done = patch.like_done;
      if (typeof patch.fav_done === 'boolean') t.fav_done = patch.fav_done;
      if (typeof patch.paused === 'boolean') t.paused = patch.paused;
      if (typeof patch.interval_min === 'number' && patch.interval_min >= 1 && patch.interval_min <= 120) t.interval_min = Math.floor(patch.interval_min);
      persistCollections();
      return t;
    },
    remove: (id) => { const i = videoTasks.findIndex((x) => x.id === id); if (i < 0) return false; videoTasks.splice(i, 1); persistCollections(); return true; },
  },
  scripts: {
    // S57 软删除：active=未删（默认），trash=回收站；S107 active按置顶>使用次数排（自定义段内置段保持原序）
    list: (mode) => {
      const builtins = mockScripts.map((s) => ({ ...s }));
      const customs = [...customScripts].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || ((b.used || 0) - (a.used || 0)));
      const all = [...builtins, ...customs];
      return mode === 'trash' ? all.filter((s) => s.deleted) : all.filter((s) => !s.deleted);
    },
    use: (id) => {
      const x = customScripts.find((s) => s.id === id);
      if (!x) return null; // 内置话术不进统计（防伪造热度）
      x.used = (x.used || 0) + 1;
      persistCollections();
      return x;
    },
    pin: (id, v) => {
      const x = customScripts.find((s) => s.id === id);
      if (!x) return null;
      x.pinned = !!v;
      persistCollections();
      return x;
    },
    create: (category, title, content) => {
      if (!title.trim() || !content.trim()) return null;
      const item = { id: `cs-${Date.now().toString(36)}`, category: category || '自定义', title: title.trim(), content: content.trim() };
      customScripts.push(item);
      persistCollections();
      return item;
    },
    // S57 删除=标记进回收站（内置话术不在customScripts天然404；误删可恢复）
    remove: (id) => { const x = customScripts.find((v) => v.id === id); if (!x || x.deleted) return false; x.deleted = true; persistCollections(); return true; },
    restore: (id) => { const x = customScripts.find((v) => v.id === id); if (!x || !x.deleted) return false; x.deleted = undefined; persistCollections(); return true; },
  },
  replyRules: {
    // S57 软删除：active/trash双视图
    list: (mode) => (mode === 'trash' ? replyRules.filter((r) => r.deleted) : replyRules.filter((r) => !r.deleted)),
    create: (keyword, reply) => {
      if (!keyword.trim() || !reply.trim()) return null;
      const item = { id: `rr-${Date.now().toString(36)}`, keyword: keyword.trim(), reply: reply.trim(), enabled: true };
      replyRules.push(item);
      persistCollections();
      return item;
    },
    update: (id, patch) => {
      const r = replyRules.find((x) => x.id === id);
      if (!r) return null;
      if (typeof patch.reply === 'string' && patch.reply.trim()) r.reply = patch.reply.trim();
      if (typeof patch.enabled === 'boolean') r.enabled = patch.enabled;
      persistCollections();
      return r;
    },
    remove: (id) => { const x = replyRules.find((v) => v.id === id); if (!x || x.deleted) return false; x.deleted = true; persistCollections(); return true; },
    restore: (id) => { const x = replyRules.find((v) => v.id === id); if (!x || !x.deleted) return false; x.deleted = undefined; persistCollections(); return true; },
  },
  replies: {
    list: (comment_id) => replies.filter((r) => r.comment_id === comment_id),
    all: () => replies,
    create: (comment_id, content, variant) => {
      if (!content.trim()) return null;
      const v = Number(variant);
      const item: Reply = { id: `rp-${Date.now().toString(36)}`, comment_id, content: content.trim(), at: new Date().toISOString().slice(5, 16).replace('T', ' ') };
      if (Number.isInteger(v) && v >= 1 && v <= 4) item.variant = v; // S86 话术候选位次（越界=未标注，不进实验）
      replies.push(item);
      persistCollections();
      return item;
    },
  },
  campaigns: {
    list: () => campaigns,
    create: (input) => {
      const name = String(input?.name || '').trim();
      if (!name || !input.start_at || !input.end_at) return null;
      if (Date.parse(input.start_at) > Date.parse(input.end_at)) return null;
      const c: Campaign = { id: `mk-${Date.now().toString(36)}`, name, note: String(input.note || '').slice(0, 200), keyword: String(input.keyword || '').slice(0, 20), start_at: input.start_at, end_at: input.end_at, checklist: (input.checklist || []).slice(0, 30), created_at: new Date().toISOString() };
      campaigns.push(c);
      persistCollections();
      return c;
    },
    update: (id, patch) => {
      const c = campaigns.find((x) => x.id === id);
      if (!c) return null;
      if (patch.name !== undefined) { const n = String(patch.name).trim(); if (!n) return null; c.name = n; }
      if (patch.note !== undefined) c.note = String(patch.note).slice(0, 200);
      if (patch.keyword !== undefined) c.keyword = String(patch.keyword).slice(0, 20);
      if (patch.start_at !== undefined) c.start_at = patch.start_at;
      if (patch.end_at !== undefined) c.end_at = patch.end_at;
      if (patch.checklist !== undefined) c.checklist = patch.checklist.slice(0, 30);
      if (Date.parse(c.start_at) > Date.parse(c.end_at)) return null;
      persistCollections();
      return c;
    },
    remove: (id) => {
      const i = campaigns.findIndex((x) => x.id === id);
      if (i < 0) return false;
      campaigns.splice(i, 1);
      persistCollections();
      return true;
    },
  },
  drafts: {
    list: (status) => (status ? drafts.filter((d) => d.status === status) : [...drafts]),
    create: (input) => {
      const text = String(input?.text || '').trim().slice(0, 500);
      if (!text || !input.comment_id?.trim() || !input.nick?.trim()) return null;
      if (drafts.some((d) => d.comment_id === input.comment_id && d.status === 'pending')) return null; // 同评论在途不重复入箱
      const item: Draft = { id: `dr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, comment_id: String(input.comment_id).trim(), nick: String(input.nick).trim().slice(0, 30), text, via: String(input.via || '手动').slice(0, 8), at: new Date().toISOString(), status: 'pending' };
      drafts.unshift(item);
      while (drafts.length > 200) drafts.pop(); // 环形上限：老处理项自然淘汰
      persistCollections();
      return item;
    },
    setStatus: (id, status) => {
      const d = drafts.find((x) => x.id === id);
      if (!d) return null;
      d.status = status;
      d.handled_at = new Date().toISOString();
      persistCollections();
      return d;
    },
    hasComment: (comment_id) => drafts.some((d) => d.comment_id === comment_id),
    pendingCount: () => drafts.filter((d) => d.status === 'pending').length,
  },
};

/** 取当前后端（默认memory；prisma待DB接入后实现） */
export function getRepos(): Repos {
  const backend = process.env.DATA_BACKEND || 'memory';
  if (backend === 'memory') return memory;
  throw new Error(`DATA_BACKEND=${backend} 尚未接入，请先完成PG+Prisma落地（prisma/schema.prisma为目标态）`);
}
