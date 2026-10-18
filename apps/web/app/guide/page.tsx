'use client';
import { Button, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

/** S36 内置使用指南：客户自助上手（纯静态页，无接口） */
const STEPS = [
  { n: '①', t: '导入你的数据', d: '打开「数据看板」→ 导入我的数据 → 下载模板照着填 → 拖入 CSV。先导作品、再导评论。', href: '/dashboard', btn: '去导入' },
  { n: '②', t: '看意向客户', d: '「评论工作台」自动把评论分成五档意图，高意向排前面。点行查看详情，j/k 可以快速翻。', href: '/comments', btn: '去工作台' },
  { n: '③', t: '生成回复话术', d: '选中评论 → 智能生成回复 → 4 个候选挑一条 →「用这条」→ 复制到抖音回复。全程你确认后才发。', href: '/comments', btn: '去试试' },
  { n: '④', t: '跟进不流失', d: '把有戏的客户「加入跟进」，在「私信辅助」的台账里管理状态：待回访 / 已回访 / 已转化。', href: '/messages', btn: '去看台账' },
];

const PAGE_MAP = [
  { page: '授权管理', what: '绑定抖音账号、查看授权有效期、系统授权状态' },
  { page: '数据看板', what: '导入数据、看播放/点赞/评论汇总、导出作品 CSV、竞品记录' },
  { page: '评论工作台', what: '意图分类、批量操作、生成回复话术、登记跟进' },
  { page: '任务中心', what: '定时任务状态、启停控制（自动同步等官方通道开通后自动生效）' },
  { page: '私信辅助', what: '话术库（可自定义）、跟进台账、接待规则' },
  { page: '系统设置', what: '字体/主题、数据备份恢复、修改访问密码' },
];

const HOTKEYS = [
  { key: 'j / k', what: '下一条 / 上一条评论' },
  { key: 'e', what: '标已读' },
  { key: '1 / 2 / 3', what: '改意图（高意向/咨询/…，按设置顺序）' },
  { key: 'c', what: '复制当前评论内容' },
  { key: 'a', what: '全选 / 取消全选' },
];

const FAQ = [
  { q: '导入的 CSV 报"列头不一致"怎么办？', a: '点导入向导里的「下载模板」，保持表头一字不差（顺序、逗号都不要改），数据行照着填。' },
  { q: '我的数据存在哪里？安全吗？', a: '全部存在你这台电脑本地（桌面版在系统数据目录），不上传任何第三方。卸载前建议先在系统设置里做一次备份。' },
  { q: '换了新电脑怎么办？', a: '新电脑装好软件后，到「系统设置 → 数据管理」导入旧电脑的备份文件即可迁移；授权也在新电脑的激活页重新导入一次授权文件。' },
  { q: '扫码登录什么时候能用？', a: '官方通道需要抖音开放平台的企业资质审核（个体工商户可以办）。通道开通后，授权页弹窗内就是抖音官方登录页，数据自动同步自动开启。' },
  { q: '为什么私信功能是灰的？', a: '抖音只对认证企业号（蓝V）开放私信接口。升级蓝V后联系服务商开通，本页直接切换官方会话。' },
  { q: '软件怎么更新？', a: '收到新版本安装包后直接双击覆盖安装，你的数据和授权都不受影响。' },
  { q: '回复是我发的还是软件自动发的？', a: '全部由你确认后自己发送。系统只负责筛选意向、生成候选话术和记账跟进，不会碰你的账号自动操作。' },
];

export default function Guide() {
  const hotCols: ColumnsType<{ key: string; what: string }> = [
    { title: '按键', dataIndex: 'key', key: 'k', width: 110, onCell: () => ({ className: 'num' }) },
    { title: '作用', dataIndex: 'what', key: 'w' },
  ];
  const faqCols: ColumnsType<{ q: string; a: string }> = [
    { title: '问题', dataIndex: 'q', key: 'q', width: 300, render: (v) => <b>{v}</b> },
    { title: '答案', dataIndex: 'a', key: 'a' },
  ];
  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1' }}><b style={{ fontSize: 15 }}>使用指南</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>五分钟上手 · 常见问题</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1080, margin: '0 auto' }}>
        <div className="card" style={{ padding: 18 }}>
          <b>从这里开始（四步）</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: 14 }}>
                <div style={{ fontSize: 12, color: '#A8A5A0' }}>{s.n}</div>
                <b style={{ fontSize: 14 }}>{s.t}</b>
                <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px', lineHeight: 1.7 }}>{s.d}</div>
                <Button size="small" href={s.href}>{s.btn}</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <b>各页面都是干什么的</b>
          <div style={{ marginTop: 10 }}>
            {PAGE_MAP.map((p) => (
              <div key={p.page} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid #F0EEEA', fontSize: 13 }}>
                <b style={{ width: 110, flexShrink: 0 }}>{p.page}</b>
                <span style={{ color: '#6B6862' }}>{p.what}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <b>快捷键（评论工作台）</b>
          <Table size="small" pagination={false} style={{ marginTop: 10 }} columns={hotCols} dataSource={HOTKEYS} rowKey="key" />
        </div>
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <b>常见问题</b>
          <Table size="small" pagination={false} style={{ marginTop: 10 }} columns={faqCols} dataSource={FAQ} rowKey="q" />
        </div>
        <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 16, lineHeight: 1.8 }}>
          还有问题？联系你的服务商会第一时间响应。本系统所有回复/跟进均由你人工确认后操作，不会自动操作你的抖音账号。
        </div>
      </div>
    </div>
  );
}
