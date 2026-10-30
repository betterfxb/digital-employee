/** crypto真单测：tsc编译lib/crypto+lib/tokenVault后import真模块（零新增依赖，用仓内typescript） */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
process.env.TOKEN_MASTER_KEY = 'test-master-key-32bytes-padding!!';
let fail = 0;
const check = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fail++; };

// 0) 编译真模块
const tmp = path.join(__dirname, '.tmp-crypto');
fs.rmSync(tmp, { recursive: true, force: true });
execSync('npx tsc lib/crypto.ts lib/tokenVault.ts lib/machineId.ts lib/remind.ts lib/leadScore.ts lib/report.ts lib/tiers.ts lib/bizTrend.ts lib/backupCrypto.ts lib/accessPw.ts lib/autoReply.ts lib/autoCfg.ts lib/csvParse.ts lib/marketing.ts lib/commentViews.ts lib/videoStats.ts lib/repair.ts lib/funnel.ts lib/attribution.ts lib/visitDue.ts lib/compliance.ts lib/dealMath.ts lib/heartbeat.ts lib/monthly.ts --outDir scripts/.tmp-crypto --module commonjs --target es2020 --skipLibCheck --esModuleInterop --rootDir .', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
const { encryptToken, decryptToken } = require('./.tmp-crypto/lib/crypto.js');
const vault = require('./.tmp-crypto/lib/tokenVault.js');
const { matchBind, fingerprint, machineCode } = require('./.tmp-crypto/lib/machineId.js');
const { parseRemind, isDue, shouldNotifyReport, todayKey, daysUntilExpiry } = require('./.tmp-crypto/lib/remind.js');
const { leadScore, scoreLevel } = require('./.tmp-crypto/lib/leadScore.js');
const { parseCommentTime, buildReport } = require('./.tmp-crypto/lib/report.js');
const { hasFeature, TIERS } = require('./.tmp-crypto/lib/tiers.js');
const { computeSegments, computeInsights, computeExperiments, campaignStats, hotKeys } = require('./.tmp-crypto/lib/marketing.js');
const { sanitizeViews } = require('./.tmp-crypto/lib/commentViews.js');
const { engagementPct, topHot, lowWarn } = require('./.tmp-crypto/lib/videoStats.js');
const { trendSeries } = require('./.tmp-crypto/lib/bizTrend.js');
const { encryptBackup, decryptBackup } = require('./.tmp-crypto/lib/backupCrypto.js');
const { hashPassword, verifyPassword } = require('./.tmp-crypto/lib/accessPw.js');
const { nextGapMs, replyGate } = require('./.tmp-crypto/lib/autoReply.js');
const { mergeAutoCfg, AUTO_DEFAULTS } = require('./.tmp-crypto/lib/autoCfg.js');
const { detectDelim, parseCsv, colMap, missingCols, normalizeDateTime, decodeTextBuffer } = require('./.tmp-crypto/lib/csvParse.js');

// 1) 真模块往返（key()每次调用重读env，换key无需清缓存）
const secret = 'access-token-敏感内容-123';
check(decryptToken(encryptToken(secret)) === secret, 'crypto roundtrip（真模块）');
check(encryptToken(secret).cipher !== encryptToken(secret).cipher, 'crypto iv随机（真模块）');
let wrongKey = false;
const savedKey = process.env.TOKEN_MASTER_KEY;
try {
  const p = encryptToken(secret);
  process.env.TOKEN_MASTER_KEY = 'wrong-key-xxxxxxxxxxxxxxxxxxxxxxxx';
  decryptToken(p);
} catch { wrongKey = true; } finally { process.env.TOKEN_MASTER_KEY = savedKey; }
check(wrongKey, 'crypto 错key解密失败（真模块）');

// 2) vault接线（poll→save / me→has 的同一实现）
vault.saveToken('acc_test', secret);
check(vault.hasToken('acc_test') === true, 'vault save/has');
check(vault.loadToken('acc_test') === secret, 'vault load解密');
check(vault.loadToken('nope') === null, 'vault 缺失返回null');

// 3) 源码一致性（防实现漂移）
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'crypto.ts'), 'utf8');
check(src.includes('aes-256-gcm'), 'crypto.ts aes-256-gcm');
check(src.includes("createHash('sha256')"), 'crypto.ts sha256(master)');
check(src.includes('randomBytes(12)'), 'crypto.ts 12B iv');
check(src.includes('getAuthTag') && src.includes('setAuthTag'), 'crypto.ts tag编解');
check(src.includes("NODE_ENV === 'production'"), 'crypto 缺key生产fail-fast');

