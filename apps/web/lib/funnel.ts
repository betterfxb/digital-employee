/**
 * S124 转化漏斗纯函数（零IO，入 crypto 单测）：
 * 评论 → 意向 → 已读处理 → 登记台账 → 成交，五级漏斗=「钱漏在哪一环」。
 * 口径诚实（S29延续）：匹配靠昵称（无可靠ID）；「已读」是本机协作态；
 * 时间字段不参与任何计算。所有层级单调收窄（后级必≤前级），防昵称口径出现倒挂。
 */

type FunComment = { user_nick: string; intent: string; is_read_local: boolean };
type FunFollow = { peer_nick: string; status: string };

export interface FunnelTier { key: string; label: string; n: number; hint: string }

const HI = ['高意向', '留电话'];

export function buildFunnel(comments: FunComment[], follows: FunFollow[]): FunnelTier[] {
  const active = follows.filter((f) => f.status !== '无效');
  const activeNicks = new Set(active.map((f) => f.peer_nick));
  const doneNicks = new Set(active.filter((f) => f.status === '已转化').map((f) => f.peer_nick));
  const hi = comments.filter((c) => HI.includes(c.intent));
  const hiRead = hi.filter((c) => c.is_read_local);
  const hiReg = hiRead.filter((c) => activeNicks.has(c.user_nick)); // 逐级收窄：登记且已读
  const hiDone = hiReg.filter((c) => doneNicks.has(c.user_nick));
  return [
    { key: 'all', label: '采集评论', n: comments.length, hint: '导入/同步进来的全部评论' },
    { key: 'hi', label: '有下单意向', n: hi.length, hint: '意图=高意向或留电话' },
    { key: 'read', label: '已读处理', n: hiRead.length, hint: '本机标记已读（处理过）' },
    { key: 'reg', label: '登记台账', n: hiReg.length, hint: '昵称进入跟进台账' },
    { key: 'done', label: '成交转化', n: hiDone.length, hint: '台账状态=已转化' },
  ];
}

/** 相邻级流失数（漏斗收窄处=该补救的地方）；首级无流失 */
export function funnelDrop(tiers: FunnelTier[]): number[] {
  return tiers.map((t, i) => (i === 0 ? 0 : tiers[i - 1].n - t.n));
}
