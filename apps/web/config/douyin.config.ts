/**
 * S23 预真机对接配置 | DOUYIN_MODE=mock(默认，占位密钥本地跑通)/live(真实开放平台)
 * live所需密钥：DOUYIN_CLIENT_KEY/DOUYIN_CLIENT_SECRET（开放平台建应用后获得，未获得前保持mock）
 */
export const douyinConfig = {
  mode: process.env.DOUYIN_MODE === 'live' ? 'live' : 'mock',
  clientKey: process.env.DOUYIN_CLIENT_KEY || '',
  clientSecret: process.env.DOUYIN_CLIENT_SECRET || '',
  /** OAuth回调地址（开放平台后台需登记同域名） */
  baseUrl: process.env.DOUYIN_REDIRECT_BASE || 'http://localhost:3001',
  redirectPath: '/api/auth/douyin/callback',
  /** 开放平台OAuth端点（联调时以官方文档复核为准） */
  authUrl: 'https://open.douyin.com/oauth/authize/',
  tokenUrl: 'https://open.douyin.com/oauth/access_token/',
  refreshUrl: 'https://open.douyin.com/oauth/refresh_token/',
  userInfoUrl: 'https://open.douyin.com/oauth/userinfo/',
  /** S26 数据拉取端点（需video.data等能力授权；联调时以官方文档复核为准） */
  videoListUrl: 'https://open.douyin.com/api/douyin/v1/video/list/',
  commentListUrl: 'https://open.douyin.com/api/douyin/v1/video/comment/list/',
  /** 授权状态一次性有效窗口(毫秒) */
  stateTtlMs: 10 * 60 * 1000,
  /** mock模式默认昵称（授权页可输入自定义） */
  testNick: process.env.DOUYIN_TEST_NICK || '我的抖音号（预真机）',
  /** 单次CSV导入行数上限 */
  importMaxRows: 200,
  /** 单次CSV字节上限(200KB) */
  importMaxBytes: 200 * 1024,
} as const;
