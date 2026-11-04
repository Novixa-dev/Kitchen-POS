/**
 * Promotions and loyalty over IPC.
 *
 * Every write is validated here before it reaches the database: the rule
 * engines are strict about what they will price, and a rule that cannot be
 * priced is worse than no rule — it looks live in the admin screen and does
 * nothing at the till.
 *
 * Nothing in this module trusts an amount from the renderer. The cashier
 * sends ids and codes; the main process decides what they are worth.
 */

import { ipcMain } from 'electron';
import { getDB } from '../db';
import { errMsg } from '../lib/errors';
import { clamp, round } from '../lib/money';
import { statuses, validateLoyaltyRule, type LoyaltyRule } from '../services/loyalty';
import {
  customerVisits,
  lastLoyaltyRedemptions,
  listLoyaltyRules,
  listPromotions,
  loyaltySummary,
  orderLines,
  redemptionSummary,
} from '../services/promotion-store';
import { rangeFor } from '../lib/report-range';
import {
  evaluate,
  liveness,
  validatePromotion,
  type Promotion,
} from '../services/promotions';
import { calcBillTotals, type TaxableItem } from '../services/tax';
import { getTaxConfig } from '../lib/settings';

/**
 * The editable fields of a promotion, as the admin form sends them.
 *
 * Every value is `unknown` on purpose. This arrives over IPC from the
 * renderer, where a number input yields a string and a cleared field yields
 * an empty one. Declaring these as `number` would make the coercion below
 * look redundant to the type checker while remaining necessary at runtime.
 */
