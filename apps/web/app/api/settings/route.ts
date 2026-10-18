export const dynamic = 'force-dynamic'; // S18: 设置读接口禁静态预渲染
import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { settingsConfig } from '@/config/settings.config';

/** GET /api/settings（系统设置全量，shop_name取当前主账号展示名） */
export async function GET() {
  return ok(getRepos().settings.get());
}

/** PATCH /api/settings（shop_name改主账号展示名；font/theme白名单校验；前端保存后即时applySettings） */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return fail('FATAL', '请求体非法');
  const repos = getRepos();
  if (body.shop_name !== undefined) {
    const name = String(body.shop_name).trim();
    if (name.length < settingsConfig.shopNameMinLen || name.length > settingsConfig.shopNameMaxLen) {
      return fail('FATAL', `店铺名称长度需${settingsConfig.shopNameMinLen}-${settingsConfig.shopNameMaxLen}字`);
    }
    repos.accounts.rename(repos.accounts.getActive(), name);
  }
  if (body.service_name !== undefined) {
    const name = String(body.service_name).trim();
    if (name.length === 0 || name.length > settingsConfig.serviceNameMaxLen) {
      return fail('FATAL', `服务名称长度需1-${settingsConfig.serviceNameMaxLen}字`);
    }
  }
  if (body.font_size !== undefined) {
    const n = Number(body.font_size);
    if (!Number.isInteger(n) || n < settingsConfig.fontSizeMin || n > settingsConfig.fontSizeMax) {
      return fail('FATAL', `字号需${settingsConfig.fontSizeMin}-${settingsConfig.fontSizeMax}整数`);
    }
  }
  if (body.theme_color !== undefined) {
    if (!settingsConfig.themePresets.some((t) => t.value === body.theme_color)) return fail('FATAL', '主题色不在候选内');
  }
  if (body.auto_reply_enabled !== undefined && typeof body.auto_reply_enabled !== 'boolean') return fail('FATAL', 'auto_reply_enabled需为布尔');
  if (body.price_list !== undefined) {
    const arr = body.price_list;
    if (!Array.isArray(arr) || arr.length > 30) return fail('FATAL', '价目表需为不超过30行的数组');
    for (const row of arr as { tier?: unknown; price?: unknown }[]) {
      if (!row || typeof row.tier !== 'string' || typeof row.price !== 'string' || !row.tier.trim() || !row.price.trim() || row.tier.trim().length > 20 || row.price.trim().length > 12) {
        return fail('FATAL', '每行需档位(1-20字)与价格(1-12字)');
      }
    }
  }
  const patch: { service_name?: string; font_size?: number; theme_color?: string; price_list?: unknown; auto_reply_enabled?: boolean } = {};
  if (body.service_name !== undefined) patch.service_name = String(body.service_name).trim();
  if (body.font_size !== undefined) patch.font_size = Number(body.font_size);
  if (body.theme_color !== undefined) patch.theme_color = body.theme_color;
  if (body.price_list !== undefined) patch.price_list = (body.price_list as { tier: string; price: string }[]).map((r) => ({ tier: r.tier.trim(), price: r.price.trim() }));
  if (body.auto_reply_enabled !== undefined) patch.auto_reply_enabled = body.auto_reply_enabled;
  return ok(repos.settings.update(patch));
}
