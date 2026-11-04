import { describe, expect, it } from 'vitest';
import {
  evaluate,
  liveness,
  matchingLines,
  offerFor,
  parseActiveDays,
  selectCandidates,
  validatePromotion,
  withinHours,
  type Promotion,
  type PromotionContext,
  type PromotionLine,
} from '../promotions';

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 1,
    code: null,
    name_en: 'Ten off',
    name_ar: 'خصم عشرة',
    kind: 'percent',
    value: 10,
    free_item_id: null,
    scope: 'bill',
    target_item_id: null,
    target_category_id: null,
    min_subtotal: 0,
    max_discount: null,
    starts_at: null,
    ends_at: null,
    active_days: null,
    start_time: null,
    end_time: null,
    usage_limit: null,
    usage_limit_per_customer: null,
    used_count: 0,
    stackable: 0,
    priority: 0,
    auto_apply: 1,
    is_active: 1,
    ...overrides,
  };
}

function lines(...amounts: number[]): PromotionLine[] {
  return amounts.map((amount, i) => ({
    id: i + 1,
    menu_item_id: i + 1,
    category_id: 1,
    amount,
  }));
}

function ctx(overrides: Partial<PromotionContext> = {}): PromotionContext {
  const l = overrides.lines ?? lines(100);
  return {
    lines: l,
    subtotal: overrides.subtotal ?? l.reduce((a, b) => a + b.amount, 0),
    now: new Date('2026-06-16T12:00:00'), // a Tuesday, local noon
    ...overrides,
  };
}

describe('liveness', () => {
  it('refuses an inactive rule', () => {
    expect(liveness(promo({ is_active: 0 }), new Date())).toBe('inactive');
  });

  it('refuses before the start date and after the end date', () => {
    const p = promo({ starts_at: '2026-07-01', ends_at: '2026-07-31' });
    expect(liveness(p, new Date('2026-06-30T23:00:00'))).toBe('not-started');
    expect(liveness(p, new Date('2026-08-01T01:00:00'))).toBe('expired');
  });

  it('accepts the first and last day of the window', () => {
    const p = promo({ starts_at: '2026-07-01', ends_at: '2026-07-31' });
    expect(liveness(p, new Date('2026-07-01T00:05:00'))).toBeNull();
    expect(liveness(p, new Date('2026-07-31T23:55:00'))).toBeNull();
  });

  it('uses the local calendar date, not the UTC one', () => {
    // 2026-07-01T00:30 local is still 2026-06-30 in UTC west of the line.
    // The rule's dates are what the owner typed on a local calendar, so the
    // local date is the one that must decide.
    const p = promo({ starts_at: '2026-07-01' });
    expect(liveness(p, new Date(2026, 6, 1, 0, 30))).toBeNull();
  });

  it('refuses on a day the rule does not run', () => {
    // 2026-06-16 is a Tuesday (day 2).
    expect(liveness(promo({ active_days: '1,3' }), new Date('2026-06-16T12:00:00'))).toBe('wrong-day');
    expect(liveness(promo({ active_days: '2' }), new Date('2026-06-16T12:00:00'))).toBeNull();
  });

  it('refuses once the usage limit is reached', () => {
    expect(liveness(promo({ usage_limit: 5, used_count: 5 }), new Date())).toBe('usage-limit-reached');
    expect(liveness(promo({ usage_limit: 5, used_count: 4 }), new Date())).toBeNull();
  });
});

describe('parseActiveDays', () => {
  it('reads a comma list and ignores anything out of range', () => {
    expect([...parseActiveDays('0,3,6')]).toEqual([0, 3, 6]);
    expect([...parseActiveDays(' 1 , 2 ')]).toEqual([1, 2]);
    expect([...parseActiveDays('7,-1,abc')]).toEqual([]);
  });

  it('treats absent as every day', () => {
    expect(parseActiveDays(null).size).toBe(0);
  });
});

