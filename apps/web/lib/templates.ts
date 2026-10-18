/**
 * S12c AI文案模板库 + S28 三段式 + S33 游戏服务行业化升级
 * 规则版：变量填充 + 评论关键词→场景匹配 + 破冰/核心/引导三段组合，不调外部LLM（零依赖）。
 * S33：游戏代练/陪玩行业场景细化（下单引导等）+ 每场景3变体（nick+content哈希轮换，同输入稳定）
 *      + 口吻三档（亲切/专业/简洁，规则后处理）+ 候选2→4。
 * LLM扩展点：generateReply 的 composition 逻辑即插拔点，未来接 API 只改本函数，UI与API契约不变。
 */
import type { TemplateItem } from './types';

const T: TemplateItem[] = [
  // ── 高意向 ──
  { id: 't-h1-1', intent: '高意向', scene: '破冰', content: '在的{nick}，{product}今天还有档期，发我段位+想玩的模式，直接给你排。' },
  { id: 't-h1-2', intent: '高意向', scene: '破冰', content: '{nick}你好，{product}在接单中，说下你的段位和需求，帮你算个准价。' },
  { id: 't-h1-3', intent: '高意向', scene: '破冰', content: '来了{nick}，{product}档期实时更新，现在下单今晚就能安排。' },
  { id: 't-h2-1', intent: '高意向', scene: '报价', content: '{product}按单/按星报价，{nick}说下段位，报个准价给你。' },
  { id: 't-h2-2', intent: '高意向', scene: '报价', content: '{nick}具体看段位和模式——当前段位发我，价格当场算。' },
  { id: 't-h2-3', intent: '高意向', scene: '报价', content: '{product}价格好说{nick}，不同档位不同价，先说需求不踩坑。' },
  { id: 't-h2-4', intent: '高意向', scene: '报价', content: '{nick}，{product}参考价：{price}。段位发我，按最省的方案报准。' },
  { id: 't-h3-1', intent: '高意向', scene: '下单引导', content: '{nick}下单很简单：发段位→确认价格→开打，全程可跟进度。' },
  { id: 't-h3-2', intent: '高意向', scene: '下单引导', content: '{nick}直接私我就行，把段位和模式发来，马上给你排单。' },
  { id: 't-h3-3', intent: '高意向', scene: '下单引导', content: '{nick}点我主页私信，发个段位就开整，不用等。' },
  { id: 't-h4-1', intent: '高意向', scene: '催单', content: '{nick}今晚档期不多了，先锁个位置，时间可改不鸽。' },
  { id: 't-h4-2', intent: '高意向', scene: '催单', content: '现在排队的人不少{nick}，先下单先安排，晚了要等。' },
  { id: 't-h4-3', intent: '高意向', scene: '催单', content: '{nick}趁这波有档期赶紧上车，过点就排到明天了。' },
  { id: 't-h5-1', intent: '高意向', scene: '售后', content: '{nick}放心下单，掉段包补，打完你验记录。' },
  { id: 't-h5-2', intent: '高意向', scene: '售后', content: '{product}有保障：不满意的部分不收费，售后随叫随到。' },
  { id: 't-h5-3', intent: '高意向', scene: '售后', content: '{nick}老店靠口碑，掉段包赔，全程录屏可查。' },
  { id: 't-h6-1', intent: '高意向', scene: '异议处理', content: '{nick}第一次尝试很正常，可以先来一单试试，觉得靠谱再继续。' },
  { id: 't-h6-2', intent: '高意向', scene: '异议处理', content: '担心的话{nick}可以先小额试单，我们跑给你看记录。' },
  { id: 't-h6-3', intent: '高意向', scene: '异议处理', content: '{nick}理解你的顾虑，先试单后加量，不满意不收费。' },
  { id: 't-h7-1', intent: '高意向', scene: '答疑', content: '{nick}你问的具体是哪方面？段位、价格还是流程，我逐个说。' },
  { id: 't-h7-2', intent: '高意向', scene: '答疑', content: '这个问题好{nick}——你发下当前段位，我按你的情况讲。' },
  { id: 't-h7-3', intent: '高意向', scene: '答疑', content: '{nick}看你要哪种：上分/陪玩/代肝都有方案，说下需求。' },
  // ── 咨询 ──
  { id: 't-c1-1', intent: '咨询', scene: '破冰', content: '你好{nick}，问的是{product}吧，给你介绍下玩法和价格。' },
  { id: 't-c1-2', intent: '咨询', scene: '破冰', content: '{nick}你好，在的~{product}正在接单，想了解哪块？' },
  { id: 't-c1-3', intent: '咨询', scene: '破冰', content: '来了{nick}，{product}的问题尽管问，知无不言。' },
  { id: 't-c2-1', intent: '咨询', scene: '报价', content: '{product}按段位和单量报价{nick}，你发下段位帮你算。' },
  { id: 't-c2-2', intent: '咨询', scene: '报价', content: '{nick}价格区间好说，先说你的需求，给你匹配最划算的。' },
  { id: 't-c2-3', intent: '咨询', scene: '报价', content: '不同档位不同价{nick}，把段位发我，报准价。' },
  { id: 't-c2-4', intent: '咨询', scene: '报价', content: '{nick}，{product}参考价：{price}，你的段位发我给你算个准的。' },
  { id: 't-c3-1', intent: '咨询', scene: '答疑', content: '{nick}可以的，{product}支持先看实录再决定，你想了解哪块？' },
  { id: 't-c3-2', intent: '咨询', scene: '答疑', content: '这个问题简单{nick}——先看主页实录，还有不明白的继续问。' },
  { id: 't-c3-3', intent: '咨询', scene: '答疑', content: '{nick}流程是这样的：确认需求→报价→开打→交付验收，随时可问。' },
  { id: 't-c4-1', intent: '咨询', scene: '异议处理', content: '{nick}新手担心很正常，可以先看我们的实录和评价再决定。' },
  { id: 't-c4-2', intent: '咨询', scene: '异议处理', content: '先小单试水{nick}，觉得稳再加，风险可控。' },
  { id: 't-c4-3', intent: '咨询', scene: '异议处理', content: '{nick}懂你顾虑，老客都是试一单留下来的，随时可以先体验。' },
  { id: 't-c5-1', intent: '咨询', scene: '下单引导', content: '{nick}想深入了解的话点我主页私信，方案和价目发你细看。' },
  { id: 't-c5-2', intent: '咨询', scene: '下单引导', content: '详细内容我私你{nick}，评论区说不全~' },
  { id: 't-c5-3', intent: '咨询', scene: '下单引导', content: '{nick}私信我发你完整方案，看满意了再决定。' },
  // ── 留电话 ──
  { id: 't-p1-1', intent: '留电话', scene: '留资引导', content: '收到{nick}，稍后联系你，留意陌生来电~' },
  { id: 't-p1-2', intent: '留电话', scene: '留资引导', content: '{nick}已记下，专员几分钟内联系你，请保持电话畅通。' },
  { id: 't-p1-3', intent: '留电话', scene: '留资引导', content: '好的{nick}，报价和档期电话里跟你细说，马上打给你。' },
  { id: 't-p2-1', intent: '留电话', scene: '破冰', content: '好的{nick}，这就安排对接。' },
  { id: 't-p2-2', intent: '留电话', scene: '破冰', content: '收到收到{nick}，专员马上联系你。' },
  { id: 't-p3-1', intent: '留电话', scene: '答疑', content: '{nick}这块让专员跟你细聊，比我讲得清楚，稍等。' },
  { id: 't-p3-2', intent: '留电话', scene: '答疑', content: '{nick}电话里给你掰开讲，几分钟就安排上。' },
  // ── 普通 ──
  { id: 't-n1-1', intent: '普通', scene: '破冰', content: '感谢关注{nick}，{product}有活动第一时间来评论区说。' },
  { id: 't-n1-2', intent: '普通', scene: '破冰', content: '谢谢支持~{nick}，想了解随时来问。' },
  { id: 't-n2-1', intent: '普通', scene: '留资引导', content: '{nick}想深入了解随时私信，看到就回。' },
  { id: 't-n2-2', intent: '普通', scene: '留资引导', content: '有问题评论区喊我{nick}，知无不言。' },
  // ── 垃圾（不回复，J4 锁定恰好1条+处理建议场景，勿动）──
  { id: 't-g1', intent: '垃圾', scene: '处理建议', content: '疑似营销/引流内容，建议点忽略并标记垃圾，不回复。' },
];

