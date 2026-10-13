/**
 * S26 live同步编排：当前账号token → 分页拉作品+评论 → upsert（与CSV导入同一落库路径）
 * 触发：POST /api/stats/sync（live模式）；周期调度待Redis队列（MEMORY下一步），当前手动同步即拉
 * 联调复核项：端点路径/分页字段/能力权限（docs/12附录）
 */
import { douyinConfig } from '@/config/douyin.config';
import { readToken, pushAuthLog, hash6 } from './localData';
import { getRepos } from './repo';
import { fetchVideoList, fetchCommentList } from './douyinPort';
import { upsertVideo, upsertComment } from './importData';

export interface LiveSyncResult {
  mode: 'live' | 'mock' | 'error';
  videos: { created: number; updated: number };
  comments: { created: number; updated: number; skipped: number };
  pages: number;
  error?: string;
}

const MAX_VIDEO_PAGES = 5; // 单次同步最多5页×20条=100作品
const MAX_COMMENT_PAGES = 2; // 每作品最多2页×50条=100评论

/** live模式实际拉取；mock直接返回标记（路由层分流，不进本函数） */
export async function runLiveSync(): Promise<LiveSyncResult> {
  const empty = { created: 0, updated: 0 };
  const result: LiveSyncResult = { mode: 'live', videos: empty, comments: { ...empty, skipped: 0 }, pages: 0 };
  const repos = getRepos();
  const aid = repos.accounts.getActive();
  const tok = readToken(aid);
  if (!tok.access || !tok.open_id) {
    return { ...result, mode: 'error', error: '当前账号无有效token或open_id，请先在授权页完成真实授权绑定' };
  }
  let videoCreated = 0;
  let videoUpdated = 0;
  let cCreated = 0;
  let cUpdated = 0;
  let cSkipped = 0;
  let cursor = 0;
  try {
    for (let p = 0; p < MAX_VIDEO_PAGES; p++) {
      const page = await fetchVideoList(tok.access, tok.open_id, cursor, 20);
      result.pages++;
      for (const v of page.list) {
        const c = upsertVideo(aid, v);
        videoCreated += c.created;
        videoUpdated += c.updated;
        // 与upsertVideo同规则定位本地视频id，再按aweme_id关联拉评论
        const localVideoId = `imp-${hash6(aid + v.aweme_id)}`;
        let ccursor = 0;
        for (let cp = 0; cp < MAX_COMMENT_PAGES; cp++) {
          const cpage = await fetchCommentList(tok.access, tok.open_id, v.aweme_id, ccursor, 50);
          for (const cm of cpage.list) {
            const r = upsertComment(aid, { video_id: localVideoId, comment_id: cm.comment_id, nick: cm.nick, content: cm.content, like: cm.like, time: cm.create_time });
            cCreated += r.created;
            cUpdated += r.updated;
            cSkipped += r.skipped;
          }
          if (!cpage.hasMore) break;
          ccursor = cpage.cursor;
        }
      }
      if (!page.hasMore) break;
      cursor = page.cursor;
    }
  } catch (e) {
    pushAuthLog('live同步中断', aid, (e as Error).message);
    return { ...result, mode: 'error', videos: { created: videoCreated, updated: videoUpdated }, comments: { created: cCreated, updated: cUpdated, skipped: cSkipped }, error: (e as Error).message };
  }
  result.videos = { created: videoCreated, updated: videoUpdated };
  result.comments = { created: cCreated, updated: cUpdated, skipped: cSkipped };
  pushAuthLog('live同步完成', aid, `作品${videoCreated + videoUpdated} · 评论${cCreated + cUpdated}`);
  return result;
}

export function liveSyncEnabled(): boolean {
  return douyinConfig.mode === 'live';
}
