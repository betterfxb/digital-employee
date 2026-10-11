export const dynamic = 'force-dynamic'; // S20: 内存态读接口禁静态预渲染
import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/reply-rules（私信接待规则，休眠配置，无企业号授权不执行，见docs/10-B7） */
export async function GET() {
  return page(getRepos().replyRules.list(), null);
}

/** POST /api/reply-rules {keyword,reply} */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.keyword?.trim() || !body?.reply?.trim()) return fail('FATAL', '缺少 keyword/reply');
  return ok(getRepos().replyRules.create(body.keyword, body.reply));
}
