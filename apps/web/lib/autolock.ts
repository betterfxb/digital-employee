/**
 * S150 挂机自动锁定纯谓词（零IO，入 crypto 单测）：
 * 收银台场景：店员走开，软件还开着=客户联系方式裸奔。闲置超阈值自动回到解锁层。
 * 只在「已设访问密码」时有意义（无密码=无锁可回），阈值 0=关闭。
 */
export function shouldLock(lastActivity: number, now: number, idleMinutes: number, hasPassword: boolean): boolean {
  if (!hasPassword || idleMinutes <= 0) return false;
  return now - lastActivity >= idleMinutes * 60_000;
}