// 4) S30 机器绑定matchBind纯逻辑（三因子命中≥min(2,绑定数)）
const cur = { cpu: 'aaa', disk: 'bbb', mac: 'ccc' };
check(matchBind(undefined, cur) === true, 'matchBind 无绑定放行');
check(matchBind({}, cur) === true, 'matchBind 空绑定放行');
check(matchBind({ cpu: 'aaa', disk: 'bbb', mac: 'ccc' }, cur) === true, 'matchBind 3/3命中');
check(matchBind({ cpu: 'aaa', disk: 'xxx', mac: 'ccc' }, cur) === true, 'matchBind 换1个硬件仍放行(2/3)');
check(matchBind({ cpu: 'aaa', disk: 'xxx', mac: 'yyy' }, cur) === false, 'matchBind 换2个硬件拒绝(1/3)');
check(matchBind({ cpu: 'aaa', disk: 'bbb', mac: '' }, cur) === true, 'matchBind 双因子绑定全命中放行');
check(matchBind({ cpu: 'aaa', disk: '', mac: 'yyy' }, cur) === false, 'matchBind 双因子绑定不全拒绝');
check(fingerprint({ cpu: '', disk: '', mac: '' }).cpu === '' && machineCode({ cpu: 'a', disk: 'b', mac: 'c' }) === 'a.b.c', 'machineId 空因子+机器码格式');

// 5) S44 跟进提醒时间解析（口语今天/明天/后天 + ISO + 无法解析）
// S79修脆弱性：parseRemind/isDue的口语按真实"今天"解析，断言必须用运行日动态基准（原硬编码2026-10-19跨零点即挂）
const realRef = Date.now();
const now = new Date('2026-10-18T12:00:00').getTime(); // ISO断言用钉死基准（两边都是绝对日期，跨天稳定）
const tmr = parseRemind('明天 18:00');
const tmrExpect = new Date(); tmrExpect.setDate(tmrExpect.getDate() + 1); tmrExpect.setHours(18, 0, 0, 0);
check(tmr !== null && tmr.getTime() === tmrExpect.getTime(), 'remind 明天18点解析');
const todayRef = new Date(); todayRef.setHours(0, 0, 0, 0);
check(isDue(todayRef.toISOString(), realRef) === true && isDue('明天 18:00', realRef) === false, 'remind 到期判定');
check(isDue('2026-10-18T11:00:00', now) === true, 'remind ISO兼容');
check(parseRemind('随便写的') === null && isDue(null) === false, 'remind 无法解析不提醒');

// 6) S48 线索意向评分（意图+点赞+关键词规则）
const scHot = leadScore({ intent: '高意向', like_count: 15, content: '跑刀一单多少钱怎么下单', keywords: ['价格'] });
const scSpam = leadScore({ intent: '垃圾', like_count: 0, content: '加V代练', keywords: [] });
check(scHot === 95 && scoreLevel(scHot) === 'high', 'leadScore 高意向+热词=95/high');
check(scSpam === 0 && scoreLevel(scSpam) === 'low', 'leadScore 垃圾0分/low');
const scMid = leadScore({ intent: '咨询', like_count: 2, content: '要什么段位', keywords: [] });
check(scMid === 22 && scoreLevel(scMid) === 'low', 'leadScore 咨询2+赞=22/low');
check(leadScore({ intent: '留电话', like_count: 99, content: '留个联系方式', keywords: ['电话'] }) === 90, 'leadScore 留电话+强信号=90');

// 7) S50 报告：相对时间解析 + 日报生成
const T0 = new Date('2026-10-18T12:00:00').getTime();
check(parseCommentTime('2小时前', T0).getTime() === T0 - 7200000 && parseCommentTime('30分钟前', T0).getTime() === T0 - 1800000, 'report 相对时间解析');
check(parseCommentTime('前天怪文', T0) === null && parseCommentTime('10-08 14:00', T0).getDate() === 8, 'report 无法解析null+MM-DD取日');
const rep = buildReport({ videos: [], comments: [], follows: [] }, 'daily');
check(rep.summary.startsWith('今日概览') && rep.metrics.length === 11 && rep.suggestions.length > 0, 'report 空数据日报结构完整');
const repW = buildReport({ videos: [{ play: 100, like: 10, comment: 1, publish_time: '10-01' }], comments: [], follows: [] }, 'weekly');
check(repW.summary.startsWith('近7天概览') && repW.metrics.some((m) => m.label === '近7天新评论'), 'report 周报周期与增量指标');

