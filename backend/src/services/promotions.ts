/**
 * Promotion rule engine.
 *
 * Every discount the app gives away is decided here, in the main process,
 * from rules stored in the database. The renderer asks what a bill qualifies
 * for and is told; it never computes a discount itself. That is the same
 * principle the tax engine follows, and for the same reason: a cashier must
 * not be able to collect a total the saved bill disagrees with.
 *
 * The module is pure — no database, no Electron, no clock of its own. `now`
 * is always passed in, so "this offer runs Tuesdays 17:00-01:00" is testable
 * without waiting for Tuesday.
 */

import { round, sum } from '../lib/money';

export type PromotionKind = 'percent' | 'amount' | 'free_item';
export type PromotionScope = 'bill' | 'item';

/** A promotion row, as stored. */
export interface Promotion {
  id: number;
  code: string | null;
  name_en: string;
  name_ar: string;
  kind: PromotionKind;
  value: number;
  free_item_id: number | null;
  scope: PromotionScope;
  target_item_id: number | null;
  target_category_id: number | null;
  min_subtotal: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  /** Comma-separated weekday numbers, 0 = Sunday. */
  active_days: string | null;
  start_time: string | null;
  end_time: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  used_count: number;
  stackable: 0 | 1 | boolean;
  priority: number;
  auto_apply: 0 | 1 | boolean;
  is_active: 0 | 1 | boolean;
}

/** One line of the bill the engine is reasoning about. */
export interface PromotionLine {
  /** `order_items.id`, used only to report which line an offer hit. */
  id: number;
  menu_item_id: number | null;
  category_id: number | null;
  /** Line total after any per-line discount, as the tax engine computed it. */
  amount: number;
}

export interface PromotionContext {
  lines: PromotionLine[];
  /** Bill total the discount comes off — the tax engine's `total_amount`. */
  subtotal: number;
  customerId?: number | null;
  /** How many times this customer has already redeemed each promotion. */
  customerRedemptions?: Readonly<Record<number, number>>;
  now: Date;
}

export type RejectionReason =
  | 'inactive'
  | 'not-started'
  | 'expired'
  | 'wrong-day'
  | 'outside-hours'
  | 'below-minimum'
  | 'no-matching-items'
  | 'usage-limit-reached'
  | 'customer-limit-reached'
  | 'needs-customer'
  | 'no-value';

export interface PromotionOffer {
  promotion: Promotion;
  /** Money taken off the bill. Zero for a pure gift. */
  amount: number;
  /** Set when the reward is a free item rather than money off. */
  freeItemId: number | null;
  /** The lines the offer applied to, for an item-scoped rule. */
  lineIds: number[];
}

export interface Evaluation {
  /** Offers that may be given, after stacking rules. */
  applied: PromotionOffer[];
  /** Offers that qualify but were excluded by a non-stackable winner. */
  suppressed: { promotion: Promotion; reason: 'not-stackable' }[];
  rejected: { promotion: Promotion; reason: RejectionReason }[];
  /** Total money off, capped at the subtotal. */
  totalDiscount: number;
}

const truthy = (v: 0 | 1 | boolean): boolean => v === true || v === 1;

/**
 * Minutes since midnight for an `HH:MM` string, or `null` if unparseable.
 *
 * Anything that is not two numbers in range is treated as "no constraint"
 * rather than "never matches": the field is optional, and a half-typed value
 * reaching the database should not silently switch an offer off.
 */
function minutesOfDay(text: string | null): number | null {
  if (!text) { return null; }
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) { return null; }
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) { return null; }
  return hours * 60 + mins;
}

/**
 * `active_days` parsed into a set; empty means "every day".
 *
 * An empty segment is dropped rather than parsed. `Number('')` is 0, so
 * `'1,,3'` — which a hand-edited row or a trailing comma produces — would
 * otherwise quietly add Sunday to a Monday/Wednesday offer.
 */
export function parseActiveDays(text: string | null): Set<number> {
  const days = new Set<number>();
  if (!text) { return days; }
  for (const part of text.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') { continue; }
    const day = Number(trimmed);
    if (Number.isInteger(day) && day >= 0 && day <= 6) { days.add(day); }
  }
  return days;
}

/**
 * Is `now` inside the rule's time-of-day window?
 *
 * A window whose end is at or before its start is read as crossing midnight,
 * which is what a restaurant means by "22:00 to 02:00". Treating it as an
 * empty range instead would make every late-night offer silently dead.
 */
