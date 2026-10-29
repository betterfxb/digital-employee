/**
 * S106 作品分析纯函数层（零依赖可单测，前后端同用）
 * 只用导入即可信字段（play/like/comment/share）派生：互动率、爆款Top、低效预警
 * S29口径：分母为0不算率（显示—不造假）；样本<3不做"低效"断言（宁缺毋滥）
 */
export interface VStats { id?: string; play: number; like: number; comment: number; share: number }

/** 互动率% =（点赞+评论+转发）/播放；播放0返回null（诚实"—"） */
export function engagementPct(v: VStats): number | null {
  if (!v || v.play <= 0) return null;
  return ((v.like + v.comment + v.share) / v.play) * 100;
}

/** 爆款TopN：互动率降序取前n（播放≥minPlay才参评，防小分母刷榜）；返回id集合 */
export function topHot<T extends VStats>(videos: T[], n = 3, minPlay = 100): Set<string> {
  const out = new Set<string>();
  videos
    .filter((v) => (v.play >= minPlay) && engagementPct(v) !== null)
    .sort((a, b) => (engagementPct(b) as number) - (engagementPct(a) as number))
    .slice(0, n)
    .forEach((v) => { if (v.id) out.add(v.id); });
  return out;
}

/** 低效预警：播放>0且<账号均值30%（作品<3条不下断言）；返回id集合 */
export function lowWarn<T extends VStats>(videos: T[]): Set<string> {
  const out = new Set<string>();
  if (videos.length < 3) return out;
  const avg = videos.reduce((a, v) => a + v.play, 0) / videos.length;
  videos.forEach((v) => { if (v.id && v.play > 0 && v.play < avg * 0.3) out.add(v.id); });
  return out;
}
