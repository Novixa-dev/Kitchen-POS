import { createContext } from 'react';

/**
 * Feature-module contract, shared by the provider and the hooks.
 *
 * Mirrors `backend/src/features/catalogue.ts`. The manifest travels over IPC
 * rather than being duplicated here, so the renderer cannot drift out of sync
 * with the catalogue the main process actually enforces.
 */

export type FeatureId =
  | 'table-service'
  | 'kds'
  | 'inventory'
  | 'customers'
  | 'expenses'
  | 'reports'
  | 'multi-menu'
  | 'accounting'
  | 'discounts'
  | 'coupons'
  | 'loyalty'
  | 'qr-receipts'
  | 'customer-menu';

export type FeatureCategory = 'operations' | 'back-office' | 'growth';

export interface FeatureModule {
  id: FeatureId;
  category: FeatureCategory;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  requires: FeatureId[];
  /** Cannot be switched off; the app does not run without it. */
  locked: boolean;
  /** What the admin chose. */
  enabled: boolean;
  /** Whether it is usable once dependencies are resolved. */
  active: boolean;
}

export interface FeaturesContextValue {
  /** The catalogue with current state, or null until the first read lands. */
  modules: FeatureModule[] | null;
  /** Fast membership test for render-time gating. */
  isActive: (id: FeatureId) => boolean;
  /** Preview which other modules a toggle would drag with it. */
  preview: (id: FeatureId, enabled: boolean) => Promise<{
    alsoEnabled: FeatureId[];
    alsoDisabled: FeatureId[];
  }>;
  setEnabled: (id: FeatureId, enabled: boolean) => Promise<boolean>;
  reset: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const FeaturesContext = createContext<FeaturesContextValue | null>(null);
