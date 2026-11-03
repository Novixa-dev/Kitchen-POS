import { describe, expect, it } from 'vitest';
import { FEATURES, dependentsOf, getManifest, isFeatureId } from '../catalogue';
import {
  defaultToggles,
  isActive,
  planToggle,
  resolveActive,
  validateCatalogue,
  type FeatureToggles,
} from '../resolve';

describe('catalogue integrity', () => {
  it('has no unknown requirements, cycles, or locked-on-switchable dependencies', () => {
    expect(validateCatalogue()).toEqual([]);
  });

  it('gives every module a unique id', () => {
    const ids = FEATURES.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every module translation keys, so the catalogue stays bilingual', () => {
    for (const f of FEATURES) {
      expect(f.nameKey).toMatch(/^feature\./);
      expect(f.descriptionKey).toMatch(/^feature\./);
    }
  });

  it('recognises its own ids and rejects anything else', () => {
    expect(isFeatureId('accounting')).toBe(true);
    expect(isFeatureId('not-a-module')).toBe(false);
    expect(isFeatureId(undefined)).toBe(false);
  });
});

describe('defaultToggles', () => {
  it('covers every module', () => {
    expect(Object.keys(defaultToggles()).sort()).toEqual(FEATURES.map(f => f.id).sort());
  });

  it('matches each manifest', () => {
    const defaults = defaultToggles();
    for (const f of FEATURES) {
      expect(defaults[f.id]).toBe(f.enabledByDefault);
    }
  });
});

describe('resolveActive', () => {
  it('falls back to the manifest default for an unset module', () => {
    const active = resolveActive({});
    expect(active.has('kds')).toBe(true);        // default on
    expect(active.has('accounting')).toBe(false); // default off
  });

  it('honours an explicit choice', () => {
    expect(resolveActive({ kds: false }).has('kds')).toBe(false);
    // `accounting` requires `expenses`, which is on by default.
    expect(resolveActive({ accounting: true }).has('accounting')).toBe(true);
  });

  it('keeps a locked module active even when switched off', () => {
    // The order terminal has nowhere to send a dine-in order without it.
    expect(resolveActive({ 'table-service': false }).has('table-service')).toBe(true);
  });

  it('drops a module whose requirement is off', () => {
    // This is the invariant: loyalty has nowhere to record a reward without
    // customers, so it must not be active just because it was switched on.
    const toggles: FeatureToggles = { loyalty: true, customers: false };
    expect(resolveActive(toggles).has('loyalty')).toBe(false);
  });

  it('resolves a dependency chain to a fixed point', () => {
    // qr-receipts -> customer-menu. Switching the chain on activates both.
    const active = resolveActive({ 'qr-receipts': true, 'customer-menu': true });
    expect(active.has('qr-receipts')).toBe(true);
    expect(active.has('customer-menu')).toBe(true);
  });

  it('drops a whole chain when its root requirement is off', () => {
    const active = resolveActive({ 'qr-receipts': true, 'customer-menu': false });
    expect(active.has('qr-receipts')).toBe(false);
    expect(active.has('customer-menu')).toBe(false);
  });

  it('never returns a module whose requirements are unmet', () => {
    // Exhaustive: for every possible single-module-on configuration, the
    // resolved set must be internally consistent.
    for (const f of FEATURES) {
      const active = resolveActive({ [f.id]: true });
      for (const id of active) {
        for (const dep of getManifest(id)?.requires ?? []) {
          expect(active.has(dep), `${id} active without ${dep}`).toBe(true);
        }
      }
    }
  });
});

describe('isActive', () => {
  it('answers for a single module', () => {
    expect(isActive({}, 'reports')).toBe(true);
    expect(isActive({ reports: false }, 'reports')).toBe(false);
  });
});

describe('planToggle — enabling', () => {
  it('switches on the requirement closure', () => {
    const plan = planToggle({ customers: false, discounts: false }, 'loyalty', true);
    expect(plan.toggles.loyalty).toBe(true);
    expect(plan.toggles.customers).toBe(true);
    expect(plan.toggles.discounts).toBe(true);
    expect(plan.alsoEnabled.sort()).toEqual(['customers', 'discounts']);
  });

  it('reports nothing extra when the requirements are already met', () => {
    const plan = planToggle({}, 'accounting', true);
    expect(plan.toggles.accounting).toBe(true);
    expect(plan.alsoEnabled).toEqual([]);
  });

  it('walks a transitive requirement', () => {
    // coupons -> discounts; enabling coupons from a bare state pulls discounts.
    const plan = planToggle({ discounts: false }, 'coupons', true);
    expect(plan.alsoEnabled).toContain('discounts');
  });

  it('leaves the result self-consistent', () => {
    const plan = planToggle({ customers: false, discounts: false }, 'loyalty', true);
    expect(resolveActive(plan.toggles).has('loyalty')).toBe(true);
  });
});

describe('planToggle — disabling', () => {
  it('switches off the dependents closure', () => {
    const plan = planToggle({ customers: true, discounts: true, loyalty: true }, 'customers', false);
    expect(plan.toggles.customers).toBe(false);
    expect(plan.toggles.loyalty).toBe(false);
    expect(plan.alsoDisabled).toContain('loyalty');
  });

  it('cascades through a chain', () => {
    const plan = planToggle(
      { 'customer-menu': true, 'qr-receipts': true },
      'customer-menu',
      false,
    );
    expect(plan.alsoDisabled).toContain('qr-receipts');
  });

  it('reports nothing extra when no dependent was on', () => {
    const plan = planToggle({ discounts: true, coupons: false }, 'discounts', false);
    expect(plan.alsoDisabled).toEqual([]);
  });

  it('refuses to switch off a locked module', () => {
    const before: FeatureToggles = { 'table-service': true };
    const plan = planToggle(before, 'table-service', false);
    expect(plan.toggles).toEqual(before);
    expect(plan.alsoDisabled).toEqual([]);
  });

  it('leaves the result self-consistent', () => {
    const plan = planToggle({ customers: true, loyalty: true }, 'customers', false);
    const active = resolveActive(plan.toggles);
    expect(active.has('customers')).toBe(false);
    expect(active.has('loyalty')).toBe(false);
  });
});

describe('planToggle — unknown module', () => {
  it('is a no-op rather than an error', () => {
    const before: FeatureToggles = { kds: true };
    const plan = planToggle(before, 'nope' as never, true);
    expect(plan.toggles).toEqual(before);
  });
});

describe('dependentsOf', () => {
  it('lists the modules that require the given one', () => {
    expect(dependentsOf('discounts').sort()).toEqual(['coupons', 'loyalty']);
    expect(dependentsOf('customer-menu')).toEqual(['qr-receipts']);
  });

  it('returns an empty list for a module nothing depends on', () => {
    expect(dependentsOf('kds')).toEqual([]);
  });
});
