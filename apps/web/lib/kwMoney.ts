/**
 * S144 关键词→钱纯函数（零IO，入 crypto 单测）：
 * 把评论关键词与成交链乘起来——哪个词背后站着肯掏钱的客户。
 * 链路口径（全部本机可信）：关键词→命中该词的评论→评论昵称进活跃台账→已转化现值金额。
 * 诚实标注：昵称匹配是近似；同一客户可命中多词，行间金额有重叠（宁标不藏）。
 */

export interface KWComment { user_nick: string; keywords?: string[]; intent?: string }
export interface KWFollow { peer_nick: string; status: string; amount?: number; source?: string }
export interface KWRow { kw: string; comments: number; hi: number; leads: number; deals: number; amount: number }

export function buildKwMoney(comments: KWComment[], follows: KWFollow[]): KWRow[] {
  const active = new Map<string, KWFollow>();
  for (const f of follows) if (f.status !== '无效' && !f.source) active.set(f.peer_nick, f); // 导入线索无真实来源评论，不进钱链
  const by = new Map<string, KWRow>();
  const people = new Map<string, Set<string>>(); // 每词去重人名集（钱按人计不按评论计，防同人多评重复入账）
  for (const c of comments) {
    for (const k of c.keywords || []) {
      const row = by.get(k) || { kw: k, comments: 0, hi: 0, leads: 0, deals: 0, amount: 0 };
      row.comments++;
      if (c.intent === '高意向' || c.intent === '留电话') row.hi++;
      const f = active.get(c.user_nick);
      if (f) {
        let s = people.get(k);
        if (!s) { s = new Set(); people.set(k, s); }
        if (!s.has(c.user_nick)) {
          s.add(c.user_nick);
          row.leads++;
          if (f.status === '已转化') { row.deals++; row.amount += Number(f.amount) || 0; }
        }
      }
      by.set(k, row);
    }
  }
  return [...by.values()].sort((a, b) => b.amount - a.amount || b.deals - a.deals || b.leads - a.leads || b.comments - a.comments);
}
