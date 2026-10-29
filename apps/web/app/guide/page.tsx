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
  { page: '评论工作台', what: '意图分类、批量操作、生成回复话术、登记跟进、保存常用筛选视图' },
  { page: '任务中心', what: '定时任务状态、启停控制、自动化参数（间隔/上限/静默时段）（自动同步等官方通道开通后自动生效）' },
  { page: '经营报告', what: '日报/周报、指标趋势与行动建议（专业版）' },
  { page: '智能营销', what: '机会雷达、智能客群圈选、话术A/B实验、活动方案复盘（专业版；系统只出主意，触达由你人工执行）' },
  { page: '私信辅助', what: '话术库（可自定义）、跟进台账（表格/看板拖拽/日历三视图）、接待规则' },
  { page: '系统设置', what: '字体/主题、数据备份恢复、修改访问密码、桌面端常驻与开机自启' },
];

const HOTKEYS = [
  { key: 'j / k', what: '下一条 / 上一条评论' },
  { key: 'e', what: '标已读' },
  { key: '1 / 2 / 3', what: '改意图（高意向/咨询/…，按设置顺序）' },
  { key: 'c', what: '复制当前评论内容' },
  { key: 'a', what: '全选 / 取消全选' },
  { key: 'Ctrl+K', what: '全局命令面板（跳页/搜台账话术/快捷动作）——任意页面可用' },
  { key: '?', what: '快捷键帮助浮层（任意页面，Esc 关闭）' },
  { key: '右键', what: '评论行右键菜单：标已读/登记跟进/改意图/搜此人' },
];

