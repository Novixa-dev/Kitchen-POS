/**
 * Resolving which feature modules are actually active.
 *
 * Pure functions over the catalogue and a stored on/off map, so the rules are
 * unit-testable without Electron or a database.
 *
 * The invariant this file exists to hold: **a module is never active unless
 * everything it requires is also active.** Without that, the admin can switch
 * off `customers` and leave `loyalty` on — and loyalty has nowhere to record a
 * reward, so it fails at the till rather than in Settings.
 */

import { FEATURES, dependentsOf, getManifest, type FeatureId } from './catalogue';

/** The admin's stored choices. Absent means "use the manifest default". */
export type FeatureToggles = Partial<Record<FeatureId, boolean>>;

/** Every module's default state, as declared in the catalogue. */
export function defaultToggles(): Record<FeatureId, boolean> {
  const out = {} as Record<FeatureId, boolean>;
  for (const f of FEATURES) { out[f.id] = f.enabledByDefault; }
  return out;
}

/**
 * Resolve the active set.
 *
 * A module is active when it is switched on (or locked) **and** every module in
 * its dependency closure is active. Resolution iterates to a fixed point, so a
 * chain — `qr-receipts` → `customer-menu` — settles correctly however the
 * catalogue happens to be ordered.
 */
export function resolveActive(toggles: FeatureToggles): Set<FeatureId> {
  const active = new Set<FeatureId>();

  for (const f of FEATURES) {
    // Locked modules are not switchable; the app does not run without them.
    const on = f.locked === true || (toggles[f.id] ?? f.enabledByDefault);
    if (on) { active.add(f.id); }
  }

  // Drop anything whose requirements are not met, repeatedly, until stable.
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...active]) {
      const manifest = getManifest(id);
      if (!manifest) { active.delete(id); changed = true; continue; }
      if (manifest.locked === true) { continue; }
      if (manifest.requires.some(dep => !active.has(dep))) {
        active.delete(id);
        changed = true;
      }
    }
  }

  return active;
}

export function isActive(toggles: FeatureToggles, id: FeatureId): boolean {
  return resolveActive(toggles).has(id);
}

export interface TogglePlan {
  toggles: FeatureToggles;
  /** Modules switched on as a side effect, because the target needs them. */
  alsoEnabled: FeatureId[];
  /** Modules switched off as a side effect, because they needed the target. */
  alsoDisabled: FeatureId[];
}

/**
 * Plan the effect of switching one module on or off.
 *
 * Enabling pulls in the dependency closure; disabling pushes out the dependents
 * closure. Returning the side effects lets the UI tell the admin what else is
 * about to change rather than silently rearranging their configuration.
 */
export function planToggle(
  toggles: FeatureToggles,
  id: FeatureId,
  enabled: boolean,
): TogglePlan {
  const manifest = getManifest(id);
  if (!manifest) {
    return { toggles, alsoEnabled: [], alsoDisabled: [] };
  }

  // A locked module cannot be switched off; asking is a no-op, not an error.
  if (manifest.locked === true && !enabled) {
    return { toggles, alsoEnabled: [], alsoDisabled: [] };
  }

  const next: FeatureToggles = { ...toggles, [id]: enabled };
  const alsoEnabled: FeatureId[] = [];
  const alsoDisabled: FeatureId[] = [];

  if (enabled) {
    // Walk the requirement closure, switching on anything that is off.
    const queue = [...manifest.requires];
    const seen = new Set<FeatureId>();
    while (queue.length > 0) {
      const dep = queue.shift() as FeatureId;
      if (seen.has(dep)) { continue; }
      seen.add(dep);

      const depManifest = getManifest(dep);
      if (!depManifest) { continue; }

      if (!(next[dep] ?? depManifest.enabledByDefault)) {
        next[dep] = true;
        alsoEnabled.push(dep);
      }
      queue.push(...depManifest.requires);
    }
  } else {
    // Walk the dependents closure, switching off anything that needs this.
    const queue = dependentsOf(id);
    const seen = new Set<FeatureId>();
    while (queue.length > 0) {
      const dependent = queue.shift() as FeatureId;
      if (seen.has(dependent)) { continue; }
      seen.add(dependent);

      const depManifest = getManifest(dependent);
      if (!depManifest || depManifest.locked === true) { continue; }

      if (next[dependent] ?? depManifest.enabledByDefault) {
        next[dependent] = false;
        alsoDisabled.push(dependent);
      }
      queue.push(...dependentsOf(dependent));
    }
  }

  return { toggles: next, alsoEnabled, alsoDisabled };
}

/**
 * Catalogue integrity check, asserted by the test suite.
 *
 * Returns the problems found: an unknown requirement, a dependency cycle, or a
 * locked module that depends on a switchable one (which would let the admin
 * break a module they are not allowed to turn off).
 */
export function validateCatalogue(): string[] {
  const problems: string[] = [];

  for (const f of FEATURES) {
    for (const dep of f.requires) {
      if (!getManifest(dep)) {
        problems.push(`${f.id} requires unknown module ${dep}`);
      }
    }
    if (f.locked === true) {
      for (const dep of f.requires) {
        if (getManifest(dep)?.locked !== true) {
          problems.push(`locked module ${f.id} depends on switchable ${dep}`);
        }
      }
    }
  }

  // Depth-first cycle detection over the requirement graph.
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map<FeatureId, number>(FEATURES.map(f => [f.id, WHITE]));

  const visit = (id: FeatureId, path: FeatureId[]): void => {
    colour.set(id, GREY);
    for (const dep of getManifest(id)?.requires ?? []) {
      const c = colour.get(dep);
      if (c === GREY) {
        problems.push(`dependency cycle: ${[...path, id, dep].join(' -> ')}`);
      } else if (c === WHITE) {
        visit(dep, [...path, id]);
      }
    }
    colour.set(id, BLACK);
  };

  for (const f of FEATURES) {
    if (colour.get(f.id) === WHITE) { visit(f.id, []); }
  }

  return problems;
}
