/**
 * S26 开放平台响应映射（纯函数零依赖，scripts/port-test.js 直测）
 * 字段名按官方文档预写，联调时以真实响应复核（docs/12附录遗留项）
 */

export interface ApiVideoRaw {
  aweme_id?: string;
  desc?: string;
  create_time?: number;
  statistics?: { play_count?: number; digg_count?: number; comment_count?: number; share_count?: number };
}

export interface ApiCommentRaw {
  cid?: string;
  text?: string;
  create_time?: number;
  digg_count?: number;
  user?: { nickname?: string };
}

export interface MappedVideo {
  aweme_id: string;
  title: string;
  /** MM-DD 展示格式（对齐中台作品表） */
  publish_time: string;
  play: number;
  like: number;
  comment: number;
  share: number;
}

export interface MappedComment {
  comment_id: string;
  nick: string;
  content: string;
  like: number;
  /** 相对时间展示（对齐评论流） */
  create_time: string;
}

const num = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.floor(Number(n)) : 0);

function mmddFromSec(sec: number): string {
  if (!sec || sec <= 0) return '';
  const d = new Date(sec * 1000);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function relTimeFromSec(sec: number): string {
  if (!sec || sec <= 0) return '刚刚';
  const diff = Date.now() / 1000 - sec;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}天前`;
  return mmddFromSec(sec);
}

/** 作品映射：aweme_id/desc/create_time/statistics → 中台Video字段；无效数据返回null */
export function mapApiVideo(raw: ApiVideoRaw | null | undefined): MappedVideo | null {
  if (!raw || !raw.aweme_id) return null;
  const st = raw.statistics || {};
  return {
    aweme_id: String(raw.aweme_id),
    title: String(raw.desc || '').slice(0, 120) || `作品${raw.aweme_id.slice(-6)}`,
    publish_time: mmddFromSec(Number(raw.create_time || 0)) || '—',
    play: num(st.play_count),
    like: num(st.digg_count),
    comment: num(st.comment_count),
    share: num(st.share_count),
  };
}

/** 评论映射：cid/text/user.nickname/digg_count → 中台评论字段；无效数据返回null */
export function mapApiComment(raw: ApiCommentRaw | null | undefined): MappedComment | null {
  if (!raw || !raw.cid || !raw.text) return null;
  return {
    comment_id: String(raw.cid),
    nick: String(raw.user?.nickname || '抖音用户').slice(0, 24),
    content: String(raw.text).slice(0, 500),
    like: num(raw.digg_count),
    create_time: relTimeFromSec(Number(raw.create_time || 0)),
  };
}