const FAQ = [
  { q: '导入的 CSV 报缺列怎么办？', a: '不用改文件：系统支持常见列名写法（播放量/观看量、发布日期/日期等自动识别），UTF-8/GBK 编码和 Excel 复制粘贴的表格都能直接读。报错里会列出你的表头和支持写法，对照改列名即可；拿不准就「下载模板」照着放。' },
  { q: '我的数据存在哪里？安全吗？', a: '全部存在你这台电脑本地（桌面版在系统数据目录），不上传任何第三方。卸载前建议先在系统设置里做一次备份。' },
  { q: '换了新电脑怎么办？', a: '新电脑装好软件后，到「系统设置 → 数据管理」导入旧电脑的备份文件即可迁移；授权也在新电脑的激活页重新导入一次授权文件。' },
  { q: '扫码登录什么时候能用？', a: '官方通道需要抖音开放平台的企业资质审核（个体工商户可以办）。通道开通后，授权页弹窗内就是抖音官方登录页，数据自动同步自动开启。' },
  { q: '为什么私信功能是灰的？', a: '抖音只对认证企业号（蓝V）开放私信接口。升级蓝V后联系服务商开通，本页直接切换官方会话。' },
  { q: '软件怎么更新？', a: '收到新版本安装包后直接双击覆盖安装，你的数据和授权都不受影响。' },
  { q: '回复是我发的还是软件自动发的？', a: '全部由你确认后自己发送。系统只负责筛选意向、生成候选话术和记账跟进，不会碰你的账号自动操作。' },
  { q: '怎么备份更安全？', a: '除了手动「下载备份/加密备份」，系统每天凌晨后还会自动在你电脑里存一份快照（保留最近14份，系统设置→本地自动备份可查看/下载/恢复），文件损坏或误操作也能救回。口令类加密备份请和文件分开保管。' },
  { q: '出问题了要提供什么？', a: '系统设置→数据管理→「导出诊断包」，把生成的 txt 文件发给服务商即可（含版本、授权状态与最近日志，不含你的业务数据）。' },
  { q: '自动回复安全吗？会不会被封号？', a: '只在抖音官方接口范围内工作：能力审核通过 + 你手动开启开关后才会自动发送；之前系统只起草、你确认后自己发。系统从不模拟人工点击、不绕平台检测——这是写进产品的红线承诺。' },
  { q: '自动化的节奏能改吗？', a: '任务中心「自动化参数」：同步间隔与每日上限、夜间静默时段、自动回复随机间隔与每日上限与口吻、日报提醒时点、看板自动刷新，全部可调（越界值系统自动钳回安全范围）。' },
  { q: '（桌面版）关掉窗口提醒还响吗？', a: '响。关窗口只是缩进系统托盘，程序在后台继续跑提醒、自动起草和每日备份；点托盘图标重新打开，要彻底退出用托盘右键「退出」。想让开机就自动待命，去系统设置→桌面端常驻打开「开机自动启动」。' },
  { q: '智能营销会不会自动给客户发广告？', a: '不会，这是产品红线。智能营销=系统用你的真实数据出主意（谁该跟进、哪群人可唤醒、哪条话术更灵、活动进度复盘），发不发消息、发给谁永远由你人工决定。市面上那些群发/外呼工具是拿你账号去赌封号。' },
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
          <b>版本说明</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>当前版本以授权管理页显示为准；升级授权文件导入即可解锁，数据不丢</span>
          <Table
            size="small"
            pagination={false}
            style={{ marginTop: 10 }}
            rowKey="cap"
            dataSource={[
              { cap: '授权绑定 · 数据看板 · CSV导入', basic: '✓', pro: '✓' },
              { cap: '智能营销（机会雷达/客群圈选/话术A/B/活动方案）', basic: '✗', pro: '✓' },
              { cap: '自动化（定时同步/自动回复起草/提醒/参数面板）', basic: '✓', pro: '✓' },
              { cap: '评论工作台（意图分类+意向分+批量操作）', basic: '✓', pro: '✓' },
              { cap: '话术生成（行业模板+口吻可调）', basic: '✓', pro: '✓' },
              { cap: '跟进台账 · 任务中心 · 系统设置', basic: '✓', pro: '✓' },
              { cap: '经营报告（日报/周报/7天趋势）', basic: '✕', pro: '✓' },
              { cap: '转化漏斗 + 热词趋势', basic: '✕', pro: '✓' },
              { cap: '线索标签 + 档案纪要', basic: '✕', pro: '✓' },
              { cap: '竞品记录与变化历史', basic: '✕', pro: '✓' },
              { cap: '价目表 + 报价话术自动带价', basic: '✕', pro: '✓' },
            ]}
            columns={[
              { title: '能力', dataIndex: 'cap', key: 'cap' },
              { title: '基础版', dataIndex: 'basic', key: 'b', width: 80, align: 'center' as const, render: (v: string) => <span style={{ color: v === '✓' ? '#1677FF' : '#A8A5A0', fontWeight: 700 }}>{v}</span> },
              { title: '专业版', dataIndex: 'pro', key: 'p', width: 80, align: 'center' as const, render: () => <span style={{ color: '#1677FF', fontWeight: 700 }}>✓</span> },
            ]}
          />
        </div>
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <b>自动化与合规</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>任务中心「自动化参数」可随时调</span>
          <div style={{ fontSize: 13, color: '#1A1A18', lineHeight: 2, marginTop: 10 }}>
            <div>· <b>定时同步</b>：按你设的间隔自动拉取作品/评论数据（官方通道开通后生效），带每日上限与夜间静默。</div>
            <div>· <b>评论自动回复</b>：新评论自动按「接待规则」匹配或起草话术并记执行日志；<b>正式发送需三重门齐</b>——官方 live 通道 + 平台「评论回复」能力审核 + 你手动打开开关。三样齐之前系统只起草、不发送。</div>
            <div>· <b>提醒</b>：跟进到期、授权临期、每日报告，系统主动通知你（只提醒，不代你操作）。</div>
            <div>· <b>边界承诺</b>：本系统只在抖音官方提供的接口内工作，不做任何模拟人工点击、绕过平台检测的操作——那类做法会被抖音封号，我们不碰，也请勿用于任何第三方工具。</div>
          </div>
        </div>
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <b>快捷键</b>
          <Table size="small" pagination={false} style={{ marginTop: 10 }} columns={hotCols} dataSource={HOTKEYS} rowKey="key" />
        </div>
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <b>常见问题</b>
          <Table size="small" pagination={false} style={{ marginTop: 10 }} columns={faqCols} dataSource={FAQ} rowKey="q" />
        </div>
        <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 16, lineHeight: 1.8 }}>
          还有问题？联系你的服务商会第一时间响应。系统只在抖音官方接口内工作：自动回复需官方能力审核通过并由你开启后才发送，能力开通前所有回复均由你确认后自己发送——任何情况下都不会模拟人工操作你的账号。
        </div>
      </div>
    </div>
  );
}
