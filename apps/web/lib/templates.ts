/**
 * S12c AI文案模板库 + S28 三段式智能回复生成
 * 规则版：变量填充 + 评论关键词→场景匹配 + 破冰/核心/引导三段组合，不调外部LLM（零依赖）。
 * LLM扩展点：generateReply 的 composition 逻辑即插拔点，未来接 API 只改本函数，UI与API契约不变。
 */
import type { TemplateItem } from './types';

const T: TemplateItem[] = [
  // 高意向
  { id: 't-h1', intent: '高意向', scene: '破冰', content: '在的{nick}，{product}还有档期，直接发段位+想跑的图给你安排。' },
  { id: 't-h2', intent: '高意向', scene: '报价', content: '{product}今天9折，{nick}现在下单送保险。' },
  { id: 't-h3', intent: '高意向', scene: '留资引导', content: '{nick}方便留个联系方式吗，发你{video}的跑刀实录和价目表。' },
  { id: 't-h4', intent: '高意向', scene: '催单', content: '{nick}档期不多了，先锁定位置，随时可改时间。' },
  { id: 't-h5', intent: '高意向', scene: '异议处理', content: '{nick}担心效果的话，可以先跑一单试试，不满意不收费。' },
  { id: 't-h6', intent: '高意向', scene: '售后', content: '{nick}下单后全程可跟进，掉段包补，售后无忧。' },
  { id: 't-h7', intent: '高意向', scene: '答疑', content: '{nick}问的{product}具体是哪块？我按你的情况报个准价。' },
  // 咨询
  { id: 't-c1', intent: '咨询', scene: '破冰', content: '你好{nick}，问的是{product}吗，我给你介绍下。' },
  { id: 't-c2', intent: '咨询', scene: '报价', content: '{product}按单/按段位报价，{nick}说下需求，我帮你选。' },
  { id: 't-c3', intent: '咨询', scene: '答疑', content: '{nick}这个问题好，{product}具体是这样的——你发下段位我给你算。' },
  { id: 't-c4', intent: '咨询', scene: '留资引导', content: '{nick}方便加个联系方式吗，{product}的详细方案发你。' },
  { id: 't-c5', intent: '咨询', scene: '异议处理', content: '{nick}预算不够的话{product}也有轻量档，先了解下。' },
  // 留电话
  { id: 't-p1', intent: '留电话', scene: '留资引导', content: '好的{nick}，{product}的详细报价稍后联系你，留意陌生来电。' },
  { id: 't-p2', intent: '留电话', scene: '破冰', content: '收到{nick}，{product}专员会跟你对接，请稍等。' },
  { id: 't-p3', intent: '留电话', scene: '答疑', content: '{nick}已收到，{product}这块我让专员跟你细聊，稍等几分钟。' },
  // 普通
  { id: 't-n1', intent: '普通', scene: '破冰', content: '感谢关注，{product}上新活动会第一时间通知。' },
  { id: 't-n2', intent: '普通', scene: '留资引导', content: '{nick}想了解{product}随时评论，看到就回。' },
  // 垃圾（不回复）
  { id: 't-g1', intent: '垃圾', scene: '处理建议', content: '疑似营销/引流内容，建议点忽略并标记垃圾，不回复。' },
];

/** 关键词→场景匹配：从评论正文抽关注点，决定三段式里的"核心回应"用哪个场景 */
const FOCUS: { scene: string; re: RegExp }[] = [
  { scene: '报价', re: /(多少钱|什么价|价格|收费|报价|贵|便宜|优惠|折扣|9折|费用)/ },
  { scene: '售后', re: /(包赔|掉段|售后|退款|保障|保险|靠谱吗)/ },
  { scene: '答疑', re: /(怎么|如何|能不能|可以吗|支持|有没有|是什么|流程|多久|什么时候)/ },
  { scene: '催单', re: /(现在|今天|马上|急|多久能|什么时候能|还有档期|排队)/ },
  { scene: '异议处理', re: /(不敢|担心|怕|风险|被骗|靠谱|第一次|没试过)/ },
];

