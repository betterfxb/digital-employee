export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { page } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/webhooks/dlq（死信查看，经Repository） */
export async function GET() {
  return page(getRepos().events.dlq(), null);
}
