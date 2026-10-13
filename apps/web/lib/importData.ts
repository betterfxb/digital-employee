/**
 * S26 数据upsert共享层：CSV导入路由与live同步（lib/liveSync）共用
 * 作品按「账号+aweme_id（live真值）或标题+发布时间（CSV）」upsert；评论按「视频+aweme_id或昵称+内容」upsert
 */
import { mockVideos, mockComments } from './mock';
import { rememberVideo, rememberComment, hash6 } from './localData';
import { classifyIntent } from './classify';
import type { Video, CommentItem } from './types';

export interface VideoUpsertInput {
  aweme_id?: string;
  title: string;
  publish_time?: string;
  play: number;
  like: number;
  comment: number;
  share: number;
}

export interface UpsertCount { created: number; updated: number; skipped: number }

export function upsertVideo(aid: string, v: VideoUpsertInput): UpsertCount {
  const title = v.title.trim();
  if (!title) return { created: 0, updated: 0, skipped: 1 };
  const pt = v.publish_time?.trim() || `${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const stats = { play: v.play, like: v.like, comment: v.comment, share: v.share };
  const exist = v.aweme_id
    ? mockVideos.find((x) => x.account_id === aid && x.aweme_id === v.aweme_id)
    : mockVideos.find((x) => x.id.startsWith('imp-') && x.account_id === aid && x.title === title && x.publish_time === pt);
  if (exist) {
    Object.assign(exist, stats, { title, publish_time: pt });
    rememberVideo(exist);
    return { created: 0, updated: 1, skipped: 0 };
  }
  const vid: Video = {
    id: v.aweme_id ? `imp-${hash6(aid + v.aweme_id)}` : `imp-${hash6(aid + title + pt)}`,
    account_id: aid,
    aweme_id: v.aweme_id || `imp_aw_${hash6(aid + title)}`,
    title,
    cover: '',
    publish_time: pt,
    ...stats,
  };
  mockVideos.push(vid);
  rememberVideo(vid);
  return { created: 1, updated: 0, skipped: 0 };
}

export interface CommentUpsertInput {
  video_id?: string;
  video_title?: string;
  comment_id?: string;
  nick: string;
  content: string;
  like: number;
  time?: string;
}

export function upsertComment(aid: string, c: CommentUpsertInput): UpsertCount {
  const nick = c.nick.trim();
  const content = c.content.trim();
  if (!nick || !content) return { created: 0, updated: 0, skipped: 1 };
  const video = c.video_id
    ? mockVideos.find((v) => v.id === c.video_id)
    : mockVideos.find((v) => v.account_id === aid && v.title === (c.video_title || ''));
  if (!video) return { created: 0, updated: 0, skipped: 1 };
  const { intent, keywords } = classifyIntent(content);
  const exist = c.comment_id
    ? mockComments.find((x) => x.comment_id === c.comment_id)
    : mockComments.find((x) => x.id.startsWith('imp-') && x.video_id === video.id && x.user_nick === nick && x.content === content);
  if (exist) {
    exist.like_count = c.like;
    exist.intent = intent;
    exist.keywords = keywords;
    rememberComment(exist);
    return { created: 0, updated: 1, skipped: 0 };
  }
  const item: CommentItem = {
    id: `imp-${hash6(video.id + (c.comment_id || '') + nick + content)}`,
    comment_id: c.comment_id || `imp_cm_${hash6(nick + content)}`,
    video_id: video.id,
    user_nick: nick,
    content,
    like_count: c.like,
    create_time: c.time?.trim() || '刚刚',
    is_read_local: false,
    intent,
    keywords,
  };
  mockComments.push(item);
  rememberComment(item);
  return { created: 1, updated: 0, skipped: 0 };
}
