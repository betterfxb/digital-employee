/**
 * S140 月度经营复盘纯函数（零IO，入 crypto 单测）：
 * 本月 vs 上月六项对照，全部来自本机 ISO 事件（建档时间+操作历史），零平台依赖。
 * 诚实口径：history 每客户环形保20条——更早月份的动作可能被截断，宁漏不造；
 * 金额取动作值（「记成交 ¥x」「记成本 ¥x」分段），不取"当前值回填历史"。
 */

export interface MFollow { created_at?: string; history?: { at: string; act: string }[] }
export interface MMetric { key: string; label: string; cur: number; prev: number; money?: boolean }

const mkey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const prevKey = (k: string) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

interface Bucket { leads: number; acts: number; deals: number; amount: number; cost: number; rep: number }

export function buildMonthReview(follows: MFollow[], now = Date.now()): { month: string; prevMonth: string; metrics: MMetric[] } {
  const cur = mkey(now); const prev = prevKey(cur);
  const acc: Record<string, Bucket> = {
    [cur]: { leads: 0, acts: 0, deals: 0, amount: 0, cost: 0, rep: 0 },
    [prev]: { leads: 0, acts: 0, deals: 0, amount: 0, cost: 0, rep: 0 },
  };
  for (const f of follows) {
    if (f.created_at) { const t = Date.parse(f.created_at); if (!Number.isNaN(t) && acc[mkey(t)]) acc[mkey(t)].leads++; }
    const dealCount: Record<string, number> = {};
    for (const h of f.history || []) {
      const t = Date.parse(h.at);
      if (Number.isNaN(t)) continue;
      const b = acc[mkey(t)];
      if (!b) continue;
      b.acts++;
      for (const seg of (h.act || '').split('；')) {
        const s = seg.trim();
        const md = /^记成交 ¥(\d+(?:\.\d+)?)$/.exec(s);
        if (md) { b.deals++; b.amount += Number(md[1]); const k = mkey(t); dealCount[k] = (dealCount[k] || 0) + 1; }
        const mc = /^记成本 ¥(\d+(?:\.\d+)?)$/.exec(s);
        if (mc) b.cost += Number(mc[1]);
      }
    }
    for (const k of Object.keys(dealCount)) if (dealCount[k] >= 2) acc[k].rep++;
  }
  return {
    month: cur, prevMonth: prev,
    metrics: [
      { key: 'leads', label: '新增线索', cur: acc[cur].leads, prev: acc[prev].leads },
      { key: 'acts', label: '跟进动作', cur: acc[cur].acts, prev: acc[prev].acts },
      { key: 'deals', label: '成交笔数', cur: acc[cur].deals, prev: acc[prev].deals },
      { key: 'amount', label: '成交金额', cur: acc[cur].amount, prev: acc[prev].amount, money: true },
      { key: 'cost', label: '记成本额', cur: acc[cur].cost, prev: acc[prev].cost, money: true },
      { key: 'rep', label: '复购客户', cur: acc[cur].rep, prev: acc[prev].rep },
    ],
  };
}
