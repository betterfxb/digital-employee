/**
 * S93 评论保存视图纯函数层（零依赖，前后端同用可单测）
 * 视图=一套常用筛选预设（关键词/意图/只看未读），持久化在 settings.comment_views
 * 防御口径同mergeAutoCfg：越界钳制、坏项丢弃、总量封顶——脏数据免疫
 */
export interface CommentView { name: string; kw: string; intent: string; unreadOnly: boolean }

const MAXV = 8;

export function sanitizeViews(input: unknown): CommentView[] {
  if (!Array.isArray(input)) return [];
  const out: CommentView[] = [];
  const seen = new Set<string>();
  for (const raw of input.slice(0, MAXV * 2)) {
    if (!raw || typeof raw !== 'object') continue;
    const v = raw as Record<string, unknown>;
    const name = String(v.name ?? '').trim().slice(0, 12);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      kw: String(v.kw ?? '').trim().slice(0, 20),
      intent: String(v.intent ?? '').trim().slice(0, 8),
      unreadOnly: v.unreadOnly === true,
    });
    if (out.length >= MAXV) break;
  }
  return out;
}
