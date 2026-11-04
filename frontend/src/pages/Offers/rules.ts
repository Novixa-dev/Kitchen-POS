/**
 * Offer-form rules.
 *
 * Mirrors `backend/src/services/promotions.ts` and `loyalty.ts`, for one
 * reason: the main process refuses an invalid rule with an error code, and an
 * admin filling in a form deserves to be told *while typing* rather than
 * after pressing Save. The backend stays the authority — this is the same
 * question asked earlier, never instead.
 *
 * Pure and dependency-free, so every rule is testable without rendering.
 */

export type PromotionKind = 'percent' | 'amount' | 'free_item';
export type PromotionScope = 'bill' | 'item';
export type LoyaltyBasis = 'visits' | 'spend';
export type RewardKind = PromotionKind;

/** The form's own shape: strings, because that is what inputs hold. */
export interface PromotionDraft {
  id?: number;
  code: string;
  nameEn: string;
  nameAr: string;
  kind: PromotionKind;
  value: string;
  freeItemId: string;
  scope: PromotionScope;
  targetItemId: string;
  targetCategoryId: string;
  minSubtotal: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  /** Weekdays as numbers; empty means every day. */
  activeDays: number[];
  startTime: string;
  endTime: string;
  usageLimit: string;
  usageLimitPerCustomer: string;
  stackable: boolean;
  priority: string;
  autoApply: boolean;
  isActive: boolean;
}

export const EMPTY_PROMOTION: PromotionDraft = {
  code: '',
  nameEn: '',
  nameAr: '',
  kind: 'percent',
  value: '',
  freeItemId: '',
  scope: 'bill',
  targetItemId: '',
  targetCategoryId: '',
  minSubtotal: '',
  maxDiscount: '',
  startsAt: '',
  endsAt: '',
  activeDays: [],
  startTime: '',
  endTime: '',
  usageLimit: '',
  usageLimitPerCustomer: '',
  stackable: false,
  priority: '0',
  autoApply: true,
  isActive: true,
};

/** Translation keys, so a refusal reads in the active language. */
export type PromotionProblem =
  | 'offers.error.nameRequired'
  | 'offers.error.percentRange'
  | 'offers.error.amountPositive'
  | 'offers.error.freeItemRequired'
  | 'offers.error.targetRequired'
  | 'offers.error.endsBeforeStarts'
  | 'offers.error.badTime'
  | 'offers.error.codeRequiredForManual';

const TIME = /^(\d{1,2}):(\d{2})$/;

/** `HH:MM`, or empty. Anything else is a typo worth refusing. */
export function isTimeValid(text: string): boolean {
  const value = text.trim();
  if (value === '') { return true; }
  const match = TIME.exec(value);
  if (!match) { return false; }
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

const num = (text: string): number => {
  const n = Number(text.trim());
  return Number.isFinite(n) ? n : NaN;
};

export function validatePromotionDraft(draft: PromotionDraft): PromotionProblem[] {
  const problems: PromotionProblem[] = [];

  if (!draft.nameEn.trim() || !draft.nameAr.trim()) {
    problems.push('offers.error.nameRequired');
  }

  if (draft.kind === 'percent') {
    const value = num(draft.value);
    if (!(value > 0 && value <= 100)) { problems.push('offers.error.percentRange'); }
  } else if (draft.kind === 'amount') {
    const value = num(draft.value);
    if (!(value > 0)) { problems.push('offers.error.amountPositive'); }
  } else if (!draft.freeItemId.trim()) {
    problems.push('offers.error.freeItemRequired');
  }

  if (draft.scope === 'item' && !draft.targetItemId.trim() && !draft.targetCategoryId.trim()) {
    problems.push('offers.error.targetRequired');
  }

  if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) {
    problems.push('offers.error.endsBeforeStarts');
  }

  if (!isTimeValid(draft.startTime) || !isTimeValid(draft.endTime)) {
    problems.push('offers.error.badTime');
  }

  // A rule that is neither automatic nor reachable by a code is a row the
  // till can only apply if the cashier happens to pick it from the list —
  // which is a legitimate choice, but not when it is *also* switched off
  // from automatic by mistake and has no code. Requiring one of the two
  // makes the intent explicit.
  if (!draft.autoApply && !draft.code.trim()) {
    problems.push('offers.error.codeRequiredForManual');
  }

  return problems;
}