/** 按意图取该意图可用的核心场景（破冰固定，行动引导固定，中间按关注点选） */
const INTENT_SCENES: Record<string, string[]> = {
  高意向: ['报价', '催单', '售后', '异议处理', '答疑'],
  咨询: ['答疑', '报价', '异议处理'],
  留电话: ['答疑', '报价'],
  普通: ['答疑', '留资引导'],
  垃圾: ['处理建议'],
};

/** 按意图取模板并填充变量（无匹配回退普通；空昵称/产品用默认值）——向后兼容，J4等依赖 */
export function renderTemplates(intent: string, nick: string, product: string) {
  const n = nick.trim() || '朋友';
  const p = product.trim() || '本店新品';
  const hit = T.filter((t) => t.intent === intent);
  const rows = hit.length > 0 ? hit : T.filter((t) => t.intent === '普通');
  return rows.map((t) => ({ ...t, content: fill(t.content, n, p, '') }));
}

function fill(s: string, nick: string, product: string, videoTitle: string): string {
  return s
    .replace(/\{nick\}/g, nick)
    .replace(/\{product\}/g, product)
    .replace(/\{video\}/g, videoTitle || '这条视频');
}

/** 从评论正文抽取关注点场景（命中多个取第一个；无命中按意图兜底） */
export function focusScene(content: string, intent: string): string {
  const hit = FOCUS.find((f) => f.re.test(content));
  if (hit && (INTENT_SCENES[intent] || []).includes(hit.scene)) return hit.scene;
  const pool = INTENT_SCENES[intent] || INTENT_SCENES['普通'];
  return pool[0];
}

export interface ReplyDraft { id: string; label: string; content: string }

/**
 * S28 三段式智能回复：破冰 + 核心回应（按关注点选场景） + 行动引导
 * 出2个候选供人工挑选（合规：人工确认后发送，不做自动外呼）。
 */
export function generateReply(o: { content: string; intent: string; nick: string; product: string; videoTitle?: string }): ReplyDraft[] {
  const nick = o.nick.trim() || '朋友';
  const product = o.product.trim() || '本店新品';
  const video = o.videoTitle?.trim() || '';
  const intent = o.intent || '普通';

  if (intent === '垃圾') {
    const g = T.find((t) => t.intent === '垃圾')!;
    return [{ id: 'spam-0', label: '不回复（处理建议）', content: fill(g.content, nick, product, video) }];
  }

  const coreScene = focusScene(o.content || '', intent);
  const pick = (scene: string) => T.find((t) => t.intent === intent && t.scene === scene) || T.find((t) => t.intent === '普通' && t.scene === scene);

  const opener = pick('破冰') || T.find((t) => t.intent === '普通')!;
  const core = pick(coreScene) || T.find((t) => t.intent === '普通')!;
  const ctaPool = ['留资引导', '催单', '售后'];
  const ctaScene = ctaPool.find((s) => s !== coreScene) || '留资引导';
  const cta = pick(ctaScene) || T.find((t) => t.intent === '普通')!;

  const compose = (a: TemplateItem, b: TemplateItem, c: TemplateItem, label: string, id: string): ReplyDraft => ({
    id,
    label,
    content: [fill(a.content, nick, product, video), fill(b.content, nick, product, video), fill(c.content, nick, product, video)]
      .filter((x, i, arr) => x && arr.indexOf(x) === i)
      .join(' '),
  });

  const drafts = [compose(opener, core, cta, `主打「${coreScene}」`, `draft-${coreScene}`)];

  // 第二候选：换一个核心场景，给人工多一个选择
  const altScene = (INTENT_SCENES[intent] || []).find((s) => s !== coreScene);
  if (altScene) {
    const altCore = pick(altScene);
    if (altCore) drafts.push(compose(opener, altCore, cta, `备选「${altScene}」`, `draft-alt-${altScene}`));
  }
  return drafts;
}
