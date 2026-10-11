import { page } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/comments?video_id&intent&keyword&unread_only&cursor（经Repository，默认内存实现） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kw = searchParams.get('keyword') || '';
  const unread = searchParams.get('unread_only') === '1';
  let items = getRepos().comments.list({ video_id: searchParams.get('video_id') || '', intent: searchParams.get('intent') || '', keyword: kw, unreadOnly: unread });
  return page(items, null);
}
