/** S26 开放平台映射单测：tsc编译零依赖的lib/douyinMappers后import真模块（模式同crypto-test） */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
let fail = 0;
const check = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fail++; };

const tmp = path.join(__dirname, '.tmp-port');
fs.rmSync(tmp, { recursive: true, force: true });
execSync('npx tsc lib/douyinMappers.ts --outDir scripts/.tmp-port --module commonjs --target es2020 --skipLibCheck', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
const { mapApiVideo, mapApiComment } = require('./.tmp-port/douyinMappers.js');

// mapApiVideo：官方文档预写字段（aweme_id/desc/create_time/statistics.*）
const v = mapApiVideo({ aweme_id: '7300000000000000001', desc: '三角洲跑刀实录', create_time: 1728300000, statistics: { play_count: 48201, digg_count: 4102, comment_count: 312, share_count: 410 } });
check(v && v.aweme_id === '7300000000000000001' && v.title === '三角洲跑刀实录' && v.play === 48201 && v.like === 4102 && v.comment === 312 && v.share === 410, 'mapApiVideo 字段映射');
check(v && /^\d{2}-\d{2}$/.test(v.publish_time), 'mapApiVideo publish_time为MM-DD');
check(mapApiVideo({}) === null && mapApiVideo(null) === null, 'mapApiVideo 无效输入返回null');
check(mapApiVideo({ aweme_id: 'x', desc: '', statistics: {} }).title.startsWith('作品'), 'mapApiVideo 空desc兜底标题');
const v2 = mapApiVideo({ aweme_id: 'x', statistics: { play_count: -5 } });
check(v2 && v2.play === 0, 'mapApiVideo 负数归零');

// mapApiComment：cid/text/user.nickname/digg_count
const c = mapApiComment({ cid: 'cmt_1', text: '这跑刀怎么下单？多少钱', create_time: Math.floor(Date.now() / 1000) - 3600, digg_count: 12, user: { nickname: '刀友老陈' } });
check(c && c.comment_id === 'cmt_1' && c.nick === '刀友老陈' && c.content.includes('下单') && c.like === 12 && c.create_time === '1小时前', 'mapApiComment 字段映射+相对时间');
check(mapApiComment({ text: '无cid' }) === null && mapApiComment({ cid: 'c' }) === null, 'mapApiComment 缺cid/text返回null');
check(mapApiComment({ cid: 'c', text: 'hi' }).nick === '抖音用户', 'mapApiComment 无昵称兜底');

// 端点防漂移（douyin.config）
const cfg = fs.readFileSync(path.join(__dirname, '..', 'config', 'douyin.config.ts'), 'utf8');
check(cfg.includes('video/list') && cfg.includes('video/comment/list'), 'douyin.config 含数据拉取端点');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail === 0 ? 'PORT ALL GREEN' : `PORT ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
