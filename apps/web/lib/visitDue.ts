/**
 * S129 老客复购回访纯函数（零IO，入 crypto 单测）：
 * 成交不是终点——跑刀是高复购生意，老客户多久没碰才是金矿。
 * 最近接触时间只信本机 ISO 事件（建档 created_at + history 各条 at，全是真实操作时间，S29 合规）；
 * next_remind_at 的口语时间不参与（那是催自己的，不是碰客户的）。
 * 无史可考（都解析不了）= 宁可不提醒，不误报。
 */

export interface TouchFollow { status: string; created_at?: string; history?: { at: string }[] }

const DAY = 86_400_000;

/** 最近一次接触时间（max of 建档/操作历史 ISO）；全无效返回 null */
export function lastTouchAt(f: TouchFollow): number | null {
  let best: number | null = null;
  for (const s of [f.created_at, ...(f.history || []).map((h) => h.at)]) {
    if (!s) continue;
    const t = Date.parse(s);
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  return best;
}

/** 是否到复购回访点：已转化 + 有据可查 + 距今 > days 天 */
export function visitDue(f: TouchFollow, days: number, now = Date.now()): boolean {
  if (f.status !== '已转化') return false;
  const t = lastTouchAt(f);
  return t !== null && now - t > days * DAY;
}

/** 距今多少天（无史返回 null） */
export function daysSinceTouch(f: TouchFollow, now = Date.now()): number | null {
  const t = lastTouchAt(f);
  return t === null ? null : Math.floor((now - t) / DAY);
}
