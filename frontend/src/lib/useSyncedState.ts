import { useState } from 'react';

/**
 * Editable local state seeded from a value that can also change externally.
 *
 * The settings forms are the case this exists for: each field is locally
 * editable, but the saved settings can also change underneath — another
 * window, a restored backup, or the form's own save round-tripping through
 * the main process.
 *
 * Syncing that with `useEffect(() => setX(prop), [prop])` costs an extra
 * render pass every time and is what React's docs call out as unnecessary.
 * Comparing against the previously seeded value during render instead
 * resets in the same pass, which is the documented pattern for
 * "adjusting state when a prop changes".
 *
 * `source` is compared by identity, so pass a stable object (a settings
 * sub-tree, say) rather than a fresh literal.
 */
export function useSyncedState<TSource, TValue>(
  source: TSource,
  derive: (source: TSource) => TValue,
): [TValue, (next: TValue) => void] {
  const [value, setValue] = useState<TValue>(() => derive(source));
  const [seededFrom, setSeededFrom] = useState(source);

  if (source !== seededFrom) {
    // Re-seeding during render, not in an effect: React discards this render
    // and re-runs the component immediately with the new state, so the user
    // never sees the stale value.
    setSeededFrom(source);
    setValue(derive(source));
  }

  return [value, setValue];
}