// 8) S54 授权分版本：features白名单语义（[]=全开）
check(hasFeature([], 'report') && hasFeature(undefined, 'report'), 'tiers 空features全开（专业版/兼容旧license）');
check(hasFeature(TIERS.basic.features, 'report') === false && hasFeature(TIERS.basic.features, 'lead') === false, 'tiers 基础版锁report/lead');
check(hasFeature(['report'], 'report') === true, 'tiers 白名单命中可用');

// 9) S55 业务趋势序列（升序取7天+缺key补0）
const BH = { '2026-10-17': { comments: 5 }, '2026-10-18': { comments: 9 }, '2026-10-16': { comments: 2 } };
const ts1 = trendSeries(BH, 'comments');
check(ts1.map((x) => x.date).join(',') === '2026-10-16,2026-10-17,2026-10-18', 'biz trend 升序取序列');
check(ts1[2].v === 9 && trendSeries(BH, 'revenue').every((x) => x.v === 0), 'biz trend 取值+缺key补0');

// 10) S56 日报提醒判定（开关/当天去重/9点窗口）
const D0 = new Date('2026-10-18T09:03:00').getTime();
check(shouldNotifyReport(D0, null, true) === true, 'report-notify 9:03窗口触发');
check(shouldNotifyReport(D0, todayKey(D0), true) === false, 'report-notify 当天已提醒去重');
check(shouldNotifyReport(new Date('2026-10-18T10:00:00').getTime(), null, true) === false && shouldNotifyReport(D0, null, false) === false, 'report-notify 非窗口/关开关不触发');

// 11) S59 授权到期天数（买断null/未来按floor取整/已过为负）
check(daysUntilExpiry(null, D0) === null && daysUntilExpiry(undefined, D0) === null, 'expiry 买断返回null不提醒');
check(daysUntilExpiry('2026-10-20', D0) === 2, 'expiry 未来日期floor取整(18日9点→20日23:59=2整天)');
check(daysUntilExpiry('2026-10-17', D0) === -1, 'expiry 已过期为负(ceil会得-0陷阱)');

// 12) S61 备份加密（往返/错口令/篡改）
const bObj = { accounts: [{ id: 'a1' }], videos: [], note: '中文✓混合json' };
const encStr = encryptBackup(bObj, 'pass-123456');
check(JSON.stringify(decryptBackup(encStr, 'pass-123456')) === JSON.stringify(bObj), 'bkenc 加解密往返一致');
check(decryptBackup(encStr, 'wrong-pass-xx') === null, 'bkenc 错误口令返回null');
const tampered = JSON.parse(encStr); tampered.data = tampered.data.slice(0, -4) + 'AAAA';
check(decryptBackup(JSON.stringify(tampered), 'pass-123456') === null, 'bkenc 数据篡改被GCM拒绝');

// 13) S69 访问密码哈希（格式/原文不泄/校验/坏输入）
const pwHash = hashPassword('secret-123');
check(pwHash.startsWith('s1$') && !pwHash.includes('secret-123'), 'apw 哈希格式且不含原文');
check(verifyPassword('secret-123', pwHash) === true && verifyPassword('wrong-pw', pwHash) === false, 'apw 口令对通过错拒绝');
// 15) S75 自动化配置钳制
const def = mergeAutoCfg(null);
check(def.sync_interval_min === AUTO_DEFAULTS.sync_interval_min && def.dashboard_refresh_sec === 60, 'acfg 空输入补默认');
const clamped = mergeAutoCfg({ sync_interval_min: 999, reply_gap_min_sec: 500, reply_gap_max_sec: 100, reply_tone: '怪' });
check(clamped.sync_interval_min === 240 && clamped.reply_gap_min_sec === 100 && clamped.reply_tone === '亲切', 'acfg 越界钳制+倒挂修正+坏枚举回退');
check(mergeAutoCfg({ quiet_enabled: 'x' }).quiet_enabled === true, 'acfg 坏布尔回退默认');

// 16) S79 导入容错共享层（编码/TSV/别名/日期）
check(detectDelim('标题\t播放\r\nx\t1') === '\t' && parseCsv('a\tb\n1\t2').length === 2, 'csv TSV自动识别（Excel复制粘贴）');
check(colMap(['用户昵称', '正文', '所属视频'])['昵称'] === 0 && colMap(['用户昵称', '正文', '所属视频'])['视频标题'] === 2, 'csv 别名归一（前后端同表）');
check(missingCols('comments', ['用户', '内容']).join() === '视频标题', 'csv 缺列精确报（别名过后仅剩一缺）');
check(normalizeDateTime('2026-10-18 12:00:00') === '10-18' && normalizeDateTime('2026年10月8日') === '10-08' && normalizeDateTime('2小时前') === '2小时前' && normalizeDateTime('10-08') === '10-08', 'csv 日期归一四形态');
check(decodeTextBuffer(Buffer.from([0xB1, 0xEA, 0xCC, 0xE2, 0xC1, 0xBF])) === '标题量' && decodeTextBuffer(Buffer.from('\uFEFFabc', 'utf8')) === 'abc', 'csv GBK嗅探与BOM剥离');