/** 关键词→场景匹配（S33 扩：陪玩/代练口语场景） */
const FOCUS: { scene: string; re: RegExp }[] = [
  { scene: '报价', re: /(多少钱|什么价|价格|收费|报价|贵|便宜|优惠|折扣|费用|一单|一局|咋卖|价位|米)/ },
  { scene: '下单引导', re: /(怎么下单|怎么联系|接单|带带|上车|怎么找|私信你|私你|怎么买|哪里买|怎么玩|能不能带|能带我|带一下|安排|开整)/ },
  { scene: '售后', re: /(包赔|掉段|售后|退款|保障|保险|靠谱吗|安全|封号|稳不稳)/ },
  { scene: '催单', re: /(现在|今天|马上|急|多久能|什么时候能|还有档期|排队|今晚|明晚|周末|有空吗)/ },
  { scene: '异议处理', re: /(不敢|担心|怕|风险|被骗|靠谱|第一次|没试过|新人|小白|新手)/ },
];

/** 按意图取该意图可用的核心场景（破冰固定，行动引导固定，中间按关注点选）——S33 新增「下单引导」 */
const INTENT_SCENES: Record<string, string[]> = {
  高意向: ['下单引导', '报价', '催单', '售后', '异议处理', '答疑'],
  咨询: ['答疑', '报价', '异议处理', '下单引导'],
  留电话: ['答疑', '报价'],
  普通: ['答疑', '留资引导'],
  垃圾: ['处理建议'],
};

