'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Select } from 'antd';
import { appConfig } from '../config/app.config';
import { loadAndApplySettings } from '../lib/settings-client';
import { isDue, shouldNotifyReport, todayKey, daysUntilExpiry } from '../lib/remind';
import { hasFeature } from '../lib/tiers';
import type { LicenseState } from '../lib/license';
import { ActivationGate } from './ActivationGate';
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
  // P0演示：默认有效，?expired=1 预览掉线通栏（挂载后读取，避免SSR/首屏不一致）
  const expired = mounted && new URLSearchParams(window.location.search).get('expired') === '1';
  const [accounts, setAccounts] = useState<any[]>([]);
  const [activeId, setActiveId] = useState('');
  const [unread, setUnread] = useState(0);
  const [ver, setVer] = useState('');
  const [licState, setLicState] = useState<LicenseState | null>(null);
  const prevUnread = useRef(0);
  const nav = [
    { href: '/auth', label: '授权管理' },
    { href: '/dashboard', label: '数据看板' },
    { href: '/comments', label: '评论工作台' },
    { href: '/tasks', label: '任务中心' },
    { href: '/report', label: '经营报告' },
    { href: '/messages', label: '私信辅助' },
    { href: '/settings', label: '系统设置' },
  ];
  useEffect(() => {
    loadAndApplySettings();
    fetch('/api/accounts').then((r) => r.json()).then((d) => { setAccounts(d.items || []); setActiveId(d.active_id || ''); }).catch(() => {});
    fetch('/api/license/status').then((r) => r.json()).then((d) => { setVer(d.app_version || ''); setLicState(d as LicenseState); }).catch(() => {});
    const tick = () => fetch('/api/comments?unread_only=1').then((r) => r.json()).then((d) => {
      const n = (d.items || []).length;
      if (typeof window !== 'undefined' && localStorage.getItem('notify_new_comment') === '1' && 'Notification' in window && Notification.permission === 'granted' && n > prevUnread.current) {
        try { new Notification('新评论提醒', { body: `当前有 ${n} 条未读评论` }); } catch {}
      }
      prevUnread.current = n;
      setUnread(n);
    }).catch(() => { /* 后台轮询自愈：60s后重试，角标沿用旧值，不打扰用户 */ });
    tick();
    const id = setInterval(tick, 60000);
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
      if (!shouldNotifyReport(Date.now(), last, enabled)) return;
      try {
        new Notification('经营报告已生成', { body: '今日日报已就绪：数据概览、7天趋势与行动建议点开即看（经营报告页）' });
      } catch { /* 通知失败不打扰 */ }
      localStorage.setItem('report_notified', todayKey());
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [mounted]);

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
  return (
    <div className="app">
      <ActivationGate />
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
        {path?.startsWith('/report') && licState && !hasFeature(licState.features, 'report')
          ? <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}><ProLock feature="经营报告" desc="日报/周报、文字总结与行动建议" /></div>
          : children}
      </div>
    </div>
  );
}
