"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createState = exports.pendingAuthStates = exports.pushAuthLog = exports.authLogs = exports.hash6 = exports.randomHex = exports.readToken = exports.recordToken = exports.rememberComment = exports.rememberVideo = exports.withBatch = exports.rememberAccount = exports.restoreBackup = exports.backupAll = exports.clearBusinessData = exports.flushLocal = exports.persistCollections = exports.hydrateCollections = void 0;
/**
 * S23 本地持久化：绑定账号/导入数据/token密文 → data/local.json（原子写）
 * 授权状态机与操作日志仅内存（重启清空可接受）。仅服务端引用，禁入client组件。
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const crypto_2 = require("./crypto");
const mock_1 = require("./mock");
/** S30 数据目录外置（桌面端DATA_DIR指向%APPDATA%），默认兼容 cwd/data */
const FILE = path_1.default.join(process.env.DATA_DIR || path_1.default.join(process.cwd(), 'data'), 'local.json');
const state = {
    accounts: [], videos: [], comments: [], tokens: {},
    follows: [], replies: [], competitors: [], videoTasks: [], settings: null, customScripts: [], replyRules: [],
};
function hydrate() {
    try {
        if (fs_1.default.existsSync(FILE)) {
            const raw = JSON.parse(fs_1.default.readFileSync(FILE, 'utf8'));
            if (Array.isArray(raw.accounts))
                state.accounts = raw.accounts;
            if (Array.isArray(raw.videos))
                state.videos = raw.videos;
            if (Array.isArray(raw.comments))
                state.comments = raw.comments;
            if (raw.tokens && typeof raw.tokens === 'object')
                state.tokens = raw.tokens;
            if (Array.isArray(raw.follows))
                state.follows = raw.follows;
            if (Array.isArray(raw.replies))
                state.replies = raw.replies;
            if (Array.isArray(raw.competitors))
                state.competitors = raw.competitors;
            if (Array.isArray(raw.videoTasks))
                state.videoTasks = raw.videoTasks;
            if (raw.settings && typeof raw.settings === 'object')
                state.settings = raw.settings;
            if (Array.isArray(raw.customScripts))
                state.customScripts = raw.customScripts;
            if (Array.isArray(raw.replyRules))
                state.replyRules = raw.replyRules;
            if (typeof raw.cleared_at === 'string')
                state.cleared_at = raw.cleared_at;
            if (Array.isArray(raw.read_ids))
                state.read_ids = raw.read_ids;
            if (Array.isArray(raw.all_read_videos))
                state.all_read_videos = raw.all_read_videos;
            if (raw.intent_overrides && typeof raw.intent_overrides === 'object')
                state.intent_overrides = raw.intent_overrides;
        }
    }
    catch { /* 文件损坏则忽略，保持内存态起跑 */ }
    // S37 清空/恢复后示例种子不复活（先清种子再注文件数据；仅全新安装有示例）
    if (state.cleared_at) {
        mock_1.mockVideos.splice(0, mock_1.mockVideos.length);
        mock_1.mockComments.splice(0, mock_1.mockComments.length);
    }
    state.accounts.forEach((a) => { if (!mock_1.mockAccounts.some((x) => x.id === a.id))
        mock_1.mockAccounts.push(a); });
    state.videos.forEach((v) => { if (!mock_1.mockVideos.some((x) => x.id === v.id))
        mock_1.mockVideos.push(v); });
    state.comments.forEach((c) => { if (!mock_1.mockComments.some((x) => x.id === c.id))
        mock_1.mockComments.push(c); });
}
hydrate();
let collRefs = null;
/** store数组定义完成后调用：文件数据注入内存数组（按id去重，防mock初始项与文件副本重复） */
function hydrateCollections(refs) {
    collRefs = refs;
    const merge = (arr, saved) => {
        saved.forEach((s) => { const o = s; if (o && typeof o.id === 'string' && !arr.some((x) => x.id === o.id))
            arr.push(o); });
    };
    merge(refs.follows, state.follows);
    merge(refs.replies, state.replies);
    merge(refs.competitors, state.competitors);
    merge(refs.videoTasks, state.videoTasks);
    if (state.settings)
        Object.assign(refs.settings, state.settings);
    merge(refs.customScripts, state.customScripts);
    merge(refs.replyRules, state.replyRules);
    // S68 协作态水合（本地const承接避免闭包内null收窄丢失——S47同款坑）
    const rids = refs.readIds;
    if (rids && Array.isArray(state.read_ids))
        state.read_ids.forEach((id) => rids.add(id));
    const ravs = refs.allReadVideos;
    if (ravs && Array.isArray(state.all_read_videos))
        state.all_read_videos.forEach((id) => ravs.add(id));
    const rio = refs.intentOverrides;
    if (rio && state.intent_overrides && typeof state.intent_overrides === 'object') {
        Object.entries(state.intent_overrides).forEach(([k, v]) => rio.set(k, v));
    }
}
exports.hydrateCollections = hydrateCollections;
/** repo变更点调用：内存集合→文件（全量序列化） */
function persistCollections() {
    if (!collRefs)
        return;
    state.follows = collRefs.follows;
    state.replies = collRefs.replies;
    state.competitors = collRefs.competitors;
    state.videoTasks = collRefs.videoTasks;
    state.settings = collRefs.settings;
    state.customScripts = collRefs.customScripts;
    state.replyRules = collRefs.replyRules;
    // S68 协作态回写
    if (collRefs.readIds)
        state.read_ids = [...collRefs.readIds];
    if (collRefs.allReadVideos)
        state.all_read_videos = [...collRefs.allReadVideos];
    if (collRefs.intentOverrides)
        state.intent_overrides = Object.fromEntries(collRefs.intentOverrides);
    flushLocal();
}
exports.persistCollections = persistCollections;
function flushLocal() {
    fs_1.default.mkdirSync(path_1.default.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs_1.default.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs_1.default.renameSync(tmp, FILE);
}
exports.flushLocal = flushLocal;
/** S37 清空业务数据（保留账号授权/tokens/设置）：文件+内存数组同清，即时生效 */
function clearBusinessData() {
    state.videos = [];
    state.comments = [];
    state.follows = [];
    state.replies = [];
    state.competitors = [];
    state.videoTasks = [];
    state.customScripts = [];
    state.replyRules = [];
    // S68 协作态随业务数据一并清（已读/意图属于评论）
    state.read_ids = [];
    state.all_read_videos = [];
    state.intent_overrides = {};
    state.cleared_at = new Date().toISOString();
    mock_1.mockVideos.splice(0, mock_1.mockVideos.length);
    mock_1.mockComments.splice(0, mock_1.mockComments.length);
    const refs = collRefs;
    if (refs) {
        refs.follows.length = 0;
        refs.replies.length = 0;
        refs.competitors.length = 0;
        refs.videoTasks.length = 0;
        refs.customScripts.length = 0;
        refs.replyRules.length = 0;
        refs.readIds?.clear();
        refs.allReadVideos?.clear();
        refs.intentOverrides?.clear();
    }
    flushLocal();
}
exports.clearBusinessData = clearBusinessData;
/** S38 备份：全量业务数据JSON快照（含账号/授权引用/设置/台账） */
function backupAll() {
    return JSON.parse(JSON.stringify(state));
}
exports.backupAll = backupAll;
/** S38 恢复：校验后整体替换（文件+内存数组即时生效；tokens随文件走） */
function restoreBackup(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data))
        return { ok: false, error: '备份格式不对' };
    if (!['accounts', 'videos', 'comments'].every((k) => k in data))
        return { ok: false, error: '缺少必要字段（不是本系统的备份文件）' };
    const arrKeys = ['accounts', 'videos', 'comments', 'follows', 'replies', 'competitors', 'videoTasks', 'customScripts', 'replyRules'];
    for (const k of arrKeys)
        if (k in data && !Array.isArray(data[k]))
            return { ok: false, error: `字段${k}格式不对` };
    const arr = (k) => (Array.isArray(data[k]) ? data[k] : []);
    // S47 修复：备份只含文件态（种子从不入文件）→ 恢复以「种子 ∪ 备份」重建（id去重，备份优先）；
    // 备份带 cleared_at（客户清空后备份）则不并种子，保持清空语义
    const clearedBackup = typeof data.cleared_at === 'string';
    const mergeBy = (seed, saved) => {
        const out = [...seed];
        saved.forEach((s) => { const i = out.findIndex((x) => x.id === s.id); if (i > -1)
            out[i] = s;
        else
            out.push(s); });
        return out;
    };
    const noSeed = (x) => (clearedBackup ? [] : x);
    state.accounts = mergeBy(noSeed(mock_1.seedSnapshot.accounts), arr('accounts'));
    state.videos = mergeBy(noSeed(mock_1.seedSnapshot.videos), arr('videos'));
    state.comments = mergeBy(noSeed(mock_1.seedSnapshot.comments), arr('comments'));
    state.tokens = (data.tokens && typeof data.tokens === 'object' ? data.tokens : {});
    state.follows = arr('follows');
    state.replies = arr('replies');
    state.competitors = arr('competitors');
    state.videoTasks = arr('videoTasks');
    state.customScripts = arr('customScripts');
    state.replyRules = arr('replyRules');
    state.settings = (data.settings && typeof data.settings === 'object' ? data.settings : null);
    // S47修：cleared_at 严格跟随备份——备份没有即回到「从未清空」态（S37原设计无脑设now会永久污染环境致种子永灭）
    state.cleared_at = typeof data.cleared_at === 'string' ? data.cleared_at : undefined;
    // 内存态同步（避免重启才能生效）
    mock_1.mockAccounts.splice(0, mock_1.mockAccounts.length, ...state.accounts);
    mock_1.mockVideos.splice(0, mock_1.mockVideos.length, ...state.videos);
    mock_1.mockComments.splice(0, mock_1.mockComments.length, ...state.comments);
    const refs = collRefs;
    if (refs) {
        refs.follows.length = 0;
        refs.follows.push(...state.follows);
        refs.replies.length = 0;
        refs.replies.push(...state.replies);
        refs.competitors.length = 0;
        refs.competitors.push(...state.competitors);
        refs.videoTasks.length = 0;
        refs.videoTasks.push(...state.videoTasks);
        refs.customScripts.length = 0;
        refs.customScripts.push(...state.customScripts);
        refs.replyRules.length = 0;
        refs.replyRules.push(...state.replyRules);
        // S68 协作态按备份回放（缺失字段=清空，以备份时点为准）
        const rids = refs.readIds;
        if (rids) {
            rids.clear();
            (state.read_ids || []).forEach((id) => rids.add(id));
        }
        const ravs = refs.allReadVideos;
        if (ravs) {
            ravs.clear();
            (state.all_read_videos || []).forEach((id) => ravs.add(id));
        }
        const rio = refs.intentOverrides;
        if (rio) {
            rio.clear();
            Object.entries(state.intent_overrides || {}).forEach(([k, v]) => rio.set(k, v));
        }
        if (state.settings) {
            const s = refs.settings;
            Object.keys(s).forEach((k) => { delete s[k]; });
            Object.assign(s, state.settings);
        }
    }
    flushLocal();
    return { ok: true, error: null };
}
exports.restoreBackup = restoreBackup;
function rememberAccount(a) {
    state.accounts = state.accounts.filter((x) => x.id !== a.id).concat(a);
    flushLocal();
}
exports.rememberAccount = rememberAccount;
let batching = false;
/**
 * S58 批量导入合并落盘：批内只改内存，结束一次性flush。
 * 修压测发现的线性劣化（每行全量写盘：2000行=2000次文件重写，单批200行从500ms涨到2s）
 */