/** S33 变体轮换：同输入稳定可复现，不同输入/不同客户有多样性；S45 报价场景按价目表有无选带价/无价池 */
function pickVariant(intent: string, scene: string, nick: string, content: string, hasPrice = false): TemplateItem {
  const pool = T.filter((t) => t.intent === intent && t.scene === scene && t.content.includes('{price}') === hasPrice);
  if (pool.length === 0) {
    const fb = T.filter((t) => t.intent === '普通' && t.scene === scene);
    return fb[0] || T.find((t) => t.intent === '普通')!;
  }
  let h = 0;
  for (const ch of nick + content + scene) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return pool[h % pool.length];
}

/** 按意图取模板并填充变量（每场景取1条变体，保持话术库精简；S45：无价目表时隐藏带{price}的条目）——向后兼容，J4/J5依赖 */
export function renderTemplates(intent: string, nick: string, product: string, priceText = '') {
  const n = nick.trim() || '朋友';
  const p = product.trim() || '本店新品';
  const withPrice = priceText.trim().length > 0;
  const hit = T.filter((t) => t.intent === intent);
  const source = (hit.length > 0 ? hit : T.filter((t) => t.intent === '普通'))
    .filter((t) => withPrice || !t.content.includes('{price}'))
    // S45：有价目表时带价变体优先入选（同场景去重取带价条，话术库与生成器口径一致）
    .sort((a, b) => Number(b.content.includes('{price}')) - Number(a.content.includes('{price}')));
  const seenScene = new Set<string>();
  const rows = source.filter((t) => (seenScene.has(t.scene) ? false : (seenScene.add(t.scene), true)));
  return rows.map((t) => ({ ...t, content: fill(t.content, n, p, '', priceText) }));
}

function fill(s: string, nick: string, product: string, videoTitle: string, price = ''): string {
  return s
    .replace(/\{nick\}/g, nick)
    .replace(/\{product\}/g, product)
    .replace(/\{video\}/g, videoTitle || '这条视频')
    .replace(/\{price\}/g, price || '面议');
}

