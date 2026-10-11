export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { page } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/videos?account_id（缺省取当前主账号，数据按账号隔离） */
export async function GET(req: Request) {
  const repos = getRepos();
  const { searchParams } = new URL(req.url);
  const aid = searchParams.get('account_id') || repos.accounts.getActive();
  return page(repos.videos.list(aid), null);
}