interface PromotionPayload {
  id?: number;
  code?: unknown;
  name_en?: unknown;
  name_ar?: unknown;
  kind?: Promotion['kind'];
  value?: unknown;
  free_item_id?: unknown;
  scope?: Promotion['scope'];
  target_item_id?: unknown;
  target_category_id?: unknown;
  min_subtotal?: unknown;
  max_discount?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  active_days?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  usage_limit?: unknown;
  usage_limit_per_customer?: unknown;
  stackable?: unknown;
  priority?: unknown;
  auto_apply?: unknown;
  is_active?: unknown;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const nullableText = (v: unknown): string | null => {
  const s = text(v);
  return s === '' ? null : s;
};
const nullableId = (v: unknown): number | null => {
  const n = numberOf(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const nullableCount = nullableId;
const nullableMoney = (v: unknown): number | null => {
  const n = numberOf(v);
  return n > 0 ? round(n) : null;
};

/**
 * A finite number, or zero.
 *
 * `Number('')` is 0 and `Number(undefined)` is NaN, so a cleared field and a
 * missing one both have to land somewhere predictable rather than reaching
 * `round()` as NaN and being stored as a null the engine then prices as zero.
 */
const numberOf = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Coerce the form payload into a row the engine can price.
 *
 * A code is upper-cased on the way in so the UNIQUE index does the work:
 * `welcome10` and `WELCOME10` must not be two different coupons.
 */
function toRow(payload: PromotionPayload) {
  const kind: Promotion['kind'] =
    payload.kind === 'amount' || payload.kind === 'free_item' ? payload.kind : 'percent';

  return {
    code: nullableText(payload.code)?.toUpperCase() ?? null,
    name_en: text(payload.name_en),
    name_ar: text(payload.name_ar),
    kind,
    value: kind === 'percent'
      ? clamp(numberOf(payload.value), 0, 100)
      : round(Math.max(0, numberOf(payload.value))),
    free_item_id: nullableId(payload.free_item_id),
    scope: payload.scope === 'item' ? 'item' as const : 'bill' as const,
    target_item_id: nullableId(payload.target_item_id),
    target_category_id: nullableId(payload.target_category_id),
    min_subtotal: round(Math.max(0, numberOf(payload.min_subtotal))),
    max_discount: nullableMoney(payload.max_discount),
    starts_at: nullableText(payload.starts_at),
    ends_at: nullableText(payload.ends_at),
    active_days: nullableText(payload.active_days),
    start_time: nullableText(payload.start_time),
    end_time: nullableText(payload.end_time),
    usage_limit: nullableCount(payload.usage_limit),
    usage_limit_per_customer: nullableCount(payload.usage_limit_per_customer),
    stackable: payload.stackable === true ? 1 : 0,
    priority: Math.trunc(clamp(numberOf(payload.priority), -100, 100)),
    auto_apply: payload.auto_apply === true ? 1 : 0,
    is_active: payload.is_active === false ? 0 : 1,
  };
}

/** As with `PromotionPayload`: untrusted renderer input, so `unknown`. */
interface LoyaltyPayload {
  id?: number;
  name_en?: unknown;
  name_ar?: unknown;
  basis?: LoyaltyRule['basis'];
  threshold?: unknown;
  window_days?: unknown;
  reward_kind?: LoyaltyRule['reward_kind'];
  reward_value?: unknown;
  reward_item_id?: unknown;
  reward_max_discount?: unknown;
  is_active?: unknown;
}

function toLoyaltyRow(payload: LoyaltyPayload) {
  const basis: LoyaltyRule['basis'] = payload.basis === 'spend' ? 'spend' : 'visits';
  const rewardKind: LoyaltyRule['reward_kind'] =
    payload.reward_kind === 'amount' || payload.reward_kind === 'free_item'
      ? payload.reward_kind
      : 'percent';

  const rawThreshold = numberOf(payload.threshold);

  return {
    name_en: text(payload.name_en),
    name_ar: text(payload.name_ar),
    basis,
    // A visit count is whole by nature; "every 4.5 visits" has no meaning.
    threshold: basis === 'visits' ? Math.trunc(rawThreshold) : round(rawThreshold),
    window_days: nullableCount(payload.window_days),
    reward_kind: rewardKind,
    reward_value: rewardKind === 'percent'
      ? clamp(numberOf(payload.reward_value), 0, 100)
      : round(Math.max(0, numberOf(payload.reward_value))),
    reward_item_id: nullableId(payload.reward_item_id),
    reward_max_discount: nullableMoney(payload.reward_max_discount),
    is_active: payload.is_active === false ? 0 : 1,
  };
}

export function registerPromotionsIPC() {
  // ── Promotions ────────────────────────────────────────────────────────
  ipcMain.handle('promotions:list', async () => {
    try {
      const now = new Date();
      // `liveness` is reported alongside each row so the admin screen can say
      // "active but not running right now" instead of leaving the owner to
      // work out why Tuesday's offer did nothing on Wednesday.
      return {
        success: true,
        data: listPromotions().map(p => ({ ...p, notLiveReason: liveness(p, now) })),
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('promotions:upsert', async (_, payload: PromotionPayload) => {
    try {
      const row = toRow(payload);

      const problems = validatePromotion(row as Partial<Promotion>);
      if (problems.length > 0) {
        return { success: false, error: problems[0], problems };
      }

      const db = getDB();

      if (payload.id) {
        db.prepare(`
          UPDATE promotions
             SET code = ?, name_en = ?, name_ar = ?, kind = ?, value = ?,
                 free_item_id = ?, scope = ?, target_item_id = ?, target_category_id = ?,
                 min_subtotal = ?, max_discount = ?, starts_at = ?, ends_at = ?,
                 active_days = ?, start_time = ?, end_time = ?,
                 usage_limit = ?, usage_limit_per_customer = ?,
                 stackable = ?, priority = ?, auto_apply = ?, is_active = ?
           WHERE id = ?
        `).run(
          row.code, row.name_en, row.name_ar, row.kind, row.value,
          row.free_item_id, row.scope, row.target_item_id, row.target_category_id,
          row.min_subtotal, row.max_discount, row.starts_at, row.ends_at,
          row.active_days, row.start_time, row.end_time,
          row.usage_limit, row.usage_limit_per_customer,
          row.stackable, row.priority, row.auto_apply, row.is_active,
          payload.id,
        );
        return { success: true, data: { id: payload.id } };
      }

      const info = db.prepare(`
        INSERT INTO promotions (
          code, name_en, name_ar, kind, value, free_item_id, scope,
          target_item_id, target_category_id, min_subtotal, max_discount,
          starts_at, ends_at, active_days, start_time, end_time,
          usage_limit, usage_limit_per_customer, stackable, priority,
          auto_apply, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.code, row.name_en, row.name_ar, row.kind, row.value,
        row.free_item_id, row.scope, row.target_item_id, row.target_category_id,
        row.min_subtotal, row.max_discount, row.starts_at, row.ends_at,
        row.active_days, row.start_time, row.end_time,
        row.usage_limit, row.usage_limit_per_customer,
        row.stackable, row.priority, row.auto_apply, row.is_active,
      );

      return { success: true, data: { id: Number(info.lastInsertRowid) } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Deactivate rather than delete when the rule has already been given away.
   *
   * `promotion_redemptions` references the row, so deleting it would either
   * fail or orphan the record of what an offer cost — which is exactly the
   * figure an owner asks about at the end of the month.
   */
  ipcMain.handle('promotions:delete', async (_, payload: { id: number }) => {
    try {
      const db = getDB();
      const used = db
        .prepare('SELECT COUNT(*) AS n FROM promotion_redemptions WHERE promotion_id = ?')
        .get(payload.id) as { n: number };

      if (used.n > 0) {
        db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(payload.id);
        return { success: true, data: { deactivated: true, redemptions: used.n } };
      }

      db.prepare('DELETE FROM promotions WHERE id = ?').run(payload.id);
      return { success: true, data: { deactivated: false } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * What a code is worth on an order, before the bill dialog commits to it.
   *
   * Returns the reason when it is worth nothing, so the cashier can tell the
   * customer "this expired on Sunday" rather than "it didn't work".
   */
  ipcMain.handle('promotions:checkCode', async (_, payload: { code: string; orderId: number; customerId?: number }) => {
    try {
      const code = text(payload.code).toUpperCase();
      if (!code) { return { success: false, error: 'promotion/code-required' }; }

      const promo = getDB()
        .prepare('SELECT * FROM promotions WHERE UPPER(code) = ?')
        .get(code) as Promotion | undefined;

      if (!promo) { return { success: false, error: 'promotion/unknown-code' }; }

      const items = getDB().prepare(`
        SELECT qty, unit_price, cgst_rate, sgst_rate, discount
          FROM order_items WHERE order_id = ?
      `).all(payload.orderId) as TaxableItem[];

      const base = calcBillTotals(items, getTaxConfig());

      const result = evaluate([promo], {
        lines: orderLines(payload.orderId),
        subtotal: base.total_amount,
        customerId: payload.customerId ?? null,
        now: new Date(),
      });

      if (result.applied.length === 0) {
        return {
          success: false,
          error: `promotion/${result.rejected[0]?.reason ?? 'no-value'}`,
        };
      }

      const offer = result.applied[0];
      return {
        success: true,
        data: {
          promotionId: promo.id,
          code: promo.code,
          nameEn: promo.name_en,
          nameAr: promo.name_ar,
          kind: promo.kind,
          amount: offer.amount,
          freeItemId: offer.freeItemId,
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * What the offers cost over a period.
   *
   * Takes the same filter shape as `reports:daily` and resolves it through
   * the same module, so the offer cost and the revenue it was taken off
   * describe the same week.
   */
  ipcMain.handle('promotions:report', async (_, payload: {
    filter: string;
    start?: string;
    end?: string;
  }) => {
    try {
      const built = rangeFor(payload.filter, 'redeemed_at', {
        start: payload.start,
        end: payload.end,
      });
      if (!built.ok) { return { success: false, error: built.error }; }

      const { condition, params } = built.range;
      const promotions = redemptionSummary(condition, params);
      const loyalty = loyaltySummary(condition, params);

      return {
        success: true,
        data: {
          promotions,
          loyalty,
          totalPromotions: round(promotions.reduce((a, r) => a + r.total_amount, 0)),
          totalLoyalty: round(loyalty.reduce((a, r) => a + r.total_amount, 0)),
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  // ── Loyalty ───────────────────────────────────────────────────────────
  ipcMain.handle('loyalty:listRules', async () => {
    try {
      return { success: true, data: listLoyaltyRules() };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('loyalty:upsertRule', async (_, payload: LoyaltyPayload) => {
    try {
      const row = toLoyaltyRow(payload);

      const problems = validateLoyaltyRule(row as Partial<LoyaltyRule>);
      if (problems.length > 0) {
        return { success: false, error: problems[0], problems };
      }

      const db = getDB();

      if (payload.id) {
        db.prepare(`
          UPDATE loyalty_rules
             SET name_en = ?, name_ar = ?, basis = ?, threshold = ?, window_days = ?,
                 reward_kind = ?, reward_value = ?, reward_item_id = ?,
                 reward_max_discount = ?, is_active = ?
           WHERE id = ?
        `).run(
          row.name_en, row.name_ar, row.basis, row.threshold, row.window_days,
          row.reward_kind, row.reward_value, row.reward_item_id,
          row.reward_max_discount, row.is_active, payload.id,
        );
        return { success: true, data: { id: payload.id } };
      }

      const info = db.prepare(`
        INSERT INTO loyalty_rules (
          name_en, name_ar, basis, threshold, window_days,
          reward_kind, reward_value, reward_item_id, reward_max_discount, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.name_en, row.name_ar, row.basis, row.threshold, row.window_days,
        row.reward_kind, row.reward_value, row.reward_item_id,
        row.reward_max_discount, row.is_active,
      );

      return { success: true, data: { id: Number(info.lastInsertRowid) } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('loyalty:deleteRule', async (_, payload: { id: number }) => {
    try {
      const db = getDB();
      const used = db
        .prepare('SELECT COUNT(*) AS n FROM loyalty_redemptions WHERE rule_id = ?')
        .get(payload.id) as { n: number };

      if (used.n > 0) {
        db.prepare('UPDATE loyalty_rules SET is_active = 0 WHERE id = ?').run(payload.id);
        return { success: true, data: { deactivated: true, redemptions: used.n } };
      }

      db.prepare('DELETE FROM loyalty_rules WHERE id = ?').run(payload.id);
      return { success: true, data: { deactivated: false } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /** Where one customer stands against every active rule. */
  ipcMain.handle('loyalty:customerStatus', async (_, payload: { customerId: number }) => {
    try {
      const lastRaw = lastLoyaltyRedemptions(payload.customerId);
      const lastRedeemed = Object.fromEntries(
        Object.entries(lastRaw).map(([ruleId, at]) => [
          Number(ruleId),
          new Date(`${at.replace(' ', 'T')}Z`),
        ]),
      );

      const data = statuses(
        listLoyaltyRules(),
        customerVisits(payload.customerId),
        new Date(),
        lastRedeemed,
      ).map(s => ({
        ruleId: s.rule.id,
        nameEn: s.rule.name_en,
        nameAr: s.rule.name_ar,
        basis: s.rule.basis,
        rewardKind: s.rule.reward_kind,
        rewardValue: s.rule.reward_value,
        progress: s.progress,
        threshold: s.threshold,
        ratio: s.ratio,
        earned: s.earned,
        remaining: s.remaining,
      }));

      return { success: true, data };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
