export const dynamic = 'force-dynamic'; // S20: 内存态读接口禁静态预渲染
import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/reply-rules?trash=1（S57 trash=1 返回回收站已删规则） */
export async function GET(req: Request) {
  const trash = new URL(req.url).searchParams.get('trash') === '1';
  return page(getRepos().replyRules.list(trash ? 'trash' : 'active'), null);
}

/** POST /api/reply-rules {keyword,reply} */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.keyword?.trim() || !body?.reply?.trim()) return fail('FATAL', '缺少 keyword/reply');
  return ok(getRepos().replyRules.create(body.keyword, body.reply));
}