describe('withinHours', () => {
  const at = (h: number, m = 0) => new Date(2026, 5, 16, h, m);

  it('has no opinion when neither bound is set', () => {
    expect(withinHours(promo(), at(3))).toBe(true);
  });

  it('honours a same-day window inclusively', () => {
    const p = promo({ start_time: '12:00', end_time: '15:00' });
    expect(withinHours(p, at(11, 59))).toBe(false);
    expect(withinHours(p, at(12, 0))).toBe(true);
    expect(withinHours(p, at(15, 0))).toBe(true);
    expect(withinHours(p, at(15, 1))).toBe(false);
  });

  it('reads a window that ends before it starts as crossing midnight', () => {
    const p = promo({ start_time: '22:00', end_time: '02:00' });
    expect(withinHours(p, at(23, 30))).toBe(true);
    expect(withinHours(p, at(1, 0))).toBe(true);
    expect(withinHours(p, at(12, 0))).toBe(false);
  });

  it('treats an unparseable bound as no constraint rather than never', () => {
    expect(withinHours(promo({ start_time: '99:99' }), at(12))).toBe(true);
    expect(withinHours(promo({ start_time: 'lunch' }), at(12))).toBe(true);
  });
});

describe('matchingLines', () => {
  const l: PromotionLine[] = [
    { id: 1, menu_item_id: 10, category_id: 1, amount: 40 },
    { id: 2, menu_item_id: 11, category_id: 2, amount: 60 },
  ];

  it('takes every line for a bill-scoped rule', () => {
    expect(matchingLines(promo({ scope: 'bill' }), l)).toHaveLength(2);
  });

  it('matches by item', () => {
    const got = matchingLines(promo({ scope: 'item', target_item_id: 11 }), l);
    expect(got.map(x => x.id)).toEqual([2]);
  });

  it('matches by category', () => {
    const got = matchingLines(promo({ scope: 'item', target_category_id: 1 }), l);
    expect(got.map(x => x.id)).toEqual([1]);
  });

  it('matches nothing when an item-scoped rule names no target', () => {
    // Otherwise it would behave as a whole-bill discount while being
    // labelled as applying to specific items.
    expect(matchingLines(promo({ scope: 'item' }), l)).toEqual([]);
  });
});

describe('offerFor', () => {
  it('computes a percentage off the bill', () => {
    const result = offerFor(promo({ value: 10 }), ctx({ lines: lines(100) }));
    expect('offer' in result && result.offer.amount).toBe(10);
  });

  it('rounds a percentage at the money boundary, not with a float multiply', () => {
    // 8.075 * 100 is 807.4999…, which Math.round sends down to 8.07.
    const result = offerFor(promo({ value: 50 }), ctx({ lines: lines(16.15) }));
    expect('offer' in result && result.offer.amount).toBe(8.08);
  });

  it('caps a percentage at max_discount', () => {
    const result = offerFor(promo({ value: 50, max_discount: 20 }), ctx({ lines: lines(200) }));
    expect('offer' in result && result.offer.amount).toBe(20);
  });

  it('never discounts more than the bill', () => {
    const result = offerFor(promo({ kind: 'amount', value: 500 }), ctx({ lines: lines(80) }));
    expect('offer' in result && result.offer.amount).toBe(80);
  });

  it('prices an item-scoped rule against its own lines only', () => {
    const l: PromotionLine[] = [
      { id: 1, menu_item_id: 10, category_id: 1, amount: 40 },
      { id: 2, menu_item_id: 11, category_id: 2, amount: 60 },
    ];
    const result = offerFor(
      promo({ scope: 'item', target_category_id: 1, value: 50 }),
      ctx({ lines: l, subtotal: 100 }),
    );
    // 50% of the matching 40, not of the 100 bill.
    expect('offer' in result && result.offer.amount).toBe(20);
    expect('offer' in result && result.offer.lineIds).toEqual([1]);
  });

  it('refuses below the minimum subtotal', () => {
    const result = offerFor(promo({ min_subtotal: 150 }), ctx({ lines: lines(100) }));
    expect('reason' in result && result.reason).toBe('below-minimum');
  });

  it('refuses a per-customer limit with no customer attached', () => {
    const result = offerFor(promo({ usage_limit_per_customer: 1 }), ctx());
    expect('reason' in result && result.reason).toBe('needs-customer');
  });

  it('refuses once that customer has used it up', () => {
    const result = offerFor(
      promo({ id: 7, usage_limit_per_customer: 2 }),
      ctx({ customerId: 3, customerRedemptions: { 7: 2 } }),
    );
    expect('reason' in result && result.reason).toBe('customer-limit-reached');
  });

  it('allows a customer still under their limit', () => {
    const result = offerFor(
      promo({ id: 7, usage_limit_per_customer: 2 }),
      ctx({ customerId: 3, customerRedemptions: { 7: 1 } }),
    );
    expect('offer' in result).toBe(true);
  });

  it('gives a gift with no money off', () => {
    const result = offerFor(promo({ kind: 'free_item', free_item_id: 42 }), ctx());
    expect('offer' in result && result.offer.amount).toBe(0);
    expect('offer' in result && result.offer.freeItemId).toBe(42);
  });

  it('refuses a free-item rule with no item', () => {
    const result = offerFor(promo({ kind: 'free_item', free_item_id: null }), ctx());
    expect('reason' in result && result.reason).toBe('no-value');
  });

  it('refuses a rule that works out to nothing', () => {
    const result = offerFor(promo({ kind: 'amount', value: 0.001 }), ctx());
    expect('reason' in result && result.reason).toBe('no-value');
  });
});

