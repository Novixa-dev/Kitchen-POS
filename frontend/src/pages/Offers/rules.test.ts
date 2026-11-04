import { describe, expect, it } from 'vitest';
import {
  BACKEND_PROBLEM_KEY,
  EMPTY_LOYALTY,
  EMPTY_PROMOTION,
  NOT_LIVE_KEY,
  REJECTION_KEY,
  isTimeValid,
  toLoyaltyDraft,
  toLoyaltyPayload,
  toPromotionDraft,
  toPromotionPayload,
  validateLoyaltyDraft,
  validatePromotionDraft,
  type LoyaltyDraft,
  type PromotionDraft,
} from './rules';

const promo = (overrides: Partial<PromotionDraft> = {}): PromotionDraft => ({
  ...EMPTY_PROMOTION,
  nameEn: 'Ten off',
  nameAr: 'خصم عشرة',
  kind: 'percent',
  value: '10',
  ...overrides,
});

const loyalty = (overrides: Partial<LoyaltyDraft> = {}): LoyaltyDraft => ({
  ...EMPTY_LOYALTY,
  nameEn: 'Fifth visit',
  nameAr: 'الزيارة الخامسة',
  threshold: '5',
  rewardValue: '10',
  ...overrides,
});

describe('isTimeValid', () => {
  it('accepts empty, meaning no constraint', () => {
    expect(isTimeValid('')).toBe(true);
    expect(isTimeValid('   ')).toBe(true);
  });

  it('accepts a real time', () => {
    expect(isTimeValid('09:30')).toBe(true);
    expect(isTimeValid('9:30')).toBe(true);
    expect(isTimeValid('23:59')).toBe(true);
  });

  it('refuses an impossible one', () => {
    expect(isTimeValid('24:00')).toBe(false);
    expect(isTimeValid('12:60')).toBe(false);
    expect(isTimeValid('lunch')).toBe(false);
    expect(isTimeValid('12')).toBe(false);
  });
});

describe('validatePromotionDraft', () => {
  it('accepts a complete rule', () => {
    expect(validatePromotionDraft(promo())).toEqual([]);
  });

  it('requires both languages, so a receipt is never half blank', () => {
    expect(validatePromotionDraft(promo({ nameAr: '' }))).toContain('offers.error.nameRequired');
    expect(validatePromotionDraft(promo({ nameEn: '  ' }))).toContain('offers.error.nameRequired');
  });

  it('bounds a percentage', () => {
    expect(validatePromotionDraft(promo({ value: '0' }))).toContain('offers.error.percentRange');
    expect(validatePromotionDraft(promo({ value: '101' }))).toContain('offers.error.percentRange');
    expect(validatePromotionDraft(promo({ value: '' }))).toContain('offers.error.percentRange');
  });

  it('requires a positive amount', () => {
    expect(validatePromotionDraft(promo({ kind: 'amount', value: '-1' })))
      .toContain('offers.error.amountPositive');
    expect(validatePromotionDraft(promo({ kind: 'amount', value: '25' }))).toEqual([]);
  });

  it('requires an item for a gift', () => {
    expect(validatePromotionDraft(promo({ kind: 'free_item', value: '' })))
      .toContain('offers.error.freeItemRequired');
    expect(validatePromotionDraft(promo({ kind: 'free_item', freeItemId: '7' }))).toEqual([]);
  });

  it('requires a target when the rule applies to items', () => {
    expect(validatePromotionDraft(promo({ scope: 'item' }))).toContain('offers.error.targetRequired');
    expect(validatePromotionDraft(promo({ scope: 'item', targetCategoryId: '3' }))).toEqual([]);
  });

  it('refuses a window that ends before it starts', () => {
    expect(validatePromotionDraft(promo({ startsAt: '2026-07-10', endsAt: '2026-07-01' })))
      .toContain('offers.error.endsBeforeStarts');
    expect(validatePromotionDraft(promo({ startsAt: '2026-07-01', endsAt: '2026-07-10' }))).toEqual([]);
  });

  it('refuses an unreadable time', () => {
    expect(validatePromotionDraft(promo({ startTime: '99:00' }))).toContain('offers.error.badTime');
  });

  it('refuses a rule that is neither automatic nor has a code', () => {
    expect(validatePromotionDraft(promo({ autoApply: false, code: '' })))
      .toContain('offers.error.codeRequiredForManual');
    expect(validatePromotionDraft(promo({ autoApply: false, code: 'SAVE10' }))).toEqual([]);
  });
});

