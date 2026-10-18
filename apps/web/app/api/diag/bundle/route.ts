export const dynamic = 'force-dynamic'; // S59: 实时读license与日志，禁静态预渲染
import fs from 'fs';
import path from 'path';
import { getLicenseState } from '@/lib/license';

/** GET /api/diag/bundle（S59 诊断包：版本/环境/授权状态/近150行日志，报障一键导出txt） */
export async function GET() {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  // 桌面端日志与data同级（main写%APPDATA%/获客中台/server.log，DATA_DIR=其/data）；开发态无日志如实标注
  const logDir = path.join(dataDir, '..');
  const tail = (name: string): string => {
    try {
      const p = path.join(logDir, name);
      if (!fs.existsSync(p)) return '(无此日志文件——非桌面运行或尚未产生)';
      const txt = fs.readFileSync(p, 'utf8');
      const lines = txt.split(/\r?\n/);
      return lines.slice(-150).join('\n');
    } catch (e) {
      return `(读取失败: ${(e as Error).message})`;
    }
  };
  const ls = getLicenseState();
  const body = [
    '==== 获客中台 诊断包 ====',
    `生成时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    `应用版本: ${process.env.APP_VERSION || '(未注入，非桌面运行)'}`,
    `运行环境: node ${process.version} | ${process.platform}/${process.arch}`,
    `数据目录: ${dataDir}`,
    '',
    '---- 授权状态 ----',
    `mode=${ls.mode} valid=${ls.valid} customer=${ls.customer ?? '-'} expires=${ls.expires_at ?? '买断'}`,
    `features=${ls.features.length ? ls.features.join(',') : '(全开=专业版)'} machine_ok=${ls.machine_ok} app_version=${process.env.APP_VERSION || '-'}`,
    `error=${ls.error ?? '-'}`,
    `机器码: ${ls.machine_code}`,
    '',
    '---- server.log 最近150行 ----',
    tail('server.log'),
    '',
    '---- crash.log 最近150行 ----',
    tail('crash.log'),
    '',
    '==== 结束（把整个文件发给服务商即可） ====',
  ].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="diag-${new Date().toISOString().slice(0, 10)}.txt"`,
    },
  });
}
