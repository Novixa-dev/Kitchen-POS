import { useContext } from 'react';
import { BrandingContext, type BrandingContextValue } from './brandingContext';

/**
 * Access the outlet's branding and the preset catalogue.
 *
 * Throws rather than defaulting, for the same reason `useTheme` does: a
 * component rendered outside the provider would paint a different accent
 * from the rest of the UI.
 */
export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error('useBranding must be used inside <BrandingProvider>.');
  }
  return ctx;
}
