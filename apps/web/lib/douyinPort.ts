/**
 * S23 IDouyinPort 预真机适配层：mock=占位密钥本地跑通全流程；live=真实开放平台OAuth
 * 作品/评论拉取接口等F2/F4在获得能力授权后于本文件补齐（01-architecture IDouyinPort切换点）
 */
import { douyinConfig } from '@/config/douyin.config';
import { authConfig } from '@/config/auth.config';
import { randomHex } from './localData';
import { mapApiVideo, mapApiComment, type MappedVideo, type MappedComment, type ApiVideoRaw, type ApiCommentRaw } from './douyinMappers';

export interface DouyinToken {
  access_token: string;
  refresh_token: string;
  open_id: string;
  nickname?: string;
  expires_in: number;
}

function daysFrom(sec: number): { expires_at: string; days_left: number } {
  const d = new Date(Date.now() + sec * 1000);
  return { expires_at: d.toISOString().slice(0, 10), days_left: Math.max(1, Math.ceil(sec / 86400)) };
}

export function tokenExpiry(sec: number): { expires_at: string; days_left: number } {
  return daysFrom(sec);
}

/** live：构造真实授权跳转URL；配置缺失返回null */
export function buildAuthorizeUrl(state: string): string | null {
  if (douyinConfig.mode !== 'live') return null;
  if (!douyinConfig.clientKey || !douyinConfig.clientSecret) return null;
  const q = new URLSearchParams({
    client_key: douyinConfig.clientKey,
    response_type: 'code',
    redirect_uri: douyinConfig.baseUrl + douyinConfig.redirectPath,
    scope: authConfig.requiredScopes,
    state,
  });
  return `${douyinConfig.authUrl}?${q.toString()}`;
}

/** mock：生成占位token（授权码→token全流程本地跑通，密钥到位后同接口切换） */
export function mockExchange(code: string, nick: string): DouyinToken {
  return {
    access_token: `mock-at-${randomHex(6)}`,
    refresh_token: `mock-rt-${randomHex(6)}`,
    open_id: `mock_${code.slice(5, 13)}`,
    nickname: nick || douyinConfig.testNick,
    expires_in: 2592000,
  };
}

/** mock：稳定的open_id（按昵称派生，重复授权幂等更新不新增账号） */
export function mockOpenId(nick: string): string {
  const base = nick || douyinConfig.testNick;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = ((h << 5) - h + base.charCodeAt(i)) | 0;
  return `mock_${Math.abs(h).toString(16).padStart(8, '0')}`;
}

async function douyinPost(url: string, form: URLSearchParams): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error('开放平台网络不通（检查服务器出网/代理）');
  }
  const j = (await res.json()) as { data?: { error_code?: number; description?: string } & Record<string, unknown> };
  const d = j.data;
  if (!d) throw new Error('开放平台响应异常');
  if (d.error_code !== 0) throw new Error(d.description || `开放平台错误码${d.error_code}`);
  return d;
}

/** live：授权码换token + userinfo取昵称（联调时按官方文档复核端点） */
export async function exchangeCode(code: string): Promise<DouyinToken> {
  const d = await douyinPost(douyinConfig.tokenUrl, new URLSearchParams({
    client_key: douyinConfig.clientKey,
    client_secret: douyinConfig.clientSecret,
    code,
    grant_type: 'authorization_code',
  }));
  let nickname: string | undefined;
  try {
    const u = await fetch(douyinConfig.userInfoUrl, { headers: { 'access-token': String(d.access_token) }, signal: AbortSignal.timeout(10_000) });
    const uj = (await u.json()) as { data?: { nickname?: string } };
    nickname = uj.data?.nickname;
  } catch { /* userinfo失败不阻断绑定 */ }
  return {
    access_token: String(d.access_token),
    refresh_token: String(d.refresh_token || ''),
    open_id: String(d.open_id),
    nickname,
    expires_in: Number(d.expires_in || 2592000),
  };
}

/** live：刷新token */
export async function refreshAccessToken(refreshToken: string): Promise<DouyinToken> {
  const d = await douyinPost(douyinConfig.refreshUrl, new URLSearchParams({
    client_key: douyinConfig.clientKey,
    client_secret: douyinConfig.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }));
  return {
    access_token: String(d.access_token),
    refresh_token: String(d.refresh_token || refreshToken),
    open_id: String(d.open_id || ''),
    expires_in: Number(d.expires_in || 2592000),
  };
}

async function douyinGet(url: string, params: Record<string, string | number>): Promise<Record<string, unknown>> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => q.set(k, String(v)));
  let res: Response;
  try {
    res = await fetch(`${url}?${q}`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error('开放平台网络不通（检查服务器出网/代理）');
  }
  const j = (await res.json()) as { data?: { error_code?: number; description?: string } & Record<string, unknown> };
  const d = j.data;
  if (!d) throw new Error('开放平台响应异常');
  if (d.error_code !== 0) throw new Error(d.description || `开放平台错误码${d.error_code}`);
  return d;
}

export interface Paged<T> { list: T[]; cursor: number; hasMore: boolean }

/** S26 live：授权用户作品列表（需video.data能力；端点/字段联调复核）。mock返回空页 */
export async function fetchVideoList(accessToken: string, openId: string, cursor = 0, count = 20): Promise<Paged<MappedVideo>> {
  if (douyinConfig.mode !== 'live') return { list: [], cursor: 0, hasMore: false };
  const d = await douyinGet(douyinConfig.videoListUrl, { access_token: accessToken, open_id: openId, cursor, count });
  const raw = (d.list || d.data || []) as ApiVideoRaw[];
  return {
    list: raw.map(mapApiVideo).filter((x): x is MappedVideo => x !== null),
    cursor: Number(d.cursor || 0),
    hasMore: Boolean(d.has_more),
  };
}

/** S26 live：单视频评论列表（需评论读取能力；端点/字段联调复核）。mock返回空页 */
export async function fetchCommentList(accessToken: string, openId: string, awemeId: string, cursor = 0, count = 50): Promise<Paged<MappedComment>> {
  if (douyinConfig.mode !== 'live') return { list: [], cursor: 0, hasMore: false };
  const d = await douyinGet(douyinConfig.commentListUrl, { access_token: accessToken, open_id: openId, aweme_id: awemeId, cursor, count });
  const raw = (d.list || d.comments || []) as ApiCommentRaw[];
  return {
    list: raw.map(mapApiComment).filter((x): x is MappedComment => x !== null),
    cursor: Number(d.cursor || 0),
    hasMore: Boolean(d.has_more),
  };
}
