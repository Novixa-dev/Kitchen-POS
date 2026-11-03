import { afterEach, describe, expect, it } from 'vitest';
import {
  EMPTY_DRAFT,
  FILLABLE_STEPS,
  SETUP_DRAFT_KEY,
  SETUP_STEPS,
  STEP_TITLES,
  canLeave,
  clearDraft,
  draftFromStore,
  draftToStore,
  firstIncompleteStep,
  nextStep,
  previousStep,
  problemsWith,
  readDraft,
  saveDraft,
  type SetupDraft,
} from './steps';

const draft = (overrides: Partial<SetupDraft> = {}): SetupDraft => ({
  ...EMPTY_DRAFT,
  restaurantName: 'Al Nakheel',
  adminName: 'Noura',
  adminPin: '1234',
  adminPinConfirm: '1234',
  ...overrides,
});

afterEach(() => { clearDraft(); });

describe('the step list', () => {
  it('ends on the confirmation, which is not something to fill in', () => {
    expect(SETUP_STEPS[SETUP_STEPS.length - 1]).toBe('done');
    expect(FILLABLE_STEPS).not.toContain('done');
    expect(FILLABLE_STEPS.length).toBe(SETUP_STEPS.length - 1);
  });

  it('gives every step a title', () => {
    for (const step of SETUP_STEPS) {
      expect(STEP_TITLES[step], step).toMatch(/^setup\.step\./);
    }
  });

  it('clamps at both ends rather than walking off the list', () => {
    expect(previousStep('language')).toBe('language');
    expect(nextStep('done')).toBe('done');
    expect(nextStep('language')).toBe('country');
    expect(previousStep('country')).toBe('language');
  });
});

describe('problemsWith', () => {
  it('lets the language and country steps through, since both always have a value', () => {
    expect(problemsWith('language', EMPTY_DRAFT)).toEqual([]);
    expect(problemsWith('country', EMPTY_DRAFT)).toEqual([]);
  });

  it('accepts "not listed" as a country, which is a real answer', () => {
    expect(canLeave('country', draft({ country: '' }))).toBe(true);
  });

  it('requires an outlet name, because it prints on every receipt', () => {
    expect(problemsWith('outlet', draft({ restaurantName: '' }))).toEqual(['setup.fillAllFields']);
    expect(problemsWith('outlet', draft({ restaurantName: '   ' }))).toEqual(['setup.fillAllFields']);
  });

  it('does not require a phone, address or tax number', () => {
    // A takeaway counter may have no address worth printing, and an outlet
    // below the registration threshold has no tax number to give.
    expect(canLeave('outlet', draft({ phone: '', address: '', taxNumber: '' }))).toBe(true);
  });

  it('requires a four-digit PIN', () => {
    expect(problemsWith('admin', draft({ adminPin: '123', adminPinConfirm: '123' })))
      .toEqual(['validation.pinLength']);
    expect(problemsWith('admin', draft({ adminPin: '12345', adminPinConfirm: '12345' })))
      .toEqual(['validation.pinLength']);
    expect(problemsWith('admin', draft({ adminPin: '12a4', adminPinConfirm: '12a4' })))
      .toEqual(['validation.pinLength']);
  });

  it('catches a mismatch only once the PIN itself is valid', () => {
    // Complaining about a mismatch while the first PIN is still half typed
    // is noise, and it is the message people read first.
    expect(problemsWith('admin', draft({ adminPin: '12', adminPinConfirm: '' })))
      .toEqual(['validation.pinLength']);
    expect(problemsWith('admin', draft({ adminPin: '1234', adminPinConfirm: '4321' })))
      .toEqual(['setup.pinMismatch']);
  });

  it('reports a missing name and a bad PIN together', () => {
    const problems = problemsWith('admin', draft({ adminName: '', adminPin: '1' }));
    expect(problems).toContain('setup.fillAllFields');
    expect(problems).toContain('validation.pinLength');
  });

  it('judges only the step in question', () => {
    // Moving past the language step must not complain about a name the
    // person has not been asked for yet.
    expect(canLeave('language', EMPTY_DRAFT)).toBe(true);
    expect(canLeave('outlet', EMPTY_DRAFT)).toBe(false);
  });

  it('accepts a complete draft at every step', () => {
    for (const step of SETUP_STEPS) {
      expect(canLeave(step, draft()), step).toBe(true);
    }
  });
});