// 17) S83-87 智能营销纯函数层（动态时间基准，防跨零点脆弱）
const NOWD = Date.now();
const iso = (off) => new Date(NOWD + off * 86400000).toISOString();
const mcs = [
  { id: 'c1', user_nick: 'A', content: '一单多少钱', intent: '高意向', is_read_local: false, keywords: ['价格'] },
  { id: 'c2', user_nick: 'B', content: '下单', intent: '高意向', is_read_local: true, keywords: ['价格'] },
  { id: 'c3', user_nick: 'C', content: '好玩', intent: '闲聊', is_read_local: false },
];
const mfs = [
  { id: 'f1', peer_nick: 'B', status: '待回访', next_remind_at: iso(-2), created_at: iso(-20), history: [{ at: iso(-20), act: '建档' }] },
  { id: 'f2', peer_nick: 'D', status: '已转化', amount: 120, history: [{ at: iso(-1), act: '状态→已转化' }] },
  { id: 'f3', peer_nick: 'E', status: '待回访', next_remind_at: iso(3), created_at: iso(-2), history: [] },
];
const mseg = (k) => computeSegments(mcs, mfs, NOWD).find((s) => s.key === k);
check(mseg('hot_untracked').count === 1 && mseg('hot_untracked').members[0].nick === 'A', 'mktg 客群高意向未登记');
check(mseg('overdue').count === 1 && mseg('overdue').members[0].nick === 'B', 'mktg 客群逾期跟进');
check(mseg('silent').count === 1 && mseg('silent').members[0].nick === 'B', 'mktg 客群沉默14天可唤醒');
check(mseg('repeat').count === 1 && mseg('repeat').members[0].extra === '¥120', 'mktg 客群成交老客带金额');
check(hotKeys(mcs, 2)[0].word === '价格' && mseg('hotkw').count === 1, 'mktg 热词与热词人群');
const mins = computeInsights(mcs, mfs, {}, NOWD);
check(mins.some((x) => x.label === '待处理高意向' && x.value === '1') && mins.some((x) => x.label === '7日成交' && x.value === '1 单'), 'mktg 简报高意向与成交条目');
check(computeInsights([], [], {}, NOWD).length === 0, 'mktg 空数据诚实空态');
const mexp = computeExperiments(
  [
    { id: 'r1', comment_id: 'c1', content: 'x', at: '', variant: 1 },
    { id: 'r2', comment_id: 'c2', content: 'x', at: '', variant: 2 },
    { id: 'r3', comment_id: 'c3', content: 'x', at: '' },
    { id: 'r4', comment_id: 'c9', content: 'x', at: '', variant: 3 },
  ],
  new Map(mcs.map((c) => [c.id, c])), mfs
);
check(mexp.total === 2 && mexp.buckets[0].used === 1 && mexp.buckets[1].leads === 1 && mexp.sufficient === false, 'mktg A/B位次过滤与样本不足如实');
const mcamp = { id: 'k1', name: 'n', start_at: iso(-7).slice(0, 10), end_at: iso(7).slice(0, 10), checklist: [{ text: 'a', done: true }, { text: 'b', done: false }], created_at: iso(-8) };
const mst = campaignStats(mcamp, mcs, mfs, NOWD);
check(mst.status === '进行中' && mst.match_count === 3 && mst.follow_new === 1 && mst.done_in_period === 1 && mst.revenue_in_period === 120 && mst.progress === 50, 'mktg 活动复盘口径全套');
check(campaignStats({ ...mcamp, start_at: iso(2).slice(0, 10), end_at: iso(9).slice(0, 10) }, mcs, mfs, NOWD).status === '未开始', 'mktg 活动状态边界');
check(hasFeature(TIERS.basic.features, 'marketing') === false, 'mktg 基础版锁marketing键');

