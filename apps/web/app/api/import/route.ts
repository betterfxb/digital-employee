export const dynamic = 'force-dynamic'; // S23: 写内存态+落盘，禁静态预渲染
import { fail, ok } from '@/lib/response';
import { douyinConfig } from '@/config/douyin.config';
import { assistConfig } from '@/config/assist.config';
import { getRepos } from '@/lib/repo';
import { pushAuthLog, withBatch, markImportAt } from '@/lib/localData'; // S125 markImportAt
import { upsertVideo, upsertComment } from '@/lib/importData';
import { parseCsv, colMap, missingColError, normalizeDateTime } from '@/lib/csvParse';

const num = (s: string | undefined) => {
  const n = Number(String(s || '').replace(/[,，\s%]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

interface ImportResult { error?: string; created: number; updated: number; skipped?: number }

function importVideos(rows: string[][], aid: string): ImportResult {
  const head = colMap(rows[0]);
  if (head['标题'] === undefined) return { error: missingColError('作品CSV', ['标题'], rows[0]), created: 0, updated: 0 };
  let created = 0;
  let updated = 0;
  for (const r of rows.slice(1, douyinConfig.importMaxRows + 1)) {
    const title = (r[head['标题']] || '').trim();
    if (!title) continue;
    const ptRaw = head['发布时间'] !== undefined ? (r[head['发布时间']] || '').trim() : '';
    const pt = normalizeDateTime(ptRaw) || `${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`; // S79 Excel绝对日期归一MM-DD
    const c = upsertVideo(aid, {
      title,
      publish_time: pt,
      play: num(head['播放'] !== undefined ? r[head['播放']] : ''),
      like: num(head['点赞'] !== undefined ? r[head['点赞']] : ''),
      comment: num(head['评论'] !== undefined ? r[head['评论']] : ''),
      share: num(head['转发'] !== undefined ? r[head['转发']] : ''),
    });
    created += c.created;
    updated += c.updated;
  }
  if (created + updated === 0) return { error: '没有可导入的有效行（检查「标题」列与数据）', created: 0, updated: 0 };
  return { created, updated };
}

/** S118 存量客户名单导入：昵称必填，状态/提醒/金额/联系方式可选；同名活跃线索跳过防重复 */
function importLeads(rows: string[][]): ImportResult {
  const head = colMap(rows[0]);
  if (head['昵称'] === undefined) return { error: missingColError('客户名单', ['昵称'], rows[0]), created: 0, updated: 0, skipped: 0 };
  const repos = getRepos();
  const activeNicks = new Set(repos.follows.list('').filter((f) => f.status !== '无效').map((f) => f.peer_nick));
  const firstVid = repos.videos.list(repos.accounts.getActive())[0]?.id || '';
  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1, douyinConfig.importMaxRows + 1)) {
    const nick = (r[head['昵称']] || '').trim().slice(0, 30);
    if (!nick) continue;
    if (activeNicks.has(nick)) { skipped++; continue; }
    activeNicks.add(nick);
    const sv = head['状态'] !== undefined ? (r[head['状态']] || '').trim() : '';
    const rtRaw = head['提醒'] !== undefined ? (r[head['提醒']] || '').trim() : '';
    const amt = head['金额'] !== undefined ? num(r[head['金额']]) : 0;
    const ct = head['联系方式'] !== undefined ? (r[head['联系方式']] || '').trim().slice(0, 32) : '';
    repos.follows.create({
      peer_nick: nick,
      source_video_id: firstVid,
      next_remind_at: (rtRaw || '明天 09:00').slice(0, 40),
      status: assistConfig.followStatuses.includes(sv) ? sv : '待回访',
      amount: amt > 0 ? amt : undefined,
      contact: ct || undefined,
      source: 'import', // S128 归因排除标记
    });
    created++;
  }
  if (created === 0) return { error: `没有可导入的新客户（跳过${skipped}个已有客户）`, created: 0, updated: 0, skipped };
  return { created, updated: 0, skipped };
}

function importComments(rows: string[][], aid: string): ImportResult {
  const head = colMap(rows[0]);
  const missing = ['昵称', '内容', '视频标题'].filter((c) => head[c] === undefined);
  if (missing.length > 0) {
    return { error: missingColError('评论CSV', missing, rows[0]), created: 0, updated: 0, skipped: 0 };
  }
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const r of rows.slice(1, douyinConfig.importMaxRows + 1)) {
    const nick = (r[head['昵称']] || '').trim();
    const content = (r[head['内容']] || '').trim();
    const vTitle = (r[head['视频标题']] || '').trim();
    if (!nick || !content) continue;
    const c = upsertComment(aid, {
      video_title: vTitle,
      nick,
      content,
      like: num(head['点赞'] !== undefined ? r[head['点赞']] : ''),
      time: normalizeDateTime(head['时间'] !== undefined ? (r[head['时间']] || '').trim() : '') || '刚刚', // S79 评论时间归一（2026-10-18 12:00→10-18；相对时间原样）
    });
    created += c.created;
    updated += c.updated;
    skipped += c.skipped;
  }
  if (created + updated === 0) return { error: skipped > 0 ? `没有匹配到视频标题的评论（跳过${skipped}条）` : '没有可导入的有效行', created: 0, updated: 0, skipped };
  return { created, updated, skipped };
}

/**
 * POST /api/import {kind: videos|comments, csv} — S23 真实数据导入（自己的账号数据手工入中台）
 * 作品按「当前账号+标题+发布时间」upsert；评论按「视频+昵称+内容」upsert，意图本地分类
 */
export async function POST(req: Request) {
  let body: { kind?: string; csv?: string } | null = null;
  try { body = await req.json(); } catch { return fail('FATAL', '请求体需为JSON', 400); }
  const kind = body?.kind;
  const csv = body?.csv;
  if (kind !== 'videos' && kind !== 'comments' && kind !== 'leads') return fail('FATAL', 'kind必须是videos/comments/leads', 400);
  if (typeof csv !== 'string' || !csv.trim()) return fail('FATAL', 'csv内容为空', 400);
  if (Buffer.byteLength(csv, 'utf8') > douyinConfig.importMaxBytes) return fail('FATAL', `单次上限${douyinConfig.importMaxBytes / 1024}KB，请拆分`, 400);

  const rows = parseCsv(csv);
  if (rows.length < 2) return fail('FATAL', '至少需要表头+1行数据', 400);
  if (rows.length - 1 > douyinConfig.importMaxRows) return fail('FATAL', `单次最多${douyinConfig.importMaxRows}行`, 400);

  const repos = getRepos();
  const aid = repos.accounts.getActive();
  // S58 批量合并落盘：整批一次flush（修每行写盘的线性劣化）
  const result = withBatch(() => (kind === 'videos' ? importVideos(rows, aid) : kind === 'comments' ? importComments(rows, aid) : importLeads(rows)));
  if (result.error) return fail('FATAL', result.error, 400);
  markImportAt(); // S125 导入成功=数据新鲜度起点
  const n = result.created + result.updated;
  pushAuthLog(`导入${kind === 'videos' ? '作品' : kind === 'comments' ? '评论' : '客户名单'}数据`, '店长', `${n}条 · ${aid}`);
  return ok({ ...result, account_id: aid, kind });
}
