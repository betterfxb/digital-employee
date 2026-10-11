import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** POST /api/accounts/switch {id}（切换主账号，数据按账号隔离展示） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.id) return fail('FATAL', '缺少 id');
  const okSwitch = getRepos().accounts.switch(body.id);
  if (!okSwitch) return fail('FATAL', '账号不存在');
  return ok({ active_id: body.id });
}