// 18) S93 评论保存视图钳制
check(sanitizeViews(null).length === 0 && sanitizeViews('x').length === 0 && sanitizeViews([null, 1, 'a']).length === 0, 'views 坏输入全滤空');
const vs = sanitizeViews([{ name: '这个名字特别特别长的视图超十二个字了', kw: '一'.repeat(30), intent: '高意向高意向高意向高', unreadOnly: 'yes' }]);
check(vs.length === 1 && vs[0].name.length === 12 && vs[0].kw.length === 20 && vs[0].intent.length === 8 && vs[0].unreadOnly === false, 'views 越界钳制与坏布尔回退false');
check(sanitizeViews([{ name: '重复', kw: 'a' }, { name: '重复', kw: 'b' }, {}]).length === 1, 'views 同名去重与无名丢弃');
check(sanitizeViews(Array.from({ length: 12 }, (_, i) => ({ name: 'v' + i }))).length === 8, 'views 总量封顶8');

// 19) S106 作品分析纯函数
check(Math.abs((engagementPct({ play: 1000, like: 50, comment: 10, share: 10 }) ?? 0) - 7) < 0.001 && engagementPct({ play: 0, like: 5, comment: 0, share: 0 }) === null, 'vstats 互动率与零分母null');
const vsA = [{ id: 'a', play: 100, like: 50, comment: 0, share: 0 }, { id: 'b', play: 100000, like: 100, comment: 0, share: 0 }, { id: 'c', play: 50, like: 40, comment: 0, share: 0 }];
const hotA = topHot(vsA); // b率1.0% > a率50%? a=50/100=50% b=0.1% c=80%但play<minPlay剔除 → top={a,b}
check(hotA.has('a') && hotA.has('b') && !hotA.has('c'), 'vstats 爆款门槛：小分母高互动不刷榜');
check(lowWarn([{ id: 'x', play: 10, like: 0, comment: 0, share: 0 }]).size === 0 && lowWarn([{ id: 'x', play: 5, like: 0, comment: 0, share: 0 }, { id: 'y', play: 1000, like: 1, comment: 0, share: 0 }, { id: 'z', play: 1000, like: 1, comment: 0, share: 0 }]).has('x'), 'vstats 低效预警样本门槛与阈值');

// 14) S74 自动回复节奏与三重门（纯函数）
check(nextGapMs(0) === 60000 && nextGapMs(0.5) === 150000 && nextGapMs(0.999999) >= 239000, 'areply 冷却60-240秒边界');
check(replyGate('mock', false, '').gate.includes('live') && replyGate('live', false, 'https://x').gate.includes('能力'), 'areply 通道门先于能力门');
check(replyGate('live', true, '').gate.includes('能力') && replyGate('live', true, 'https://x').ready === true, 'areply 能力空拒与三门就绪');

// 20) S122 数据自愈纯函数
const { recoveryOrder, isSaneState } = require('./.tmp-crypto/lib/repair.js');
check(
  JSON.stringify(recoveryOrder([
    { name: 'auto-2026-10-27.json', mtime: '2026-10-27T03:00:00Z' },
    { name: 'manual-2026-10-28-112233.json', mtime: '2026-10-28T11:22:33Z' },
    { name: 'auto-2026-10-28.json', mtime: '2026-10-28T03:00:00Z' },
  ])) === JSON.stringify(['manual-2026-10-28-112233.json', 'auto-2026-10-28.json', 'auto-2026-10-27.json']),
  'repair 候选按mtime新→旧（manual与auto混排）'
);
check(
  JSON.stringify(recoveryOrder([{ name: 'readme.txt', mtime: '2026-10-29T00:00:00Z' }, { name: 'evil.json', mtime: '2026-10-29T00:00:00Z' }, { name: 'auto-2026-10-26.json', mtime: '2026-10-26T03:00:00Z' }])) === JSON.stringify(['auto-2026-10-26.json']),
  'repair 白名单过滤目录杂物'
);
check(
  JSON.stringify(recoveryOrder([{ name: 'auto-2026-10-28.json', mtime: '' }, { name: 'auto-2026-10-27.json', mtime: '' }])) === JSON.stringify(['auto-2026-10-28.json', 'auto-2026-10-27.json']),
  'repair 同mtime按名称降序确定性兜底'
);
check(isSaneState({ accounts: [], videos: [], comments: [], tokens: {} }) === true, 'repair 四核心集合齐全=健全（空数组也算）');
check(isSaneState({ accounts: [], videos: [] }) === false && isSaneState(null) === false && isSaneState('str') === false && isSaneState({ accounts: [], videos: [], comments: [], tokens: 'x' }) === false, 'repair 半套/非对象/tokens类型错均拒');

