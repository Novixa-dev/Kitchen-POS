import { useEffect, useState } from 'react';
import { api, type AppSettings, type LegacySettingAliases } from './ipc';

/**
 * Read-only access to the validated settings tree.
 *
 * Several screens need the same few values — the tax regime, the currency, the
 * outlet name — and each one fetching for itself meant an IPC round trip per
 * component on every mount. One module-level cache is shared by all of them
 * and refreshed on the `settings-updated` event the app already broadcasts
 * after a save.
 *
 * Deliberately not a context: this is ambient configuration that changes
 * rarely, and a provider would have to wrap everything that happens to read
 * one field.
 */

type Settings = AppSettings & LegacySettingAliases;

let cache: Settings | null = null;
let inFlight: Promise<Settings | null> | null = null;
const subscribers = new Set<(settings: Settings | null) => void>();

function publish(next: Settings | null): void {
  cache = next;
  for (const notify of subscribers) { notify(next); }
}

function load(): Promise<Settings | null> {
  // Collapse concurrent mounts into a single request.
  inFlight ??= api.settings
    .get()
    .then((res) => {
      const next = res.success && res.data ? res.data : null;
      publish(next);
      return next;
    })
    .catch(() => null)
    .finally(() => { inFlight = null; });

  return inFlight;
}

/** Drop the cache and refetch. Call after saving settings. */
export function refreshAppSettings(): Promise<Settings | null> {
  inFlight = null;
  return load();
}

/**
 * Returns the settings, or null until the first read resolves.
 *
 * Consumers must handle null rather than assuming defaults: showing a VAT
 * breakdown before the regime is known would flicker the wrong label.
 */
export function useAppSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(cache);

  useEffect(() => {
    subscribers.add(setSettings);

    // `useState` already seeded from the cache, so there is nothing to write
    // here for a later mount — only a first mount needs to fetch.
    if (cache === null) {
      void load();
    }

    const onUpdated = () => { void refreshAppSettings(); };
    window.addEventListener('settings-updated', onUpdated);

    return () => {
      subscribers.delete(setSettings);
      window.removeEventListener('settings-updated', onUpdated);
    };
  }, []);

  return settings;
}

/** Notify every listener that settings changed. Use after `settings.save`. */
export function announceSettingsChanged(): void {
  window.dispatchEvent(new Event('settings-updated'));
}