describe('firstIncompleteStep', () => {
  it('resumes at the outlet step when only the language was chosen', () => {
    expect(firstIncompleteStep(EMPTY_DRAFT)).toBe('outlet');
  });

  it('resumes at the admin step when the outlet is filled in', () => {
    expect(firstIncompleteStep(draft({ adminName: '', adminPin: '' }))).toBe('admin');
  });

  it('lands on the admin step for a complete draft', () => {
    // A restored draft never carries a PIN, so this is where someone
    // resuming has to finish — never past it.
    expect(firstIncompleteStep(draft())).toBe('admin');
  });
});

describe('draftToStore', () => {
  it('drops both PIN fields', () => {
    // Setup can be interrupted while a machine is being installed, so
    // resuming is a real convenience — but the PIN for the account that can
    // erase the till does not belong in `localStorage`.
    const stored = draftToStore(draft());
    expect('adminPin' in stored).toBe(false);
    expect('adminPinConfirm' in stored).toBe(false);
  });

  it('keeps everything else', () => {
    const stored = draftToStore(draft({ phone: '0500000000' }));
    expect(stored.restaurantName).toBe('Al Nakheel');
    expect(stored.adminName).toBe('Noura');
    expect(stored.phone).toBe('0500000000');
    expect(stored.country).toBe('SA');
  });
});

describe('draftFromStore', () => {
  it('restores a stored draft with empty PIN fields', () => {
    const restored = draftFromStore(draftToStore(draft()));
    expect(restored.restaurantName).toBe('Al Nakheel');
    expect(restored.adminPin).toBe('');
    expect(restored.adminPinConfirm).toBe('');
  });

  it('never restores a PIN even if one is in the stored object', () => {
    // Defence in depth: a draft written by an older build, or edited by
    // hand, must not repopulate the field.
    const restored = draftFromStore({ ...draft(), adminPin: '9999' });
    expect(restored.adminPin).toBe('');
  });

  it('falls back field by field rather than discarding the whole draft', () => {
    const restored = draftFromStore({ restaurantName: 'Kept', phone: 42 });
    expect(restored.restaurantName).toBe('Kept');
    expect(restored.phone).toBe('');
    expect(restored.locale).toBe('ar');
  });

  it('defaults to Arabic, which is the app default language', () => {
    expect(draftFromStore({}).locale).toBe('ar');
    expect(draftFromStore({ locale: 'fr' }).locale).toBe('ar');
    expect(draftFromStore({ locale: 'en' }).locale).toBe('en');
  });

  it('returns the empty draft for anything that is not an object', () => {
    expect(draftFromStore(null)).toEqual(EMPTY_DRAFT);
    expect(draftFromStore('draft')).toEqual(EMPTY_DRAFT);
  });
});

describe('readDraft and saveDraft', () => {
  it('returns null when nothing has been saved', () => {
    expect(readDraft()).toBeNull();
  });

  it('round-trips a draft without its PIN', () => {
    saveDraft(draft());
    const restored = readDraft();
    expect(restored?.restaurantName).toBe('Al Nakheel');
    expect(restored?.adminPin).toBe('');
  });

  it('returns null for malformed JSON rather than throwing on launch', () => {
    window.localStorage.setItem(SETUP_DRAFT_KEY, '{not json');
    expect(readDraft()).toBeNull();
  });

  it('clears', () => {
    saveDraft(draft());
    clearDraft();
    expect(readDraft()).toBeNull();
  });
});
