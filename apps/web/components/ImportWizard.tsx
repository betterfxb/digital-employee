'use client';
import { useState } from 'react';
import { App, Button, Modal, Radio, Upload } from 'antd';
import { downloadCsv } from '@/lib/csv';
import { decodeTextBuffer, parseCsv, missingCols, missingColError, detectKind } from '@/lib/csvParse';

/**
 * S32 导入向导：模板下载 → 拖拽上传 → 结果明细（建/更/跳+原因）
 * S79 容错升级：UTF-8/GBK编码嗅探（中文Excel导出ANSI不再乱码）、列头按别名表预检（与后端同口径，抖音后台直接导出也能过）、TSV自动识别（Excel复制粘贴产物）
 */
const TPL: Record<'videos' | 'comments' | 'leads', { label: string; cols: string[]; sample: string[][] }> = {
  videos: { label: '作品', cols: ['标题', '发布时间', '播放', '点赞', '评论', '转发'], sample: [['三角洲跑刀实录 · 一局爆仓', '10-08', '48201', '4102', '312', '410']] },
  comments: { label: '评论', cols: ['昵称', '内容', '视频标题', '时间', '点赞'], sample: [['刀友老陈', '跑刀一单多少钱？怎么下单？', '三角洲跑刀实录 · 一局爆仓', '2小时前', '12']] },
  // S118 存量客户名单：昵称必填；状态/下次提醒/金额/联系方式可空（状态空=待回访，提醒空=明天9点）
  leads: { label: '客户', cols: ['昵称', '状态', '下次提醒', '金额', '联系方式'], sample: [['跑刀阿伟', '待回访', '明天 09:00', '', 'wx:abc123'], ['老客凯哥', '已转化', '', '298', '']] },
};

export function ImportWizard({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { message } = App.useApp();
  const [kind, setKind] = useState<'videos' | 'comments' | 'leads'>('videos');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [autoSwitched, setAutoSwitched] = useState(false); // S145 本次导入发生过类型自动纠正

  const close = () => { setStep(0); setResult(null); setErr(''); setBusy(false); setAutoSwitched(false); onClose(); };

  const handleFile = async (file: File) => {
    setErr('');
    const buf = await file.arrayBuffer().catch(() => null);
    if (!buf) { setErr('文件读取失败，请重试'); return; }
    const csv = decodeTextBuffer(buf); // S79 UTF-8严格失败→GBK（中文Excel ANSI导出）
    if (!csv.trim()) { setErr('文件是空的，请用模板填写后再上传'); return; }
    const rows = parseCsv(csv); // S79 逗号/制表符自动识别（Excel复制粘贴=TSV也能进）
    const head = rows[0] || [];
    // S145 表头自动识别：选错类型直接纠偏（识别不出=null 沿用手动选），结果页如实注明
    const detected = detectKind(head);
    const useKind = detected ?? kind;
    if (detected && detected !== kind) setKind(detected);
    setAutoSwitched(!!detected && detected !== kind);
    const missing = missingCols(useKind, head);
    if (missing.length > 0) {
      setErr(missingColError(`${TPL[useKind].label}文件`, missing, head));
      return;
    }
    const n = rows.length - 1;
    if (n > 200) { setErr(`单次最多 200 行，本文件 ${n} 行，请拆分后再传`); return; }
    setBusy(true);
    const r = await fetch('/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: useKind, csv }),
    }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.code) { setErr(r?.message || '导入失败，请重试'); return; }
    setResult({ created: r.created || 0, updated: r.updated || 0, skipped: r.skipped || 0 });
    setStep(1);
    onDone();
  };

  const dl = (k: 'videos' | 'comments' | 'leads') => downloadCsv(`${TPL[k].label}导入模板.csv`, TPL[k].cols, TPL[k].sample);

  return (
    <Modal title="导入我的数据" open={open} onCancel={close} footer={null} width={560} destroyOnHidden>
      {step === 0 ? (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
            <Radio.Group value={kind} onChange={(e) => { setKind(e.target.value); setErr(''); }} options={[
              { value: 'videos', label: '作品数据' }, { value: 'comments', label: '评论数据' }, { value: 'leads', label: '老客户名单' },
            ]} optionType="button" />
            <Button size="small" type="text" onClick={() => dl(kind)}>下载{TPL[kind].label}模板</Button>
          </div>
          <Upload.Dragger
            accept=".csv,text/csv" showUploadList={false} disabled={busy}
            beforeUpload={(f) => { handleFile(f); return false; }}
          >
            <div style={{ padding: '10px 0', color: busy ? '#A8A5A0' : '#1A1A18' }}>{busy ? '正在导入…' : '把 CSV / Excel 另存的表格拖到这里，或点击选择文件'}</div>
            <div style={{ fontSize: 12, color: '#A8A5A0', paddingBottom: 8 }}>单次 ≤200 行 · UTF-8/GBK 自动识别 · 抖音后台导出/Excel 复制粘贴都能直接进</div>
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
          {autoSwitched && (
            <div style={{ fontSize: 12, color: '#4C6B57', background: '#F5FAF6', border: '1px dashed #C8D8CC', borderRadius: 4, padding: '6px 12px', marginTop: 10 }}>
              已识别为【{TPL[kind].label}数据】自动导入——表头说了算，不用再操心选类型
            </div>
          )}
          {result && result.skipped > 0 && (
            <div style={{ fontSize: 12, color: '#8A6D1F', background: '#FBF3E4', border: '1px solid #EADFBE', borderRadius: 4, padding: '8px 12px', marginTop: 12, textAlign: 'left' }}>
              {kind === 'leads'
                ? `跳过 ${result.skipped} 个已有客户（同名活跃线索自动去重，放心重复导入同一名单）。`
                : `跳过 ${result.skipped} 条：视频标题未匹配到已导入的作品。请先导入作品 CSV，再导评论。`}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
            <Button onClick={() => { setStep(0); setResult(null); }}>再导入一批</Button>
            <Button type="primary" onClick={() => { close(); window.location.href = kind === 'comments' ? '/comments' : kind === 'leads' ? '/messages' : '/dashboard'; }}>
              {kind === 'comments' ? '去评论工作台看意向' : kind === 'leads' ? '去台账看新客户' : '完成，看数据看板'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
