/**
 * S136 业务心跳纯函数（零IO，入 crypto 单测）：
 * 近 N 天逐日三条曲线——新线索(follows.created_at)、跟进动作(history 各条 at)、成交(「记成交 ¥x」动作)。
 * 全部本机 ISO 操作事件，零平台依赖（S29 延续）；空白天补零保证曲线连续。
 * 口径注脚：登记即成交(create 无 history)不进成交线——只统计"动作可考"的成交，宁漏不造。
 */

export interface HbFollow { status: string; created_at?: string; history?: { at: string; act: string }[] }
export interface HbDay { date: string; leads: number; touches: number; deals: number; amount: number }

const DAY = 86_400_000;

const dkey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function buildHeartbeat(follows: HbFollow[], days = 14, now = Date.now()): HbDay[] {
  const out: HbDay[] = [];
  const idx = new Map<string, HbDay>();
  const base = new Date(now); base.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const k = dkey(base.getTime() - i * DAY);
    const day = { date: k, leads: 0, touches: 0, deals: 0, amount: 0 };
    out.push(day); idx.set(k, day);
  }
  for (const f of follows) {
    if (f.created_at) { const t = Date.parse(f.created_at); if (!Number.isNaN(t)) { const d = idx.get(dkey(t)); if (d) d.leads++; } }
    for (const h of f.history || []) {
      const t = Date.parse(h.at);
      if (Number.isNaN(t)) continue;
      const d = idx.get(dkey(t));
      if (!d) continue;
      d.touches++;
      for (const seg of (h.act || '').split('；')) {
        const m = /^记成交 ¥(\d+(?:\.\d+)?)$/.exec(seg.trim());
        if (m) { d.deals++; d.amount += Number(m[1]); }
      }
    }
  }
  return out;
}