// 21) S124 转化漏斗纯函数
const { buildFunnel, funnelDrop } = require('./.tmp-crypto/lib/funnel.js');
const fc = [
  { user_nick: 'A', intent: '高意向', is_read_local: true },
  { user_nick: 'A2', intent: '高意向', is_read_local: false },
  { user_nick: 'B', intent: '留电话', is_read_local: true },
  { user_nick: 'C', intent: '咨询', is_read_local: true },
  { user_nick: 'D', intent: '普通', is_read_local: false },
];
const ff = [{ peer_nick: 'A', status: '已转化' }, { peer_nick: 'B', status: '待回访' }, { peer_nick: 'X', status: '无效' }];
const ft = buildFunnel(fc, ff);
check(ft.map((x) => x.n).join(',') === '5,3,2,2,1', 'funnel 五级收窄：全5→意向3→已读2→登记2→成交1');
check(funnelDrop(ft).join(',') === '0,2,1,0,1', 'funnel 相邻级流失数');
const ftMono = buildFunnel([{ user_nick: 'Y', intent: '高意向', is_read_local: false }], [{ peer_nick: 'Y', status: '已转化' }]);
check(ftMono[2].n === 0 && ftMono[4].n === 0, 'funnel 未读即不入后级（严格子集收窄，昵称再活跃也不倒挂）');
check(buildFunnel([], []).map((x) => x.n).join(',') === '0,0,0,0,0', 'funnel 空数据全零不NaN');

// 22) S128 作品带货榜归因纯函数
const { attribution } = require('./.tmp-crypto/lib/attribution.js');
const va = [{ id: 'v1', title: '跑刀实录' }, { id: 'v2', title: '契约陪玩' }];
const vf = [
  { source_video_id: 'v1', status: '已转化', amount: 298 },
  { source_video_id: 'v1', status: '待回访' },
  { source_video_id: 'v1', status: '无效' },
  { source_video_id: 'v2', status: '已转化', amount: 100 },
  { source_video_id: 'v2', status: '已转化', amount: 50 },
  { source_video_id: 'v1', status: '已转化', amount: 9999, source: 'import' }, // 导入污染项必须被排除
];
const vrows = attribution(vf, va);
check(vrows.length === 2, 'attr 两作品产两行');
const attr1 = vrows.find((r) => r.videoId === 'v1');
check(attr1.amount === 298 && attr1.done === 1 && attr1.leads === 2, 'attr 排除import线索与无效项（v1真实=2有效线索1成交298元）');
check(vrows[0].videoId === 'v1' && vrows[0].amount === 298, 'attr 金额倒序v1居首');
check(attribution([], va).length === 0 && attribution([{ source_video_id: '', status: '已转化', amount: 1 }], va).length === 0, 'attr 空/无来源不产行');

// 23) S129 老客复购回访纯函数
const { lastTouchAt, visitDue, daysSinceTouch } = require('./.tmp-crypto/lib/visitDue.js');
const NOW = Date.UTC(2026, 10, 1);
const vf2 = { status: '已转化', created_at: new Date(NOW - 40 * 86400000).toISOString(), history: [{ at: new Date(NOW - 35 * 86400000).toISOString(), act: 'x' }] };
check(lastTouchAt(vf2) === NOW - 35 * 86400000, 'visit 最近接触取max(建档,history)最新条');
check(visitDue(vf2, 30, NOW) === true && visitDue(vf2, 40, NOW) === false, 'visit 30天阈值到期/40天未到期（恰在边界外）');
check(visitDue({ status: '待回访', created_at: vf2.created_at }, 30, NOW) === false, 'visit 非已转化永不回访');
check(lastTouchAt({ status: '已转化' }) === null && visitDue({ status: '已转化', history: [{ at: 'garbage' }] }, 30, NOW) === false, 'visit 无史/史全乱码宁可不提醒');
check(daysSinceTouch({ status: '已转化', created_at: new Date(NOW - 2.5 * 86400000).toISOString() }, NOW) === 2, 'visit floor天数');

// 24) S130 话术合规体检纯函数
const { scanText } = require('./.tmp-crypto/lib/compliance.js');
const { complianceConfig } = require('./.tmp-crypto/config/compliance.config.js');
const h1 = scanText('加微信 13800001111 报价更优惠');
check(h1.some((x) => x.name === '站外导流') && h1.every((x) => x.why && x.fix), 'compliance 导流词命中且每条带理由与建议');
check(scanText('你好，跑刀服务按约定交付，拍小窗口下单即可').length === 0, 'compliance 正常话术零误报');
check(scanText('包赢绝无封号，加我微信详聊').length >= 2, 'compliance 承诺词族+导流词族双命中（同族去重为一条）');
check(scanText('').length === 0 && scanText(null).length === 0, 'compliance 空输入安全');
check(complianceConfig.rules.every((r) => { try { new RegExp(r.pat); return true; } catch { return false; } }), 'compliance 全部规则正则可编译');

