import { ok } from '@/lib/response';
import { mockAccount } from '@/lib/mock';
import { saveToken } from '@/lib/tokenVault';

/** GET /api/auth/poll?state&t（P0 mock：t>=2成功并落加密token；t为演示计数器，生产换真授权码） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state') || 'demo';
  const waited = Number(searchParams.get('t') || 0);
  if (waited < 2) return ok({ status: 'pending', state });
  saveToken(mockAccount.id, `mock-token-${state}`);
  return ok({ status: 'success', state, account: mockAccount });
}