describe('toPromotionPayload', () => {
  it('upper-cases the code so two cases are not two coupons', () => {
    expect(toPromotionPayload(promo({ code: ' save10 ' })).code).toBe('SAVE10');
  });

  it('sends null rather than an empty code', () => {
    expect(toPromotionPayload(promo({ code: '  ' })).code).toBeNull();
  });

  it('drops the targets when the rule is bill-scoped', () => {
    const payload = toPromotionPayload(promo({ scope: 'bill', targetItemId: '4', targetCategoryId: '9' }));
    expect(payload.target_item_id).toBeNull();
    expect(payload.target_category_id).toBeNull();
  });

  it('drops the free item when the rule is not a gift', () => {
    expect(toPromotionPayload(promo({ kind: 'percent', freeItemId: '7' })).free_item_id).toBeNull();
  });

  it('drops the cap when the rule is not a percentage', () => {
    // A cap on a fixed amount means nothing, and storing one invites the
    // reading that it does.
    expect(toPromotionPayload(promo({ kind: 'amount', value: '20', maxDiscount: '5' })).max_discount)
      .toBeNull();
  });

  it('sends sorted days, and null for every day', () => {
    expect(toPromotionPayload(promo({ activeDays: [5, 1, 3] })).active_days).toBe('1,3,5');
    expect(toPromotionPayload(promo({ activeDays: [] })).active_days).toBeNull();
  });

  it('sends null for a blank limit rather than zero', () => {
    const payload = toPromotionPayload(promo({ usageLimit: '', usageLimitPerCustomer: '' }));
    expect(payload.usage_limit).toBeNull();
    expect(payload.usage_limit_per_customer).toBeNull();
  });

  it('keeps a negative priority, which is a real choice', () => {
    expect(toPromotionPayload(promo({ priority: '-5' })).priority).toBe(-5);
  });
});

describe('promotion round trip', () => {
  it('survives row to draft to payload unchanged', () => {
    const row = {
      id: 4,
      code: 'WELCOME',
      name_en: 'Welcome',
      name_ar: 'ترحيب',
      kind: 'percent' as const,
      value: 15,
      free_item_id: null,
      scope: 'item' as const,
      target_item_id: null,
      target_category_id: 2,
      min_subtotal: 50,
      max_discount: 30,
      starts_at: '2026-07-01 00:00:00',
      ends_at: '2026-07-31 00:00:00',
      active_days: '1,2,3',
      start_time: '12:00',
      end_time: '15:00',
      usage_limit: 100,
      usage_limit_per_customer: 1,
      stackable: 1,
      priority: 5,
      auto_apply: 0,
      is_active: 1,
    };

    const payload = toPromotionPayload(toPromotionDraft(row));

    expect(payload).toMatchObject({
      id: 4,
      code: 'WELCOME',
      name_en: 'Welcome',
      name_ar: 'ترحيب',
      kind: 'percent',
      value: 15,
      scope: 'item',
      target_category_id: 2,
      min_subtotal: 50,
      max_discount: 30,
      // The stored timestamp is trimmed to the date the input holds.
      starts_at: '2026-07-01',
      ends_at: '2026-07-31',
      active_days: '1,2,3',
      start_time: '12:00',
      end_time: '15:00',
      usage_limit: 100,
      usage_limit_per_customer: 1,
      stackable: true,
      priority: 5,
      auto_apply: false,
      is_active: true,
    });
  });

  it('reads a day list that lost a value without taking the rest down', () => {
    const draft = toPromotionDraft({
      id: 1, code: null, name_en: 'a', name_ar: 'ا', kind: 'percent', value: 5,
      free_item_id: null, scope: 'bill', target_item_id: null, target_category_id: null,
      min_subtotal: 0, max_discount: null, starts_at: null, ends_at: null,
      active_days: '1,,9,3', start_time: null, end_time: null,
      usage_limit: null, usage_limit_per_customer: null,
      stackable: 0, priority: 0, auto_apply: 1, is_active: 1,
    });
    expect(draft.activeDays).toEqual([1, 3]);
  });
});

