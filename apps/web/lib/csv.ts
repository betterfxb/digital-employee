/** CSV导出（BOM防Excel中文乱码，纯展示数据导出，不含敏感原文以外的字段） */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  // 公式注入防护：首字符为=+-@时前缀单引号（防Excel执行），再做引号转义
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const text = '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
