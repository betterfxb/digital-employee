/**
 * S18b 设置即时生效：CSS变量（主题）+ body zoom（字号）+ 开机拉取应用
 * zoom为过渡方案（全站px样式，改rem成本过高，见09备注）；Chrome/Edge/Firefox均支持。
 */
import { settingsConfig } from '../config/settings.config';

export interface UiSettings { font_size: number; theme_color: string }

/** 即时应用（不等待保存，用于调节预览与保存后生效） */
export function applySettings(s: UiSettings) {
  document.documentElement.style.setProperty('--accent', s.theme_color);
  (document.body.style as CSSStyleDeclaration & { zoom?: string }).zoom =
    String(s.font_size / settingsConfig.fontZoomBase);
}

/** 开机应用（Shell挂载时调用，失败静默用默认值） */
export async function loadAndApplySettings() {
  try {
    const s = await (await fetch('/api/settings')).json();
    if (typeof s.font_size === 'number' && typeof s.theme_color === 'string') applySettings(s);
  } catch { /* 默认主题生效，不打扰用户 */ }
}
