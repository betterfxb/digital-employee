export const dynamic = 'force-dynamic'; // S23: 写内存态+落盘，禁静态预渲染
import { fail, ok } from '@/lib/response';
import { douyinConfig } from '@/config/douyin.config';
import { getRepos } from '@/lib/repo';
import { pushAuthLog } from '@/lib/localData';
import { upsertVideo, upsertComment } from '@/lib/importData';

/** CSV解析：支持引号转义/逗号换行/BOM，返回二维数组 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const num = (s: string | undefined) => {
  const n = Number(String(s || '').replace(/[,，\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

function colMap(header: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  header.forEach((h, i) => { m[h.trim()] = i; });
  return m;
}

interface ImportResult { error?: string; created: number; updated: number; skipped?: number }

function importVideos(rows: string[][], aid: string): ImportResult {
  const head = colMap(rows[0]);
  if (head['标题'] === undefined) return { error: '作品CSV缺少「标题」列，可先下载模板', created: 0, updated: 0 };
  let created = 0;
  let updated = 0;
  for (const r of rows.slice(1, douyinConfig.importMaxRows + 1)) {
    const title = (r[head['标题']] || '').trim();
    if (!title) continue;
    const pt = (head['发布时间'] !== undefined ? (r[head['发布时间']] || '').trim() : '') || `${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
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

function importComments(rows: string[][], aid: string): ImportResult {
  const head = colMap(rows[0]);
  if (head['昵称'] === undefined || head['内容'] === undefined || head['视频标题'] === undefined) {
    return { error: '评论CSV需含「昵称,内容,视频标题」列，可先下载模板', created: 0, updated: 0 };
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
      time: (head['时间'] !== undefined ? (r[head['时间']] || '').trim() : '') || '刚刚',
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
  if (kind !== 'videos' && kind !== 'comments') return fail('FATAL', 'kind必须是videos或comments', 400);
  if (typeof csv !== 'string' || !csv.trim()) return fail('FATAL', 'csv内容为空', 400);
  if (Buffer.byteLength(csv, 'utf8') > douyinConfig.importMaxBytes) return fail('FATAL', `单次上限${douyinConfig.importMaxBytes / 1024}KB，请拆分`, 400);

  const rows = parseCsv(csv);
  if (rows.length < 2) return fail('FATAL', '至少需要表头+1行数据', 400);
  if (rows.length - 1 > douyinConfig.importMaxRows) return fail('FATAL', `单次最多${douyinConfig.importMaxRows}行`, 400);

  const repos = getRepos();
  const aid = repos.accounts.getActive();
  const result = kind === 'videos' ? importVideos(rows, aid) : importComments(rows, aid);
  if (result.error) return fail('FATAL', result.error, 400);
  const n = result.created + result.updated;
  pushAuthLog(`导入${kind === 'videos' ? '作品' : '评论'}数据`, '店长', `${n}条 · ${aid}`);
  return ok({ ...result, account_id: aid, kind });
}
