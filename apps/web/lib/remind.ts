/**
 * S44 跟进提醒时间解析：台账 next_remind_at 为中文口语格式（明天 18:00 / 今天 9:30 / 后天 18:00）
 * 也兼容 ISO（2026-10-18T18:00）；解析不了返回 null（该条不参与提醒，宁可漏提醒不误报）
 */
export function parseRemind(s: string | undefined | null): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = new Date(s);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const m = s.match(/^(今天|明天|后天)\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const d = new Date();
    const add = m[1] === '明天' ? 1 : m[1] === '后天' ? 2 : 0;
    d.setDate(d.getDate() + add);
    d.setHours(Number(m[2]), Number(m[3]), 0, 0);
    return d;
  }
  return null;
}

/** 是否已到提醒时间 */
export function isDue(s: string | undefined | null, now = Date.now()): boolean {
  const t = parseRemind(s);
  return !!t && t.getTime() <= now;
}