export function withinHours(promo: Promotion, now: Date): boolean {
  const start = minutesOfDay(promo.start_time);
  const end = minutesOfDay(promo.end_time);
  if (start === null && end === null) { return true; }

  const current = now.getHours() * 60 + now.getMinutes();
  if (start === null) { return current <= (end as number); }
  if (end === null) { return current >= start; }

  return end > start
    ? current >= start && current <= end
    : current >= start || current <= end;
}

/** Local calendar date as `YYYY-MM-DD`, which is how the dates are stored. */
function localDate(now: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Everything about the rule that does not depend on the bill.
 *
 * Separate from `offerFor` so the admin screen can say "this offer is not
 * running right now" without constructing a bill.
 */
export function liveness(promo: Promotion, now: Date): RejectionReason | null {
  if (!truthy(promo.is_active)) { return 'inactive'; }

  const today = localDate(now);
  if (promo.starts_at && today < promo.starts_at.slice(0, 10)) { return 'not-started'; }
  if (promo.ends_at && today > promo.ends_at.slice(0, 10)) { return 'expired'; }

  const days = parseActiveDays(promo.active_days);
  if (days.size > 0 && !days.has(now.getDay())) { return 'wrong-day'; }

  if (!withinHours(promo, now)) { return 'outside-hours'; }

  if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
    return 'usage-limit-reached';
  }

  return null;
}

/** Lines an item-scoped rule applies to. A bill-scoped rule takes them all. */
export function matchingLines(promo: Promotion, lines: PromotionLine[]): PromotionLine[] {
  if (promo.scope === 'bill') { return lines; }

  return lines.filter((line) => {
    if (promo.target_item_id !== null) { return line.menu_item_id === promo.target_item_id; }
    if (promo.target_category_id !== null) { return line.category_id === promo.target_category_id; }
    // Item-scoped with no target names nothing in particular, so it would
    // otherwise behave as a bill discount under a misleading label.
    return false;
  });
}

/**
 * What one rule would give on this bill, or why it would give nothing.
 *
 * The cap is applied here rather than by the caller so a percentage rule can
 * never exceed its own `max_discount`, no matter which path reaches it.
 */
export function offerFor(
  promo: Promotion,
  ctx: PromotionContext,
): { offer: PromotionOffer } | { reason: RejectionReason } {
  const dead = liveness(promo, ctx.now);
  if (dead) { return { reason: dead }; }

  if (ctx.subtotal < promo.min_subtotal) { return { reason: 'below-minimum' }; }

  if (promo.usage_limit_per_customer !== null) {
    if (!ctx.customerId) { return { reason: 'needs-customer' }; }
    const used = ctx.customerRedemptions?.[promo.id] ?? 0;
    if (used >= promo.usage_limit_per_customer) { return { reason: 'customer-limit-reached' }; }
  }

  const lines = matchingLines(promo, ctx.lines);
  if (lines.length === 0) { return { reason: 'no-matching-items' }; }

  if (promo.kind === 'free_item') {
    if (promo.free_item_id === null) { return { reason: 'no-value' }; }
    return {
      offer: {
        promotion: promo,
        amount: 0,
        freeItemId: promo.free_item_id,
        lineIds: lines.map(l => l.id),
      },
    };
  }

  const base = promo.scope === 'bill' ? ctx.subtotal : sum(lines.map(l => l.amount));

  let amount = promo.kind === 'percent'
    ? round(base * (promo.value / 100))
    : round(promo.value);

  if (promo.max_discount !== null) { amount = Math.min(amount, round(promo.max_discount)); }
  // An amount rule worth more than the lines it applies to must not turn the
  // bill negative, and must not quietly discount items it does not cover.
  amount = round(Math.min(amount, base));

  if (amount <= 0) { return { reason: 'no-value' }; }

  return {
    offer: {
      promotion: promo,
      amount,
      freeItemId: null,
      lineIds: lines.map(l => l.id),
    },
  };
}

/**
 * Evaluate a set of rules against one bill.
 *
 * Stacking: the highest-priority qualifying rule is taken first. If it is not
 * stackable it wins alone and every other money offer is suppressed. A gift
 * (`free_item`) never blocks a money discount and is never blocked by one —
 * they are different kinds of reward, and an outlet that offers both means
 * both.
 *
 * `totalDiscount` is capped at the subtotal, so no combination of rules can
 * produce a bill the outlet owes the customer.
 */