function withBatch(fn) {
    batching = true;
    try {
        return fn();
    }
    finally {
        batching = false;
        flushLocal();
    }
}
exports.withBatch = withBatch;
function rememberVideo(v) {
    state.videos = state.videos.filter((x) => x.id !== v.id).concat(v);
    if (!batching)
        flushLocal();
}
exports.rememberVideo = rememberVideo;
function rememberComment(c) {
    state.comments = state.comments.filter((x) => x.id !== c.id).concat(c);
    if (!batching)
        flushLocal();
}
exports.rememberComment = rememberComment;
function recordToken(accountId, t) {
    const rec = { expires_at: t.expires_at, open_id: t.open_id };
    try {
        rec.enc = (0, crypto_2.encryptToken)(t.access);
        if (t.refresh)
            rec.refreshEnc = (0, crypto_2.encryptToken)(t.refresh);
    }
    catch {
        rec.plain = t.access;
        rec.refreshPlain = t.refresh;
        console.warn('[localData] TOKEN_MASTER_KEY缺失，token降级明文落盘（live模式应前置报错）');
    }
    state.tokens[accountId] = rec;
    flushLocal();
}
exports.recordToken = recordToken;
function readToken(accountId) {
    const r = state.tokens[accountId];
    if (!r)
        return { access: null, refresh: null };
    try {
        return {
            access: r.enc ? (0, crypto_2.decryptToken)(r.enc) : r.plain || null,
            refresh: r.refreshEnc ? (0, crypto_2.decryptToken)(r.refreshEnc) : r.refreshPlain || null,
            expires_at: r.expires_at,
            open_id: r.open_id,
        };
    }
    catch {
        return { access: null, refresh: null, expires_at: r.expires_at, open_id: r.open_id };
    }
}
exports.readToken = readToken;
function randomHex(n) { return (0, crypto_1.randomBytes)(n).toString('hex'); }
exports.randomHex = randomHex;
function hash6(s) { return (0, crypto_1.createHash)('sha256').update(s).digest('hex').slice(0, 6); }
exports.hash6 = hash6;
/** 操作日志（内存，绑定/导入实时追加） */
exports.authLogs = [
    { at: '10-09 09:41', op: '扫码授权成功', by: '店长', result: '有效期30天' },
    { at: '10-08 06:02', op: '每日STAT同步', by: '系统', result: '38视频 · 成功' },
    { at: '10-07 22:14', op: 'token预刷新', by: '系统', result: '成功' },
];
function pushAuthLog(op, by, result) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    exports.authLogs.unshift({ at: `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`, op, by, result });
    if (exports.authLogs.length > 50)
        exports.authLogs.pop();
}
exports.pushAuthLog = pushAuthLog;
/** 一次性授权state（mock与live共用，10分钟过期即弃） */
exports.pendingAuthStates = new Map();
function createState(nick) {
    const now = Date.now();
    exports.pendingAuthStates.forEach((v, k) => { if (now - v.at > 600000)
        exports.pendingAuthStates.delete(k); });
    const s = randomHex(8);
    exports.pendingAuthStates.set(s, { nick: nick.slice(0, 20), at: now });
    return s;
}
exports.createState = createState;
