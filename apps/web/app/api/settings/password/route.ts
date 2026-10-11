import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { settingsConfig } from '@/config/settings.config';

/** POST /api/settings/password {new_password}（mock：只记changed_at，不存原文；生产进鉴权+哈希） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pwd = String(body?.new_password || '');
  if (pwd.length < settingsConfig.passwordMinLen) return fail('FATAL', `新密码至少${settingsConfig.passwordMinLen}位`);
  return ok({ changed: true, changed_at: getRepos().settings.setPassword() });
}
