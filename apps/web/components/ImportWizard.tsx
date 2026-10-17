'use client';
import { useState } from 'react';
import { App, Button, Modal, Radio, Upload } from 'antd';
import { downloadCsv } from '@/lib/csv';

/**
 * S32 导入向导：模板下载 → 拖拽上传（前端列头/行数预校验）→ 结果明细（建/更/跳+原因）
 * 目标：客户 5 分钟把自己的数据导进系统；复用 POST /api/import，无新接口
 */
const TPL: Record<'videos' | 'comments', { label: string; cols: string[]; sample: string[][] }> = {
  videos: { label: '作品', cols: ['标题', '发布时间', '播放', '点赞', '评论', '转发'], sample: [['三角洲跑刀实录 · 一局爆仓', '10-08', '48201', '4102', '312', '410']] },
  comments: { label: '评论', cols: ['昵称', '内容', '视频标题', '时间', '点赞'], sample: [['刀友老陈', '跑刀一单多少钱？怎么下单？', '三角洲跑刀实录 · 一局爆仓', '2小时前', '12']] },
};

export function ImportWizard({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { message } = App.useApp();
  const [kind, setKind] = useState<'videos' | 'comments'>('videos');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const close = () => { setStep(0); setResult(null); setErr(''); setBusy(false); onClose(); };

  const handleFile = async (file: File) => {
    setErr('');
    const csv = await file.text().catch(() => '');
    if (!csv.trim()) { setErr('文件是空的，请用模板填写后再上传'); return; }
    const header = csv.split(/\r?\n/)[0].replace(/^\uFEFF/, '').trim();
    if (header !== TPL[kind].cols.join(',')) {
      setErr(`列头与模板不一致。正确列头：${TPL[kind].cols.join(',')}（可先「下载模板」照着填）`);
      return;
    }
    const rows = csv.trim().split(/\r?\n/).length - 1;
    if (rows > 200) { setErr(`单次最多 200 行，本文件 ${rows} 行，请拆分后再传`); return; }
    setBusy(true);
    const r = await fetch('/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, csv }),
    }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.code) { setErr(r?.message || '导入失败，请重试'); return; }
    setResult({ created: r.created || 0, updated: r.updated || 0, skipped: r.skipped || 0 });
    setStep(1);
    onDone();
  };

  const dl = (k: 'videos' | 'comments') => downloadCsv(`${TPL[k].label}导入模板.csv`, TPL[k].cols, TPL[k].sample);

  return (
    <Modal title="导入我的数据" open={open} onCancel={close} footer={null} width={560} destroyOnHidden>
      {step === 0 ? (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
            <Radio.Group value={kind} onChange={(e) => { setKind(e.target.value); setErr(''); }} options={[
              { value: 'videos', label: '作品数据' }, { value: 'comments', label: '评论数据' },
            ]} optionType="button" />
            <Button size="small" type="text" onClick={() => dl(kind)}>下载{TPL[kind].label}模板</Button>
          </div>
          <Upload.Dragger
            accept=".csv,text/csv" showUploadList={false} disabled={busy}
            beforeUpload={(f) => { handleFile(f); return false; }}
          >
            <div style={{ padding: '10px 0', color: busy ? '#A8A5A0' : '#1A1A18' }}>{busy ? '正在导入…' : '把填好的 CSV 拖到这里，或点击选择文件'}</div>
            <div style={{ fontSize: 12, color: '#A8A5A0', paddingBottom: 8 }}>单次 ≤200 行 · 先下模板照着填</div>
          </Upload.Dragger>
          {err && <div style={{ color: '#B4443C', fontSize: 12, marginTop: 10, lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 12, lineHeight: 1.7 }}>
            建议顺序：<b>先作品、后评论</b>（评论按视频标题归属作品，标题对不上会被跳过）。重复导入同一文件不会产生重复数据（自动去重合并）。
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{(result?.created || 0) + (result?.updated || 0)}</div>
          <div style={{ fontSize: 13, color: '#6B6862', marginTop: 4 }}>
            条{TPL[kind].label}已入库{result?.updated ? `（其中更新 ${result.updated} 条）` : ''}
          </div>
          {result && result.skipped > 0 && (
            <div style={{ fontSize: 12, color: '#8A6D1F', background: '#FBF3E4', border: '1px solid #EADFBE', borderRadius: 4, padding: '8px 12px', marginTop: 12, textAlign: 'left' }}>
              跳过 {result.skipped} 条：视频标题未匹配到已导入的作品。请先导入作品 CSV，再导评论。
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
            <Button onClick={() => { setStep(0); setResult(null); }}>再导入一批</Button>
            <Button type="primary" onClick={() => { close(); window.location.href = kind === 'comments' ? '/comments' : '/dashboard'; }}>
              {kind === 'comments' ? '去评论工作台看意向' : '完成，看数据看板'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
