export const dynamic = 'force-dynamic'; // S20: 内存态读接口禁静态预渲染
import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { mockVideos } from '@/lib/mock';

/** GET /api/video-tasks（视频跟进队列，只做提醒+手动清单，见docs/10-A3/A4） */
export async function GET() {
  return page(getRepos().videoTasks.list(), null);
}

/** POST /api/video-tasks {video_id}（仅自有视频，重复加入→FATAL） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = mockVideos.find((x) => x.id === body?.video_id);
  if (!v) return fail('FATAL', '视频不存在（仅支持自有视频）');
  const item = getRepos().videoTasks.create(v.id, v.title);
  if (!item) return fail('FATAL', '该视频已在队列中');
  return ok(item);
}
