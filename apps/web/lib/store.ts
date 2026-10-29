/** 内存态存储（P0 mock：同进程有效；S23起账号/导入/token持久化，S25b台账/回评等集合持久化；生产替换为Prisma，见01-architecture） */
import { hydrateCollections } from './localData'; // S23水合+S25b集合水合（模块尾部调用）
import './localData';
import { mockComments } from './mock';

/** 已读comment_id集合（本地协作态，不反写抖音） */
export const readIds = new Set<string>(mockComments.filter((c) => c.is_read_local).map((c) => c.id));
/** 全部标已读的video_id集合 */
export const allReadVideos = new Set<string>();
/** 意图/忽略覆盖 {commentId: {intent?, ignore?}} */
export const intentOverrides = new Map<string, { intent?: string; ignore?: boolean }>();
/** 跟进台账 */
export const follows: { id: string; peer_nick: string; source_video_id: string; next_remind_at: string; status: string; amount?: number; created_at?: string; tags?: string[]; note?: string; history?: { at: string; act: string }[] }[] = [
  { id: 'f1', peer_nick: '刀友老陈', source_video_id: 'v1', next_remind_at: '今天 18:00', status: '待回访' },
  { id: 'f2', peer_nick: '熬夜选手Lin', source_video_id: 'v1', next_remind_at: '明天', status: '已手动回复' },
];
/** 竞品手动导入 */
export const competitors: { id: string; source: string; url: string; play: number; like: number; remark: string; kind?: string; history?: { at: string; play: number; like: number }[] }[] = [
  { id: 'cp1', source: 'feigua', url: '竞品A · 跑刀代练', play: 890000, like: 42000, remark: '' },
  { id: 'cp2', source: 'manual', url: '同城店B · 契约陪玩', play: 120000, like: 5400, remark: '' },
];
/** webhook已处理event_id（幂等） */
export const seenEvents = new Set<string>();
/** webhook死信队列 */
export const dlq: { id: string; reason: string; at: string; body: string }[] = [];
/** 同步任务 */
export const syncJobs: { task_id: string; at: string }[] = [];
/** 当前主账号（多账号切换，默认acc_001） */
export let activeAccountId = 'acc_001';
export function setActiveAccountId(id: string) { activeAccountId = id; }
/** 已暂停的任务类型（任务中心启停，只含同步类任务） */
export const pausedTasks = new Set<string>();
/** 视频跟进队列（S20：只做跟进提醒+手动清单，不做自动点赞/评论/收藏，见docs/10-A4） */
export const videoTasks: { id: string; video_id: string; title: string; follow: boolean; like_done: boolean; fav_done: boolean; paused: boolean; interval_min: number; last_check: string | null; created_at: string }[] = [
  { id: 'vt1', video_id: 'v1', title: '三角洲跑刀实录 · 一局爆仓', follow: true, like_done: false, fav_done: false, paused: false, interval_min: 5, last_check: null, created_at: '10-09' },
];
/** 自定义话术（S20：用户自建，对齐ScriptItem） */
export const customScripts: { id: string; category: string; title: string; content: string; deleted?: boolean }[] = [];
/** 私信接待规则（S20：休眠配置，无企业号授权不执行，见docs/10-B7） */
export const replyRules: { id: string; keyword: string; reply: string; enabled: boolean; deleted?: boolean }[] = [
  { id: 'rr1', keyword: '价格', reply: '报价已私信发送，详询请留联系方式。', enabled: true },
];
/** 评论回评记账（S20：作者回评自有视频，mock本地记账；S86 variant=话术候选位次1-4供A/B实验） */
export const replies: { id: string; comment_id: string; content: string; at: string; variant?: number }[] = [];
/** S87 营销活动计划（人工执行checklist+期间复盘；执行永远人工，系统只跟踪） */
export const campaigns: import('./marketing').Campaign[] = [];
/** 系统设置（内存持久化：同进程有效，重启回默认；生产进DB。初值对齐settings.config） */
export const settings = {
  service_name: '跑刀代跑',
  font_size: 14,
  theme_color: '#1A1A18',
  password_changed_at: null as string | null,
  /** S69 访问密码scrypt哈希（null=未设置不锁；原文永不落盘） */
  password_hash: null as string | null,
  /** S74 评论自动回复总开关（三重门之一，默认关） */
  auto_reply_enabled: false as boolean,
  /** S104 开机自启（桌面壳主进程跟随此标志管理登录项；浏览器版无效果是正常） */
  desktop_autostart: false as boolean,
  /** S75 自动化统一配置原始对象（读取一律经mergeAutoCfg规范化） */
  auto_config: null as Record<string, unknown> | null,
  /** S45 价目表（档位→价格，话术{price}填充源） */
  price_list: [] as { tier: string; price: string }[],
  /** S93 评论保存视图（读写均过sanitizeViews钳制） */
  comment_views: [] as import('./commentViews').CommentView[],
};

export function isRead(c: { id: string; video_id: string; is_read_local: boolean }) {
  return c.is_read_local || readIds.has(c.id) || allReadVideos.has(c.video_id);
}

export function viewOf(c: (typeof mockComments)[number]) {
  const ov = intentOverrides.get(c.id);
  return { ...c, is_read_local: isRead(c), intent: ov?.intent || c.intent, ignore: ov?.ignore || false };
}

// S25b：业务集合水合（模块尾部，数组已定义）；repo变更点调persistCollections落盘；S68协作态一并注入
hydrateCollections({ follows, replies, competitors, videoTasks, settings, customScripts, replyRules, campaigns, readIds, allReadVideos, intentOverrides });
