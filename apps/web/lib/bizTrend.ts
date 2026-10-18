/** S55 业务趋势纯函数（client 可用，零 node 依赖）：快照类型 + 序列提取 */
export interface BizSnapshot { comments: number; high: number; follows: number; done: number; revenue: number }
export type BizHist = Record<string, Partial<BizSnapshot>>;

/** 取某指标最近N天序列（按日期升序；缺key补0） */
export function trendSeries(h: BizHist, key: keyof BizSnapshot, days = 7): { date: string; v: number }[] {
  return Object.keys(h).sort().slice(-days).map((d) => ({ date: d, v: Number(h[d]?.[key] ?? 0) }));
}
