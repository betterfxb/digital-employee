/** Mock数据层（P0演示用，S1-S4不接真实抖音；后续替换为Prisma+Gateway） */
import type { Account, Video, CommentItem, ScriptItem } from './types';
export const mockAccount: Account = {
  id: 'acc_001',
  open_id_mask: '8f3a…9c21',
  nickname: '萌络网络-三角洲跑刀',
  avatar: '',
  auth_type: 'personal',
  expires_at: '2026-11-08',
  days_left: 30,
};

/** 多账号列表（maxAccountsPerTenant=5内；days_left用于健康看板） */
export const mockAccounts: Account[] = [
  { ...mockAccount },
  { id: 'acc_002', open_id_mask: 'c41d…77ab', nickname: '萌络网络-无畏契约', avatar: '', auth_type: 'personal', expires_at: '2026-10-20', days_left: 11 },
];

export const mockVideos: Video[] = [
  { id: 'v1', account_id: 'acc_001', aweme_id: 'aw_001', title: '三角洲跑刀实录 · 一局爆仓', cover: '', publish_time: '10-08', play: 48201, like: 4102, comment: 312, share: 410 },
  { id: 'v2', account_id: 'acc_001', aweme_id: 'aw_002', title: '跑刀教学 · 零氪开荒路线', cover: '', publish_time: '10-07', play: 32118, like: 2340, comment: 188, share: 220 },
  { id: 'v3', account_id: 'acc_002', aweme_id: 'aw_003', title: '无畏契约定制定位赛 · 十连胜', cover: '', publish_time: '10-06', play: 21440, like: 1502, comment: 141, share: 98 },
  { id: 'v7', account_id: 'acc_002', aweme_id: 'aw_007', title: '瓦洛兰特陪玩 · 带飞五杀', cover: '', publish_time: '10-02', play: 15300, like: 1108, comment: 74, share: 60 },
  { id: 'v8', account_id: 'acc_002', aweme_id: 'aw_008', title: '契约新英雄上手教学', cover: '', publish_time: '10-01', play: 7800, like: 520, comment: 30, share: 18 },
];

export const mockComments: CommentItem[] = [
  { id: 'c1', comment_id: 'cm_001', video_id: 'v1', user_nick: '刀友老陈', content: '跑刀一单多少钱？怎么下单？', like_count: 12, create_time: '2小时前', is_read_local: false, intent: '高意向', keywords: ['下单'] },
  { id: 'c2', comment_id: 'cm_002', video_id: 'v1', user_nick: '熬夜选手Lin', content: '求带跑，留个联系方式', like_count: 4, create_time: '3小时前', is_read_local: false, intent: '留电话', keywords: ['电话'] },
  { id: 'c3', comment_id: 'cm_003', video_id: 'v1', user_nick: '路人甲', content: '跑刀要什么段位才能接', like_count: 0, create_time: '5小时前', is_read_local: false, intent: '咨询', keywords: [] },
  { id: 'c4', comment_id: 'cm_004', video_id: 'v1', user_nick: '刷单小哥', content: '加V低价代练，量大从优', like_count: 1, create_time: '昨天', is_read_local: true, intent: '垃圾', keywords: ['加V'] },
  { id: 'c5', comment_id: 'cm_005', video_id: 'v2', user_nick: '阿山', content: '零氪能跑刀吗', like_count: 6, create_time: '1小时前', is_read_local: false, intent: '咨询', keywords: [] },
  { id: 'c6', comment_id: 'cm_006', video_id: 'v2', user_nick: '战队李姐', content: '包出红要加多少钱', like_count: 9, create_time: '4小时前', is_read_local: false, intent: '高意向', keywords: ['价格'] },
  { id: 'c7', comment_id: 'cm_007', video_id: 'v3', user_nick: '开黑小王', content: '定位赛包胜多少钱，怎么下单？', like_count: 7, create_time: '1小时前', is_read_local: false, intent: '高意向', keywords: ['下单'] },
  { id: 'c8', comment_id: 'cm_008', video_id: 'v3', user_nick: '路人乙', content: '什么段位能接定位赛', like_count: 1, create_time: '3小时前', is_read_local: false, intent: '咨询', keywords: [] },
  { id: 'c9', comment_id: 'cm_009', video_id: 'v7', user_nick: '夜猫子Kim', content: '求陪玩，留个联系方式', like_count: 3, create_time: '2小时前', is_read_local: false, intent: '留电话', keywords: ['电话'] },
  { id: 'c10', comment_id: 'cm_010', video_id: 'v7', user_nick: '老板阿凯', content: '五杀陪玩什么价', like_count: 8, create_time: '5小时前', is_read_local: false, intent: '高意向', keywords: ['价格'] },
  { id: 'c11', comment_id: 'cm_011', video_id: 'v8', user_nick: '瓦友', content: '新英雄强吗', like_count: 2, create_time: '昨天', is_read_local: true, intent: '咨询', keywords: [] },
  { id: 'c12', comment_id: 'cm_012', video_id: 'v8', user_nick: '粉丝小林', content: '剪得不错', like_count: 1, create_time: '昨天', is_read_local: true, intent: '普通', keywords: [] },
];

export const mockScripts: ScriptItem[] = [
  { id: 's1', category: '欢迎语', title: '欢迎语', content: '在的兄弟，直接发段位+想跑的图，给你安排刀手。' },
  { id: 's2', category: '报价', title: '报价', content: '跑刀单件9折，今天下单送保险，契约代练按段位报价。' },
  { id: 's3', category: '留资引导', title: '留资引导', content: '方便留个联系方式吗，发你跑刀实录和价目表。' },
];

/**
 * S47 种子快照：模块加载第一时刻（数组纯净）冻结的内置示例。
 * 用途：restoreBackup 恢复时以「种子 ∪ 备份」重建内存（备份只含文件态、从不含种子，
 * 若全量替换会把示例数据和 acc_001/002 种子账号抹掉——J3/J5连锁挂的根因）
 */
export const seedSnapshot = {
  accounts: [...mockAccounts],
  videos: [...mockVideos],
  comments: [...mockComments],
};
