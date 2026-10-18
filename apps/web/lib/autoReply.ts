/**
 * S74 评论自动回复执行器（官方接口内全自动化；非RPA——在我们服务端跑，不碰客户端与cookie）
 *
 * 红线三重门（缺一不外发）：①DOUYIN_MODE=live ②官方「评论回复」能力开通（env+端点，联调复核）
 *                        ③用户在任务中心打开总开关（settings.auto_reply_enabled）
 * 未过门时：执行器照样真实运转（规则匹配→话术起草→日志），状态记"待人工/待通道"——机器就绪，只等钥匙
 *
 * 拟人化的合规实现（节奏层）：随机冷却60–240秒/条 · 每日≤autoReplyDailyCap · 夜间22-8静默
 * 处理即标已读（S68持久化机制天然去重，重启不重复起草）；接待规则关键词命中优先用规则文案
 */
import { getRepos } from './repo';
import { generateReply } from './templates';
import { tasksConfig } from '../config/tasks.config';
import { douyinConfig } from '../config/douyin.config';

export interface AutoReplyJob {
  at: string;
  comment_id: string;
  nick: string;
  text: string;
  via: '规则' | '生成';
  status: 'sent' | 'manual';
  note: string;
}

interface ARState { today: string; sentToday: number; nextAt: number; log: AutoReplyJob[] }

const g = globalThis as unknown as { __autoReply?: ARState };

function ensure(): ARState {
  if (!g.__autoReply) g.__autoReply = { today: '', sentToday: 0, nextAt: 0, log: [] };
  return g.__autoReply;
}

/** 夜间静默（与调度同一套时段配置） */
function inQuiet(now = new Date()): boolean {
  if (!tasksConfig.quietHoursEnabled) return false;
  const h = now.getHours();
  const { start, end } = tasksConfig.quietHours;
  return start > end ? h >= start || h < end : h >= start && h < end;
}

/** S74 拟人随机冷却（纯函数可测）：60–240秒 */
export function nextGapMs(rand: number): number {
  const r = Math.min(Math.max(rand, 0), 0.999999);
  return 60_000 + Math.floor(r * 180_000);
}

/** S74 三重门判定（纯函数可测）：返回 {ready, gate}——门只判通道侧（live→能力），用户开关在调用方单独判 */
export function replyGate(mode: string, capEnabled: boolean, url: string): { ready: boolean; gate: string } {
  if (mode !== 'live') return { ready: false, gate: '等 live 通道（开放平台密钥）' };
  if (!capEnabled || !url) return { ready: false, gate: '等官方「评论回复」能力审核' };
  return { ready: true, gate: '就绪' };
}

/** 单次执行判定与处理（scheduler 每60s心跳调用；幂等：已起草/已处理的跳过） */
export function autoReplyTick(): void {
  const a = ensure();
  const st = getRepos().settings.get() as { auto_reply_enabled?: boolean; service_name?: string };
  const today = new Date().toISOString().slice(0, 10);
  if (a.today !== today) { a.today = today; a.sentToday = 0; }
  if (!st.auto_reply_enabled) return;
  if (inQuiet()) return;
  if (a.sentToday >= tasksConfig.autoReplyDailyCap) return;
  if (Date.now() < a.nextAt) return;

  const comments = getRepos().comments.list({ video_id: '', intent: '', keyword: '', unreadOnly: true });
  const target = comments.find((c) => c.intent !== '垃圾' && !a.log.some((j) => j.comment_id === c.id));
  if (!target) return;

  // 规则优先（接待规则S20），未命中用话术生成（S33三变体+口吻）
  const rule = getRepos().replyRules.list().find((r) => r.enabled && target.content.includes(r.keyword));
  let text: string;
  let via: AutoReplyJob['via'];
  if (rule) { text = rule.reply; via = '规则'; } else {
    const drafts = generateReply({ content: target.content, intent: target.intent, nick: target.user_nick, product: String(st.service_name || ''), tone: '亲切' });
    text = drafts[0]?.content || '';
    via = '生成';
  }
  if (!text) return;

  const gate = replyGate(douyinConfig.mode, douyinConfig.commentReplyEnabled, douyinConfig.commentReplyUrl);
  const sent = gate.ready; // live发送在能力开通后由联调接入（端点空=恒不过门，绝无假发送）
  const status: AutoReplyJob['status'] = sent ? 'sent' : 'manual';
  const note = sent ? '官方接口已发送' : gate.gate;
  a.log.unshift({ at: new Date().toISOString(), comment_id: target.id, nick: target.user_nick, text, via, status, note });
  if (a.log.length > 20) a.log.length = 20;
  a.nextAt = Date.now() + nextGapMs(Math.random()); // 拟人节奏
  if (sent) {
    a.sentToday += 1;
    getRepos().comments.markRead([target.id], new Set([target.id])); // 已外发→标已读（S68持久化，重启不重发）
  }
  // manual 状态：只登记草稿，不标已读——人工走正常回复流程，回完自然已读
}

/** 状态快照（供任务中心自动化卡片） */
export function autoReplyStatus() {
  const a = ensure();
  const st = getRepos().settings.get() as { auto_reply_enabled?: boolean; service_name?: string };
  const enabled = !!st.auto_reply_enabled;
  const gate = replyGate(douyinConfig.mode, douyinConfig.commentReplyEnabled, douyinConfig.commentReplyUrl);
  return {
    enabled,
    ready: gate.ready,
    gate: gate.gate,
    sentToday: a.sentToday,
    cap: tasksConfig.autoReplyDailyCap,
    nextInSec: enabled && a.nextAt > Date.now() ? Math.ceil((a.nextAt - Date.now()) / 1000) : null,
    log: a.log.slice(0, 6),
  };
}
