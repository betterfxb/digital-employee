export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { getLastImportAt } from '@/lib/localData'; // S125

/**
 * GET /api/stats/overview[?all=1] — 播放/点赞/评论按作品实时聚合（导入真数据即反映）
 * S29: 删除粉丝/环比等无接口支撑的硬编码假指标，只返回真实聚合
 * S63: ?all=1 → 全部账号汇总（含每账号明细行），无则当前账号
 */
export async function GET(req: Request) {
  const repos = getRepos();
  if (new URL(req.url).searchParams.get('all') === '1') {
    const accs = repos.accounts.list();
    let play = 0; let like = 0; let comment = 0; let share = 0;
    const accounts = accs.map((a) => {
      const vs = repos.videos.list(a.id);
      const row = {
        id: a.id,
        nick: a.nickname,
        videos: vs.length,
        play: vs.reduce((s, v) => s + v.play, 0),
        like: vs.reduce((s, v) => s + v.like, 0),
        comment: vs.reduce((s, v) => s + v.comment, 0),
        share: vs.reduce((s, v) => s + v.share, 0),
      };
      play += row.play; like += row.like; comment += row.comment; share += row.share;
      return row;
    });
    return ok({ play, like, comment, share, note: `全部账号汇总 · ${accs.length}个账号`, accounts, last_import_at: getLastImportAt() ?? null });
  }
  const videos = repos.videos.list(repos.accounts.getActive());
  return ok({
    play: videos.reduce((a, v) => a + v.play, 0),
    like: videos.reduce((a, v) => a + v.like, 0),
    comment: videos.reduce((a, v) => a + v.comment, 0),
    note: '作品口径实时聚合',
    last_import_at: getLastImportAt() ?? null, // S125 新鲜度提醒（本机导入事件，非平台字段）
  });
}
