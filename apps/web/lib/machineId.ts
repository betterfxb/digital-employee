/**
 * S30 机器指纹：CPU/磁盘/网卡MAC 三因子采集（Windows PowerShell CIM），各因子 sha256 截断32hex
 * 绑定规则：license 存三因子哈希，当前机器命中 ≥min(2, 绑定因子数) 即认（换单个硬件不误伤）
 * 仅服务端引用；PowerShell 不可用时因子为空（签发侧同样为空则该因子不参与绑定）
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';

export interface MachineFactors { cpu: string; disk: string; mac: string }

function sha32(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

function ps(cmd: string): string {
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
      timeout: 5000, windowsHide: true, encoding: 'utf8',
    }).trim().replace(/\s+/g, '');
  } catch { return ''; }
}

/** 采集原始因子（多值排序去重拼接，防网卡/磁盘枚举顺序漂移） */
export function collectRaw(): MachineFactors {
  const cpu = ps('(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId)');
  const disk = ps('((Get-CimInstance Win32_DiskDrive | Where-Object {$_.SerialNumber} | ForEach-Object {$_.SerialNumber.Trim()}) | Sort-Object | Select-Object -Unique) -join "|"');
  const mac = ps('((Get-CimInstance Win32_NetworkAdapter | Where-Object {$_.PhysicalAdapter -and $_.MACAddress} | ForEach-Object {$_.MACAddress}) | Sort-Object | Select-Object -Unique) -join "|"');
  return { cpu, disk, mac };
}

/** 因子哈希（空值保持空串，不参与绑定） */
export function fingerprint(raw: MachineFactors): MachineFactors {
  return {
    cpu: raw.cpu ? sha32(raw.cpu) : '',
    disk: raw.disk ? sha32(raw.disk) : '',
    mac: raw.mac ? sha32(raw.mac) : '',
  };
}

let cached: MachineFactors | null = null;
export function currentFactors(): MachineFactors {
  if (!cached) cached = fingerprint(collectRaw());
  return cached;
}

/** 机器码：三哈希用 . 拼接（激活页展示，复制给签发方） */
export function machineCode(f: MachineFactors = currentFactors()): string {
  return `${f.cpu}.${f.disk}.${f.mac}`;
}

/** 纯函数：绑定校验。无绑定/空绑定=不限制（兼容旧license）；命中数 ≥ min(2, 绑定因子数) 即认 */
export function matchBind(bind: Partial<MachineFactors> | undefined, current: MachineFactors): boolean {
  if (!bind) return true;
  const keys: (keyof MachineFactors)[] = ['cpu', 'disk', 'mac'];
  const bound = keys.filter((k) => !!bind[k]);
  if (bound.length === 0) return true;
  const matched = bound.filter((k) => bind[k] === current[k]).length;
  return matched >= Math.min(2, bound.length);
}