describe('evaluate', () => {
  it('lets a non-stackable rule win alone', () => {
    const result = evaluate(
      [
        promo({ id: 1, value: 10, priority: 5, stackable: 0 }),
        promo({ id: 2, value: 5, priority: 1, stackable: 1 }),
      ],
      ctx({ lines: lines(100) }),
    );

    expect(result.applied.map(o => o.promotion.id)).toEqual([1]);
    expect(result.suppressed.map(s => s.promotion.id)).toEqual([2]);
    expect(result.totalDiscount).toBe(10);
  });

  it('stacks two stackable rules', () => {
    const result = evaluate(
      [
        promo({ id: 1, value: 10, priority: 5, stackable: 1 }),
        promo({ id: 2, value: 5, priority: 1, stackable: 1 }),
      ],
      ctx({ lines: lines(100) }),
    );

    expect(result.applied.map(o => o.promotion.id)).toEqual([1, 2]);
    expect(result.totalDiscount).toBe(15);
  });

  it('keeps a later non-stackable rule out of a stack it would contaminate', () => {
    const result = evaluate(
      [
        promo({ id: 1, value: 10, priority: 5, stackable: 1 }),
        promo({ id: 2, value: 5, priority: 1, stackable: 0 }),
      ],
      ctx({ lines: lines(100) }),
    );

    expect(result.applied.map(o => o.promotion.id)).toEqual([1]);
    expect(result.suppressed.map(s => s.promotion.id)).toEqual([2]);
  });

  it('orders by priority, then by what is worth most', () => {
    const result = evaluate(
      [
        promo({ id: 1, kind: 'amount', value: 5, priority: 0, stackable: 0 }),
        promo({ id: 2, kind: 'amount', value: 30, priority: 0, stackable: 0 }),
      ],
      ctx({ lines: lines(100) }),
    );
    expect(result.applied.map(o => o.promotion.id)).toEqual([2]);
  });

  it('gives a gift alongside a non-stackable money discount', () => {
    const result = evaluate(
      [
        promo({ id: 1, value: 10, stackable: 0 }),
        promo({ id: 2, kind: 'free_item', free_item_id: 9, stackable: 0 }),
      ],
      ctx({ lines: lines(100) }),
    );

    expect(result.applied.map(o => o.promotion.id).sort()).toEqual([1, 2]);
    expect(result.totalDiscount).toBe(10);
  });

  it('never discounts past the subtotal, however the rules stack', () => {
    const result = evaluate(
      [
        promo({ id: 1, kind: 'amount', value: 60, stackable: 1 }),
        promo({ id: 2, kind: 'amount', value: 60, stackable: 1 }),
      ],
      ctx({ lines: lines(100) }),
    );
    expect(result.totalDiscount).toBe(100);
  });

  it('reports why each rule was turned down', () => {
    const result = evaluate(
      [promo({ id: 1, is_active: 0 }), promo({ id: 2, min_subtotal: 999 })],
      ctx({ lines: lines(100) }),
    );
    expect(result.rejected).toEqual([
      { promotion: expect.objectContaining({ id: 1 }), reason: 'inactive' },
      { promotion: expect.objectContaining({ id: 2 }), reason: 'below-minimum' },
    ]);
    expect(result.totalDiscount).toBe(0);
  });
});

