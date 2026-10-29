/**
 * S14d 共享领域类型：页面/路由/仓库统一引用，逐步替换any
 * 字段对齐docs/03契约与mock数据；新增字段先改此处再改mock。
 */
export interface Account {
  id: string; open_id_mask: string; nickname: string; avatar: string;
  auth_type: string; expires_at: string; days_left: number; active?: boolean;
}

export interface Video {
  id: string; account_id: string; aweme_id: string; title: string; cover: string;
  publish_time: string; play: number; like: number; comment: number; share: number;
}

export interface CommentItem {
  id: string; comment_id: string; video_id: string; user_nick: string; content: string;
  like_count: number; create_time: string; is_read_local: boolean; intent: string;
  keywords: string[]; ignore?: boolean;
}

export interface Follow {
  id: string; peer_nick: string; source_video_id: string; next_remind_at: string; status: string;
  /** S43 成交记账：已转化客户可记成交金额（元）与登记时间 */
  amount?: number;
  created_at?: string;
  /** S48 线索标签（自定义，≤10个每个≤8字） */
  tags?: string[];
  /** S49 跟进纪要 */
  note?: string;
  /** S115 联系方式（电话/微信，≤32字；仅本机存储） */
  contact?: string;
  /** S49 操作历史（最新在前，环形20条） */
  history?: { at: string; act: string }[];
}

export interface Competitor {
  id: string; source: string; url: string; play: number; like: number; remark: string; kind?: string;
  /** S53 竞品记录历史（每次手动更新留痕，最新在前，环形20条）：看变化趋势 */
  history?: { at: string; play: number; like: number }[];
}

export interface ScriptItem { id: string; category: string; title: string; content: string; deleted?: boolean; /** S107 使用计数与置顶（仅自定义话术） */ used?: number; pinned?: boolean }

export interface TemplateItem { id: string; intent: string; scene: string; content: string }

export interface TaskItem {
  no: number; type: string; label: string; paused: boolean;
  lastRun: string | null; nextInMin: number; priority: number;
}

export interface TrendPoint { date: string; play: number; like: number }

export interface PageResult<T> { items: T[]; next_cursor: string | null; has_more: boolean }

export interface VideoTask { id: string; video_id: string; title: string; follow: boolean; like_done: boolean; fav_done: boolean; paused: boolean; interval_min: number; last_check: string | null; created_at: string }

export interface DlqItem { id: string; reason: string; at: string; body: string }

export interface AuthLogItem { at: string; op: string; by: string; result: string }

export interface Overview { play: number; like: number; comment: number; note?: string; share?: number; accounts?: { id: string; nick: string; videos: number; play: number; like: number; comment: number; share: number }[]; last_import_at?: string | null }
