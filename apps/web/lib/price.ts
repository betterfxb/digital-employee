import { getRepos } from './repo';

/** S45 价目表文本（话术 {price} 填充用）：settings.price_list 前3行拼接；未配置返回空（带价模板自动隐藏） */
export function priceText(): string {
  const pl = (getRepos().settings.get() as { price_list?: { tier: string; price: string }[] }).price_list;
  if (!Array.isArray(pl) || pl.length === 0) return '';
  return pl.slice(0, 3).map((r) => `${r.tier} ${r.price}`).join(' · ');
}
