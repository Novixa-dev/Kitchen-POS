/**
 * One path from an order to a priced bill.
 *
 * `billing:preview` and `createBill` both call `priceOrder`. That is
 * deliberate: when the dialog computed its own figures the cashier could
 * collect a total the saved bill disagreed with, and the same would happen
 * again the moment promotions were priced in two places that round
 * differently. The renderer asks what the bill comes to; it never works it
 * out.
 *
 * Order of operations, and why:
 *
 *  1. Tax engine prices the lines and the bill (`calcBillTotals`).
 *  2. Promotion rules are evaluated against that gross total.
 *  3. Earned loyalty rewards are priced against the same total.
 *  4. The cashier's manual discount is applied last.
 *
 * Rule-driven discounts come before the manual one so a cashier topping up an
 * offer cannot accidentally be credited twice for the same money, and the
 * combined discount is capped at the bill so no arrangement of rules can make
 * the outlet owe the customer.
 */

import { round } from '../lib/money';
import { getTaxConfig } from '../lib/settings';
import {
  rewardsFor,
  type LoyaltyReward,
} from './loyalty';
import {
  customerRedemptionCounts,
  customerVisits,
  lastLoyaltyRedemptions,
  listLoyaltyRules,
  listPromotions,
  orderLines,
  type LoyaltyRedemptionInput,
  type RedemptionInput,
} from './promotion-store';
import {
  evaluate,
  selectCandidates,
  type Evaluation,
  type PromotionOffer,
} from './promotions';
import {
  applyBillDiscount,
  calcBillTotals,
  calcLineTax,
  type BillTotals,
  type TaxableItem,
  type TaxConfig,
} from './tax';
import { getDB } from '../db';

export interface PricingRequest {
  orderId: number;
  /** The cashier's own figure, applied after every rule. */
  manualDiscount?: number;
  customerId?: number | null;
  /** Offers the cashier picked from the list. */
  promotionIds?: number[];
  /** Codes the customer presented. */
  couponCodes?: string[];
  /** Whether to pay out loyalty rewards this customer has earned. */
  useLoyalty?: boolean;
  /** Injected so the rule windows are testable; defaults to the real clock. */
  now?: Date;
}

export interface AppliedOffer {
  promotionId: number;
  code: string | null;
  nameEn: string;
  nameAr: string;
  kind: PromotionOffer['promotion']['kind'];
  amount: number;
  freeItemId: number | null;
}

export interface AppliedReward {
  ruleId: number;
  nameEn: string;
  nameAr: string;
  kind: LoyaltyReward['kind'];
  amount: number;
  freeItemId: number | null;
}

export interface PricedLine {
  id: number;
  name: string;
  qty: number;
  unit_price: number;
  taxable_amount: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_amount: number;
}

export interface PricedBill {
  totals: BillTotals;
  tax: TaxConfig;
  lines: PricedLine[];
  /** Discount that came from a promotion or a loyalty reward. */
  promotionDiscount: number;
  /** The cashier's own discount, after clamping. */
  manualDiscount: number;
  offers: AppliedOffer[];
  rewards: AppliedReward[];
  /** Offers that qualified but lost to a non-stackable winner. */
  suppressed: { promotionId: number; nameEn: string; nameAr: string }[];
  /** Offers that did not qualify, with the reason, for the cashier to see. */
  rejected: { promotionId: number; nameEn: string; nameAr: string; reason: string }[];
  /** Rows `createBill` writes once the bill exists. */
  redemptions: RedemptionInput[];
  loyaltyRedemptions: LoyaltyRedemptionInput[];
}

interface OrderItemRow extends TaxableItem {
  id: number;
  name: string;
}

/**
 * Price one order.
 *
 * Reads the order, the rules and the customer's history, and returns both the
 * figures to show and the redemption rows to write. Nothing is written here —
 * the caller decides whether this is a preview or a sale.
 */