/** The payload the main process expects. Strings become numbers or null. */
export function toPromotionPayload(draft: PromotionDraft) {
  const optionalNumber = (text: string): number | null => {
    const value = num(text);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  return {
    id: draft.id,
    code: draft.code.trim() === '' ? null : draft.code.trim().toUpperCase(),
    name_en: draft.nameEn.trim(),
    name_ar: draft.nameAr.trim(),
    kind: draft.kind,
    value: draft.kind === 'free_item' ? 0 : (optionalNumber(draft.value) ?? 0),
    free_item_id: draft.kind === 'free_item' ? optionalNumber(draft.freeItemId) : null,
    scope: draft.scope,
    target_item_id: draft.scope === 'item' ? optionalNumber(draft.targetItemId) : null,
    target_category_id: draft.scope === 'item' ? optionalNumber(draft.targetCategoryId) : null,
    min_subtotal: optionalNumber(draft.minSubtotal) ?? 0,
    max_discount: draft.kind === 'percent' ? optionalNumber(draft.maxDiscount) : null,
    starts_at: draft.startsAt || null,
    ends_at: draft.endsAt || null,
    // Empty means every day, which the engine reads from a null column.
    active_days: draft.activeDays.length > 0 ? [...draft.activeDays].sort().join(',') : null,
    start_time: draft.startTime.trim() || null,
    end_time: draft.endTime.trim() || null,
    usage_limit: optionalNumber(draft.usageLimit),
    usage_limit_per_customer: optionalNumber(draft.usageLimitPerCustomer),
    stackable: draft.stackable,
    priority: Number.isFinite(num(draft.priority)) ? num(draft.priority) : 0,
    auto_apply: draft.autoApply,
    is_active: draft.isActive,
  };
}

/** A stored row back into form state, for editing. */
export function toPromotionDraft(row: {
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
  active_days: string | null;
  start_time: string | null;
  end_time: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  stackable: number;
  priority: number;
  auto_apply: number;
  is_active: number;
}): PromotionDraft {
  const str = (v: number | null): string => (v === null || v === 0 ? '' : String(v));

  return {
    id: row.id,
    code: row.code ?? '',
    nameEn: row.name_en,
    nameAr: row.name_ar,
    kind: row.kind,
    value: row.value === 0 ? '' : String(row.value),
    freeItemId: str(row.free_item_id),
    scope: row.scope,
    targetItemId: str(row.target_item_id),
    targetCategoryId: str(row.target_category_id),
    minSubtotal: str(row.min_subtotal),
    maxDiscount: str(row.max_discount),
    // The column may carry a full timestamp; the date input needs the date.
    startsAt: row.starts_at?.slice(0, 10) ?? '',
    endsAt: row.ends_at?.slice(0, 10) ?? '',
    // An empty segment is dropped before parsing: `Number('')` is 0, so a
    // stray or trailing comma would otherwise add Sunday to the rule.
    activeDays: (row.active_days ?? '')
      .split(',')
      .map(d => d.trim())
      .filter(d => d !== '')
      .map(Number)
      .filter(d => Number.isInteger(d) && d >= 0 && d <= 6),
    startTime: row.start_time ?? '',
    endTime: row.end_time ?? '',
    usageLimit: str(row.usage_limit),
    usageLimitPerCustomer: str(row.usage_limit_per_customer),
    stackable: row.stackable === 1,
    priority: String(row.priority),
    autoApply: row.auto_apply === 1,
    isActive: row.is_active === 1,
  };
}

// ── Loyalty ───────────────────────────────────────────────────────────────

export interface LoyaltyDraft {
  id?: number;
  nameEn: string;
  nameAr: string;
  basis: LoyaltyBasis;
  threshold: string;
  windowDays: string;
  rewardKind: RewardKind;
  rewardValue: string;
  rewardItemId: string;
  rewardMaxDiscount: string;
  isActive: boolean;
}

export const EMPTY_LOYALTY: LoyaltyDraft = {
  nameEn: '',
  nameAr: '',
  basis: 'visits',
  threshold: '',
  windowDays: '',
  rewardKind: 'percent',
  rewardValue: '',
  rewardItemId: '',
  rewardMaxDiscount: '',
  isActive: true,
};

export type LoyaltyProblem =
  | 'offers.error.nameRequired'
  | 'offers.error.thresholdPositive'
  | 'offers.error.visitsWhole'
  | 'offers.error.windowWhole'
  | 'offers.error.percentRange'
  | 'offers.error.amountPositive'
  | 'offers.error.freeItemRequired';

export function validateLoyaltyDraft(draft: LoyaltyDraft): LoyaltyProblem[] {
  const problems: LoyaltyProblem[] = [];

  if (!draft.nameEn.trim() || !draft.nameAr.trim()) {
    problems.push('offers.error.nameRequired');
  }

  const threshold = num(draft.threshold);
  if (!(threshold > 0)) {
    problems.push('offers.error.thresholdPositive');
  } else if (draft.basis === 'visits' && !Number.isInteger(threshold)) {
    problems.push('offers.error.visitsWhole');
  }

  if (draft.windowDays.trim() !== '') {
    const window = num(draft.windowDays);
    if (!(Number.isInteger(window) && window > 0)) { problems.push('offers.error.windowWhole'); }
  }

  if (draft.rewardKind === 'percent') {
    const value = num(draft.rewardValue);
    if (!(value > 0 && value <= 100)) { problems.push('offers.error.percentRange'); }
  } else if (draft.rewardKind === 'amount') {
    if (!(num(draft.rewardValue) > 0)) { problems.push('offers.error.amountPositive'); }
  } else if (!draft.rewardItemId.trim()) {
    problems.push('offers.error.freeItemRequired');
  }

  return problems;
}

export function toLoyaltyPayload(draft: LoyaltyDraft) {
  const optionalNumber = (text: string): number | null => {
    const value = num(text);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  return {
    id: draft.id,
    name_en: draft.nameEn.trim(),
    name_ar: draft.nameAr.trim(),
    basis: draft.basis,
    threshold: optionalNumber(draft.threshold) ?? 0,
    window_days: optionalNumber(draft.windowDays),
    reward_kind: draft.rewardKind,
    reward_value: draft.rewardKind === 'free_item' ? 0 : (optionalNumber(draft.rewardValue) ?? 0),
    reward_item_id: draft.rewardKind === 'free_item' ? optionalNumber(draft.rewardItemId) : null,
    reward_max_discount: draft.rewardKind === 'percent'
      ? optionalNumber(draft.rewardMaxDiscount)
      : null,
    is_active: draft.isActive,
  };
}

export function toLoyaltyDraft(row: {
  id: number;
  name_en: string;
  name_ar: string;
  basis: LoyaltyBasis;
  threshold: number;
  window_days: number | null;
  reward_kind: RewardKind;
  reward_value: number;
  reward_item_id: number | null;
  reward_max_discount: number | null;
  is_active: number;
}): LoyaltyDraft {
  const str = (v: number | null): string => (v === null || v === 0 ? '' : String(v));

  return {
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    basis: row.basis,
    threshold: str(row.threshold),
    windowDays: str(row.window_days),
    rewardKind: row.reward_kind,
    rewardValue: str(row.reward_value),
    rewardItemId: str(row.reward_item_id),
    rewardMaxDiscount: str(row.reward_max_discount),
    isActive: row.is_active === 1,
  };
}

/**
 * Why a rule is not running, as a translation key.
 *
 * The backend reports the reason codes; this maps them to copy so the admin
 * list can say "ended on Sunday" rather than leaving the owner to work out
 * why a rule marked active did nothing.
 */
export const NOT_LIVE_KEY: Readonly<Record<string, string>> = {
  inactive: 'offers.notLive.inactive',
  'not-started': 'offers.notLive.notStarted',
  expired: 'offers.notLive.expired',
  'wrong-day': 'offers.notLive.wrongDay',
  'outside-hours': 'offers.notLive.outsideHours',
  'usage-limit-reached': 'offers.notLive.usedUp',
};

/** Why an offer did not apply to the bill in front of the cashier. */
export const REJECTION_KEY: Readonly<Record<string, string>> = {
  ...NOT_LIVE_KEY,
  'below-minimum': 'offers.rejected.belowMinimum',
  'no-matching-items': 'offers.rejected.noMatchingItems',
  'customer-limit-reached': 'offers.rejected.customerLimit',
  'needs-customer': 'offers.rejected.needsCustomer',
  'no-value': 'offers.rejected.noValue',
};

/**
 * The main process's refusal codes, mapped to copy.
 *
 * The backend validates independently and answers with its own codes
 * (`promotion/percent-out-of-range`). Those are not the form's keys, so
 * without this map a refusal the form did not catch would reach the admin as
 * the raw code.
 */
export const BACKEND_PROBLEM_KEY: Readonly<Record<string, string>> = {
  'promotion/name-required': 'offers.error.nameRequired',
  'promotion/percent-out-of-range': 'offers.error.percentRange',
  'promotion/amount-must-be-positive': 'offers.error.amountPositive',
  'promotion/free-item-required': 'offers.error.freeItemRequired',
  'promotion/item-scope-needs-target': 'offers.error.targetRequired',
  'promotion/ends-before-starts': 'offers.error.endsBeforeStarts',
  'promotion/no-valid-days': 'offers.error.badTime',
  'promotion/bad-start-time': 'offers.error.badTime',
  'promotion/bad-end-time': 'offers.error.badTime',
  'promotion/unknown-kind': 'offers.error.percentRange',
  'loyalty/name-required': 'offers.error.nameRequired',
  'loyalty/threshold-must-be-positive': 'offers.error.thresholdPositive',
  'loyalty/visit-threshold-must-be-whole': 'offers.error.visitsWhole',
  'loyalty/window-must-be-whole-days': 'offers.error.windowWhole',
  'loyalty/percent-out-of-range': 'offers.error.percentRange',
  'loyalty/amount-must-be-positive': 'offers.error.amountPositive',
  'loyalty/free-item-required': 'offers.error.freeItemRequired',
  'loyalty/unknown-basis': 'offers.error.thresholdPositive',
  'loyalty/unknown-reward': 'offers.error.percentRange',
};
