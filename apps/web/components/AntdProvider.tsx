'use client';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

/** S27 antd全局配置：中文语言包 + 羊皮纸主题token（保留现有暖色纸感，仅升级控件质感） */
export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1A1A18',
          colorInfo: '#1A1A18',
          colorLink: '#8A6D3B',
          borderRadius: 4,
          fontFamily: 'inherit',
          colorBgContainer: '#FFFFFF',
          colorBorder: '#D8D5CF',
          colorSplit: '#E8E6E1',
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