describe('selectCandidates', () => {
  const all = [
    promo({ id: 1, code: null, auto_apply: 1 }),
    promo({ id: 2, code: null, auto_apply: 0 }),
    promo({ id: 3, code: 'WELCOME10', auto_apply: 1 }),
  ];

  it('takes automatic rules and leaves manual ones out', () => {
    expect(selectCandidates(all).map(p => p.id)).toEqual([1]);
  });

  it('never applies a coupon automatically, even if the row says auto', () => {
    expect(selectCandidates(all).map(p => p.id)).not.toContain(3);
  });

  it('matches a presented code regardless of case or stray space', () => {
    expect(selectCandidates(all, { codes: ['  welcome10 '] }).map(p => p.id).sort()).toEqual([1, 3]);
  });

  it('includes a rule the cashier picked by id', () => {
    expect(selectCandidates(all, { ids: [2] }).map(p => p.id).sort()).toEqual([1, 2]);
  });
});

describe('validatePromotion', () => {
  it('accepts a sane rule', () => {
    expect(validatePromotion(promo())).toEqual([]);
  });

  it('requires both names, so one language is never blank on a receipt', () => {
    expect(validatePromotion(promo({ name_ar: '  ' }))).toContain('promotion/name-required');
  });

  it('bounds a percentage', () => {
    expect(validatePromotion(promo({ kind: 'percent', value: 0 }))).toContain('promotion/percent-out-of-range');
    expect(validatePromotion(promo({ kind: 'percent', value: 101 }))).toContain('promotion/percent-out-of-range');
  });

  it('requires a positive amount', () => {
    expect(validatePromotion(promo({ kind: 'amount', value: -5 }))).toContain('promotion/amount-must-be-positive');
  });

  it('requires a target for an item-scoped rule', () => {
    expect(validatePromotion(promo({ scope: 'item' }))).toContain('promotion/item-scope-needs-target');
  });

  it('refuses a window that ends before it starts', () => {
    expect(validatePromotion(promo({ starts_at: '2026-07-10', ends_at: '2026-07-01' })))
      .toContain('promotion/ends-before-starts');
  });

  it('refuses a day list that names no real day', () => {
    expect(validatePromotion(promo({ active_days: '9' }))).toContain('promotion/no-valid-days');
  });

  it('refuses a time the admin typed that cannot be read', () => {
    expect(validatePromotion(promo({ start_time: '25:00' }))).toContain('promotion/bad-start-time');
    expect(validatePromotion(promo({ end_time: 'later' }))).toContain('promotion/bad-end-time');
  });
});

describe('parseActiveDays, empty segments', () => {
  it('drops an empty segment instead of reading it as Sunday', () => {
    // `Number('')` is 0, so a stray or trailing comma would otherwise add
    // Sunday to a rule that does not run on Sunday.
    expect([...parseActiveDays('1,,3')]).toEqual([1, 3]);
    expect([...parseActiveDays('1,3,')]).toEqual([1, 3]);
    expect([...parseActiveDays(',')]).toEqual([]);
  });
});
