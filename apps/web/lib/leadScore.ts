/**
 * S48 线索意向评分（规则版，本地零依赖）：
 * score = 意图基分 + 点赞分 + 关键词分 + 留资分，0-100 封顶
 * 展示于评论工作台（帮运营先处理高分线索）；纯函数可单测
 */
import type { CommentItem } from './types';

const INTENT_BASE: Record<string, number> = { 高意向: 40, 留电话: 30, 咨询: 20, 普通: 5, 垃圾: 0 };

/** 关键词命中分（价格/下单/联系类是强信号） */
const HOT_RE = /(多少钱|价格|收费|怎么下单|接单|带带|上车|留.*联系方式|电话|微信|v我)/;

export function leadScore(c: Pick<CommentItem, 'intent' | 'like_count' | 'content' | 'keywords'>): number {
  let s = INTENT_BASE[c.intent] ?? 5;
  s += Math.min(20, Math.max(0, c.like_count || 0));
  if (HOT_RE.test(c.content || '')) s += 25;
  if ((c.keywords || []).some((k) => /价格|下单|电话|联系/.test(k))) s += 15;
  return Math.min(100, s);
}

/** 分档色（高>=70 中>=40 低） */
export function scoreLevel(score: number): 'high' | 'mid' | 'low' {
  return score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
}
