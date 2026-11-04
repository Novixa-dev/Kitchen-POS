import { describe, expect, it } from 'vitest';
import {
  rewardsFor,
  statusFor,
  statuses,
  validateLoyaltyRule,
  visitsInWindow,
  type LoyaltyRule,
  type VisitRecord,
} from '../loyalty';

const NOW = new Date('2026-06-16T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function rule(overrides: Partial<LoyaltyRule> = {}): LoyaltyRule {
  return {
    id: 1,
    name_en: 'Fifth visit',
    name_ar: 'الزيارة الخامسة',
    basis: 'visits',
    threshold: 5,
    window_days: null,
    reward_kind: 'percent',
    reward_value: 10,
    reward_item_id: null,
    reward_max_discount: null,
    is_active: 1,
    ...overrides,
  };
}

/** `n` visits, one per day going back from `NOW`, each worth `total`. */
function visits(n: number, total = 100): VisitRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    at: new Date(NOW.getTime() - i * DAY),
    total,
  }));
}

describe('visitsInWindow', () => {
  it('takes every visit when the rule has no window', () => {
    expect(visitsInWindow(rule({ window_days: null }), visits(40), NOW)).toHaveLength(40);
  });

  it('keeps only the visits inside a rolling window', () => {
    // The fixture puts one visit per day at offsets 0..29, and the cutoff is
    // inclusive, so a 7-day window keeps today plus the seven days behind it.
    expect(visitsInWindow(rule({ window_days: 7 }), visits(30), NOW)).toHaveLength(8);
  });

  it('counts a visit falling exactly on the cutoff', () => {
    const exactly30 = [{ at: new Date(NOW.getTime() - 30 * DAY), total: 50 }];
    expect(visitsInWindow(rule({ window_days: 30 }), exactly30, NOW)).toHaveLength(1);
  });

  it('treats a zero or negative window as no window rather than no visits', () => {
    expect(visitsInWindow(rule({ window_days: 0 }), visits(5), NOW)).toHaveLength(5);
  });
});

describe('statusFor', () => {
  it('counts visits against a visit threshold', () => {
    const status = statusFor(rule({ basis: 'visits', threshold: 5 }), visits(3), NOW);
    expect(status.progress).toBe(3);
    expect(status.remaining).toBe(2);
    expect(status.earned).toBe(false);
    expect(status.ratio).toBeCloseTo(0.6);
  });

  it('counts money against a spend threshold', () => {
    const status = statusFor(
      rule({ basis: 'spend', threshold: 500 }),
      visits(3, 120.5),
      NOW,
    );
    expect(status.progress).toBe(361.5);
    expect(status.remaining).toBe(138.5);
  });

  it('earns at the threshold, not one past it', () => {
    expect(statusFor(rule({ threshold: 5 }), visits(5), NOW).earned).toBe(true);
  });

  it('clamps the ratio at one, so a long-standing regular is not 400% loyal', () => {
    const status = statusFor(rule({ threshold: 5 }), visits(20), NOW);
    expect(status.ratio).toBe(1);
    expect(status.remaining).toBe(0);
  });

  it('earns nothing from a threshold of zero', () => {
    // A rule everyone meets immediately is a configuration mistake, not a
    // reward every customer is owed.
    expect(statusFor(rule({ threshold: 0 }), visits(1), NOW).earned).toBe(false);
  });
});

describe('statuses', () => {
  it('leaves inactive rules out', () => {
    const got = statuses([rule({ id: 1 }), rule({ id: 2, is_active: 0 })], visits(1), NOW);
    expect(got.map(s => s.rule.id)).toEqual([1]);
  });

  it('puts the closest reward first', () => {
    const got = statuses(
      [rule({ id: 1, threshold: 100 }), rule({ id: 2, threshold: 4 })],
      visits(3),
      NOW,
    );
    expect(got.map(s => s.rule.id)).toEqual([2, 1]);
  });
});