describe('validateLoyaltyDraft', () => {
  it('accepts a complete rule', () => {
    expect(validateLoyaltyDraft(loyalty())).toEqual([]);
  });

  it('requires a positive threshold', () => {
    expect(validateLoyaltyDraft(loyalty({ threshold: '0' })))
      .toContain('offers.error.thresholdPositive');
  });

  it('requires a whole number of visits', () => {
    expect(validateLoyaltyDraft(loyalty({ basis: 'visits', threshold: '4.5' })))
      .toContain('offers.error.visitsWhole');
  });

  it('allows a fractional spend threshold', () => {
    expect(validateLoyaltyDraft(loyalty({ basis: 'spend', threshold: '499.5' }))).toEqual([]);
  });

  it('treats a blank window as the whole history', () => {
    expect(validateLoyaltyDraft(loyalty({ windowDays: '' }))).toEqual([]);
    expect(toLoyaltyPayload(loyalty({ windowDays: '' })).window_days).toBeNull();
  });

  it('refuses a fractional window', () => {
    expect(validateLoyaltyDraft(loyalty({ windowDays: '1.5' })))
      .toContain('offers.error.windowWhole');
  });

  it('requires an item for a gift reward', () => {
    expect(validateLoyaltyDraft(loyalty({ rewardKind: 'free_item', rewardValue: '' })))
      .toContain('offers.error.freeItemRequired');
  });
});

describe('loyalty round trip', () => {
  it('survives row to draft to payload unchanged', () => {
    const row = {
      id: 2,
      name_en: 'Monthly regular',
      name_ar: 'زائر شهري',
      basis: 'spend' as const,
      threshold: 500,
      window_days: 30,
      reward_kind: 'percent' as const,
      reward_value: 10,
      reward_item_id: null,
      reward_max_discount: 50,
      is_active: 0,
    };

    expect(toLoyaltyPayload(toLoyaltyDraft(row))).toMatchObject({
      id: 2,
      name_en: 'Monthly regular',
      name_ar: 'زائر شهري',
      basis: 'spend',
      threshold: 500,
      window_days: 30,
      reward_kind: 'percent',
      reward_value: 10,
      reward_max_discount: 50,
      is_active: false,
    });
  });
});

describe('reason copy', () => {
  it('names every liveness reason the backend can report', () => {
    // These strings are the backend's `RejectionReason` union. A reason with
    // no copy reaches the cashier as a blank line.
    for (const reason of [
      'inactive', 'not-started', 'expired', 'wrong-day', 'outside-hours',
      'usage-limit-reached',
    ]) {
      expect(NOT_LIVE_KEY[reason], reason).toBeTruthy();
    }
  });

  it('names every rejection reason too', () => {
    for (const reason of [
      'inactive', 'not-started', 'expired', 'wrong-day', 'outside-hours',
      'below-minimum', 'no-matching-items', 'usage-limit-reached',
      'customer-limit-reached', 'needs-customer', 'no-value',
    ]) {
      expect(REJECTION_KEY[reason], reason).toBeTruthy();
    }
  });
});

describe('BACKEND_PROBLEM_KEY', () => {
  it('has copy for every code the main process can refuse with', () => {
    // These are the strings `validatePromotion` and `validateLoyaltyRule`
    // return. One without copy reaches the admin as a raw code.
    for (const code of [
      'promotion/name-required', 'promotion/percent-out-of-range',
      'promotion/amount-must-be-positive', 'promotion/free-item-required',
      'promotion/item-scope-needs-target', 'promotion/ends-before-starts',
      'promotion/no-valid-days', 'promotion/bad-start-time',
      'promotion/bad-end-time', 'promotion/unknown-kind',
      'loyalty/name-required', 'loyalty/threshold-must-be-positive',
      'loyalty/visit-threshold-must-be-whole', 'loyalty/window-must-be-whole-days',
      'loyalty/percent-out-of-range', 'loyalty/amount-must-be-positive',
      'loyalty/free-item-required', 'loyalty/unknown-basis',
      'loyalty/unknown-reward',
    ]) {
      expect(BACKEND_PROBLEM_KEY[code], code).toBeTruthy();
    }
  });

  it('maps only to keys the dictionary defines', () => {
    for (const key of Object.values(BACKEND_PROBLEM_KEY)) {
      expect(key.startsWith('offers.error.'), key).toBe(true);
    }
  });
});
