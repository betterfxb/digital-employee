import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { settingsConfig } from '@/config/settings.config';

/** POST /api/settings/password {new_password}（S69 实装：scrypt哈希落settings；空串=取消密码并清changed_at） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pwd = String(body?.new_password || '');
  if (pwd === '') {
    return ok({ changed: true, cleared: true, changed_at: getRepos().settings.setAccessPassword('') });
  }
  if (pwd.length < settingsConfig.passwordMinLen) return fail('FATAL', `新密码至少${settingsConfig.passwordMinLen}位`);
  return ok({ changed: true, changed_at: getRepos().settings.setAccessPassword(pwd) });
}
