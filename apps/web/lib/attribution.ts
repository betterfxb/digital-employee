/**
 * S128 作品带货榜纯函数（零IO，入 crypto 单测）：把「内容」和「钱」连线。
 * 口径诚实：source='import' 的老客户导入线索没有真实来源作品（S118 当初塞了首作品兜底），
 * 必须整行排除——带货榜只信「从这条视频的评论区走进台账」的归因；无效线索不计带货。
 * 金额=台账记账值（已转化才计），未成交线索也计数（热度参考）。
 */

export interface AttrFollow { source_video_id: string; status: string; amount?: number; source?: string }
export interface AttrVideo { id: string; title: string }
export interface AttrRow { videoId: string; title: string; leads: number; done: number; amount: number }

export function attribution(follows: AttrFollow[], videos: AttrVideo[]): AttrRow[] {
  const by = new Map<string, AttrRow>();
  const titleOf = new Map(videos.map((v) => [v.id, v.title]));
  for (const f of follows) {
    if (f.source === 'import') continue; // 归因排除：导入线索不挂任何作品
    if (!f.source_video_id) continue;
    const r = by.get(f.source_video_id) || { videoId: f.source_video_id, title: titleOf.get(f.source_video_id) || '（作品已删除）', leads: 0, done: 0, amount: 0 };
    if (f.status !== '无效') r.leads++;
    if (f.status === '已转化') { r.done++; r.amount += f.amount || 0; }
    by.set(f.source_video_id, r);
  }
  return [...by.values()].sort((a, b) => b.amount - a.amount || b.done - a.done || b.leads - a.leads);
}
