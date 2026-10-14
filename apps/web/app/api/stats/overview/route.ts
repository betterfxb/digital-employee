export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/**
 * GET /api/stats/overview — 播放/点赞/评论按当前账号作品实时聚合（导入真数据即反映）
 * S29: 删除粉丝/环比等无接口支撑的硬编码假指标，只返回真实聚合
 */
export async function GET() {
  const repos = getRepos();
  const videos = repos.videos.list(repos.accounts.getActive());
  return ok({
    play: videos.reduce((a, v) => a + v.play, 0),
    like: videos.reduce((a, v) => a + v.like, 0),
    comment: videos.reduce((a, v) => a + v.comment, 0),
    note: '作品口径实时聚合',
  });
}
