"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewOf = exports.isRead = exports.settings = exports.replies = exports.replyRules = exports.customScripts = exports.videoTasks = exports.pausedTasks = exports.setActiveAccountId = exports.activeAccountId = exports.syncJobs = exports.dlq = exports.seenEvents = exports.competitors = exports.follows = exports.intentOverrides = exports.allReadVideos = exports.readIds = void 0;
/** 内存态存储（P0 mock：同进程有效；S23起账号/导入/token持久化，S25b台账/回评等集合持久化；生产替换为Prisma，见01-architecture） */
const localData_1 = require("./localData"); // S23水合+S25b集合水合（模块尾部调用）
require("./localData");
const mock_1 = require("./mock");
/** 已读comment_id集合（本地协作态，不反写抖音） */
exports.readIds = new Set(mock_1.mockComments.filter((c) => c.is_read_local).map((c) => c.id));
/** 全部标已读的video_id集合 */
exports.allReadVideos = new Set();
/** 意图/忽略覆盖 {commentId: {intent?, ignore?}} */
exports.intentOverrides = new Map();
/** 跟进台账 */
exports.follows = [
    { id: 'f1', peer_nick: '刀友老陈', source_video_id: 'v1', next_remind_at: '今天 18:00', status: '待回访' },
    { id: 'f2', peer_nick: '熬夜选手Lin', source_video_id: 'v1', next_remind_at: '明天', status: '已手动回复' },
];
/** 竞品手动导入 */
exports.competitors = [
    { id: 'cp1', source: 'feigua', url: '竞品A · 跑刀代练', play: 890000, like: 42000, remark: '' },
    { id: 'cp2', source: 'manual', url: '同城店B · 契约陪玩', play: 120000, like: 5400, remark: '' },
];
/** webhook已处理event_id（幂等） */
exports.seenEvents = new Set();
/** webhook死信队列 */
exports.dlq = [];
/** 同步任务 */
exports.syncJobs = [];
/** 当前主账号（多账号切换，默认acc_001） */
exports.activeAccountId = 'acc_001';
function setActiveAccountId(id) { exports.activeAccountId = id; }
exports.setActiveAccountId = setActiveAccountId;
/** 已暂停的任务类型（任务中心启停，只含同步类任务） */
exports.pausedTasks = new Set();
/** 视频跟进队列（S20：只做跟进提醒+手动清单，不做自动点赞/评论/收藏，见docs/10-A4） */
exports.videoTasks = [
    { id: 'vt1', video_id: 'v1', title: '三角洲跑刀实录 · 一局爆仓', follow: true, like_done: false, fav_done: false, paused: false, interval_min: 5, last_check: null, created_at: '10-09' },
];
/** 自定义话术（S20：用户自建，对齐ScriptItem） */
exports.customScripts = [];
/** 私信接待规则（S20：休眠配置，无企业号授权不执行，见docs/10-B7） */
exports.replyRules = [
    { id: 'rr1', keyword: '价格', reply: '报价已私信发送，详询请留联系方式。', enabled: true },
];
/** 评论回评记账（S20：作者回评自有视频，mock本地记账） */
exports.replies = [];
/** 系统设置（内存持久化：同进程有效，重启回默认；生产进DB。初值对齐settings.config） */
exports.settings = {
    service_name: '跑刀代跑',
    font_size: 14,
    theme_color: '#1A1A18',
    password_changed_at: null,
    /** S69 访问密码scrypt哈希（null=未设置不锁；原文永不落盘） */
    password_hash: null,
    /** S74 评论自动回复总开关（三重门之一，默认关） */
    auto_reply_enabled: false,
    /** S45 价目表（档位→价格，话术{price}填充源） */
    price_list: [],
};
function isRead(c) {
    return c.is_read_local || exports.readIds.has(c.id) || exports.allReadVideos.has(c.video_id);
}
exports.isRead = isRead;
function viewOf(c) {
    const ov = exports.intentOverrides.get(c.id);
    return { ...c, is_read_local: isRead(c), intent: ov?.intent || c.intent, ignore: ov?.ignore || false };
}
exports.viewOf = viewOf;
// S25b：业务集合水合（模块尾部，数组已定义）；repo变更点调persistCollections落盘；S68协作态一并注入
(0, localData_1.hydrateCollections)({ follows: exports.follows, replies: exports.replies, competitors: exports.competitors, videoTasks: exports.videoTasks, settings: exports.settings, customScripts: exports.customScripts, replyRules: exports.replyRules, readIds: exports.readIds, allReadVideos: exports.allReadVideos, intentOverrides: exports.intentOverrides });
