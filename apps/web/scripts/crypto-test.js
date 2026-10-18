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
execSync('npx tsc lib/crypto.ts lib/tokenVault.ts lib/machineId.ts lib/remind.ts lib/leadScore.ts lib/report.ts lib/tiers.ts lib/bizTrend.ts lib/backupCrypto.ts lib/accessPw.ts lib/autoReply.ts lib/autoCfg.ts --outDir scripts/.tmp-crypto --module commonjs --target es2020 --skipLibCheck --esModuleInterop --rootDir .', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
const { encryptToken, decryptToken } = require('./.tmp-crypto/lib/crypto.js');
const vault = require('./.tmp-crypto/lib/tokenVault.js');
const { matchBind, fingerprint, machineCode } = require('./.tmp-crypto/lib/machineId.js');
const { parseRemind, isDue, shouldNotifyReport, todayKey, daysUntilExpiry } = require('./.tmp-crypto/lib/remind.js');
const { leadScore, scoreLevel } = require('./.tmp-crypto/lib/leadScore.js');
const { parseCommentTime, buildReport } = require('./.tmp-crypto/lib/report.js');
const { hasFeature, TIERS } = require('./.tmp-crypto/lib/tiers.js');
const { trendSeries } = require('./.tmp-crypto/lib/bizTrend.js');
const { encryptBackup, decryptBackup } = require('./.tmp-crypto/lib/backupCrypto.js');
const { hashPassword, verifyPassword } = require('./.tmp-crypto/lib/accessPw.js');
const { nextGapMs, replyGate } = require('./.tmp-crypto/lib/autoReply.js');
const { mergeAutoCfg, AUTO_DEFAULTS } = require('./.tmp-crypto/lib/autoCfg.js');

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
const now = new Date('2026-10-18T12:00:00').getTime();
const tmr = parseRemind('明天 18:00');
check(tmr !== null && tmr.getTime() === new Date('2026-10-19T18:00:00').getTime(), 'remind 明天18点解析');
check(isDue('今天 11:00', now) === true && isDue('明天 18:00', now) === false, 'remind 到期判定');
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

// 14) S74 自动回复节奏与三重门（纯函数）
check(nextGapMs(0) === 60000 && nextGapMs(0.5) === 150000 && nextGapMs(0.999999) >= 239000, 'areply 冷却60-240秒边界');
check(replyGate('mock', false, '').gate.includes('live') && replyGate('live', false, 'https://x').gate.includes('能力'), 'areply 通道门先于能力门');
check(replyGate('live', true, '').gate.includes('能力') && replyGate('live', true, 'https://x').ready === true, 'areply 能力空拒与三门就绪');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail === 0 ? 'CRYPTO ALL GREEN' : `CRYPTO ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