describe('rewardsFor', () => {
  it('gives nothing until the threshold is met', () => {
    expect(rewardsFor([rule({ threshold: 5 })], visits(4), 100, NOW)).toEqual([]);
  });

  it('prices a percentage reward against the bill', () => {
    const [reward] = rewardsFor([rule({ reward_kind: 'percent', reward_value: 10 })], visits(5), 250, NOW);
    expect(reward.amount).toBe(25);
  });

  it('caps a percentage reward', () => {
    const [reward] = rewardsFor(
      [rule({ reward_kind: 'percent', reward_value: 50, reward_max_discount: 30 })],
      visits(5),
      400,
      NOW,
    );
    expect(reward.amount).toBe(30);
  });

  it('never rewards more than the bill is worth', () => {
    const [reward] = rewardsFor(
      [rule({ reward_kind: 'amount', reward_value: 200 })],
      visits(5),
      75,
      NOW,
    );
    expect(reward.amount).toBe(75);
  });

  it('gives a gift with no money off', () => {
    const [reward] = rewardsFor(
      [rule({ reward_kind: 'free_item', reward_item_id: 12 })],
      visits(5),
      100,
      NOW,
    );
    expect(reward.kind).toBe('free_item');
    expect(reward.amount).toBe(0);
    expect(reward.freeItemId).toBe(12);
  });

  it('skips a gift rule with no item rather than printing a zero line', () => {
    expect(rewardsFor(
      [rule({ reward_kind: 'free_item', reward_item_id: null })],
      visits(5),
      100,
      NOW,
    )).toEqual([]);
  });

  it('skips a reward that works out to nothing on this bill', () => {
    expect(rewardsFor(
      [rule({ reward_kind: 'percent', reward_value: 1 })],
      visits(5),
      0.2,
      NOW,
    )).toEqual([]);
  });

  it('respects the window: last month earned it, this month has not', () => {
    const lastMonth = Array.from({ length: 6 }, (_, i) => ({
      at: new Date(NOW.getTime() - (40 + i) * DAY),
      total: 100,
    }));
    const r = rule({ threshold: 5, window_days: 30 });
    expect(rewardsFor([r], lastMonth, 100, NOW)).toEqual([]);
    expect(rewardsFor([rule({ threshold: 5, window_days: null })], lastMonth, 100, NOW)).toHaveLength(1);
  });
});

describe('validateLoyaltyRule', () => {
  it('accepts a sane rule', () => {
    expect(validateLoyaltyRule(rule())).toEqual([]);
  });

  it('requires both names', () => {
    expect(validateLoyaltyRule(rule({ name_ar: '' }))).toContain('loyalty/name-required');
  });

  it('requires a positive threshold', () => {
    expect(validateLoyaltyRule(rule({ threshold: 0 }))).toContain('loyalty/threshold-must-be-positive');
  });

  it('requires a whole number of visits', () => {
    expect(validateLoyaltyRule(rule({ basis: 'visits', threshold: 4.5 })))
      .toContain('loyalty/visit-threshold-must-be-whole');
  });

  it('allows a fractional spend threshold', () => {
    expect(validateLoyaltyRule(rule({ basis: 'spend', threshold: 499.5 }))).toEqual([]);
  });

  it('requires a whole-day window when one is given', () => {
    expect(validateLoyaltyRule(rule({ window_days: 1.5 }))).toContain('loyalty/window-must-be-whole-days');
    expect(validateLoyaltyRule(rule({ window_days: 0 }))).toContain('loyalty/window-must-be-whole-days');
    expect(validateLoyaltyRule(rule({ window_days: null }))).toEqual([]);
  });

  it('bounds a percentage reward', () => {
    expect(validateLoyaltyRule(rule({ reward_kind: 'percent', reward_value: 120 })))
      .toContain('loyalty/percent-out-of-range');
  });

  it('requires an item for a gift reward', () => {
    expect(validateLoyaltyRule(rule({ reward_kind: 'free_item', reward_item_id: null })))
      .toContain('loyalty/free-item-required');
  });
});
