export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { statsConfig } from '@/config/stats.config';

/** GET /api/competitors（手动导入区，经Repository） */
export async function GET() {
  return page(getRepos().competitors.list(), null);
}

/** 采集槽位：note笔记/author作者/comment评论/user用户（手动导入形态，见docs/10-A2） */
const KINDS = ['note', 'author', 'comment', 'user'];

/** POST /api/competitors {url, source, remark?, kind?}（source必须在competitorSources内；kind默认note） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.url || !body?.source) return fail('FATAL', '缺少 url/source');
  if (!statsConfig.competitorSources.includes(body.source)) return fail('FATAL', `来源非法，仅支持 ${statsConfig.competitorSources.join('/')}`);
  const kind = body.kind || 'note';
  if (!KINDS.includes(kind)) return fail('FATAL', `槽位非法，仅支持 ${KINDS.join('/')}`);
  return ok(getRepos().competitors.create({ source: body.source, url: body.url, remark: body.remark || '', kind }));
}
