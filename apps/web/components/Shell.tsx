'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Select } from 'antd';
import { appConfig } from '../config/app.config';
import { loadAndApplySettings } from '../lib/settings-client';
import { isDue, shouldNotifyReport, todayKey, daysUntilExpiry } from '../lib/remind';
import { shouldLock } from '../lib/autolock'; // S150
import { hasFeature } from '../lib/tiers';
import type { LicenseState } from '../lib/license';
import { ActivationGate } from './ActivationGate';
import { CommandPalette } from './CommandPalette';
import { ProLock } from './ProLock';

/**
 * 全局壳：侧栏208px + 账号切换 + 未读角标 + 新评论通知 + 内容槽
 * 通知仅在用户于任务中心打开开关并授权后触发；数据轮询60s。
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // 挂载门：服务端与首屏渲染保持一致，动态部分（账号/角标/过期条）只在挂载后渲染，消灭hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // S122 数据自愈探针：本进程启动时若发生过损坏恢复，顶栏黄条提示（关一次本日不再扰）
  useEffect(() => {
    fetch('/api/data/health').then((r) => r.json()).then((d) => {
      if (d?.recovery && sessionStorage.getItem('data_recovery_dismissed') !== d.recovery.at) setRecovery(d.recovery);
    }).catch(() => {});
  }, []);
  // P0演示：默认有效，?expired=1 预览掉线通栏（挂载后读取，避免SSR/首屏不一致）
  const expired = mounted && new URLSearchParams(window.location.search).get('expired') === '1';
  const [accounts, setAccounts] = useState<any[]>([]);
  const [activeId, setActiveId] = useState('');
  const [unread, setUnread] = useState(0);
  const [drCnt, setDrCnt] = useState(0); // S108 草稿待确认数（任务中心红点）
  const [odCnt, setOdCnt] = useState(0); // S117 逾期跟进数（私信辅助红点）
  const [recovery, setRecovery] = useState<{ from: string; at: string } | null>(null); // S122 自愈黄条
  const [ver, setVer] = useState('');
  const [licState, setLicState] = useState<LicenseState | null>(null);
  const [reportHour, setReportHour] = useState(9);
  /** S99 快捷键悬浮层：任意界面按 ? 呼出（Esc/点背景关闭） */
  const [helpOpen, setHelpOpen] = useState(false);
  /** S69 本地访问密码解锁层 */
  const [locked, setLocked] = useState(false);
  const [unlockPw, setUnlockPw] = useState('');
  const [unlockErr, setUnlockErr] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const prevUnread = useRef(0);
  // S150 挂机自动锁定：活动打点 + 60秒随巡检复核（有密码且闲置超阈值→回解锁层）
  const lastAct = useRef(Date.now());
  const lockCfg = useRef({ idle: 0, hasPw: false });
  useEffect(() => {
    const mark = () => { lastAct.current = Date.now(); };
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    return () => { window.removeEventListener('pointerdown', mark); window.removeEventListener('keydown', mark); };
  }, []);
  const nav = [
    { href: '/today', label: '今日工作台' },
    { href: '/auth', label: '授权管理' },
    { href: '/dashboard', label: '数据看板' },
    { href: '/comments', label: '评论工作台' },
    { href: '/tasks', label: '任务中心' },
    { href: '/report', label: '经营报告' },
    { href: '/marketing', label: '智能营销' },
    { href: '/messages', label: '私信辅助' },
    { href: '/settings', label: '系统设置' },
  ];
  useEffect(() => {
    loadAndApplySettings();
    fetch('/api/accounts').then((r) => r.json()).then((d) => { setAccounts(d.items || []); setActiveId(d.active_id || ''); }).catch(() => {});
    fetch('/api/license/status').then((r) => r.json()).then((d) => { setVer(d.app_version || ''); setLicState(d as LicenseState); }).catch(() => {});
    // S69 有访问密码且本标签未解锁 → 显示解锁层（sessionStorage按标签会话）；S75 顺带取日报时点
    fetch('/api/settings').then((r) => r.json()).then((d) => {
      if (d?.password_hash && sessionStorage.getItem('unlock_ok') !== '1') setLocked(true);
      lockCfg.current = { idle: Number(d?.lock_idle_minutes) || 0, hasPw: !!d?.password_hash }; // S150
      const rh = (d?.auto_config && typeof d.auto_config === 'object') ? Number((d.auto_config as { report_hour?: number }).report_hour) : NaN;
      if (Number.isFinite(rh)) setReportHour(rh);
    }).catch(() => {});
    const tick = () => fetch('/api/comments?unread_only=1').then((r) => r.json()).then((d) => {
      const n = (d.items || []).length;
      if (typeof window !== 'undefined' && localStorage.getItem('notify_new_comment') === '1' && 'Notification' in window && Notification.permission === 'granted' && n > prevUnread.current) {
        try { new Notification('新评论提醒', { body: `当前有 ${n} 条未读评论` }); } catch {}
      }
      prevUnread.current = n;
      setUnread(n);
    }).catch(() => { /* 后台轮询自愈：60s后重试，角标沿用旧值，不打扰用户 */ });
    const tickDr = () => {
      fetch('/api/drafts?status=pending').then((r) => r.json()).then((d) => setDrCnt((d.items || []).length)).catch(() => { /* 角标自愈：失败下轮重试 */ });
      fetch('/api/follows').then((r) => r.json()).then((f) => setOdCnt(((f.items || []) as { status: string; next_remind_at: string }[]).filter((x) => ['待回访', '已手动回复'].includes(x.status) && isDue(x.next_remind_at)).length)).catch(() => { /* 同上 */ });
      // S150 挂机锁复核：拉最新设置（改了阈值无需刷新页），闲置超阈且本标签已解锁则强制回锁
      fetch('/api/settings').then((r) => r.json()).then((d) => {
        lockCfg.current = { idle: Number(d?.lock_idle_minutes) || 0, hasPw: !!d?.password_hash };
        if (shouldLock(lastAct.current, Date.now(), lockCfg.current.idle, lockCfg.current.hasPw)) {
          sessionStorage.removeItem('unlock_ok');
          setLocked(true);
        }
      }).catch(() => {});
    };
    tick(); tickDr();
    const id = setInterval(() => { tick(); tickDr(); }, 60000);
    return () => clearInterval(id);
  }, []);

  // S44 跟进到期提醒：60s轮询待回访里到期的（今天/明天口语时间解析），系统通知提醒人去跟进——只提醒不自动操作
  useEffect(() => {
    if (!mounted) return;
    const check = () => {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem('notify_follow_due') !== '1') return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      fetch('/api/follows?status=待回访').then((r) => r.json()).then((d) => {
        const today = new Date().toISOString().slice(0, 10);
        let seen: string[] = [];
        try {
          const saved = JSON.parse(localStorage.getItem('follow_reminded') || '{}') as { date?: string; ids?: string[] };
          if (saved.date === today) seen = saved.ids || [];
        } catch { /* 损坏则当天重提醒，可接受 */ }
        const due = ((d.items || []) as { id: string; peer_nick: string; next_remind_at: string }[])
          .filter((f) => isDue(f.next_remind_at) && !seen.includes(f.id));
        if (due.length === 0) return;
        const names = due.map((x) => x.peer_nick);
        try {
          new Notification('跟进提醒', { body: `该联系 ${names.slice(0, 3).join('、')}${names.length > 3 ? ` 等${names.length}位` : ''} 了（台账·待回访）` });
        } catch { /* 通知失败不打扰 */ }
        localStorage.setItem('follow_reminded', JSON.stringify({ date: today, ids: [...seen, ...due.map((x) => x.id)] }));
      }).catch(() => { /* 轮询自愈 */ });
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [mounted]);

  // S56 日报提醒：每天9点窗口（页面开着时）提醒查看经营报告，当天去重
  useEffect(() => {
    if (!mounted) return;
    const check = () => {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const enabled = localStorage.getItem('notify_report') === '1';
      const last = localStorage.getItem('report_notified');
      if (!shouldNotifyReport(Date.now(), last, enabled, reportHour)) return;
      try {
        new Notification('经营报告已生成', { body: `今日日报已就绪（${reportHour}点）：数据概览、7天趋势与行动建议点开即看（经营报告页）` });
      } catch { /* 通知失败不打扰 */ }
      localStorage.setItem('report_notified', todayKey());
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [mounted, reportHour]);

  // S59 授权到期真实提醒：剩余≤7天且未过期时每日最多提醒一次（已过期由激活门/横幅负责，不重复打扰）
  useEffect(() => {
    if (!mounted || !licState) return;
    const check = () => {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const days = daysUntilExpiry(licState.expires_at);
      if (days === null || days > 7 || days < 0) return;
      const key = `license_reminded_${todayKey()}`;
      if (localStorage.getItem(key)) return;
      try {
        new Notification('授权即将到期', { body: `还剩${days}天到期，联系服务商续期以免功能锁定（授权管理页可查看详情）` });
      } catch { /* 通知失败不打扰 */ }
      localStorage.setItem(key, '1');
    };
    check();
    const id = setInterval(check, 3_600_000);
    return () => clearInterval(id);
  }, [mounted, licState]);
  const switchAcc = async (id: string) => {
    const r = await fetch('/api/accounts/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then((x) => x.json()).catch(() => null);
    if (r?.active_id) window.location.reload();
  };

  /** S69 解锁：服务端scrypt校验，成功记本标签会话 */
  const doUnlock = async () => {
    if (!unlockPw) { setUnlockErr('请输入密码'); return; }
    setUnlocking(true); setUnlockErr('');
    try {
      const r = await fetch('/api/auth/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: unlockPw }) }).then((x) => x.json()).catch(() => null);
      if (r?.unlocked) {
        sessionStorage.setItem('unlock_ok', '1');
        lastAct.current = Date.now(); // S150 解锁即活跃，防下一巡检秒回锁
        setLocked(false); setUnlockPw('');
      } else setUnlockErr(r?.message || '解锁失败，请重试');
    } finally { setUnlocking(false); }
  };
  // S99 全局快捷键帮助层：? 开 / Esc 关（输入框聚焦与锁定态不触发）
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (locked) return;
      const t = e.target as HTMLElement;
      if (e.key === 'Escape') { setHelpOpen(false); return; }
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === '?') { e.preventDefault(); setHelpOpen((v) => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [locked]);
  return (
    <div className="app">
      <ActivationGate />
      {/* S90 全局命令面板（访问密码锁定期间禁用，Ctrl+K） */}
      <CommandPalette enabled={!locked} />
      {/* S69 本地访问密码解锁层（在激活门之上：先解锁再看授权状态） */}
      {locked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 360, width: '100%', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 6, padding: '28px 30px' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>工作台已锁定</div>
            <div style={{ fontSize: 12, color: '#6B6862', marginTop: 6, lineHeight: 1.7 }}>本机设置了访问密码，输入后进入。每个窗口/标签需解锁一次，关窗即恢复锁定。</div>
            <Input.Password value={unlockPw} onChange={(e) => { setUnlockPw(e.target.value); setUnlockErr(''); }} placeholder="访问密码" style={{ marginTop: 14 }} maxLength={32} onPressEnter={doUnlock} autoFocus />
            {unlockErr && <div style={{ color: '#B4443C', fontSize: 12, marginTop: 8 }}>{unlockErr}</div>}
            <Button type="primary" block loading={unlocking} style={{ marginTop: 12 }} onClick={doUnlock}>解锁</Button>
          </div>
        </div>
      )}
      <aside className="side">
        <div style={{ padding: '18px 18px 10px', fontWeight: 700 }}>{appConfig.appName}<small style={{ display: 'block', fontSize: 11, color: '#A8A5A0', fontWeight: 400 }}>DOUYIN · P0</small></div>
        <div style={{ padding: '0 12px 8px' }}>
          {mounted
            ? <Select style={{ width: '100%' }} size="small" value={activeId || undefined} onChange={(v) => switchAcc(v)} options={accounts.map((a) => ({ value: a.id, label: `${a.nickname}${a.days_left <= 15 ? '（即将过期）' : ''}` }))} placeholder="选择账号" />
            : <Select style={{ width: '100%' }} size="small" disabled options={[]} placeholder="加载中…" />}
        </div>
        <nav className="nav" style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={path?.startsWith(n.href) ? 'active' : ''}>
              <span>{n.label}</span>
              {mounted && n.href === '/comments' && unread > 0 && <span className="num" style={{ background: '#1A1A18', color: '#fff', fontSize: 11, borderRadius: 10, padding: '0 7px' }}>{unread}</span>}
              {mounted && n.href === '/tasks' && drCnt > 0 && <span className="num" title="待确认草稿" style={{ background: '#B4443C', color: '#fff', fontSize: 11, borderRadius: 10, padding: '0 7px' }}>{drCnt}</span>}
              {mounted && n.href === '/messages' && odCnt > 0 && <span className="num" title="逾期跟进" style={{ background: '#9A6B2F', color: '#fff', fontSize: 11, borderRadius: 10, padding: '0 7px' }}>{odCnt}</span>}
            </Link>
          ))}
        </nav>
        <div style={{ margin: 'auto 12px 12px', border: '1px solid #E8E6E1', borderRadius: 4, padding: 12, background: '#FCFBF9', fontSize: 12 }}>
          <b>升级蓝V后解锁</b><div style={{ color: '#6B6862', margin: '6px 0 10px' }}>私信自动同步 · 一键留资</div>
          <Button size="small" href="/guide">查看指南</Button>
        </div>
        {mounted && ver && <div className="num" style={{ padding: '0 18px 12px', fontSize: 11, color: '#A8A5A0' }}>v{ver}</div>}
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        {expired && <div style={{ background: '#FBF3E4', borderBottom: '1px solid #E8E6E1', padding: '10px 24px', fontSize: 12 }}>授权已过期或被取消，请重新扫码授权。 <Link href="/auth">去授权 →</Link></div>}
        {mounted && recovery && (
          <div style={{ background: '#FBF3E4', borderBottom: '1px solid #EADFBE', padding: '10px 24px', fontSize: 12, color: '#8A6D1F', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>数据文件曾损坏，系统已自动从备份 <b className="num">{recovery.from}</b> 恢复（恢复于 {new Date(recovery.at).toLocaleString('zh-CN')}）。近期数据可能有少量回退，建议核对关键台账。</span>
            <Button size="small" onClick={() => { fetch('/api/data/backups/run', { method: 'POST' }).catch(() => {}); sessionStorage.setItem('data_recovery_dismissed', recovery.at); setRecovery(null); }}>已知晓，手动留一份备份</Button>
            <Button size="small" type="text" onClick={() => { sessionStorage.setItem('data_recovery_dismissed', recovery.at); setRecovery(null); }}>关闭</Button>
          </div>
        )}
        {path?.startsWith('/report') && licState && !hasFeature(licState.features, 'report')
          ? <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}><ProLock feature="经营报告" desc="日报/周报、文字总结与行动建议" /></div>
          : children}
      </div>
      {helpOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(26,26,24,0.28)' }} onClick={() => setHelpOpen(false)} />
          <div style={{ position: 'fixed', left: '50%', top: '16%', transform: 'translateX(-50%)', zIndex: 9991, width: 420, maxWidth: '92vw', background: '#FCFBF9', border: '1px solid #E8E6E1', borderRadius: 8, boxShadow: '0 18px 48px rgba(26,26,24,0.22)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><b style={{ fontSize: 15 }}>快捷键</b><span style={{ flex: 1 }} /><Button size="small" onClick={() => setHelpOpen(false)}>关闭 (Esc)</Button></div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '88px 1fr', gap: '6px 10px', fontSize: 13 }}>
              <span className="num"><b>Ctrl+K</b></span><span>命令面板：跳页 / 搜台账昵称 / 搜话术 / 快捷动作</span>
              <span className="num"><b>?</b></span><span>打开或关闭本帮助</span>
              <span style={{ gridColumn: '1 / -1', fontSize: 11, color: '#A8A5A0', marginTop: 4 }}>评论工作台内另有：</span>
              <span className="num"><b>j / k</b></span><span>下一条 / 上一条评论</span>
              <span className="num"><b>e</b></span><span>标已读</span>
              <span className="num"><b>1 / 2 / 3</b></span><span>改意图（高意向 / 咨询 / 留电话）</span>
              <span className="num"><b>c</b></span><span>复制当前评论内容</span>
              <span className="num"><b>a</b></span><span>全选 / 取消全选</span>
              <span className="num"><b>右键</b></span><span>评论行右键出快捷菜单（跟进 / 改意图 / 搜此人）</span>
            </div>
            <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 10 }}>快捷键只在输入框之外生效；台账「看板」视图可拖拽卡片改状态。</div>
          </div>
        </>
      )}
    </div>
  );
}