// 25) S133/S134 经营账纯函数
const { weekRange, sumWeekDone, parseDealHistory } = require('./.tmp-crypto/lib/dealMath.js');
const wr = weekRange(new Date(2026, 9, 29, 15, 30).getTime()); // 周四下午
const wrD = new Date(wr.start);
check(wrD.getDay() === 1 && wrD.getHours() === 0 && wr.end - wr.start === 7 * 86400000, 'week 周界=本地周一00:00起7天');
const wj = weekRange(new Date(2027, 0, 1, 9, 0).getTime()); // 跨年后周五
check(new Date(wj.start).getDay() === 1 && wj.start <= new Date(2027, 0, 1).getTime() && wj.start >= new Date(2026, 11, 21).getTime(), 'week 跨年元旦归上周（12-28周一起）');
const NOW2 = new Date(2026, 9, 29).getTime();
const inWk = new Date(weekRange(NOW2).start + 3600000).toISOString();
const outWk = new Date(weekRange(NOW2).start - 3600000).toISOString();
const wm = [
  { status: '已转化', amount: 298, history: [{ at: inWk, act: '状态改为「已转化」' }] },
  { status: '已转化', amount: 100, history: [{ at: outWk, act: '状态改为「已转化」' }] },
  { status: '已转化', amount: 50, history: [{ at: inWk, act: '更新跟进纪要' }] },
  { status: '待回访', amount: 1, history: [{ at: inWk, act: '状态改为「已转化」' }] },
];
const sw = sumWeekDone(wm, NOW2);
check(sw.n === 1 && sw.amount === 298, 'weekSum 只计本周状态转已转化（旧周/非状态act/非已转化状态均排除）');
check(parseDealHistory({ status: '已转化', history: [{ at: inWk, act: '记成交 ¥298' }, { at: inWk, act: '状态改为「已转化」；记成交 ¥100' }] }).n === 2, 'clv 合并动作按「；」拆段计数');
const clv2 = parseDealHistory({ status: '已转化', amount: 398, history: [{ at: inWk, act: '记成交 ¥298' }, { at: inWk, act: '记成交 ¥100' }] });
check(clv2.total === 398, 'clv 累计金额求和');
check(parseDealHistory({ status: '已转化', history: [{ at: inWk, act: '记成交¥abc' }] }).n === 0, 'clv 脏动作跳过不炸');
const clv3 = parseDealHistory({ status: '已转化', amount: 50 });
check(clv3.n === 1 && clv3.total === 50, 'clv 无动作史但已转化有金额=按现值记1次（create即成交兜底）');
check(parseDealHistory({ status: '待回访', amount: 50 }).n === 0, 'clv 非已转化不算成交');

// 26) S136 业务心跳逐日聚合
const { buildHeartbeat } = require('./.tmp-crypto/lib/heartbeat.js');
const NOWH = new Date(2026, 9, 29, 12, 0).getTime();
const isoAt = (t) => new Date(t).toISOString();
const hbEmpty = buildHeartbeat([], 14, NOWH);
check(hbEmpty.length === 14 && hbEmpty[13].date === '2026-10-29' && hbEmpty[0].date === '2026-10-16', 'hb 14天连续日期补零（今日常为末位）');
const hb1 = buildHeartbeat([{ status: '待回访', created_at: isoAt(NOWH - 2 * 86400000), history: [{ at: isoAt(NOWH), act: '状态改为「已转化」；记成交 ¥298' }] }], 14, NOWH);
check(hb1[13].touches === 1 && hb1[13].deals === 1 && hb1[13].amount === 298 && hb1[11].leads === 1, 'hb 建档落建档日/动作与成交金额落动作日');
check(hb1[0].leads === 0 && hb1[0].touches === 0, 'hb 无记录日为零不缺项');
const hbOut = buildHeartbeat([{ status: '待回访', created_at: isoAt(NOWH - 20 * 86400000), history: [{ at: isoAt(NOWH - 20 * 86400000), act: '记成交 ¥999' }] }], 14, NOWH);
check(hbOut.reduce((s, d) => s + d.leads + d.touches + d.amount, 0) === 0, 'hb 窗口外事件全忽略');
const { silentDue } = require('./.tmp-crypto/lib/visitDue.js');
check(silentDue({ status: '待回访', created_at: isoAt(NOWH - 15 * 86400000) }, 14, NOWH) === true, 'silent 15天无记录=沉默');
check(silentDue({ status: '待回访', created_at: isoAt(NOWH - 14 * 86400000) }, 14, NOWH) === false && silentDue({ status: '已手动回复', created_at: isoAt(NOWH - 20 * 86400000), history: [{ at: isoAt(NOWH) }] }, 14, NOWH) === false, 'silent 恰14天不算/有新动作即解铃');
check(silentDue({ status: '已转化', created_at: isoAt(NOWH - 60 * 86400000) }, 14, NOWH) === false && silentDue({ status: '无效', created_at: isoAt(NOWH - 60 * 86400000) }, 14, NOWH) === false, 'silent 已转化走复购口径/无效永不满');

