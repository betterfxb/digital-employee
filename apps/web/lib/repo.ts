/**
 * S9 持久化抽象层：Repository接口 + 内存实现
 * 路由只依赖本文件，不直连store/Prisma。切换：DATA_BACKEND=memory（默认）/prisma（目标态，需DB落地，见prisma/schema.prisma）。
 */
import { readIds, allReadVideos, intentOverrides, follows, competitors, seenEvents, dlq, syncJobs, activeAccountId, setActiveAccountId, pausedTasks, settings, videoTasks, customScripts, replyRules, replies, viewOf } from './store';
import { mockComments, mockAccounts, mockVideos, mockScripts } from './mock';
import { persistCollections } from './localData'; // S25b: 业务集合变更落盘
import type { Account, Video, CommentItem, Follow, Competitor, DlqItem } from './types';

export interface FollowInput { peer_nick: string; source_video_id: string; next_remind_at: string; status: string; amount?: number }
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
export interface FollowRepo { list(status: string): Follow[]; create(input: FollowInput): Follow; update(id: string, patch: { status?: string; amount?: number; tags?: string[]; note?: string }): Follow | null }
export interface CompetitorRepo { list(): Competitor[]; create(input: CompetitorInput): Competitor }
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
  update(patch: { service_name?: string; font_size?: number; theme_color?: string; price_list?: unknown }): Record<string, unknown>;
  setPassword(): string;
}
export interface VideoTask { id: string; video_id: string; title: string; follow: boolean; like_done: boolean; fav_done: boolean; paused: boolean; interval_min: number; last_check: string | null; created_at: string }
export interface VideoTaskRepo {
  list(): VideoTask[];
  create(video_id: string, title: string): VideoTask | null;
  update(id: string, patch: Partial<Pick<VideoTask, 'follow' | 'like_done' | 'fav_done' | 'paused' | 'interval_min'>>): VideoTask | null;
  remove(id: string): boolean;
}
export interface Script { id: string; category: string; title: string; content: string }
export interface ScriptRepo { list(): Script[]; create(category: string, title: string, content: string): Script | null; remove(id: string): boolean }
export interface ReplyRule { id: string; keyword: string; reply: string; enabled: boolean }
export interface ReplyRuleRepo {
  list(): ReplyRule[];
  create(keyword: string, reply: string): ReplyRule | null;
  update(id: string, patch: { reply?: string; enabled?: boolean }): ReplyRule | null;
  remove(id: string): boolean;
}
export interface Reply { id: string; comment_id: string; content: string; at: string }
export interface ReplyRepo { list(comment_id: string): Reply[]; create(comment_id: string, content: string): Reply | null }
export interface Repos { comments: CommentRepo; videos: VideoRepo; follows: FollowRepo; competitors: CompetitorRepo; events: EventRepo; sync: SyncRepo; accounts: AccountRepo; tasks: TaskRepo; settings: SettingsRepo; videoTasks: VideoTaskRepo; scripts: ScriptRepo; replyRules: ReplyRuleRepo; replies: ReplyRepo }

const memory: Repos = {
  videos: {
    list: (accountId) => mockVideos.filter((v) => v.account_id === accountId),
  },
  comments: {
    list: (f) => mockComments.map(viewOf).filter((c) => (!f.video_id || c.video_id === f.video_id) && (!f.intent || c.intent === f.intent) && (!f.keyword || c.content.includes(f.keyword)) && (!f.unreadOnly || !c.is_read_local)),
    markRead: (ids, valid) => { let n = 0; ids.forEach((id) => { if (valid.has(id)) { readIds.add(id); n++; } }); return n; },
    markAllRead: (videoId) => { allReadVideos.add(videoId); },
    setIntent: (id, patch) => { const next = { ...(intentOverrides.get(id) || {}), ...patch }; intentOverrides.set(id, next); return { id, ...next }; },
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
      if (patch.tags !== undefined) acts.push(`标签更新为「${patch.tags.join('、') || '无'}」`);
      if (patch.note !== undefined) acts.push('更新跟进纪要');
      if (patch.status !== undefined) f.status = patch.status;
      if (patch.amount !== undefined) f.amount = patch.amount;
      if (patch.tags !== undefined) f.tags = patch.tags;
      if (patch.note !== undefined) f.note = patch.note;
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
      return { shop_name: acc.nickname, service_name: settings.service_name, font_size: settings.font_size, theme_color: settings.theme_color, password_changed_at: settings.password_changed_at, price_list: settings.price_list };
    },
    update: (patch) => {
      if (typeof patch.service_name === 'string') settings.service_name = patch.service_name;
      if (typeof patch.font_size === 'number') settings.font_size = patch.font_size;
      if (typeof patch.theme_color === 'string') settings.theme_color = patch.theme_color;
      if (Array.isArray(patch.price_list)) settings.price_list = patch.price_list as { tier: string; price: string }[];
      persistCollections();
      const acc = mockAccounts.find((a) => a.id === activeAccountId) || mockAccounts[0];
      return { shop_name: acc.nickname, service_name: settings.service_name, font_size: settings.font_size, theme_color: settings.theme_color, password_changed_at: settings.password_changed_at, price_list: settings.price_list };
    },
    setPassword: () => { settings.password_changed_at = new Date().toISOString(); persistCollections(); return settings.password_changed_at as string; },
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
    list: () => [...mockScripts.map((s) => ({ ...s })), ...customScripts],
    create: (category, title, content) => {
      if (!title.trim() || !content.trim()) return null;
      const item = { id: `cs-${Date.now().toString(36)}`, category: category || '自定义', title: title.trim(), content: content.trim() };
      customScripts.push(item);
      persistCollections();
      return item;
    },
    remove: (id) => { const i = customScripts.findIndex((x) => x.id === id); if (i < 0) return false; customScripts.splice(i, 1); persistCollections(); return true; },
  },
  replyRules: {
    list: () => replyRules,
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
    remove: (id) => { const i = replyRules.findIndex((x) => x.id === id); if (i < 0) return false; replyRules.splice(i, 1); persistCollections(); return true; },
  },
  replies: {
    list: (comment_id) => replies.filter((r) => r.comment_id === comment_id),
    create: (comment_id, content) => {
      if (!content.trim()) return null;
      const item = { id: `rp-${Date.now().toString(36)}`, comment_id, content: content.trim(), at: new Date().toISOString().slice(5, 16).replace('T', ' ') };
      replies.push(item);
      persistCollections();
      return item;
    },
  },
};

/** 取当前后端（默认memory；prisma待DB接入后实现） */
export function getRepos(): Repos {
  const backend = process.env.DATA_BACKEND || 'memory';
  if (backend === 'memory') return memory;
  throw new Error(`DATA_BACKEND=${backend} 尚未接入，请先完成PG+Prisma落地（prisma/schema.prisma为目标态）`);
}
