/**
 * S50 智能日报/周报（规则版聚合，全部来自本地真实数据，零依赖可单测）
 * - parseCommentTime：解析评论时间（相对"2小时前/昨天"、MM-DD、ISO）到绝对时刻
 * - buildReport：指标网格 + 文字总结 + 行动建议（daily=全量快照+今日动态；weekly=近7天增量）
 */
import { leadScore } from './leadScore';

export interface ReportInput {
  videos: { play: number; like: number; comment: number; publish_time: string }[];
  comments: { intent: string; like_count: number; content: string; keywords: string[]; create_time: string; is_read_local: boolean }[];
  follows: { status: string; amount?: number; created_at?: string }[];
  now?: number;
}

export function parseCommentTime(s: string, now = Date.now()): Date | null {
  if (!s) return null;
  const rel = s.match(/^(\d+)\s*分钟前?$/); if (rel) return new Date(now - Number(rel[1]) * 60_000);
  const h = s.match(/^(\d+)\s*小时前?$/); if (h) return new Date(now - Number(h[1]) * 3_600_000);
  if (/^昨天/.test(s)) { const d = new Date(now); d.setDate(d.getDate() - 1); return d; }
  if (/^今天/.test(s)) return new Date(now);
  const md = s.match(/^(\d{1,2})-(\d{1,2})/);
  if (md) { const d = new Date(now); d.setMonth(Number(md[1]) - 1, Number(md[2])); d.setHours(12, 0, 0, 0); return d; }
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

const WEEK = 7 * 86_400_000;

export interface Report {
  metrics: { label: string; value: string }[];
  summary: string;
  suggestions: string[];
}

export function buildReport(input: ReportInput, kind: 'daily' | 'weekly'): Report {
  const now = input.now ?? Date.now();
  const { videos, comments, follows } = input;
  const inWindow = (t: number | null) => !!t && (kind === 'daily' ? t >= now - 86_400_000 : t >= now - WEEK);

  const play = videos.reduce((a, v) => a + (v.play || 0), 0);
  const like = videos.reduce((a, v) => a + (v.like || 0), 0);
  const high = comments.filter((c) => c.intent === '高意向');
  const unread = comments.filter((c) => !c.is_read_local);
  const done = follows.filter((f) => f.status === '已转化');
  const revenue = done.reduce((a, f) => a + (f.amount || 0), 0);
  const rate = follows.length ? Math.round((done.length / follows.length) * 100) : 0;

  const newComments = comments.filter((c) => { const t = parseCommentTime(c.create_time, now); return inWindow(t ? t.getTime() : null); });
  const newFollows = follows.filter((c) => inWindow(c.created_at ? new Date(c.created_at).getTime() : null));
  const topLead = [...comments].sort((a, b) => leadScore(b) - leadScore(a))[0];

  const metrics: { label: string; value: string }[] = [
    { label: '作品数', value: String(videos.length) },
    { label: kind === 'daily' ? '总播放' : '总播放(累计)', value: play.toLocaleString() },
    { label: '总点赞', value: like.toLocaleString() },
    { label: '点赞率', value: play ? `${((like / play) * 100).toFixed(1)}%` : '—' },
    { label: '评论总数', value: String(comments.length) },
    { label: '高意向', value: String(high.length) },
    { label: '未读', value: String(unread.length) },
    { label: '待回访', value: String(follows.filter((f) => f.status === '待回访').length) },
    { label: '成交额', value: `¥${revenue.toLocaleString()}` },
    { label: '转化率', value: `${rate}%` },
    ...(kind === 'weekly'
      ? [{ label: '近7天新评论', value: String(newComments.length) }, { label: '近7天新跟进', value: String(newFollows.length) }]
      : [{ label: '今日新跟进', value: String(newFollows.length) }]),
  ];

  const period = kind === 'daily' ? '今日' : '近7天';
  const summary =
    `${period}概览：作品${videos.length}条（播放${play.toLocaleString()}·点赞${like.toLocaleString()}），评论${comments.length}条，其中高意向${high.length}条、未读${unread.length}条。` +
    `线索侧：跟进${follows.length}条（待回访${follows.filter((f) => f.status === '待回访').length}·已转化${done.length}），成交额¥${revenue.toLocaleString()}，转化率${rate}%，${period}新增跟进${newFollows.length}条。` +
    (topLead ? `当前最强线索：「${topLead.content.slice(0, 18)}${topLead.content.length > 18 ? '…' : ''}」（意向分${leadScore(topLead)}）。` : '') +
    (unread.length ? `还有${unread.length}条未读评论待处理。` : '评论已全部处理。');

  const suggestions: string[] = [];
  const pending = follows.filter((f) => f.status === '待回访').length;
  if (pending > 0) suggestions.push(`有${pending}条线索在待回访，今天先清一轮（台账按提醒时间排序处理）`);
  if (high.length > 0 && unread.length > 0) suggestions.push('高意向评论优先回，拖久了客户就凉了');
  if (play > 0 && like / play >= 0.05) suggestions.push('点赞率超5%，内容方向对，保持更新节奏');
  if (revenue > 0) suggestions.push(`累计成交¥${revenue.toLocaleString()}，把成交客户加标签做回头客运营`);
  if (!suggestions.length) suggestions.push('数据量还小，先导入更多作品与评论，报告会更有参考价值');

  return { metrics, summary, suggestions };
}
