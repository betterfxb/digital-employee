export const dynamic = 'force-dynamic'; // S80: 按名读盘禁静态
import { readBackup } from '@/lib/autoBackup';

/** GET /api/data/backups/download?name=（S80 下载某份本地备份，命名白名单防穿越） */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') || '';
  const r = readBackup(name);
  if ('error' in r) return new Response(r.error, { status: 400 });
  return new Response(r.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}
