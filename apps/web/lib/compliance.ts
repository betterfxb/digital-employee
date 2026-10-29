/**
 * S130 话术合规体检纯函数（零IO，入 crypto 单测）：
 * 发出去之前最后一道人工确认位——只警示不拦截。
 * 命中词族来自 complianceConfig（可扩充），每条带危险原因与改写方向。
 */
import { complianceConfig } from '../config/compliance.config'; // 相对路径：保 crypto 单文件编译可测

export interface ComplianceHit { name: string; why: string; fix: string }

export function scanText(text: string | null | undefined, rules = complianceConfig.rules): ComplianceHit[] {
  const t = (text || '').toLowerCase();
  if (!t) return [];
  const hits: ComplianceHit[] = [];
  for (const r of rules) {
    try {
      if (new RegExp(r.pat, 'i').test(t)) hits.push({ name: r.name, why: r.why, fix: r.fix });
    } catch { /* 规则正则写坏跳过该条，不影响其余体检（配置断言在verify层兜底） */ }
  }
  return hits;
}
