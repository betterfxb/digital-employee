'use client';
import { useEffect, useState } from 'react';
import { App, Button, Segmented } from 'antd';
import { downloadCsv } from '@/lib/csv';
import { buildReport, type Report } from '@/lib/report';
import type { CommentItem, Follow, Video } from '@/lib/types';

/** S50 智能日报/周报：本地真实数据聚合 → 指标网格+文字总结+行动建议（可复制/导出） */
export default function ReportPage() {
  const { message } = App.useApp();
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily');
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState(false);

  const build = (k: 'daily' | 'weekly') => {
    Promise.all([
      fetch('/api/videos').then((r) => r.json()),
      fetch('/api/comments?unread_only=0').then((r) => r.json()),
      fetch('/api/follows').then((r) => r.json()),
    ]).then(([v, c, f]) => {
      setReport(buildReport({
        videos: (v.items || []) as Video[],
        comments: (c.items || []) as CommentItem[],
        follows: (f.items || []) as Follow[],
      }, k));
      setErr(false);
    }).catch(() => setErr(true));
  };
  useEffect(() => { build('daily'); }, []);

  const switchKind = (k: string) => { const kk = k === '周报' ? 'weekly' : 'daily'; setKind(kk); build(kk); };
  const copySummary = () => {
    if (!report) return;
    navigator.clipboard?.writeText(report.summary).then(() => message.success('总结已复制')).catch(() => message.error('复制失败，请手动选择'));
  };
  const exportReport = () => {
    if (!report) return;
    downloadCsv(`${kind === 'daily' ? '日报' : '周报'}指标.csv`, ['指标', '数值'], report.metrics.map((m) => [m.label, m.value]));
  };

  const dateLabel = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1' }}><b style={{ fontSize: 15 }}>经营报告</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>本地真实数据自动汇总 · 可复制给合伙人/老板</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Segmented options={['日报', '周报']} value={kind === 'daily' ? '日报' : '周报'} onChange={switchKind} />
          <span style={{ fontSize: 12, color: '#A8A5A0' }}>{dateLabel}</span>
          <span style={{ flex: 1 }} />
          <Button size="small" onClick={copySummary} disabled={!report}>复制总结</Button>
          <Button size="small" onClick={exportReport} disabled={!report}>导出指标CSV</Button>
        </div>
        {err && <div className="card" style={{ padding: 20 }}>报告生成失败 <Button size="small" style={{ marginLeft: 8 }} onClick={() => build(kind)}>重试</Button></div>}
        {!report && !err && <div className="skel" style={{ height: 240 }}>loading</div>}
        {report && (
          <>
            <div className="card" style={{ padding: 18 }}>
              <b>{kind === 'daily' ? '日报' : '周报'}指标</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 12 }}>
                {report.metrics.map((m) => (
                  <div key={m.label} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#6B6862' }}>{m.label}</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{m.value}</div>
                  </div>
                ))}
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
      </div>
    </div>
  );
}
