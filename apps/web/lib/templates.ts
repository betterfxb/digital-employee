/**
 * S12c AI文案模板库：按意图×话术场景出带变量文案
 * 本地模板，变量 {nick}/{product}，不调外部LLM；场景复用assistConfig.scriptCategories。
 */
import type { TemplateItem } from './types';

const T: TemplateItem[] = [
  { id: 't-h1', intent: '高意向', scene: '欢迎语', content: '在的{nick}，{product}还有档期，直接发段位+想跑的图给你安排。' },
  { id: 't-h2', intent: '高意向', scene: '报价', content: '{product}今天9折，{nick}现在下单送保险。' },
  { id: 't-h3', intent: '高意向', scene: '留资引导', content: '{nick}方便留个联系方式吗，发你跑刀实录和价目表。' },
  { id: 't-c1', intent: '咨询', scene: '欢迎语', content: '你好{nick}，问的是{product}吗，我给你介绍下。' },
  { id: 't-c2', intent: '咨询', scene: '报价', content: '{product}按单/按段位报价，{nick}说下需求，我帮你选。' },
  { id: 't-p1', intent: '留电话', scene: '留资引导', content: '好的{nick}，{product}的详细报价稍后联系你，留意陌生来电。' },
  { id: 't-p2', intent: '留电话', scene: '欢迎语', content: '收到{nick}，{product}专员会跟你对接，请稍等。' },
  { id: 't-n1', intent: '普通', scene: '欢迎语', content: '感谢关注，{product}上新活动会第一时间通知。' },
  { id: 't-g1', intent: '垃圾', scene: '处理建议', content: '疑似营销/引流内容，建议点忽略并标记垃圾，不回复。' },
];

/** 按意图取模板并填充变量（无匹配回退普通；空昵称/产品用默认值） */
export function renderTemplates(intent: string, nick: string, product: string) {
  const n = nick.trim() || '朋友';
  const p = product.trim() || '本店新品';
  const hit = T.filter((t) => t.intent === intent);
  const rows = hit.length > 0 ? hit : T.filter((t) => t.intent === '普通');
  return rows.map((t) => ({ ...t, content: t.content.replace(/\{nick\}/g, n).replace(/\{product\}/g, p) }));
}
