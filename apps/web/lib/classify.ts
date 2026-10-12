/**
 * S23 导入评论意图分类（与mock演示数据同口径：五档意图+关键词抽取，仅本地不反写）
 */
const KW_PATTERNS: [string, RegExp][] = [
  ['下单', /下单/],
  ['价格', /(多少钱|什么价|价格|收费|报价)/],
  ['电话', /(电话|联系方式|加微|vx|V我|加我)/],
  ['加V', /加V/],
];

export function classifyIntent(content: string): { intent: string; keywords: string[] } {
  const keywords = KW_PATTERNS.filter(([, re]) => re.test(content)).map(([k]) => k);
  let intent = '普通';
  if (/(下单|多少钱|什么价|价格|收费|报价)/.test(content)) intent = '高意向';
  else if (/(刷单|低价代练|量大从优|接单.*量)/.test(content)) intent = '垃圾';
  else if (/(电话|联系方式|加微|vx|V我|加我)/.test(content)) intent = '留电话';
  else if (/(吗|怎么|如何|能不能|什么|\?|？)/.test(content)) intent = '咨询';
  return { intent, keywords };
}
