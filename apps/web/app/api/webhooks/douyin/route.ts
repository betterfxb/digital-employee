import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/**
 * POST /api/webhooks/douyin（P0桩：验签+幂等+DLQ形态，生产再接真实密钥）
 * 规则：缺 x-signature 头 → 401 FATAL；重复 event_id → deduped:true；非法JSON → 进DLQ并返回RETRYABLE
 */
export async function POST(req: Request) {
  const sig = req.headers.get('x-signature');
  if (!sig) return fail('FATAL', '缺少 x-signature', 401);
  const text = await req.text();
  let body: { event_id?: string; comment_id?: string } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    getRepos().events.pushDlq('JSON解析失败', text);
    return fail('RETRYABLE', 'body非法，已进DLQ', 400);
  }
  const event_id = body?.event_id || body?.comment_id || text.slice(0, 64);
  const first = getRepos().events.receive(event_id);
  return ok({ received: true, deduped: !first, event_id });
}
