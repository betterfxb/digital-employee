export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/**
 * GET /api/stats/overview — S23b: 播放/点赞/评论按当前账号作品实时聚合（导入真数据即反映）
 * 粉丝两项与环比为mock口径（官方仅T+1粉丝接口，live接入后替换），note随响应用于UI标注
 */
export async function GET() {
  const repos = getRepos();
  const videos = repos.videos.list(repos.accounts.getActive());
  return ok({
    play: videos.reduce((a, v) => a + v.play, 0),
    like: videos.reduce((a, v) => a + v.like, 0),
    comment: videos.reduce((a, v) => a + v.comment, 0),
    fans_new: 342,
    fans_total: 48201,
    mom_play: 12.4,
    mom_like: 6.1,
    date: '昨天',
    note: '作品口径实时聚合 · 粉丝/环比为mock口径',
  });
}
