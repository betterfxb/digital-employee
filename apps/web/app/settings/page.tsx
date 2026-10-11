'use client';
import { useEffect, useState } from 'react';
import { settingsConfig } from '@/config/settings.config';
import { applySettings } from '@/lib/settings-client';

/** S18 系统设置：店铺/服务/字体/主题/密码；调节即时预览，保存持久化并全局生效 */
export default function Settings() {
  const [shop, setShop] = useState('');
  const [service, setService] = useState('');
  const [font, setFont] = useState<number>(settingsConfig.fontSizeDefault);
  const [theme, setTheme] = useState<string>(settingsConfig.themeDefault);
  const [pwdAt, setPwdAt] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [npw, setNpw] = useState('');
  const [cpw, setCpw] = useState('');
  const [pmsg, setPmsg] = useState('');

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((s) => {
      setShop(s.shop_name || ''); setService(s.service_name || '');
      setFont(s.font_size || settingsConfig.fontSizeDefault);
      setTheme(s.theme_color || settingsConfig.themeDefault);
      setPwdAt(s.password_changed_at || null);
    }).catch(() => setMsg('设置加载失败，请刷新重试'));
  }, []);

  // 调节即时预览（不落库），保存后持久化
  const previewFont = (n: number) => { setFont(n); setMsg(''); applySettings({ font_size: n, theme_color: theme }); };
  const previewTheme = (v: string) => { setTheme(v); setMsg(''); applySettings({ font_size: font, theme_color: v }); };

  const save = async () => {
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop_name: shop.trim(), service_name: service.trim(), font_size: font, theme_color: theme }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setMsg(r?.message || '保存失败，请重试'); return; }
    applySettings({ font_size: r.font_size, theme_color: r.theme_color });
    setMsg(`已保存${r.shop_name ? `，店铺：${r.shop_name}` : ''}`);
  };

  const changePwd = async () => {
    if (npw !== cpw) { setPmsg('两次输入不一致'); return; }
    const r = await fetch('/api/settings/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_password: npw }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setPmsg(r?.message || '修改失败，请重试'); return; }
    setNpw(''); setCpw(''); setPwdAt(r.changed_at); setPmsg('已修改');
  };

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1', display: 'flex', alignItems: 'center' }}><div><b style={{ fontSize: 15 }}>系统设置</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>调节即时预览，保存后持久化全局生效</div></div><div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>{msg && <span style={{ fontSize: 12, color: '#6B6862' }}>{msg}</span>}<button className="btn small" onClick={save}>保存全部</button></div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: 18 }}>
            <b>店铺信息</b>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>改的是当前主账号展示名（{settingsConfig.shopNameMinLen}-{settingsConfig.shopNameMaxLen}字），侧栏/授权页同步更新</div>
            <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="店铺名称" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '8px 12px', width: '100%' }} />
          </div>
          <div className="card" style={{ padding: 18, marginTop: 16 }}>
            <b>服务信息</b>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>用作话术{'{product}'}默认值（最多{settingsConfig.serviceNameMaxLen}字），评论页自动带入</div>
            <input value={service} onChange={(e) => setService(e.target.value)} placeholder="服务名称" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '8px 12px', width: '100%' }} />
          </div>
          <div className="card" style={{ padding: 18, marginTop: 16 }}>
            <b>安全</b>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>修改登录密码（至少{settingsConfig.passwordMinLen}位）{pwdAt ? ` · 上次修改 ${pwdAt.slice(0, 10)}` : ''}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="新密码" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '8px 12px', flex: 1 }} />
              <input type="password" value={cpw} onChange={(e) => setCpw(e.target.value)} placeholder="确认新密码" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '8px 12px', flex: 1 }} />
              <button className="btn ghost small" onClick={changePwd}>修改</button>
            </div>
            {pmsg && <div style={{ fontSize: 12, color: '#6B6862', marginTop: 8 }}>{pmsg}</div>}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <b>显示</b>
          <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>字号 {settingsConfig.fontSizeMin}-{settingsConfig.fontSizeMax}px · 主题色全局生效（含按钮与导航标识）</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>界面字号</span>
            <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>{font}px · {font <= 12 ? '紧凑' : font <= 14 ? '标准' : font <= 16 ? '舒适' : font <= 18 ? '大' : '超大'}</span>
          </div>
          <style>{`.fontRange{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;outline:none;cursor:pointer}.fontRange::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #1A1A18;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}.fontRange::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #1A1A18;cursor:pointer}`}</style>
          <div style={{ position: 'relative', padding: '14px 10px 0' }}>
            <input type="range" className="fontRange" min={settingsConfig.fontSizeMin} max={settingsConfig.fontSizeMax} step={settingsConfig.fontSizeStep} value={font} onChange={(e) => previewFont(Number(e.target.value))} style={{ width: '100%', background: `linear-gradient(to right, #1A1A18 ${((font - settingsConfig.fontSizeMin) / (settingsConfig.fontSizeMax - settingsConfig.fontSizeMin)) * 100}%, #E8E6E1 ${((font - settingsConfig.fontSizeMin) / (settingsConfig.fontSizeMax - settingsConfig.fontSizeMin)) * 100}%)` }} />
            <div style={{ position: 'relative', height: 22, marginTop: 2 }}>
              {[12, 14, 16, 18, 20].map((v) => (
                <span key={v} style={{ position: 'absolute', left: `${((v - settingsConfig.fontSizeMin) / (settingsConfig.fontSizeMax - settingsConfig.fontSizeMin)) * 100}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ width: v === font ? 9 : 6, height: v === font ? 9 : 6, borderRadius: '50%', background: v <= font ? '#1A1A18' : '#D8D5CF' }} />
                  <span className="num" style={{ fontSize: 11, color: v === font ? '#1A1A18' : '#A8A5A0', fontWeight: v === font ? 700 : 400 }}>{v}</span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginTop: 14 }}>
            {settingsConfig.themePresets.map((t) => {
              const on = theme === t.value;
              const desc: Record<string, string> = { '墨黑': '默认百搭', '藏青': '沉稳商务', '墨绿': '活力亲和', '赭石': '醒目引流' };
              return (
                <button key={t.value} onClick={() => previewTheme(t.value)} style={{ border: on ? '2px solid #1A1A18' : '1px solid #E8E6E1', borderRadius: 6, padding: 10, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ borderRadius: 4, background: '#FAFAF8', border: '1px solid #E8E6E1', overflow: 'hidden' }}>
                    <div style={{ height: 10, background: t.value }} />
                    <div style={{ padding: '8px 8px', display: 'flex', gap: 5, alignItems: 'center' }}>
                      <div style={{ width: 36, height: 14, borderRadius: 2, background: t.value }} />
                      <div style={{ flex: 1, height: 14, borderRadius: 2, background: '#E8E6E1' }} />
                    </div>
                    <div style={{ padding: '0 8px 8px', fontSize: 11, color: '#6B6862' }}>按钮 · 导航同步变色</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: on ? 700 : 400, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{t.name}</span>{on && <span>✓</span>}</div>
                  <div style={{ fontSize: 11, color: '#A8A5A0' }}>{desc[t.name] || ''}</div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, border: '1px solid #E8E6E1', borderRadius: 4, padding: 14, background: '#FCFBF9' }}>
            <div style={{ fontSize: 12, color: '#A8A5A0', marginBottom: 6 }}>实时预览（随调节变化，保存后持久化）</div>
            <b>三角洲跑刀实录 · 一局爆仓</b>
            <div style={{ fontSize: 12, color: '#6B6862', marginTop: 4 }}>在的兄弟，直接发段位+想跑的图，给你安排刀手。</div>
            <div style={{ marginTop: 8 }}><span style={{ display: 'inline-block', border: '1px solid #D8D5CF', background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '6px 12px', fontSize: 12 }}>按钮跟随主题色</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
