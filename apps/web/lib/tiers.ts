/**
 * S54 授权分版本（license features 白名单落地，S25 预留字段首次启用）
 * 语义：features=[] → 全开（=专业版，向后兼容所有已发 license）；非空 → 仅列表内能力可用
 * 能力键（专业版专属）：report 经营报告 / analytics 漏斗热词 / lead 线索标签与档案 / competitor 竞品记录 / quote 价目表
 * 基础版 = 全部页面可用但上述专业能力锁（页面级+卡级锁定，API 按既有策略保持开放）
 */
export type ProFeature = 'report' | 'analytics' | 'lead' | 'competitor' | 'quote';

export const TIERS: Record<string, { name: string; features: string[] }> = {
  // 专业版：空数组=全开（与历史 license 兼容）
  pro: { name: '专业版', features: [] },
  // 基础版：页面白名单（授权/看板/评论/话术·台账·任务·设置），专业能力键均不在内
  basic: { name: '基础版', features: ['auth', 'dashboard', 'comments', 'scripts', 'messages', 'tasks', 'settings'] },
};

/** 某专业能力是否可用（空=全开；非空=白名单命中才可用） */
export function hasFeature(features: string[] | undefined | null, key: ProFeature): boolean {
  if (!features || features.length === 0) return true;
  return features.includes(key);
}
