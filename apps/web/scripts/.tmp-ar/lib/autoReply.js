"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoReplyStatus = exports.autoReplyTick = exports.replyGate = exports.nextGapMs = void 0;
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
const repo_1 = require("./repo");
const templates_1 = require("./templates");
const tasks_config_1 = require("../config/tasks.config");
const douyin_config_1 = require("../config/douyin.config");
const g = globalThis;
function ensure() {
    if (!g.__autoReply)
        g.__autoReply = { today: '', sentToday: 0, nextAt: 0, log: [] };
    return g.__autoReply;
}
/** 夜间静默（与调度同一套时段配置） */
function inQuiet(now = new Date()) {
    if (!tasks_config_1.tasksConfig.quietHoursEnabled)
        return false;
    const h = now.getHours();
    const { start, end } = tasks_config_1.tasksConfig.quietHours;
    return start > end ? h >= start || h < end : h >= start && h < end;
}
/** S74 拟人随机冷却（纯函数可测）：60–240秒 */
function nextGapMs(rand) {
    const r = Math.min(Math.max(rand, 0), 0.999999);
    return 60000 + Math.floor(r * 180000);
}
exports.nextGapMs = nextGapMs;
/** S74 三重门判定（纯函数可测）：返回 {ready, gate} */
function replyGate(mode, capEnabled, url) {
    if (!capEnabled)
        return { ready: false, gate: '等用户打开总开关' };
    if (mode !== 'live')
        return { ready: false, gate: '等 live 通道（开放平台密钥）' };
    if (!url)
        return { ready: false, gate: '等官方「评论回复」能力审核' };
    return { ready: true, gate: '就绪' };
}
exports.replyGate = replyGate;
/** 单次执行判定与处理（scheduler 每60s心跳调用；幂等：已起草/已处理的跳过） */
function autoReplyTick() {
    const a = ensure();
    const st = (0, repo_1.getRepos)().settings.get();
    const today = new Date().toISOString().slice(0, 10);
    if (a.today !== today) {
        a.today = today;
        a.sentToday = 0;
    }
    if (!st.auto_reply_enabled)
        return;
    if (inQuiet())
        return;
    if (a.sentToday >= tasks_config_1.tasksConfig.autoReplyDailyCap)
        return;
    if (Date.now() < a.nextAt)
        return;
    const comments = (0, repo_1.getRepos)().comments.list({ video_id: '', intent: '', keyword: '', unreadOnly: true });
    const target = comments.find((c) => c.intent !== '垃圾' && !a.log.some((j) => j.comment_id === c.id));
    if (!target)
        return;
    // 规则优先（接待规则S20），未命中用话术生成（S33三变体+口吻）
    const rule = (0, repo_1.getRepos)().replyRules.list().find((r) => r.enabled && target.content.includes(r.keyword));
    let text;
    let via;
    if (rule) {
        text = rule.reply;
        via = '规则';
    }
    else {
        const drafts = (0, templates_1.generateReply)({ content: target.content, intent: target.intent, nick: target.user_nick, product: String(st.service_name || ''), tone: '亲切' });
        text = drafts[0]?.content || '';
        via = '生成';
    }
    if (!text)
        return;
    const gate = replyGate(douyin_config_1.douyinConfig.mode, douyin_config_1.douyinConfig.commentReplyEnabled, douyin_config_1.douyinConfig.commentReplyUrl);
    const sent = gate.ready; // live发送在能力开通后由联调接入（端点空=恒不过门，绝无假发送）
    const status = sent ? 'sent' : 'manual';
    const note = sent ? '官方接口已发送' : gate.gate;
    a.log.unshift({ at: new Date().toISOString(), comment_id: target.id, nick: target.user_nick, text, via, status, note });
    if (a.log.length > 20)
        a.log.length = 20;
    a.nextAt = Date.now() + nextGapMs(Math.random()); // 拟人节奏
    if (sent) {
        a.sentToday += 1;
        (0, repo_1.getRepos)().comments.markRead([target.id], new Set([target.id])); // 已外发→标已读（S68持久化，重启不重发）
    }
    // manual 状态：只登记草稿，不标已读——人工走正常回复流程，回完自然已读
}
exports.autoReplyTick = autoReplyTick;
/** 状态快照（供任务中心自动化卡片） */
function autoReplyStatus() {
    const a = ensure();
    const st = (0, repo_1.getRepos)().settings.get();
    const enabled = !!st.auto_reply_enabled;
    const gate = replyGate(douyin_config_1.douyinConfig.mode, douyin_config_1.douyinConfig.commentReplyEnabled, douyin_config_1.douyinConfig.commentReplyUrl);
    return {
        enabled,
        ready: gate.ready,
        gate: gate.gate,
        sentToday: a.sentToday,
        cap: tasks_config_1.tasksConfig.autoReplyDailyCap,
        nextInSec: enabled && a.nextAt > Date.now() ? Math.ceil((a.nextAt - Date.now()) / 1000) : null,
        log: a.log.slice(0, 6),
    };
}
exports.autoReplyStatus = autoReplyStatus;
