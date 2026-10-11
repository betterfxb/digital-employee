export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/scripts?type=私信（P0 mock：全量返回，type仅透传） */
export async function GET() {
  return page(getRepos().scripts.list(), null);
}

/** POST /api/scripts {category?,title,content}（自定义话术，见docs/10-A9） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.title?.trim() || !body?.content?.trim()) return fail('FATAL', '缺少 title/content');
  return ok(getRepos().scripts.create(body.category || '自定义', body.title, body.content));
}
