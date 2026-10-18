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

/** 本地日期键 YYYY-MM-DD（提醒去重用） */
export function todayKey(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * S56 日报提醒判定：开关开 + 当天未提醒过 + 处在 hour 点的前5分钟窗口
 * （页面开着才提醒——纯本地方案的诚实边界，不做后台常驻）
 */
export function shouldNotifyReport(now: number, lastNotified: string | null, enabled: boolean, hour = 9): boolean {
  if (!enabled) return false;
  if (lastNotified === todayKey(now)) return false;
  const d = new Date(now);
  return d.getHours() === hour && d.getMinutes() <= 5;
}

/**
 * S59 授权剩余天数（到期日当天23:59为界，floor=完整剩余天数；买断/无法解析返回null不提醒）
 * 正数=还有N天，0=不足1天/今天到期，负数=已过期
 */
export function daysUntilExpiry(expires: string | null | undefined, now = Date.now()): number | null {
  if (!expires) return null;
  const d = new Date(`${expires}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - now) / 86_400_000);
}
