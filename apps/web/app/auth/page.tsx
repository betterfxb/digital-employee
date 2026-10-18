'use client';
import { useEffect, useState } from 'react';
import { App, Button, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { appConfig } from '@/config/app.config';
import { authConfig } from '@/config/auth.config';
import type { Account, AuthLogItem } from '@/lib/types';
import type { LicenseState } from '@/lib/license';
import { daysUntilExpiry } from '@/lib/remind';

/** S1 授权页：扫码轮询→看板闭环 + 掉线/加载/空态 */
export default function AuthPage() {
  const { message } = App.useApp();
  const [qr, setQr] = useState<{ state: string; mode?: string; qr_data_url?: string } | null>(null);
  const [status, setStatus] = useState('pending');
  const [me, setMe] = useState<Account | null>(null);
  const [logs, setLogs] = useState<AuthLogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [usage, setUsage] = useState<{ usedToday: number; cap: number; left: number } | null>(null);
  const [lic, setLic] = useState<LicenseState | null>(null);
  const [nick, setNick] = useState('');

  useEffect(() => {
    fetch('/api/auth/douyin/qrcode').then((r) => r.json()).then(setQr).catch(() => message.error('授权服务异常，请刷新重试'));
    fetch('/api/accounts/me').then((r) => r.json()).then(setMe).catch(() => message.error('账号信息加载失败，请刷新重试'));
    fetch('/api/auth/logs').then((r) => r.json()).then((d) => setLogs(d.items || [])).catch(() => {});
    fetch('/api/accounts').then((r) => r.json()).then((d) => setAccounts(d.items || [])).catch(() => {});
    fetch('/api/stats/usage').then((r) => r.json()).then(setUsage).catch(() => {});
    fetch('/api/license/status').then((r) => r.json()).then(setLic).catch(() => {});
    const p = new URLSearchParams(window.location.search);
    const bind = p.get('bind');
    const err = p.get('err');
    if (bind === 'ok') message.success(`已绑定「${p.get('nick') || ''}」并切为当前账号，可在看板导入真实数据`);
    else if (err) message.error(`绑定失败：${err}`);
    // S31 弹窗授权：本窗是授权弹窗（opener存在）→ 结果转交打开方窗口并自关闭；opener不可用时留本窗自洽
    if ((bind || err) && window.opener && !window.opener.closed) {
      if (bind === 'ok') {
        try { window.opener.location.href = `/auth?bind=ok&nick=${encodeURIComponent(p.get('nick') || '')}`; } catch { /* 转交失败留本窗展示 */ }
      }
      window.setTimeout(() => { try { window.close(); } catch { /* 浏览器策略禁止则留窗 */ } }, 350);
    }
    if (bind || err) history.replaceState(null, '', '/auth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchAcc = async (id: string) => {
    const r = await fetch('/api/accounts/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then((x) => x.json()).catch(() => null);
    if (r?.active_id) window.location.reload();
  };

  /** S31 弹窗授权：抖音登录页开在工作台弹出窗内（live=抖音官方页，mock=演示确认页），结果回传本页 */
  const openDyAuth = () => {
    const w = window.open(`/api/auth/douyin/authorize?popup=1&nick=${encodeURIComponent(nick)}`, 'dy_auth', 'width=540,height=680,menubar=no,toolbar=no');
    if (!w) message.error('弹窗被浏览器拦截：请允许本站弹出窗口后重试');
  };

  const refreshQr = () => {
    fetch('/api/auth/douyin/qrcode').then((r) => r.json()).then(setQr).catch(() => {});
  };

  const doRefresh = async () => {
    const r = await fetch('/api/auth/refresh', { method: 'POST' }).then((x) => x.json()).catch(() => null);
    if (r?.expires_at) {
      setMe((m: Account | null) => (m ? { ...m, expires_at: r.expires_at } : m));
      message.success(`已刷新，有效期至 ${r.expires_at}`);
    } else message.error('刷新失败，请重扫');
  };

  useEffect(() => {
    if (!qr) return;
    let t = 0;
    const id = setInterval(async () => {
      t += 1;
      const r = await fetch(`/api/auth/poll?state=${qr.state}&t=${t}`).then((x) => x.json());
      if (r.status === 'success') { setStatus('success'); clearInterval(id); }
      if (t * (authConfig.pollIntervalMs / 1000) > authConfig.pollTimeoutSec) { setStatus('expired'); clearInterval(id); }
    }, authConfig.pollIntervalMs);
    return () => clearInterval(id);
  }, [qr]);

  const logCols: ColumnsType<AuthLogItem> = [
    { title: '时间', dataIndex: 'at', key: 'at', onCell: () => ({ className: 'num' }) },
    { title: '操作', dataIndex: 'op', key: 'op' },
    { title: '操作人', dataIndex: 'by', key: 'by' },
    { title: '结果', dataIndex: 'result', key: 'result' },
  ];

  const accCols: ColumnsType<Account> = [
    { title: '账号', key: 'nick', render: (_, a) => <b>{a.nickname}{a.active ? ' · 主账号' : ''}</b> },
    { title: '有效期至', dataIndex: 'expires_at', key: 'exp', onCell: () => ({ className: 'num' }) },
    { title: '剩余天数', key: 'left', onCell: () => ({ className: 'num' }), render: (_, a) => <>{a.days_left}天{a.days_left <= 15 ? '（即将过期）' : ''}</> },
    { title: '', key: 'act', width: 90, render: (_, a) => (a.active ? null : <Button size="small" onClick={() => switchAcc(a.id)}>切换</Button>) },
  ];

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1' }}><b style={{ fontSize: 15 }}>授权管理</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>个人号 · {appConfig.dataDelayNote} · 本地协作</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <div style={{ border: '1px solid #E8E6E1', background: '#FBF3E4', borderRadius: 4, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>个人号可看自己视频 + 管评论，<b>无法同步私信</b>（需蓝V）。已读/意图仅本地，不反写抖音。</div>
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 32 }}>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>授权健康</div><b className="num">{me ? `${me.days_left}天后过期` : '—'}</b></div>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>今日同步余量</div><b className="num">{usage ? `${usage.left}/${usage.cap}` : '—'}</b></div>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>蓝V</div><b>未认证 · <a href="/messages#upgrade">去升级</a></b></div>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>系统授权</div><b>
            {lic ? (lic.mode === 'licensed' ? `正式授权${lic.valid ? ` · ${(lic.features && lic.features.length) ? '基础版' : '专业版'}` : '（异常）'}` : '未授权') : '—'}
            {lic && <span style={{ fontWeight: 400, color: '#A8A5A0' }}> · {lic.watermark}{lic.customer ? ` · ${lic.customer}` : ''}{lic.mode === 'licensed' ? (() => { const d = daysUntilExpiry(lic.expires_at); if (d === null) return ' · 买断长期'; return d >= 0 && d <= 7 ? <b style={{ color: '#B4443C' }}> · 仅剩{d}天到期，请续期⚠️</b> : ` · 剩${d}天到期`; })() : ''}</span>}
          </b></div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: 18, flex: 1 }}>
            {!me ? <div className="skel" style={{ height: 52 }}>loading</div> : <b>{me.nickname} · 个人号 · 有效期至 {me.expires_at}</b>}
            <div style={{ marginTop: 12, fontSize: 12, color: '#6B6862' }}>✔ 流量 T+1 ｜ ✔ 评论实时+对账 ｜ ✕ 私信同步需蓝V</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button size="small" onClick={doRefresh}>刷新有效期</Button>
            </div>
          </div>
          <div className="card" style={{ padding: 18, width: 320 }}>
            <b>扫码授权</b><div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 12px' }}>
              60s过期 · 状态：{status}（轮询{authConfig.pollIntervalMs}ms） ·
              <span style={{ marginLeft: 4, color: qr?.mode === 'live' ? '#1A1A18' : '#A8A5A0', fontWeight: 700 }}>{qr?.mode === 'live' ? '官方已接入' : '通道待开通'}</span>
            </div>
            <div style={{ width: 180, height: 180, border: '1px dashed #D8D5CF', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
              {qr?.qr_data_url
                ? <img src={qr.qr_data_url} alt="抖音登录授权二维码" width={164} height={164} onClick={refreshQr} title="点击刷新二维码" style={{ cursor: 'zoom-in', display: 'block' }} />
                : qr ? <span className="num" style={{ fontSize: 12, color: '#A8A5A0' }}>{qr.state}</span> : <span className="skel">loading</span>}
            </div>
            {status === 'success' && <Button type="primary" size="small" style={{ marginTop: 12 }} href="/dashboard">授权成功，去看板 →</Button>}
            <div style={{ borderTop: '1px solid #E8E6E1', marginTop: 14, paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#6B6862', marginBottom: 6 }}>登录授权</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Input size="small" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="你的抖音号昵称" maxLength={20} style={{ width: 150 }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="small" type="primary" onClick={openDyAuth}>抖音登录授权</Button>
                <Button size="small" href={`/api/auth/douyin/authorize?nick=${encodeURIComponent(nick)}`}>整页授权</Button>
              </div>
              <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 6 }}>{qr?.mode === 'live' ? '弹窗内即抖音官方登录页，确认后自动回工作台' : '当前为体验流程；开通官方通道后弹窗内即抖音官方登录页'}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div className="card">
          <Table<AuthLogItem> size="small" pagination={false} columns={logCols} dataSource={logs} rowKey={(_, i) => String(i)} locale={{ emptyText: '暂无日志' }} />
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#A8A5A0' }}>保留{authConfig.authLogRetentionDays}天 · 超限partial由服务端分页</div>
        </div>
        <div className="card">
          <div style={{ padding: '12px 14px', fontWeight: 700 }}>账号列表 <span style={{ fontSize: 12, color: '#A8A5A0', fontWeight: 400 }}>官方扫码绑定，上限{authConfig.maxAccountsPerTenant}个</span></div>
          <Table<Account> size="small" pagination={false} columns={accCols} dataSource={accounts} rowKey="id" locale={{ emptyText: '暂无账号' }} />
        </div>
        </div>
      </div>
    </div>
  );
}
