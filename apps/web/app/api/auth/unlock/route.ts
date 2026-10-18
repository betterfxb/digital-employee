export const dynamic = 'force-dynamic'; // S69: 每次校验读内存settings，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { verifyPassword } from '@/lib/accessPw';

/** POST /api/auth/unlock {password}（S69 本地访问密码解锁；未设置密码直接放行） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const hash = (getRepos().settings.get() as { password_hash?: string | null }).password_hash;
  if (!hash) return ok({ unlocked: true, required: false });
  const pw = String(body?.password || '');
  if (!verifyPassword(pw, hash)) return fail('FATAL', '密码错误', 401);
  return ok({ unlocked: true, required: true });
}