/** 从评论正文抽取关注点场景（命中多个取第一个；无命中按意图兜底） */
export function focusScene(content: string, intent: string): string {
  const hit = FOCUS.find((f) => f.re.test(content));
  if (hit && (INTENT_SCENES[intent] || []).includes(hit.scene)) return hit.scene;
  const pool = INTENT_SCENES[intent] || INTENT_SCENES['普通'];
  return pool[0];
}

export interface ReplyDraft { id: string; label: string; content: string }

/** S33 口吻后处理：亲切=模板原生；专业=书面化（敬语开场+去语气词）；简洁=compose层砍破冰留核心+行动 */
function toneFix(s: string, tone: string): string {
  if (tone === '专业') return s
    .replace(/~/g, '')
    .replace(/^(在的|来了|来了来了|收到了?收到?)/, '您好，')
    .replace(/你好/, '您好')
    .replace(/呀|呢|哈|咯|啦/g, '')
    .replace(/，{2,}/g, '，');
  return s;
}

/**
 * S28 三段式 + S33 升级：破冰 + 核心回应（按关注点选场景） + 行动引导
 * 出4个候选供人工挑选（3个不同核心场景 + 1个主场景换口吻）；简洁口吻只出核心+行动两段。
 * 合规：人工确认后发送，不做自动外呼。
 */
export function generateReply(o: { content: string; intent: string; nick: string; product: string; videoTitle?: string; tone?: string; priceText?: string }): ReplyDraft[] {
  const nick = o.nick.trim() || '朋友';
  const product = o.product.trim() || '本店新品';
  const video = o.videoTitle?.trim() || '';
  const intent = o.intent || '普通';
  const tone = o.tone === '专业' || o.tone === '简洁' ? o.tone : '亲切';
  const price = (o.priceText || '').trim();
  /** 报价场景且价目表非空 → 选带价变体 */
  const priceFor = (sc: string) => sc === '报价' && !!price;

  if (intent === '垃圾') {
    const g = T.find((t) => t.intent === '垃圾')!;
    return [{ id: 'spam-0', label: '不回复（处理建议）', content: fill(g.content, nick, product, video) }];
  }

  const coreScene = focusScene(o.content || '', intent);
  const openerT = pickVariant(intent, '破冰', nick, o.content || '', false);
  const coreT = pickVariant(intent, coreScene, nick, o.content || '', priceFor(coreScene));
  const ctaPool = ['下单引导', '留资引导', '催单', '售后'];
  const ctaScene = ctaPool.find((s) => s !== coreScene && (INTENT_SCENES[intent] || []).includes(s)) || '留资引导';
  const ctaT = pickVariant(intent, ctaScene, nick, o.content || '', false);

  const compose = (a: TemplateItem | null, b: TemplateItem, c: TemplateItem | null, label: string, id: string, t2: string): ReplyDraft => {
    const segs = [a, b, c].filter(Boolean) as TemplateItem[];
    return {
      id,
      label,
      content: segs.map((x) => toneFix(fill(x.content, nick, product, video, price), t2))
        .filter((x, i, arr) => x && arr.indexOf(x) === i)
        .join(' '),
    };
  };

  const openerFor = (t: string) => (t === '简洁' ? null : openerT);
  const drafts: ReplyDraft[] = [
    compose(openerFor(tone), coreT, ctaT, `主打「${coreScene}」`, `draft-${coreScene}`, tone),
  ];

  // 备选核心场景（同口吻），最多补2个
  const altScenes = (INTENT_SCENES[intent] || []).filter((s) => s !== coreScene && s !== '处理建议').slice(0, 2);
  for (const sc of altScenes) {
    const altCore = pickVariant(intent, sc, nick, o.content || '', priceFor(sc));
    drafts.push(compose(openerFor(tone), altCore, ctaT, `备选「${sc}」`, `draft-alt-${sc}`, tone));
  }

  // 第4个候选：主场景换口吻（与当前口吻互补），给人工第三维度选择
  const altTone = tone === '专业' ? '亲切' : '专业';
  drafts.push(compose(openerFor(altTone), coreT, ctaT, `主打「${coreScene}」·${altTone}`, `draft-tone-${coreScene}`, altTone));

  return drafts;
}
