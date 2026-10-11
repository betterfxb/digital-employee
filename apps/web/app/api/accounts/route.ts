export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/accounts（多账号列表，maxAccountsPerTenant=5内，附active_id） */
export async function GET() {
  const repos = getRepos();
  return ok({ items: repos.accounts.list(), active_id: repos.accounts.getActive() });
}
