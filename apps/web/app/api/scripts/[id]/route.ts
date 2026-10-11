import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** POST /api/scripts {category?,title,content}（自定义话术，见docs/10-A9） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.title?.trim() || !body?.content?.trim()) return fail('FATAL', '缺少 title/content');
  return ok(getRepos().scripts.create(body.category || '自定义', body.title, body.content));
}

/** DELETE /api/scripts/:id（仅自定义可删，内置返回404） */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const okDel = getRepos().scripts.remove(params.id);
  if (!okDel) return fail('FATAL', '不存在或为内置话术', 404);
  return ok({ removed: true, id: params.id });
}
