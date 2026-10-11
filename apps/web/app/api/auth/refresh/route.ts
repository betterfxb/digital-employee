import { ok } from '@/lib/response';

/** POST /api/auth/refresh（P0 mock：延长30天；生产需加Redis刷新锁，见01-architecture） */
export async function POST() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return ok({ expires_at: d.toISOString().slice(0, 10), refreshed: true });
}
