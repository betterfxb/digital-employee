'use client';
import { useEffect, useState } from 'react';
import { appConfig } from '@/config/app.config';
import { authConfig } from '@/config/auth.config';
import type { Account, AuthLogItem } from '@/lib/types';

/** S1 授权页：扫码轮询→看板闭环 + 掉线/加载/空态 */
export default function AuthPage() {
  const [qr, setQr] = useState<{ state: string } | null>(null);
  const [status, setStatus] = useState('pending');
  const [me, setMe] = useState<Account | null>(null);
  const [logs, setLogs] = useState<AuthLogItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [usage, setUsage] = useState<{ usedToday: number; cap: number; left: number } | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/auth/douyin/qrcode').then((r) => r.json()).then(setQr).catch(() => setMsg('授权服务异常，请刷新重试'));
    fetch('/api/accounts/me').then((r) => r.json()).then(setMe).catch(() => setMsg('账号信息加载失败，请刷新重试'));
    fetch('/api/auth/logs').then((r) => r.json()).then((d) => setLogs(d.items || [])).catch(() => {});
    fetch('/api/accounts').then((r) => r.json()).then((d) => setAccounts(d.items || [])).catch(() => {});
    fetch('/api/stats/usage').then((r) => r.json()).then(setUsage).catch(() => {});
  }, []);

  const switchAcc = async (id: string) => {
    const r = await fetch('/api/accounts/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then((x) => x.json()).catch(() => null);
    if (r?.active_id) window.location.reload();
  };

  const doRefresh = async () => {
    const r = await fetch('/api/auth/refresh', { method: 'POST' }).then((x) => x.json()).catch(() => null);
    if (r?.expires_at) {
      setMe((m: Account | null) => (m ? { ...m, expires_at: r.expires_at } : m));
      setMsg(`已刷新，有效期至 ${r.expires_at}`);
    } else setMsg('刷新失败，请重扫');
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

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1' }}><b style={{ fontSize: 15 }}>授权管理</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>个人号 · {appConfig.dataDelayNote} · 本地协作</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <div style={{ border: '1px solid #E8E6E1', background: '#FBF3E4', borderRadius: 4, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>个人号可看自己视频 + 管评论，<b>无法同步私信</b>（需蓝V）。已读/意图仅本地，不反写抖音。</div>
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 32 }}>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>授权健康</div><b className="num">{me ? `${me.days_left}天后过期` : '—'}</b></div>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>今日同步余量</div><b className="num">{usage ? `${usage.left}/${usage.cap}` : '—'}</b></div>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>违规提醒</div><b>0 · 正常</b></div>
          <div><div style={{ fontSize: 12, color: '#6B6862' }}>蓝V</div><b>未认证 · <a href="/messages#upgrade">去升级</a></b></div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: 18, flex: 1 }}>
            {!me ? <div className="skel" style={{ height: 52 }}>loading</div> : <b>{me.nickname} · 个人号 · 有效期至 {me.expires_at}</b>}
            <div style={{ marginTop: 12, fontSize: 12, color: '#6B6862' }}>✔ 流量 T+1 ｜ ✔ 评论实时+对账 ｜ ✕ 私信同步需蓝V</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn ghost small" onClick={doRefresh}>刷新有效期</button>
              {msg && <span style={{ fontSize: 12, color: '#6B6862' }}>{msg}</span>}
            </div>
          </div>
          <div className="card" style={{ padding: 18, width: 320 }}>
            <b>扫码授权</b><div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 12px' }}>60s过期 · 状态：{status}（轮询{authConfig.pollIntervalMs}ms）</div>
            <div style={{ width: 180, height: 180, border: '1px dashed #D8D5CF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8A5A0' }}>{qr ? `QR ${qr.state}` : <span className="skel">loading</span>}</div>
            {status === 'success' && <a className="btn small" style={{ display: 'inline-block', marginTop: 12, textDecoration: 'none' }} href="/dashboard">授权成功，去看板 →</a>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div className="card">
          <table><thead><tr><th>时间</th><th>操作</th><th>操作人</th><th>结果</th></tr></thead>
            <tbody className="num">{logs.length === 0 ? <tr><td colSpan={4} style={{ color: '#A8A5A0' }}>加载中…</td></tr> : logs.map((l, i) => <tr key={i}><td>{l.at}</td><td>{l.op}</td><td>{l.by}</td><td>{l.result}</td></tr>)}</tbody></table>
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#A8A5A0' }}>保留{authConfig.authLogRetentionDays}天 · 超限partial由服务端分页</div>
        </div>
        <div className="card">
          <div style={{ padding: '12px 14px', fontWeight: 700 }}>账号列表 <span style={{ fontSize: 12, color: '#A8A5A0', fontWeight: 400 }}>官方扫码绑定，上限{authConfig.maxAccountsPerTenant}个</span></div>
          <table><thead><tr><th>账号</th><th>有效期至</th><th>剩余天数</th><th></th></tr></thead>
            <tbody>{accounts.map((a) => <tr key={a.id}><td><b>{a.nickname}</b>{a.active ? ' · 主账号' : ''}</td><td className="num">{a.expires_at}</td><td className="num">{a.days_left}天{a.days_left <= 15 ? '（即将过期）' : ''}</td><td>{a.active ? null : <button className="btn ghost small" onClick={() => switchAcc(a.id)}>切换</button>}</td></tr>)}</tbody></table>
        </div>
        </div>
      </div>
    </div>
  );
}
