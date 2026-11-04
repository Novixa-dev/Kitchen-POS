/**
 * Database access for promotions and loyalty.
 *
 * Kept apart from `promotions.ts` and `loyalty.ts` so those stay pure and
 * unit-testable without a database, while everything that touches SQLite —
 * and therefore has to agree with the migration — lives in one place.
 */

import { getDB } from '../db';
import { round } from '../lib/money';
import type { LoyaltyRule, VisitRecord } from './loyalty';
import type { Promotion, PromotionLine } from './promotions';

/** SQLite stores booleans as 0/1; the row shape matches the table exactly. */
export function listPromotions(): Promotion[] {
  return getDB()
    .prepare('SELECT * FROM promotions ORDER BY priority DESC, id ASC')
    .all() as Promotion[];
}

export function getPromotion(id: number): Promotion | undefined {
  return getDB().prepare('SELECT * FROM promotions WHERE id = ?').get(id) as Promotion | undefined;
}

export function listLoyaltyRules(): LoyaltyRule[] {
  return getDB()
    .prepare('SELECT * FROM loyalty_rules ORDER BY threshold ASC, id ASC')
    .all() as LoyaltyRule[];
}

/**
 * The lines of an order, shaped for the rule engine.
 *
 * `category_id` comes from the menu item rather than the order line, because
 * the line stores a snapshot of the name and price but not the category — and
 * a category-scoped offer has to know which category a dish is in.
 *
 * `amount` is the line's net of its own discount, which is the same base the
 * tax engine uses, so a bill-scoped percentage and the tax both work off
 * figures that agree.
 */
export function orderLines(orderId: number): PromotionLine[] {
  return getDB().prepare(`
    SELECT oi.id                                     AS id,
           oi.menu_item_id                           AS menu_item_id,
           mi.category_id                            AS category_id,
           (oi.unit_price * oi.qty - COALESCE(oi.discount, 0)) AS amount
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = ?
  `).all(orderId) as PromotionLine[];
}

/** How many times this customer has redeemed each promotion. */
export function customerRedemptionCounts(customerId: number): Record<number, number> {
  const rows = getDB().prepare(`
    SELECT promotion_id, COUNT(*) AS uses
      FROM promotion_redemptions
     WHERE customer_id = ?
     GROUP BY promotion_id
  `).all(customerId) as { promotion_id: number; uses: number }[];

  return Object.fromEntries(rows.map(r => [r.promotion_id, r.uses]));
}

/**
 * A customer's billed visits, for the loyalty window.
 *
 * Cancelled orders have no bill row, so they are absent by construction.
 * `created_at` is SQLite's zone-less UTC, so it is parsed as UTC explicitly
 * rather than handed to `new Date()`, which would read it in the machine's
 * zone and shift every window by the local offset.
 */
export function customerVisits(customerId: number): VisitRecord[] {
  const rows = getDB().prepare(`
    SELECT created_at, total_amount
      FROM bills
     WHERE customer_id = ?
     ORDER BY created_at DESC
  `).all(customerId) as { created_at: string; total_amount: number }[];

  return rows.map(r => ({
    at: new Date(`${r.created_at.replace(' ', 'T')}Z`),
    total: round(r.total_amount),
  }));
}

export interface RedemptionInput {
  promotionId: number;
  amount: number;
  freeItemId: number | null;
}

/**
 * Record what was given away and advance the usage counters.
 *
 * Must be called inside the billing transaction: the counter and the bill
 * have to commit together, or a crash between them leaves an offer that was
 * granted but not counted — which is how a "first 100 customers" promotion
 * ends up serving the hundred-and-tenth.
 */
export function recordRedemptions(
  billId: number,
  customerId: number | null,
  redemptions: RedemptionInput[],
): void {
  const db = getDB();

  const insert = db.prepare(`
    INSERT INTO promotion_redemptions (promotion_id, bill_id, customer_id, amount, free_item_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const bump = db.prepare('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?');

  for (const r of redemptions) {
    insert.run(r.promotionId, billId, customerId, round(r.amount), r.freeItemId);
    bump.run(r.promotionId);
  }
}

/** What the offers actually cost, over a date range. Used by reporting. */
export function redemptionSummary(start: string, end: string) {
  return getDB().prepare(`
    SELECT p.id,
           p.name_en,
           p.name_ar,
           p.code,
           COUNT(r.id)                  AS redemptions,
           COALESCE(SUM(r.amount), 0)   AS total_amount
      FROM promotion_redemptions r
      JOIN promotions p ON p.id = r.promotion_id
     WHERE DATE(r.redeemed_at) BETWEEN DATE(?) AND DATE(?)
     GROUP BY p.id
     ORDER BY total_amount DESC
  `).all(start, end) as {
    id: number;
    name_en: string;
    name_ar: string;
    code: string | null;
    redemptions: number;
    total_amount: number;
  }[];
}

export interface LoyaltyRedemptionInput {
  ruleId: number;
  amount: number;
  freeItemId: number | null;
}

/**
 * Log loyalty rewards. Inside the billing transaction, for the same reason as
 * `recordRedemptions`: a reward granted but not logged is one the customer can
 * earn again on their very next bill.
 */
export function recordLoyaltyRedemptions(
  billId: number,
  customerId: number,
  rewards: LoyaltyRedemptionInput[],
): void {
  const insert = getDB().prepare(`
    INSERT INTO loyalty_redemptions (rule_id, bill_id, customer_id, amount, free_item_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const r of rewards) {
    insert.run(r.ruleId, billId, customerId, round(r.amount), r.freeItemId);
  }
}

/**
 * Rules this customer has already been given since their last qualifying
 * visit window opened.
 *
 * A "fifth visit" reward must not pay out on the sixth, seventh and eighth
 * too. The rule is: a reward is available again only once the customer has
 * accumulated another full threshold's worth since they last took it, which
 * the caller enforces by excluding visits up to the last redemption.
 */
export function lastLoyaltyRedemptions(customerId: number): Record<number, string> {
  const rows = getDB().prepare(`
    SELECT rule_id, MAX(redeemed_at) AS at
      FROM loyalty_redemptions
     WHERE customer_id = ?
     GROUP BY rule_id
  `).all(customerId) as { rule_id: number; at: string }[];

  return Object.fromEntries(rows.map(r => [r.rule_id, r.at]));
}
