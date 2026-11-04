/**
 * Loyalty rule engine.
 *
 * "Every fifth visit a free dessert", "spend 500 in a month and get 10% off".
 * The rules are data; this module decides which a customer has earned and how
 * close they are to the next one.
 *
 * Pure, like `promotions.ts`: the caller supplies the customer's billed
 * history and the clock. A rule with a rolling window is then testable
 * without a database full of dated rows.
 *
 * The reward is expressed as a promotion-shaped offer, so billing has exactly
 * one path that turns a reward into money off a bill. Two paths would
 * eventually disagree about rounding.
 */

import { round, sum } from '../lib/money';

export type LoyaltyBasis = 'visits' | 'spend';
export type RewardKind = 'percent' | 'amount' | 'free_item';

export interface LoyaltyRule {
  id: number;
  name_en: string;
  name_ar: string;
  basis: LoyaltyBasis;
  threshold: number;
  /** Rolling window in days; `null` counts the customer's whole history. */
  window_days: number | null;
  reward_kind: RewardKind;
  reward_value: number;
  reward_item_id: number | null;
  reward_max_discount: number | null;
  is_active: 0 | 1 | boolean;
}

/** One past bill for this customer. */
export interface VisitRecord {
  /** `bills.created_at`, a zone-less UTC timestamp. */
  at: Date;
  total: number;
}

export interface LoyaltyStatus {
  rule: LoyaltyRule;
  /** Visits or money within the window, whichever the rule counts. */
  progress: number;
  threshold: number;
  /** Clamped to 1; a customer well past a threshold is not 300% loyal. */
  ratio: number;
  earned: boolean;
  /** How much more is needed. Zero once earned. */
  remaining: number;
}

export interface LoyaltyReward {
  rule: LoyaltyRule;
  kind: RewardKind;
  /** Money off, computed against the bill. Zero for a gift. */
  amount: number;
  freeItemId: number | null;
}

const truthy = (v: 0 | 1 | boolean): boolean => v === true || v === 1;

/**
 * When each rule last paid out for this customer.
 *
 * Progress resets at that point, so a "every fifth visit" reward does not pay
 * again on the sixth, seventh and eighth. Without this the first customer to
 * cross a threshold is rewarded on every subsequent bill forever.
 */
export type LastRedeemed = Readonly<Record<number, Date | null | undefined>>;

/** Visits inside the rule's rolling window, or all of them. */
export function visitsInWindow(
  rule: LoyaltyRule,
  visits: VisitRecord[],
  now: Date,
  lastRedeemed: LastRedeemed = {},
): VisitRecord[] {
  let eligible = visits;

  const since = lastRedeemed[rule.id];
  if (since) {
    // Strictly after: the bill that triggered the payout is spent.
    eligible = eligible.filter(v => v.at.getTime() > since.getTime());
  }

  if (rule.window_days === null || rule.window_days <= 0) { return eligible; }

  const cutoff = now.getTime() - rule.window_days * 24 * 60 * 60 * 1000;
  // Inclusive of the cutoff instant: a 30-day window asked about a bill from
  // exactly 30 days ago should count it, not drop it on a millisecond.
  return eligible.filter(v => v.at.getTime() >= cutoff);
}

/** Where a customer stands against one rule. */
export function statusFor(
  rule: LoyaltyRule,
  visits: VisitRecord[],
  now: Date,
  lastRedeemed: LastRedeemed = {},
): LoyaltyStatus {
  const inWindow = visitsInWindow(rule, visits, now, lastRedeemed);
  const progress = rule.basis === 'visits'
    ? inWindow.length
    : sum(inWindow.map(v => v.total));

  const threshold = rule.threshold;
  const earned = threshold > 0 && progress >= threshold;

  return {
    rule,
    progress,
    threshold,
    ratio: threshold > 0 ? Math.min(1, progress / threshold) : 0,
    earned,
    remaining: earned ? 0 : round(Math.max(0, threshold - progress), rule.basis === 'visits' ? 0 : 2),
  };
}

/** Every active rule's standing, strongest progress first. */
export function statuses(
  rules: LoyaltyRule[],
  visits: VisitRecord[],
  now: Date,
  lastRedeemed: LastRedeemed = {},
): LoyaltyStatus[] {
  return rules
    .filter(r => truthy(r.is_active))
    .map(r => statusFor(r, visits, now, lastRedeemed))
    .sort((a, b) => b.ratio - a.ratio);
}

/**
 * Rewards a customer has earned, priced against the bill in front of them.
 *
 * A reward is worth nothing until there is a bill to apply it to, so the
 * subtotal is required rather than optional — an "earned" reward with no
 * amount is the kind of thing that reaches a receipt as a zero line.
 */
export function rewardsFor(
  rules: LoyaltyRule[],
  visits: VisitRecord[],
  subtotal: number,
  now: Date,
  lastRedeemed: LastRedeemed = {},
): LoyaltyReward[] {
  const rewards: LoyaltyReward[] = [];

  for (const status of statuses(rules, visits, now, lastRedeemed)) {
    if (!status.earned) { continue; }
    const rule = status.rule;

    if (rule.reward_kind === 'free_item') {
      if (rule.reward_item_id === null) { continue; }
      rewards.push({ rule, kind: 'free_item', amount: 0, freeItemId: rule.reward_item_id });
      continue;
    }

    let amount = rule.reward_kind === 'percent'
      ? round(subtotal * (rule.reward_value / 100))
      : round(rule.reward_value);

    if (rule.reward_max_discount !== null) {
      amount = Math.min(amount, round(rule.reward_max_discount));
    }
    amount = round(Math.min(amount, round(subtotal)));

    if (amount <= 0) { continue; }
    rewards.push({ rule, kind: rule.reward_kind, amount, freeItemId: null });
  }

  return rewards;
}

/** Problems that make a rule meaningless; refused at the IPC boundary. */
export function validateLoyaltyRule(rule: Partial<LoyaltyRule>): string[] {
  const problems: string[] = [];

  if (!rule.name_en?.trim() || !rule.name_ar?.trim()) {
    problems.push('loyalty/name-required');
  }

  if (rule.basis !== 'visits' && rule.basis !== 'spend') {
    problems.push('loyalty/unknown-basis');
  }

  if (!(typeof rule.threshold === 'number' && rule.threshold > 0)) {
    problems.push('loyalty/threshold-must-be-positive');
  } else if (rule.basis === 'visits' && !Number.isInteger(rule.threshold)) {
    problems.push('loyalty/visit-threshold-must-be-whole');
  }

  if (rule.window_days !== null && rule.window_days !== undefined) {
    if (!Number.isInteger(rule.window_days) || rule.window_days <= 0) {
      problems.push('loyalty/window-must-be-whole-days');
    }
  }

  if (rule.reward_kind === 'percent') {
    if (!(typeof rule.reward_value === 'number' && rule.reward_value > 0 && rule.reward_value <= 100)) {
      problems.push('loyalty/percent-out-of-range');
    }
  } else if (rule.reward_kind === 'amount') {
    if (!(typeof rule.reward_value === 'number' && rule.reward_value > 0)) {
      problems.push('loyalty/amount-must-be-positive');
    }
  } else if (rule.reward_kind === 'free_item') {
    if (!rule.reward_item_id) { problems.push('loyalty/free-item-required'); }
  } else {
    problems.push('loyalty/unknown-reward');
  }

  return problems;
}
