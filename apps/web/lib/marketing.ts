/**
 * S83-S87 智能营销套件纯函数层（零 node 依赖，可入 client/可单测）
 * 红线设计：只做"智能出主意"，一切触达动作人工执行——不群发、不自动私信、不外呼
 * 数据源：只用本地已有且可信的数据（评论意图/关键词/台账 status·history·created_at·amount/业务快照）
 * 评论 create_time 形态不可全信（相对时间/无年份）——凡涉时间窗口只用 ISO 可信字段（S29 铁律）
 */
import { isDue } from './remind';

export interface MComment { id: string; user_nick: string; content: string; intent: string; is_read_local: boolean; keywords?: string[] }
export interface MFollow { id: string; peer_nick: string; status: string; amount?: number; next_remind_at?: string; created_at?: string; history?: { at: string; act: string }[] }
export interface MReply { id: string; comment_id: string; content: string; at: string; variant?: number }

export interface Segment { key: string; label: string; desc: string; action: string; count: number; members: { nick: string; extra: string }[] }

const CAP = 12;
const dayMs = 86400000;

/** 热词Top（无 hotHistory 依赖的兜底口径：按全量评论 keywords 频次） */
export function hotKeys(comments: MComment[], top = 3): { word: string; n: number }[] {
  const m = new Map<string, number>();
  for (const c of comments) (c.keywords || []).forEach((k) => m.set(k, (m.get(k) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([word, n]) => ({ word, n }));
}

/** 智能客群：五个互不依赖的规则群（可重叠，按规则名圈选） */
export function computeSegments(comments: MComment[], follows: MFollow[], now = Date.now()): Segment[] {
  const followed = new Set(follows.map((f) => f.peer_nick));
  const out: Segment[] = [];

  // A 高意向未登记——最该马上跟进的人
  const hi = comments.filter((c) => c.intent === '高意向' && !followed.has(c.user_nick));
  const hiNicks = new Map<string, string>();
  for (const c of hi) if (!hiNicks.has(c.user_nick)) hiNicks.set(c.user_nick, c.content.slice(0, 20));
  out.push({
    key: 'hot_untracked', label: '高意向·未登记', desc: '评论被识别为高意向但台账里还没有', action: '优先登记跟进（人工私信/回评）',
    count: hiNicks.size, members: [...hiNicks.entries()].slice(0, CAP).map(([nick, last]) => ({ nick, extra: `“${last}…”` })),
  });

  // B 逾期未跟进（提醒时间已过且未闭环）
  const dueF = follows.filter((f) => ['待回访', '已手动回复'].includes(f.status) && isDue(f.next_remind_at, now));
  out.push({
    key: 'overdue', label: '跟进逾期', desc: '下次提醒时间已过仍未处理', action: '今天内联系或改期',
    count: dueF.length, members: dueF.slice(0, CAP).map((f) => ({ nick: f.peer_nick, extra: `提醒 ${String(f.next_remind_at).slice(0, 16)}` })),
  });

  // C 沉默可唤醒：待回访但最近一次动态（history或建档）距今≥14天
  const silent = follows.filter((f) => {
    if (f.status !== '待回访') return false;
    const last = f.history?.[0]?.at || f.created_at;
    if (!last) return false;
    const t = Date.parse(last);
    return Number.isFinite(t) && now - t >= 14 * dayMs;
  });
  out.push({
    key: 'silent', label: '沉默可唤醒', desc: '待回访且14天以上没有新动态', action: '换个由头再触达（新作品/优惠口径，人工发送）',
    count: silent.length, members: silent.slice(0, CAP).map((f) => ({ nick: f.peer_nick, extra: `静默 ${Math.floor((now - Date.parse(f.history?.[0]?.at || f.created_at || '')) / dayMs)} 天` })),
  });

  // D 成交老客：复购与口碑经营
  const done = follows.filter((f) => f.status === '已转化');
  out.push({
    key: 'repeat', label: '成交老客', desc: '已转化的客户，值得维护复购', action: '上新/节点主动问候（人工）',
    count: done.length, members: done.slice(0, CAP).map((f) => ({ nick: f.peer_nick, extra: f.amount ? `¥${f.amount}` : '已成交' })),
  });

  // E 热词人群：本期最热关键词命中、未进台账的人
  const hot = hotKeys(comments, 3);
  const hotMembers = new Map<string, string>();
  for (const c of comments) {
    if (followed.has(c.user_nick)) continue;
    const hit = hot.find((h) => (c.keywords || []).includes(h.word) || c.content.includes(h.word));
    if (hit && !hotMembers.has(c.user_nick)) hotMembers.set(c.user_nick, hit.word);
  }
  out.push({
    key: 'hotkw', label: `热词人群（${hot.map((h) => h.word).join('/') || '—'}）`, desc: '命中最热关键词但还没进台账', action: '结合话术库集中接待',
    count: hotMembers.size, members: [...hotMembers.entries()].slice(0, CAP).map(([nick, w]) => ({ nick, extra: `热词「${w}」` })),
  });

  return out;
}

/** 商机简报：纯可信数据聚合，无数据=少一条而不是造假 */
export function computeInsights(comments: MComment[], follows: MFollow[], bizHist: Record<string, { comments?: number; high?: number; follows?: number; done?: number; revenue?: number }>, now = Date.now()): { label: string; value: string; sub: string; link: string }[] {
  const items: { label: string; value: string; sub: string; link: string }[] = [];
  const unreadHi = comments.filter((c) => c.intent === '高意向' && !c.is_read_local).length;
  if (unreadHi > 0) items.push({ label: '待处理高意向', value: String(unreadHi), sub: '未读评论里的高意向——黄金4小时', link: '/comments?intent=' + encodeURIComponent('高意向') });
  const due = computeSegments(comments, follows, now).find((s) => s.key === 'overdue')?.count ?? 0;
  if (due > 0) items.push({ label: '逾期跟进', value: String(due), sub: '今天联系还来得及', link: '/messages' });
  const wake = computeSegments(comments, follows, now).find((s) => s.key === 'silent')?.count ?? 0;
  if (wake > 0) items.push({ label: '可唤醒沉默客', value: String(wake), sub: '14天+没动静，换个由头', link: '/marketing' });
  // 7日成交（history 里“已转化”动作在窗口内，amount 取台账现值——口径注明）
  let rev7 = 0; let n7 = 0;
  for (const f of follows) {
    if (!f.history) continue;
    const hit = f.history.some((h) => h.act.includes('已转化') && now - Date.parse(h.at) <= 7 * dayMs);
    if (hit) { n7++; if (f.amount) rev7 += f.amount; }
  }
  if (n7 > 0) items.push({ label: '7日成交', value: `${n7} 单`, sub: `台账约 ¥${rev7.toLocaleString()}（金额取现值口径）`, link: '/messages' });
  // 业务快照日环比（有两天以上才有，缺=不展示）
  const days = Object.keys(bizHist).sort();
  if (days.length >= 2) {
    const a = bizHist[days[days.length - 2]] || {}; const b = bizHist[days[days.length - 1]] || {};
    const dC = (b.comments ?? 0) - (a.comments ?? 0);
    const dH = (b.high ?? 0) - (a.high ?? 0);
    if (days[days.length - 1] === new Date(now).toISOString().slice(0, 10)) {
      items.push({ label: '昨日新增', value: `评论 ${dC >= 0 ? '+' : ''}${dC}`, sub: `高意向 ${dH >= 0 ? '+' : ''}${dH}（快照口径·${days[days.length - 2]}→${days[days.length - 1]}）`, link: '/dashboard' });
    }
  }
  for (const h of hotKeys(comments, 3).slice(0, 3)) items.push({ label: `热词「${h.word}」`, value: `${h.n} 次`, sub: '评论区正在集中问这个', link: '/comments?keyword=' + encodeURIComponent(h.word) });
  return items;
}

/** 话术A/B：按回评候选位次聚合（样本不足如实报告，不做统计学包装） */
export interface ExpBucket { variant: number; used: number; leads: number; done: number }
export function computeExperiments(replies: MReply[], commentById: Map<string, MComment>, follows: MFollow[]): { buckets: ExpBucket[]; total: number; sufficient: boolean } {
  const byNick = new Map<string, MFollow>();
  for (const f of follows) if (!byNick.has(f.peer_nick)) byNick.set(f.peer_nick, f);
  const buckets: ExpBucket[] = [1, 2, 3, 4].map((v) => ({ variant: v, used: 0, leads: 0, done: 0 }));
  let total = 0;
  for (const r of replies) {
    if (!r.variant || r.variant < 1 || r.variant > 4) continue;
    const c = commentById.get(r.comment_id);
    if (!c) continue;
    const b = buckets[r.variant - 1];
    b.used++; total++;
    const f = byNick.get(c.user_nick);
    if (f) { b.leads++; if (f.status === '已转化') b.done++; }
  }
  return { buckets, total, sufficient: total >= 20 };
}

/** 营销活动（计划+人工checklist+期间复盘） */
export interface Campaign { id: string; name: string; note?: string; keyword?: string; start_at: string; end_at: string; checklist: { text: string; done: boolean }[]; created_at: string; deleted?: boolean }
export interface CampaignStats extends Campaign { status: string; match_count: number; follow_new: number; done_in_period: number; revenue_in_period: number; progress: number }
export function campaignStats(c: Campaign, comments: MComment[], follows: MFollow[], now = Date.now()): CampaignStats {
  const s = Date.parse(c.start_at), e = Date.parse(c.end_at) + dayMs - 1;
  const kw = (c.keyword || '').trim();
  const match = kw ? comments.filter((x) => x.content.includes(kw) || (x.keywords || []).includes(kw)).length : comments.length;
  let followNew = 0, doneCnt = 0, rev = 0;
  for (const f of follows) {
    const ct = f.created_at ? Date.parse(f.created_at) : NaN;
    if (Number.isFinite(ct) && ct >= s && ct <= e) followNew++;
    for (const h of f.history || []) {
      const t = Date.parse(h.at);
      if (Number.isFinite(t) && t >= s && t <= e && h.act.includes('已转化')) { doneCnt++; rev += Number(f.amount) || 0; }
    }
  }
  const total = c.checklist.length;
  const done = c.checklist.filter((x) => x.done).length;
  const status = now < s ? '未开始' : now > e ? '已结束' : '进行中';
  return { ...c, status, match_count: match, follow_new: followNew, done_in_period: doneCnt, revenue_in_period: rev, progress: total ? Math.round((done / total) * 100) : 0 };
}
