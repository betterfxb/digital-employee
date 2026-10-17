'use client';
import { useEffect, useState } from 'react';
import { App, Button, Upload } from 'antd';
import type { LicenseState } from '@/lib/license';

/**
 * S30 激活门：无license/绑定不符/过期 → 全屏遮罩锁核心功能（策略：API开放、UI拦截）
 * 展示本机机器码（可复制给签发方）+ 导入授权文件；验签+机器绑定全过即解锁
 */
export function ActivationGate() {
  const { message } = App.useApp();
  const [st, setSt] = useState<LicenseState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const check = () => fetch('/api/license/status').then((r) => r.json()).then((d: LicenseState) => setSt(d)).catch(() => { /* 网络异常不拦截，防误伤 */ });
  useEffect(() => { check(); }, []);

  const doImport = (text: string) => {
    setBusy(true); setErr('');
    fetch('/api/license/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ license: text }),
    }).then((r) => r.json()).then((d) => {
      if (d.code) { setErr(d.message || '导入失败'); return; }
      message.success('授权已激活');
      setSt(d as LicenseState);
    }).catch(() => setErr('导入失败，请重试')).finally(() => setBusy(false));
  };

  if (!st || (st.mode === 'licensed' && st.valid)) return null;
  /**
   * S31修"复制没反应"：①非secure上下文/权限被拒时 clipboard 为 undefined，?.链整体静默短路无任何反馈；
   * ②Electron主进程曾无差别拒绝全部浏览器权限（含clipboard-write）→双路径兜底，任何路径必有反馈
   */
  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(st.machine_code);
        message.success('机器码已复制');
        return;
      }
    } catch { /* Clipboard API失败→落execCommand兜底 */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = st.machine_code;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, st.machine_code.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { message.success('机器码已复制'); return; }
    } catch { /* 兜底也失败→明确提示 */ }
    message.error('复制失败：请手动选中机器码后 Ctrl+C');
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 6, padding: '32px 36px' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>获客中台 · 未激活</div>
        <div style={{ fontSize: 13, color: '#6B6862', marginTop: 8, lineHeight: 1.8 }}>
          本产品为<b>单机授权</b>。请复制下方机器码发送给服务商，获取专属授权文件后导入激活。
          {st.mode === 'licensed' && st.error && <div style={{ color: '#B4443C', marginTop: 8 }}>当前状态：{st.error}</div>}
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: '#6B6862', marginBottom: 6 }}>本机机器码</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div className="num" style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', background: '#FCFBF9', border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px', lineHeight: 1.6 }}>{st.machine_code}</div>
            <Button onClick={copy}>复制</Button>
          </div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Upload accept=".license,.json" showUploadList={false} beforeUpload={(f) => { f.text().then(doImport).catch(() => setErr('读取文件失败')); return false; }}>
            <Button type="primary" loading={busy}>导入授权文件</Button>
          </Upload>
          <span style={{ fontSize: 12, color: '#A8A5A0' }}>收到 license.license 文件后点此导入</span>
        </div>
        {err && <div style={{ color: '#B4443C', fontSize: 12, marginTop: 10 }}>{err}</div>}
        <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 22, borderTop: '1px solid #E8E6E1', paddingTop: 12 }}>授权与本机绑定，拷贝到其他电脑无法使用；数据可随时通过导入导出功能迁出</div>
      </div>
    </div>
  );
}