// 27) S140 月度复盘纯函数
const { buildMonthReview } = require('./.tmp-crypto/lib/monthly.js');
const MNOW = new Date(2026, 9, 15, 10, 0).getTime();
const mIso = (y, mo, dd) => new Date(y, mo, dd, 9, 0).toISOString();
const mf = [
  { created_at: mIso(2026, 9, 10), history: [{ at: mIso(2026, 9, 10), act: '状态改为「已转化」；记成交 ¥300' }, { at: mIso(2026, 9, 12), act: '记成交 ¥100' }] },
  { created_at: mIso(2026, 8, 20), history: [{ at: mIso(2026, 8, 25), act: '记成交 ¥50' }, { at: mIso(2026, 9, 8), act: '记成本 ¥80' }, { at: mIso(2026, 9, 3), act: '更新跟进纪要' }] },
  { created_at: mIso(2026, 6, 1), history: [] },
];
const mr = buildMonthReview(mf, MNOW);
check(mr.month === '2026-10' && mr.prevMonth === '2026-09', 'monthly 月键与上月（10月对9月）');
const mm = (k) => mr.metrics.find((x) => x.key === k);
check(mm('amount').cur === 400 && mm('amount').prev === 50 && mm('deals').cur === 2 && mm('deals').prev === 1, 'monthly 成交分段计数落对月（合并动作拆段）');
check(mm('acts').cur === 4 && mm('leads').cur === 1 && mm('leads').prev === 1 && mm('cost').cur === 80 && mm('rep').cur === 1, 'monthly 动作/线索/成本/复购逐月分桶（窗口外全弃）');
check(buildMonthReview([], new Date(2027, 0, 5).getTime()).prevMonth === '2026-12', 'monthly 跨年1月的上月是12月');
check(buildMonthReview(mf, MNOW).metrics.length === 6, 'monthly 六项指标齐');

// 28) S141 备份演练计数比对纯函数
const { countsOf, diffCounts } = require('./.tmp-crypto/lib/repair.js');
const cs = countsOf({ accounts: [1, 2], videos: [], comments: [1], follows: [1, 2, 3], replies: 'x', campaigns: [], drafts: [] });
check(cs.accounts === 2 && cs.comments === 1 && cs.follows === 3 && cs.replies === -1, 'countsOf 七集合计数（非数组记-1）');
const df1 = diffCounts({ accounts: 1, videos: 0, comments: 0, follows: 2, replies: 0, campaigns: 0, drafts: 0 }, { accounts: 1, videos: 3, comments: 1, follows: 2, replies: 0, campaigns: 0, drafts: 0 });
check(df1.find((d) => d.key === 'videos').lost === 3 && df1.find((d) => d.key === 'comments').lost === 1 && df1.find((d) => d.key === 'follows').lost === 0, 'diffCounts 备份比当前多=流失嫌疑计数');
check(diffCounts({ accounts: 1, videos: 3, comments: 1, follows: 2, replies: 0, campaigns: 0, drafts: 0 }, { accounts: 1, videos: 0, comments: 0, follows: 2, replies: 0, campaigns: 0, drafts: 0 }).every((d) => d.lost === 0), 'diffCounts 备份比当前少=正常漂移零警报');

// 29) S142 客户分层纯函数
const { tierOf } = require('./.tmp-crypto/lib/dealMath.js');
check(tierOf({ status: '已转化', history: [{ at: 'x', act: '记成交 ¥600' }] }, 500) === 'A', 'tier 累计达线=A');
check(tierOf({ status: '已转化', amount: 300 }, 500) === 'B', 'tier 成交未达线=B（含create兜底现值）');
check(tierOf({ status: '待回访' }, 500) === 'C', 'tier 无成交=C培育');
check(tierOf({ status: '待回访', history: [{ at: 'x', act: '记成交 ¥300' }, { at: 'x', act: '记成交 ¥300' }] }, 500) === 'A', 'tier 成交2次直升A（无视金额门槛）');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail === 0 ? 'CRYPTO ALL GREEN' : `CRYPTO ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
