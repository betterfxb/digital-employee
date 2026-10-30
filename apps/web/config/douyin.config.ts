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
  /** 开放平台OAuth端点（2026-10-30按官方文档复核修正：/oauth/authize/系旧误值，现行=connect；联调当日以申请到的权限包文档再核） */
  authUrl: 'https://open.douyin.com/platform/oauth/connect/',
  tokenUrl: 'https://open.douyin.com/oauth/access_token/',
  refreshUrl: 'https://open.douyin.com/oauth/refresh_token/',
  userInfoUrl: 'https://open.douyin.com/oauth/userinfo/',
  /** S26 数据拉取端点（需video.list.bind/item.comment能力授权；2026-10-30官方文档复核：video_list与comment现行路径） */
  videoListUrl: 'https://open.douyin.com/api/douyin/v1/video/video_list/',
  commentListUrl: 'https://open.douyin.com/video/comment/list/',
  /**
   * S74 官方「评论回复」自动化通道（红线三重门之一）：
   * 能力审核通过 → DOUYIN_COMMENT_REPLY=1 且填入官方端点（联调复核，未确认前留空=执行器恒不外发）
   */
  commentReplyEnabled: process.env.DOUYIN_COMMENT_REPLY === '1',
  commentReplyUrl: process.env.DOUYIN_COMMENT_REPLY_URL || '',
  /** 授权状态一次性有效窗口(毫秒) */
  stateTtlMs: 10 * 60 * 1000,
  /** mock模式默认昵称（授权页可输入自定义） */
  testNick: process.env.DOUYIN_TEST_NICK || '我的抖音号',
  /** 单次CSV导入行数上限 */
  importMaxRows: 200,
  /** 单次CSV字节上限(200KB) */
  importMaxBytes: 200 * 1024,
} as const;
