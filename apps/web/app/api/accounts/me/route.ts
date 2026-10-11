export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { hasToken } from '@/lib/tokenVault';

/** GET /api/accounts/me（返回当前主账号；token_bound自证加密保管链路通，不泄露原文） */
export async function GET() {
  const acc = getRepos().accounts.getActiveAccount();
  return ok({ ...acc, token_bound: hasToken(acc.id) });
}
