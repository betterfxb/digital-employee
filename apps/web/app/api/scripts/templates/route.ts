import { page } from '@/lib/response';
import { renderTemplates } from '@/lib/templates';
import { priceText } from '@/lib/price';

/** GET /api/scripts/templates?intent&nick&product（意图文案模板，变量填充，垃圾意图返回处理建议；S45带价目表） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const items = renderTemplates(
    searchParams.get('intent') || '普通',
    searchParams.get('nick') || '',
    searchParams.get('product') || '',
    priceText()
  );
  return page(items, null);
}
