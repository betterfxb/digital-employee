/** 统一API返回体，见 docs/03-api-contract.md */
export function ok<T>(data: T) {
  return Response.json(data);
}

export function fail(code: 'RETRYABLE' | 'FATAL' | 'AUTH_EXPIRED', message: string, status = 400) {
  return Response.json({ code, message, trace_id: `t-${Date.now().toString(36)}` }, { status });
}

/** 服务端分页包 */
export function page<T>(items: T[], next_cursor: string | null) {
  return ok({ items, next_cursor, has_more: !!next_cursor });
}
