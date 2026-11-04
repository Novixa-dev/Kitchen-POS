/**
 * The setup wizard's shape and rules.
 *
 * Kept apart from the component and free of React, so "may this step be
 * left" and "what is wrong with it" are testable without rendering anything.
 * The main process validates the same things again before writing — this is
 * for telling someone what to fix as they type, which is a different job.
 */

import type { TranslationKey } from '../../i18n/types';

export type SetupStep = 'language' | 'country' | 'outlet' | 'admin' | 'done';

/** In order. `done` is a confirmation, not something to fill in. */
export const SETUP_STEPS: readonly SetupStep[] = [
  'language', 'country', 'outlet', 'admin', 'done',
];

/** The steps a person actually fills in, which is what "step 2 of 4" counts. */
export const FILLABLE_STEPS = SETUP_STEPS.filter(step => step !== 'done');

export const STEP_TITLES: Record<SetupStep, TranslationKey> = {
  language: 'setup.step.language',
  country: 'setup.step.country',
  outlet: 'setup.step.outlet',
  admin: 'setup.step.admin',
  done: 'setup.step.done',
};

export interface SetupDraft {
  locale: 'ar' | 'en';
  numerals: 'latn' | 'arab';
  /** ISO 3166-1 alpha-2, or '' for "not listed". */
  country: string;
  restaurantName: string;
  phone: string;
  address: string;
  taxNumber: string;
  adminName: string;
  adminPin: string;
  adminPinConfirm: string;
}

export const EMPTY_DRAFT: SetupDraft = {
  locale: 'ar',
  numerals: 'latn',
  country: 'SA',
  restaurantName: '',
  phone: '',
  address: '',
  taxNumber: '',
  adminName: '',
  adminPin: '',
  adminPinConfirm: '',
};

export const PIN_LENGTH = 4;

/**
 * What is wrong with this step, as translation keys.
 *
 * An empty list means the step may be left. Only the fields on the step in
 * question are judged, so moving forward never complains about something the
 * person has not reached yet.
 */
export function problemsWith(step: SetupStep, draft: SetupDraft): TranslationKey[] {
  const problems: TranslationKey[] = [];

  switch (step) {
    case 'language':
    case 'country':
      // Both always have a valid value selected — there is no empty state to
      // get wrong, and "not listed" is a legitimate answer.
      break;

    case 'outlet':
      // The name is the only required one: it prints on every receipt. A
      // phone number and address are genuinely optional for a takeaway
      // counter, and demanding a tax number from an outlet below the
      // registration threshold would be wrong.
      if (draft.restaurantName.trim() === '') {
        problems.push('setup.fillAllFields');
      }
      break;

    case 'admin':
      if (draft.adminName.trim() === '') {
        problems.push('setup.fillAllFields');
      }
      if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(draft.adminPin)) {
        problems.push('validation.pinLength');
      } else if (draft.adminPin !== draft.adminPinConfirm) {
        // Only once the PIN itself is valid: complaining about a mismatch
        // while someone is still typing the first one is noise.
        problems.push('setup.pinMismatch');
      }
      break;

    case 'done':
      break;
  }

  return problems;
}

export function canLeave(step: SetupStep, draft: SetupDraft): boolean {
  return problemsWith(step, draft).length === 0;
}

export function stepIndex(step: SetupStep): number {
  return SETUP_STEPS.indexOf(step);
}

export function nextStep(step: SetupStep): SetupStep {
  const index = stepIndex(step);
  return SETUP_STEPS[Math.min(index + 1, SETUP_STEPS.length - 1)];
}

export function previousStep(step: SetupStep): SetupStep {
  const index = stepIndex(step);
  return SETUP_STEPS[Math.max(index - 1, 0)];
}

/** Where the wizard may resume: the first step with something still wrong. */
export function firstIncompleteStep(draft: SetupDraft): SetupStep {
  return FILLABLE_STEPS.find(step => !canLeave(step, draft)) ?? 'admin';
}

export const SETUP_DRAFT_KEY = 'kpos.setupDraft';

/**
 * What is safe to keep between launches.
 *
 * The PIN fields are deliberately dropped. Setup can be interrupted — the
 * machine is being installed, someone unplugs it — and resuming is a real
 * convenience, but a four-digit PIN for the account that can erase the till
 * does not belong in `localStorage` waiting to be read. Whoever resumes
 * types it again.
 */
export function draftToStore(draft: SetupDraft): Omit<SetupDraft, 'adminPin' | 'adminPinConfirm'> {
  const { adminPin: _pin, adminPinConfirm: _confirm, ...rest } = draft;
  return rest;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/** Read a stored draft, falling back field by field rather than wholesale. */
export function draftFromStore(raw: unknown): SetupDraft {
  if (raw === null || typeof raw !== 'object') { return { ...EMPTY_DRAFT }; }
  const stored = raw as Record<string, unknown>;

  return {
    locale: stored.locale === 'en' ? 'en' : 'ar',
    numerals: stored.numerals === 'arab' ? 'arab' : 'latn',
    country: str(stored.country, EMPTY_DRAFT.country),
    restaurantName: str(stored.restaurantName, ''),
    phone: str(stored.phone, ''),
    address: str(stored.address, ''),
    taxNumber: str(stored.taxNumber, ''),
    adminName: str(stored.adminName, ''),
    // Never restored; see `draftToStore`.
    adminPin: '',
    adminPinConfirm: '',
  };
}

export function readDraft(): SetupDraft | null {
  try {
    const raw = window.localStorage.getItem(SETUP_DRAFT_KEY);
    if (raw === null) { return null; }
    return draftFromStore(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDraft(draft: SetupDraft): void {
  try {
    window.localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(draftToStore(draft)));
  } catch {
    // Locked-down profile: resuming is a convenience, not a requirement.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(SETUP_DRAFT_KEY);
  } catch {
    // Nothing to do; the next launch reads whatever is there and validates it.
  }
}

/** True when a stored draft is worth offering to resume. */
export function isWorthResuming(draft: SetupDraft): boolean {
  return draft.restaurantName.trim() !== '' || draft.adminName.trim() !== '';
}
