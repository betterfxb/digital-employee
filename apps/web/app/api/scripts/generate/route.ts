import { page, fail } from '@/lib/response';
import { generateReply } from '@/lib/templates';

/** POST /api/scripts/generate {content,intent,nick,product,video_title}（S28 三段式智能回复候选，人工确认后发送） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return fail('FATAL', '请求体不是合法JSON');
  const items = generateReply({
    content: String(body.content || ''),
    intent: String(body.intent || '普通'),
    nick: String(body.nick || ''),
    product: String(body.product || ''),
    videoTitle: String(body.video_title || ''),
    tone: String(body.tone || ''), // S33 口吻：亲切(默认)/专业/简洁
  });
  return page(items, null);
}
