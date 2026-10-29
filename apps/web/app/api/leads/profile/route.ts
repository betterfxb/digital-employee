export const dynamic = 'force-dynamic'; // S109: 实时内存态聚合，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/**
 * GET /api/leads/profile?nick=（S109 线索360档案：按昵称跨集合聚合）
 * 返回 {nick, comments[], replies[], follows[], stats}——评论史/回评史/跟进史/成交汇总
 * 时间口径：stats 只用 ISO 可信字段（follows created_at/history）；评论 create_time 原样展示不参与计算（S29）
 */
export async function GET(req: Request) {
  const nick = new URL(req.url).searchParams.get('nick')?.trim();
  if (!nick) return fail('FATAL', '缺少 nick 参数', 400);
  const repos = getRepos();
  const comments = repos.comments.list({ video_id: '', intent: '', keyword: '', unreadOnly: false }).filter((c) => c.user_nick === nick).slice(0, 30);
  const cids = new Set(comments.map((c) => c.id));
  const replies = repos.replies.all().filter((r) => cids.has(r.comment_id)).slice(0, 30);
  const follows = repos.follows.list('').filter((f) => f.peer_nick === nick);
  const done = follows.filter((f) => f.status === '已转化');
  const amountSum = done.reduce((a, f) => a + (Number(f.amount) || 0), 0);
  const times = follows.flatMap((f) => [f.created_at, ...(f.history || []).map((h) => h.at)].filter(Boolean) as string[]).sort();
  return ok({
    nick,
    comments,
    replies,
    follows,
    stats: {
      comments_n: comments.length,
      high_n: comments.filter((c) => c.intent === '高意向').length,
      replied_n: replies.length,
      follows_n: follows.length,
      done_n: done.length,
      amount_sum: amountSum,
      first_touch: times[0] || null,
      last_touch: times[times.length - 1] || null,
    },
  });
}