export function evaluate(promos: Promotion[], ctx: PromotionContext): Evaluation {
  const rejected: Evaluation['rejected'] = [];
  const qualifying: PromotionOffer[] = [];

  for (const promo of promos) {
    const result = offerFor(promo, ctx);
    if ('reason' in result) {
      rejected.push({ promotion: promo, reason: result.reason });
    } else {
      qualifying.push(result.offer);
    }
  }

  const gifts = qualifying.filter(o => o.freeItemId !== null);
  const money = qualifying
    .filter(o => o.freeItemId === null)
    .sort((a, b) => (b.promotion.priority - a.promotion.priority) || (b.amount - a.amount));

  const applied: PromotionOffer[] = [];
  const suppressed: Evaluation['suppressed'] = [];

  for (const offer of money) {
    if (applied.length === 0) {
      applied.push(offer);
      if (!truthy(offer.promotion.stackable)) {
        // This one wins alone; everything after it is reported as suppressed
        // rather than rejected, because it did qualify.
        suppressed.push(...money.slice(1).map(o => ({
          promotion: o.promotion,
          reason: 'not-stackable' as const,
        })));
        break;
      }
      continue;
    }

    if (truthy(offer.promotion.stackable)) {
      applied.push(offer);
    } else {
      suppressed.push({ promotion: offer.promotion, reason: 'not-stackable' });
    }
  }

  const totalDiscount = round(
    Math.min(sum(applied.map(o => o.amount)), round(ctx.subtotal)),
  );

  return { applied: [...applied, ...gifts], suppressed, rejected, totalDiscount };
}

/**
 * Rules that apply without being asked for: automatic offers, plus any coupon
 * whose code the customer presented.
 *
 * Codes are matched case-insensitively with surrounding space trimmed, because
 * a code is read off a printed slip and typed by hand.
 */
export function selectCandidates(
  promos: Promotion[],
  options: { codes?: string[]; ids?: number[] } = {},
): Promotion[] {
  const codes = new Set((options.codes ?? []).map(c => c.trim().toUpperCase()).filter(Boolean));
  const ids = new Set(options.ids ?? []);

  return promos.filter((promo) => {
    if (ids.has(promo.id)) { return true; }
    if (promo.code && codes.has(promo.code.trim().toUpperCase())) { return true; }
    // A coupon is never automatic: it exists to be presented.
    return promo.code === null && truthy(promo.auto_apply);
  });
}

/** Problems that make a rule meaningless; refused at the IPC boundary. */
export function validatePromotion(promo: Partial<Promotion>): string[] {
  const problems: string[] = [];

  if (!promo.name_en?.trim() || !promo.name_ar?.trim()) {
    problems.push('promotion/name-required');
  }

  if (promo.kind === 'percent') {
    if (!(typeof promo.value === 'number' && promo.value > 0 && promo.value <= 100)) {
      problems.push('promotion/percent-out-of-range');
    }
  } else if (promo.kind === 'amount') {
    if (!(typeof promo.value === 'number' && promo.value > 0)) {
      problems.push('promotion/amount-must-be-positive');
    }
  } else if (promo.kind === 'free_item') {
    if (!promo.free_item_id) { problems.push('promotion/free-item-required'); }
  } else {
    problems.push('promotion/unknown-kind');
  }

  if (promo.scope === 'item' && !promo.target_item_id && !promo.target_category_id) {
    problems.push('promotion/item-scope-needs-target');
  }

  if (promo.starts_at && promo.ends_at && promo.ends_at.slice(0, 10) < promo.starts_at.slice(0, 10)) {
    problems.push('promotion/ends-before-starts');
  }

  if (promo.active_days && parseActiveDays(promo.active_days).size === 0) {
    problems.push('promotion/no-valid-days');
  }

  // A time field that does not parse is accepted elsewhere as "no
  // constraint", but when the admin has typed something it is almost
  // certainly a mistake worth refusing at the point of entry.
  for (const field of ['start_time', 'end_time'] as const) {
    const raw = promo[field];
    if (raw && minutesOfDay(raw) === null) { problems.push(`promotion/bad-${field.replace('_', '-')}`); }
  }

  return problems;
}
