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
execSync('npx tsc lib/crypto.ts lib/tokenVault.ts lib/machineId.ts lib/remind.ts lib/leadScore.ts lib/report.ts lib/tiers.ts lib/bizTrend.ts lib/backupCrypto.ts lib/accessPw.ts lib/autoReply.ts lib/autoCfg.ts lib/csvParse.ts lib/marketing.ts lib/commentViews.ts lib/videoStats.ts lib/repair.ts --outDir scripts/.tmp-crypto --module commonjs --target es2020 --skipLibCheck --esModuleInterop --rootDir .', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
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

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail === 0 ? 'CRYPTO ALL GREEN' : `CRYPTO ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
