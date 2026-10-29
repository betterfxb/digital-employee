/**
 * S133/S134 经营账纯函数（零IO，入 crypto 单测）：
 * weekRange=周一为一周界（本机时区）；sumWeekDone=本周转化成交额（S101已验证口径的周版）；
 * parseDealHistory=从操作历史解析累计成交（复购次数的唯一可信来源是本机动作记录）。
 * 全部只用 ISO 事件时间，不碰不可信文本时间（S29 口径延续）。
 */

export interface MathFollow { status: string; amount?: number; cost?: number; history?: { at: string; act: string }[] }

/** 本周一 00:00 ~ 下周一 00:00（毫秒） */
export function weekRange(now = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  const wd = (d.getDay() + 6) % 7; // 周一=0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd).getTime();
  return { start, end: start + 7 * 86400000 };
}

/** 本周内「状态改为已转化」的线索数与金额（金额=台账当前记账值，与 S101 近7天口径一致） */
export function sumWeekDone(follows: MathFollow[], now = Date.now()): { n: number; amount: number } {
  const { start, end } = weekRange(now);
  let n = 0; let amount = 0;
  for (const f of follows) {
    if (f.status !== '已转化') continue;
    const inWeek = (f.history || []).some((h) => {
      if (h.act.indexOf('已转化') === -1) return false;
      const t = Date.parse(h.at);
      return !Number.isNaN(t) && t >= start && t < end;
    });
    if (inWeek) { n++; amount += Number(f.amount) || 0; }
  }
  return { n, amount };
}

/** 累计成交：history 各条目按「；」拆段后匹配"记成交 ¥x"动作；一条都没有但已转化有金额=按现值记1次（登记即成交的 create 无动作史） */
export function parseDealHistory(f: MathFollow): { n: number; total: number } {
  let n = 0; let total = 0;
  for (const h of f.history || []) {
    for (const seg of (h.act || '').split('；')) {
      const m = /^记成交 ¥(\d+(?:\.\d+)?)$/.exec(seg.trim());
      if (m) { n++; total += Number(m[1]); }
    }
  }
  if (n === 0 && f.status === '已转化' && (Number(f.amount) || 0) > 0) return { n: 1, total: Number(f.amount) };
  return { n, total };
}
