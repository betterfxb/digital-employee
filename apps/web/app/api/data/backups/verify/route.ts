export const dynamic = 'force-dynamic'; // 读备份文件+内存实况比对，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { readBackup, listBackups } from '@/lib/autoBackup';
import { isSaneState, countsOf, diffCounts } from '@/lib/repair';
import { currentCounts } from '@/lib/localData';

const ZH: Record<string, string> = { accounts: '授权账号', videos: '作品', comments: '评论', follows: '跟进线索', replies: '回评', campaigns: '活动', drafts: '草稿' };

/**
 * S141 备份演练：GET /api/data/backups/verify[?name=]（缺省=最近一份）
 * 白名单读取→解析→isSaneState 验身→与当前内存态逐集合比数。
 * lost=备份比当前多出的条数——业务数据无正常删除路径，多=流失嫌疑（S122 只管解析失败，这里堵静默变少）。
 */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') || '';
  let target = name;
  if (!target) {
    const latest = listBackups()[0];
    if (!latest) return fail('FATAL', '还没有任何备份文件（先去备份一份）', 404);
    target = latest.name;
  }
  const r = readBackup(target);
  if ('error' in r) return fail('FATAL', r.error, 400);
  let data: unknown = null;
  try { data = JSON.parse(r.body); } catch {
    return ok({ name: target, sane: false, parseable: false, lostTotal: 0, diff: [] });
  }
  const sane = isSaneState(data);
  const diff = diffCounts(currentCounts(), countsOf(data))
    .filter((d) => d.now >= 0 && d.snap >= 0)
    .map((d) => ({ ...d, label: ZH[d.key] || d.key }));
  return ok({ name: target, sane, parseable: true, lostTotal: diff.reduce((s, d) => s + d.lost, 0), diff });
}
