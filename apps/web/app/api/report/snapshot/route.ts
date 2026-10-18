export const dynamic = 'force-dynamic'; // S55: 快照写盘+实时聚合，禁静态预渲染
import { ok } from '@/lib/response';
import { mockComments } from '@/lib/mock';
import { getRepos } from '@/lib/repo';
import { appendBizToday } from '@/lib/businessHistory';

/** POST /api/report/snapshot（S55 经营报告页打开即记当日快照并返回历史；每日最多一条） */
export async function POST() {
  const follows = getRepos().follows.list('');
  const done = follows.filter((f) => f.status === '已转化');
  const snapshot = {
    comments: mockComments.length,
    high: mockComments.filter((c) => c.intent === '高意向').length,
    follows: follows.length,
    done: done.length,
    revenue: done.reduce((a, f) => a + (f.amount || 0), 0),
  };
  const history = appendBizToday(snapshot);
  return ok({ snapshot, history });
}
