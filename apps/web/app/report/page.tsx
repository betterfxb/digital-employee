'use client';
import { useEffect, useState } from 'react';
import { buildMonthReview } from '@/lib/monthly'; // S140
import { App, Button, Modal, Segmented } from 'antd';
import { downloadCsv } from '@/lib/csv';
import { buildReport, type Report } from '@/lib/report';
import { trendSeries, type BizSnapshot } from '@/lib/bizTrend';
import type { CommentItem, Follow, Video } from '@/lib/types';

/** S50 智能日报/周报：本地真实数据聚合 → 指标网格+文字总结+行动建议（可复制/导出） */
export default function ReportPage() {
  const { message } = App.useApp();
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily');
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState(false);
  /** S55 业务趋势：打开报告页即记当日快照并取回历史 */
  const [hist, setHist] = useState<Record<string, Partial<BizSnapshot>>>({});
  /** S62 分享图（canvas 生成，微信可发的日报长图） */
  const [shareImg, setShareImg] = useState<string | null>(null);
  const [mrows, setMrows] = useState<{ created_at?: string; history?: { at: string; act: string }[] }[] | null>(null); // S140 月度复盘源数据

  const snap = () => fetch('/api/report/snapshot', { method: 'POST' }).then((r) => r.json()).then((d) => setHist(d.history || {})).catch(() => {});

  const build = (k: 'daily' | 'weekly') => {
    Promise.all([
      fetch('/api/videos').then((r) => r.json()),
      fetch('/api/comments?unread_only=0').then((r) => r.json()),
      fetch('/api/follows').then((r) => r.json()),
    ]).then(([v, c, f]) => {
      setMrows((f.items || []) as { created_at?: string; history?: { at: string; act: string }[] }[]);
      setReport(buildReport({
        videos: (v.items || []) as Video[],
        comments: (c.items || []) as CommentItem[],
        follows: (f.items || []) as Follow[],
      }, k));
      setErr(false);
    }).catch(() => setErr(true));
  };
  useEffect(() => { build('daily'); snap(); }, []);

  const switchKind = (k: string) => { const kk = k === '周报' ? 'weekly' : 'daily'; setKind(kk); build(kk); };
  const copySummary = () => {
    if (!report) return;
    navigator.clipboard?.writeText(report.summary).then(() => message.success('总结已复制')).catch(() => message.error('复制失败，请手动选择'));
  };
  const exportReport = () => {
    if (!report) return;
    downloadCsv(`${kind === 'daily' ? '日报' : '周报'}指标.csv`, ['指标', '数值'], report.metrics.map((m) => [m.label, m.value]));
  };

  /** S62 生成分享图：750宽微信友好长图（标题带+指标宫格+文字总结+行动建议+页脚） */
  const genShare = () => {
    if (!report) return;
    const W = 750;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    if (!ctx) { message.error('当前环境不支持生成图片'); return; }
    const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
    const wrap = (text: string, maxWidth: number): string[] => {
      const lines: string[] = [];
      let line = '';
      for (const ch of text) {
        if (ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; } else line += ch;
      }
      if (line) lines.push(line);
      return lines;
    };
    const metrics = report.metrics.slice(0, 10);
    const metricRows = Math.ceil(metrics.length / 2);
    const summaryLines = wrap(report.summary, W - 100);
    const H = 160 + metricRows * 78 + 60 + summaryLines.length * 32 + report.suggestions.length * 62 + 120;
    cv.width = W; cv.height = H;
    // 底色
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    // 头部
    ctx.fillStyle = '#1A1A18'; ctx.fillRect(0, 0, W, 120);
    ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(`获客中台 · ${kind === 'daily' ? '经营日报' : '经营周报'}`, 40, 58);
    ctx.fillStyle = '#C9C4BC'; ctx.font = `17px ${FONT}`;
    ctx.fillText(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }), 40, 94);
    // 指标宫格
    let y = 176;
    ctx.fillStyle = '#6B6862'; ctx.font = `18px ${FONT}`;
    ctx.fillText('核心指标', 40, y); y += 18;
    metrics.forEach((m, i) => {
      const x = 40 + (i % 2) * 355;
      const my = y + Math.floor(i / 2) * 78;
      ctx.fillStyle = '#8A8580'; ctx.font = `17px ${FONT}`;
      ctx.fillText(m.label, x, my + 20);
      ctx.fillStyle = '#1A1A18'; ctx.font = `bold 30px ${FONT}`;
      ctx.fillText(m.value, x, my + 58);
    });
    y += metricRows * 78 + 30;
    // 文字总结
    ctx.fillStyle = '#FCFBF9'; ctx.fillRect(40, y, W - 80, summaryLines.length * 32 + 56);
    ctx.fillStyle = '#6B6862'; ctx.font = `17px ${FONT}`;
    ctx.fillText('文字总结', 60, y + 34);
    ctx.fillStyle = '#1A1A18'; ctx.font = `19px ${FONT}`;
    summaryLines.forEach((ln, i) => ctx.fillText(ln, 60, y + 72 + i * 32));
    y += summaryLines.length * 32 + 86;
    // 行动建议
    ctx.fillStyle = '#6B6862'; ctx.font = `17px ${FONT}`;
    ctx.fillText('行动建议', 40, y); y += 34;
    report.suggestions.slice(0, 4).forEach((s) => {
      ctx.fillStyle = '#1A1A18'; ctx.beginPath(); ctx.arc(48, y - 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#33312D'; ctx.font = `18px ${FONT}`;
      wrap(s, W - 110).forEach((ln, i) => { ctx.fillText(ln, 64, y + i * 28); y += 28; });
      y += 26;
    });
    // 页脚
    ctx.fillStyle = '#A8A5A0'; ctx.font = `15px ${FONT}`;
    ctx.fillText('本报告由获客中台基于本机真实数据生成', 40, H - 34);
    setShareImg(cv.toDataURL('image/png'));
  };

  const dateLabel = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  return (
    <div>
      <div style={{ borderBottom: '1px solid #E8E6E1' }}>
        {/* S113 头与内容同列宽居中（1680全宽版式与其余页一致，宽屏不再缩成窄条） */}
        <div style={{ maxWidth: 1680, margin: '0 auto', padding: '14px 32px' }}><b style={{ fontSize: 15 }}>经营报告</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>本地真实数据自动汇总 · 可复制给合伙人/老板</div></div>
      </div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Segmented options={['日报', '周报']} value={kind === 'daily' ? '日报' : '周报'} onChange={switchKind} />
          <span style={{ fontSize: 12, color: '#A8A5A0' }}>{dateLabel}</span>
          <span style={{ flex: 1 }} />
          <Button size="small" onClick={copySummary} disabled={!report}>复制总结</Button>
          <Button size="small" onClick={exportReport} disabled={!report}>导出指标CSV</Button>
          <Button size="small" className="no-print" onClick={() => window.print()} disabled={!report}>打印/存PDF</Button>
          <Button size="small" type="primary" onClick={genShare} disabled={!report}>生成分享图</Button>
        </div>
        {err && <div className="card" style={{ padding: 20 }}>报告生成失败 <Button size="small" style={{ marginLeft: 8 }} onClick={() => build(kind)}>重试</Button></div>}
        {!report && !err && <div className="skel" style={{ height: 240 }}>loading</div>}
        {report && (
          <>
            <div className="card" style={{ padding: 18 }}>
              <b>{kind === 'daily' ? '日报' : '周报'}指标</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
                {report.metrics.map((m) => (
                  <div key={m.label} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#6B6862' }}>{m.label}</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 18, marginTop: 16 }}>
              <b>7天趋势</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>每日首次打开本页自动记录 · 只记真实数据</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
                {([['comments', '评论数'], ['follows', '线索数'], ['revenue', '成交额']] as [keyof BizSnapshot, string][]).map(([k, label]) => {
                  const series = trendSeries(hist, k);
                  const cur = series.length ? series[series.length - 1].v : 0;
                  const pts = series.map((p, i) => `${(i / Math.max(series.length - 1, 1)) * 100},${36 - (p.v / Math.max(...series.map((x) => x.v), 1)) * 30 - 3}`).join(' ');
                  return (
                    <div key={k} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#6B6862' }}>{label}<b className="num" style={{ fontSize: 16, color: '#1A1A18', marginLeft: 8 }}>{k === 'revenue' ? `¥${cur.toLocaleString()}` : cur.toLocaleString()}</b></div>
                      {series.length >= 2 ? (
                        <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ width: '100%', height: 40, marginTop: 6 }} role="img" aria-label={`${label}趋势`}>
                          <polyline points={pts} fill="none" stroke="#1A1A18" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </svg>
                      ) : (
                        <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 12 }}>今日已记第1个点，明天起显示变化</div>
                      )}
                      {series.length >= 2 && <div className="num" style={{ fontSize: 10, color: '#A8A5A0', display: 'flex', justifyContent: 'space-between' }}><span>{series[0].date.slice(5)}</span><span>{series[series.length - 1].date.slice(5)}</span></div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card" style={{ padding: 18, marginTop: 16, background: '#FCFBF9' }}>
              <b>文字总结</b>
              <div style={{ fontSize: 13, color: '#1A1A18', lineHeight: 2, marginTop: 10 }}>{report.summary}</div>
            </div>
            <div className="card" style={{ padding: 18, marginTop: 16 }}>
              <b>行动建议</b>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.suggestions.map((s) => (
                  <div key={s} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: '#1A1A18', marginTop: 7, flexShrink: 0 }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {/* S140 月度经营复盘：纯本机 ISO 事件月对月，与日/周报快照独立（报告生成失败不影响此块） */}
        {mrows && (() => {
          const mv = buildMonthReview(mrows, Date.now());
          const fmt = (m: { cur: number; prev: number; money?: boolean }) => (m.money ? `¥${m.cur.toLocaleString()}` : `${m.cur.toLocaleString()}`);
          const delta = (m: { cur: number; prev: number; money?: boolean }) => {
            const d = m.cur - m.prev;
            if (m.prev === 0 && m.cur === 0) return <span style={{ color: '#C8C5BE' }}>—</span>;
            if (m.prev === 0) return <span style={{ color: '#1F4D3A' }}>新增</span>;
            if (d === 0) return <span style={{ color: '#A8A5A0' }}>持平</span>;
            const up = d > 0;
            return <span className="num" style={{ color: up ? '#1F4D3A' : '#B4443C' }}>{up ? '▲' : '▼'} {m.money ? `¥${Math.abs(d).toLocaleString()}` : Math.abs(d).toLocaleString()}</span>;
          };
          const amt = mv.metrics.find((x) => x.key === 'amount')!;
          const acts = mv.metrics.find((x) => x.key === 'acts')!;
          return (
            <div className="card" style={{ padding: 18, marginTop: 16 }}>
              <b>月度经营复盘</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>{mv.month} vs {mv.prevMonth} · 全本机操作事件，与平台播放数据无关</span>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {mv.metrics.map((m) => (
                  <div key={m.key} style={{ border: '1px solid #F0EEEA', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#6B6862' }}>{m.label}</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(m)}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>上月 {m.money ? `¥${m.prev.toLocaleString()}` : m.prev.toLocaleString()} · <span style={{ whiteSpace: 'nowrap' }}>{delta(m)}</span></div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: '#6B6862', background: '#FCFBF9', border: '1px solid #E8E6E1', borderRadius: 4, padding: '8px 12px', marginTop: 12 }}>
                {mv.month.slice(5)}月成交 ¥{amt.cur.toLocaleString()}，比上月{amt.cur > amt.prev ? `多 ¥${(amt.cur - amt.prev).toLocaleString()}` : amt.cur < amt.prev ? `少 ¥${(amt.prev - amt.cur).toLocaleString()}` : '持平'}；跟进动作 {acts.cur} 次（上月 {acts.prev} 次）——{acts.cur > acts.prev ? '这个月更勤' : acts.cur < acts.prev ? '节奏慢下来了' : '动作量持平'}。
              </div>
              <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 8 }}>口径：成交/成本取台账动作记录值；每客户历史保留最近20条，久远流水可能被截断——宁漏不造</div>
            </div>
          );
        })()}
        {/* S62 分享图预览与下载 */}
        <Modal title="分享图预览（可直接保存发微信）" open={!!shareImg} onCancel={() => setShareImg(null)} footer={null} width={460}>
          {shareImg && (
            <div style={{ textAlign: 'center' }}>
              <img src={shareImg} alt="经营报告分享图" style={{ width: '100%', border: '1px solid #E8E6E1' }} />
              <a href={shareImg} download={`${kind === 'daily' ? '经营日报' : '经营周报'}-${new Date().toISOString().slice(0, 10)}.png`}>
                <Button type="primary" style={{ marginTop: 12 }}>下载图片</Button>
              </a>
              <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 8 }}>手机端可长按图片保存 · 图中数据均为本机真实聚合</div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