export function priceOrder(request: PricingRequest): PricedBill {
  const db = getDB();
  const now = request.now ?? new Date();
  const taxConfig = getTaxConfig();

  const items = db.prepare(`
    SELECT id, name, qty, unit_price, cgst_rate, sgst_rate, discount
      FROM order_items
     WHERE order_id = ?
  `).all(request.orderId) as OrderItemRow[];

  const base = calcBillTotals(items, taxConfig);

  // ── Promotions ────────────────────────────────────────────────────────
  const candidates = selectCandidates(listPromotions(), {
    ids: request.promotionIds ?? [],
    codes: request.couponCodes ?? [],
  });

  const customerId = request.customerId ?? null;

  const evaluation: Evaluation = evaluate(candidates, {
    lines: orderLines(request.orderId),
    subtotal: base.total_amount,
    customerId,
    customerRedemptions: customerId ? customerRedemptionCounts(customerId) : {},
    now,
  });

  // ── Loyalty ───────────────────────────────────────────────────────────
  let rewards: LoyaltyReward[] = [];
  if (request.useLoyalty && customerId) {
    const lastRaw = lastLoyaltyRedemptions(customerId);
    const lastRedeemed = Object.fromEntries(
      Object.entries(lastRaw).map(([ruleId, at]) => [
        Number(ruleId),
        // SQLite's CURRENT_TIMESTAMP is zone-less UTC; parsed as such rather
        // than as local time, which would move every reset by the offset.
        new Date(`${at.replace(' ', 'T')}Z`),
      ]),
    );

    rewards = rewardsFor(
      listLoyaltyRules(),
      customerVisits(customerId),
      base.total_amount,
      now,
      lastRedeemed,
    );
  }

  // ── Combine ───────────────────────────────────────────────────────────
  const ruleDiscount = round(
    Math.min(
      round(evaluation.totalDiscount + rewards.reduce((a, r) => a + r.amount, 0)),
      base.total_amount,
    ),
  );

  const afterRules = applyBillDiscount(base, ruleDiscount);

  const requestedManual = Math.max(0, round(request.manualDiscount ?? 0));
  const totals = applyBillDiscount(afterRules, requestedManual);
  // What the clamp actually allowed, which is what gets stored and printed.
  const manualDiscount = round(afterRules.total_amount - totals.total_amount);

  return {
    totals,
    tax: taxConfig,
    lines: items.map((item) => {
      const line = calcLineTax(item, taxConfig);
      return {
        id: item.id,
        name: item.name,
        qty: item.qty,
        unit_price: item.unit_price,
        taxable_amount: line.taxableAmount,
        tax_amount: line.taxAmount,
        cgst_amount: line.cgstAmount,
        sgst_amount: line.sgstAmount,
        total_amount: line.totalAmount,
      };
    }),
    promotionDiscount: ruleDiscount,
    manualDiscount,
    offers: evaluation.applied.map(o => ({
      promotionId: o.promotion.id,
      code: o.promotion.code,
      nameEn: o.promotion.name_en,
      nameAr: o.promotion.name_ar,
      kind: o.promotion.kind,
      amount: o.amount,
      freeItemId: o.freeItemId,
    })),
    rewards: rewards.map(r => ({
      ruleId: r.rule.id,
      nameEn: r.rule.name_en,
      nameAr: r.rule.name_ar,
      kind: r.kind,
      amount: r.amount,
      freeItemId: r.freeItemId,
    })),
    suppressed: evaluation.suppressed.map(s => ({
      promotionId: s.promotion.id,
      nameEn: s.promotion.name_en,
      nameAr: s.promotion.name_ar,
    })),
    rejected: evaluation.rejected.map(r => ({
      promotionId: r.promotion.id,
      nameEn: r.promotion.name_en,
      nameAr: r.promotion.name_ar,
      reason: r.reason,
    })),
    redemptions: evaluation.applied.map(o => ({
      promotionId: o.promotion.id,
      amount: o.amount,
      freeItemId: o.freeItemId,
    })),
    loyaltyRedemptions: rewards.map(r => ({
      ruleId: r.rule.id,
      amount: r.amount,
      freeItemId: r.freeItemId,
    })),
  };
}
