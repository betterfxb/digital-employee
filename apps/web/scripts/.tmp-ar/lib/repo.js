"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRepos = void 0;
/**
 * S9 持久化抽象层：Repository接口 + 内存实现
 * 路由只依赖本文件，不直连store/Prisma。切换：DATA_BACKEND=memory（默认）/prisma（目标态，需DB落地，见prisma/schema.prisma）。
 */
const store_1 = require("./store");
const accessPw_1 = require("./accessPw");
const mock_1 = require("./mock");
const localData_1 = require("./localData"); // S25b: 业务集合变更落盘
const memory = {
    videos: {
        list: (accountId) => mock_1.mockVideos.filter((v) => v.account_id === accountId),
    },
    comments: {
        list: (f) => mock_1.mockComments.map(store_1.viewOf).filter((c) => (!f.video_id || c.video_id === f.video_id) && (!f.intent || c.intent === f.intent) && (!f.keyword || c.content.includes(f.keyword)) && (!f.unreadOnly || !c.is_read_local)),
        // S68 修：协作态写内存后必须落盘（此前重启即丢已读/意图）
        markRead: (ids, valid) => { let n = 0; ids.forEach((id) => { if (valid.has(id)) {
            store_1.readIds.add(id);
            n++;
        } }); if (n > 0)
            (0, localData_1.persistCollections)(); return n; },
        markAllRead: (videoId) => { store_1.allReadVideos.add(videoId); (0, localData_1.persistCollections)(); },
        setIntent: (id, patch) => { const next = { ...(store_1.intentOverrides.get(id) || {}), ...patch }; store_1.intentOverrides.set(id, next); (0, localData_1.persistCollections)(); return { id, ...next }; },
        exists: (id) => mock_1.mockComments.some((c) => c.id === id),
    },
    follows: {
        list: (status) => (status ? store_1.follows.filter((f) => f.status === status) : store_1.follows),
        create: (input) => { const item = { id: `f-${Date.now().toString(36)}`, created_at: new Date().toISOString(), ...input }; store_1.follows.push(item); (0, localData_1.persistCollections)(); return item; },
        update: (id, patch) => {
            const f = store_1.follows.find((x) => x.id === id);
            if (!f)
                return null;
            // S49 先算变更动作再落值（顺序反了会漏记状态变更）
            const acts = [];
            if (patch.status !== undefined && patch.status !== f.status)
                acts.push(`状态改为「${patch.status}」`);
            if (patch.amount !== undefined)
                acts.push(`记成交 ¥${patch.amount}`);
            if (patch.tags !== undefined)
                acts.push(`标签更新为「${patch.tags.join('、') || '无'}」`);
            if (patch.note !== undefined)
                acts.push('更新跟进纪要');
            if (patch.next_remind_at !== undefined && patch.next_remind_at !== f.next_remind_at)
                acts.push(`提醒时间改为「${patch.next_remind_at}」`);
            if (patch.status !== undefined)
                f.status = patch.status;
            if (patch.amount !== undefined)
                f.amount = patch.amount;
            if (patch.tags !== undefined)
                f.tags = patch.tags;
            if (patch.note !== undefined)
                f.note = patch.note;
            if (patch.next_remind_at !== undefined)
                f.next_remind_at = patch.next_remind_at;
            if (acts.length > 0) {
                f.history = [{ at: new Date().toISOString(), act: acts.join('；') }, ...(f.history || [])].slice(0, 20);
            }
            (0, localData_1.persistCollections)();
            return f;
        },
    },
    competitors: {
        list: () => store_1.competitors,
        create: (input) => { const item = { id: `cp-${Date.now().toString(36)}`, play: 0, like: 0, ...input }; store_1.competitors.push(item); (0, localData_1.persistCollections)(); return item; },
        // S53 更新前把当前值记入历史（有变化才留痕），支持竞品变化追踪
        update: (id, patch) => {
            const c = store_1.competitors.find((x) => x.id === id);
            if (!c)
                return null;
            const changed = (patch.play !== undefined && patch.play !== c.play) || (patch.like !== undefined && patch.like !== c.like) || (patch.remark !== undefined && patch.remark !== c.remark);
            if (changed) {
                c.history = [{ at: new Date().toISOString(), play: c.play, like: c.like }, ...(c.history || [])].slice(0, 20);
            }
            if (patch.play !== undefined)
                c.play = patch.play;
            if (patch.like !== undefined)
                c.like = patch.like;
            if (patch.remark !== undefined)
                c.remark = patch.remark;
            (0, localData_1.persistCollections)();
            return c;
        },
    },
    events: {
        receive: (eventId) => { if (store_1.seenEvents.has(eventId))
            return false; store_1.seenEvents.add(eventId); return true; },
        pushDlq: (reason, body) => { store_1.dlq.push({ id: `dlq-${Date.now().toString(36)}`, reason, at: new Date().toISOString(), body: body.slice(0, 500) }); },
        dlq: () => store_1.dlq,
    },
    sync: {
        enqueue: () => { const task_id = `sync-${Date.now().toString(36)}`; store_1.syncJobs.push({ task_id, at: new Date().toISOString() }); return { task_id, scheduled: true }; },
        count: () => store_1.syncJobs.length,
    },
    accounts: {
        list: () => mock_1.mockAccounts.map((a) => ({ ...a, active: a.id === store_1.activeAccountId })),
        getActive: () => store_1.activeAccountId,
        getActiveAccount: () => mock_1.mockAccounts.find((a) => a.id === store_1.activeAccountId) || mock_1.mockAccounts[0],
        switch: (id) => { if (!mock_1.mockAccounts.some((a) => a.id === id))
            return false; (0, store_1.setActiveAccountId)(id); return true; },
        rename: (id, nickname) => { const a = mock_1.mockAccounts.find((x) => x.id === id); if (!a)
            return false; a.nickname = nickname; return true; },
    },
    tasks: {
        isPaused: (type) => store_1.pausedTasks.has(type),
        setPaused: (type, paused) => { if (paused)
            store_1.pausedTasks.add(type);
        else
            store_1.pausedTasks.delete(type); },
        lastRun: (type) => (type === 'statsSync' && store_1.syncJobs.length > 0 ? store_1.syncJobs[store_1.syncJobs.length - 1].at : null),
    },
    settings: {
        get: () => {
            const acc = mock_1.mockAccounts.find((a) => a.id === store_1.activeAccountId) || mock_1.mockAccounts[0];
            return { shop_name: acc.nickname, service_name: store_1.settings.service_name, font_size: store_1.settings.font_size, theme_color: store_1.settings.theme_color, password_changed_at: store_1.settings.password_changed_at, price_list: store_1.settings.price_list, password_hash: store_1.settings.password_hash, auto_reply_enabled: store_1.settings.auto_reply_enabled };
        },
        update: (patch) => {
            if (typeof patch.service_name === 'string')
                store_1.settings.service_name = patch.service_name;
            if (typeof patch.font_size === 'number')
                store_1.settings.font_size = patch.font_size;
            if (typeof patch.theme_color === 'string')
                store_1.settings.theme_color = patch.theme_color;
            if (Array.isArray(patch.price_list))
                store_1.settings.price_list = patch.price_list;
            if (typeof patch.auto_reply_enabled === 'boolean')
                store_1.settings.auto_reply_enabled = patch.auto_reply_enabled;
            (0, localData_1.persistCollections)();
            const acc = mock_1.mockAccounts.find((a) => a.id === store_1.activeAccountId) || mock_1.mockAccounts[0];
            return { shop_name: acc.nickname, service_name: store_1.settings.service_name, font_size: store_1.settings.font_size, theme_color: store_1.settings.theme_color, password_changed_at: store_1.settings.password_changed_at, price_list: store_1.settings.price_list, password_hash: store_1.settings.password_hash, auto_reply_enabled: store_1.settings.auto_reply_enabled };
        },
        // S69 设置/取消访问密码（scrypt哈希，原文永不落盘）
        setAccessPassword: (pw) => {
            if (!pw) {
                store_1.settings.password_hash = null;
                store_1.settings.password_changed_at = null;
                (0, localData_1.persistCollections)();
                return null;
            }
            store_1.settings.password_hash = (0, accessPw_1.hashPassword)(pw);
            store_1.settings.password_changed_at = new Date().toISOString();
            (0, localData_1.persistCollections)();
            return store_1.settings.password_changed_at;
        },
    },
    videoTasks: {
        list: () => store_1.videoTasks,
        create: (video_id, title) => {
            if (store_1.videoTasks.some((t) => t.video_id === video_id))
                return null;
            const item = { id: `vt-${Date.now().toString(36)}`, video_id, title, follow: true, like_done: false, fav_done: false, paused: false, interval_min: 5, last_check: null, created_at: new Date().toISOString().slice(5, 10) };
            store_1.videoTasks.push(item);
            (0, localData_1.persistCollections)();
            return item;
        },
        update: (id, patch) => {
            const t = store_1.videoTasks.find((x) => x.id === id);
            if (!t)
                return null;
            if (typeof patch.follow === 'boolean')
                t.follow = patch.follow;
            if (typeof patch.like_done === 'boolean')
                t.like_done = patch.like_done;
            if (typeof patch.fav_done === 'boolean')
                t.fav_done = patch.fav_done;
            if (typeof patch.paused === 'boolean')
                t.paused = patch.paused;
            if (typeof patch.interval_min === 'number' && patch.interval_min >= 1 && patch.interval_min <= 120)
                t.interval_min = Math.floor(patch.interval_min);
            (0, localData_1.persistCollections)();
            return t;
        },
        remove: (id) => { const i = store_1.videoTasks.findIndex((x) => x.id === id); if (i < 0)
            return false; store_1.videoTasks.splice(i, 1); (0, localData_1.persistCollections)(); return true; },
    },
    scripts: {
        // S57 软删除：active=未删（默认），trash=回收站
        list: (mode) => {
            const all = [...mock_1.mockScripts.map((s) => ({ ...s })), ...store_1.customScripts];
            return mode === 'trash' ? all.filter((s) => s.deleted) : all.filter((s) => !s.deleted);
        },
        create: (category, title, content) => {
            if (!title.trim() || !content.trim())
                return null;
            const item = { id: `cs-${Date.now().toString(36)}`, category: category || '自定义', title: title.trim(), content: content.trim() };
            store_1.customScripts.push(item);
            (0, localData_1.persistCollections)();
            return item;
        },
        // S57 删除=标记进回收站（内置话术不在customScripts天然404；误删可恢复）
        remove: (id) => { const x = store_1.customScripts.find((v) => v.id === id); if (!x || x.deleted)
            return false; x.deleted = true; (0, localData_1.persistCollections)(); return true; },
        restore: (id) => { const x = store_1.customScripts.find((v) => v.id === id); if (!x || !x.deleted)
            return false; x.deleted = undefined; (0, localData_1.persistCollections)(); return true; },
    },
    replyRules: {
        // S57 软删除：active/trash双视图
        list: (mode) => (mode === 'trash' ? store_1.replyRules.filter((r) => r.deleted) : store_1.replyRules.filter((r) => !r.deleted)),
        create: (keyword, reply) => {
            if (!keyword.trim() || !reply.trim())
                return null;
            const item = { id: `rr-${Date.now().toString(36)}`, keyword: keyword.trim(), reply: reply.trim(), enabled: true };
            store_1.replyRules.push(item);
            (0, localData_1.persistCollections)();
            return item;
        },
        update: (id, patch) => {
            const r = store_1.replyRules.find((x) => x.id === id);
            if (!r)
                return null;
            if (typeof patch.reply === 'string' && patch.reply.trim())
                r.reply = patch.reply.trim();
            if (typeof patch.enabled === 'boolean')
                r.enabled = patch.enabled;
            (0, localData_1.persistCollections)();
            return r;
        },
        remove: (id) => { const x = store_1.replyRules.find((v) => v.id === id); if (!x || x.deleted)
            return false; x.deleted = true; (0, localData_1.persistCollections)(); return true; },
        restore: (id) => { const x = store_1.replyRules.find((v) => v.id === id); if (!x || !x.deleted)
            return false; x.deleted = undefined; (0, localData_1.persistCollections)(); return true; },
    },
    replies: {
        list: (comment_id) => store_1.replies.filter((r) => r.comment_id === comment_id),
        create: (comment_id, content) => {
            if (!content.trim())
                return null;
            const item = { id: `rp-${Date.now().toString(36)}`, comment_id, content: content.trim(), at: new Date().toISOString().slice(5, 16).replace('T', ' ') };
            store_1.replies.push(item);
            (0, localData_1.persistCollections)();
            return item;
        },
    },
};
/** 取当前后端（默认memory；prisma待DB接入后实现） */
function getRepos() {
    const backend = process.env.DATA_BACKEND || 'memory';
    if (backend === 'memory')
        return memory;
    throw new Error(`DATA_BACKEND=${backend} 尚未接入，请先完成PG+Prisma落地（prisma/schema.prisma为目标态）`);
}
exports.getRepos = getRepos;
