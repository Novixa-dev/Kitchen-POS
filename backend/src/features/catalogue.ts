/**
 * Feature module catalogue.
 *
 * Every optional capability in the app is declared here with a manifest. The
 * admin turns each one on or off; navigation, routes and IPC all respect that.
 *
 * This is a *declared* registry, not a runtime plugin loader. A till that
 * handles money should not execute code downloaded at runtime — and that is
 * not what "make it a plugin system" actually needs. What it needs is to turn
 * parts of the system on and off cleanly, per outlet, which this gives with
 * none of the risk. The shape is the one VS Code uses for its own built-in
 * features: declared contributions with resolved dependencies and activation
 * gates.
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

export interface FeatureManifest {
  id: FeatureId;
  category: FeatureCategory;
  /** Translation keys, so the catalogue itself stays bilingual. */
  nameKey: string;
  descriptionKey: string;
  /** Sprite icon id. */
  icon: string;
  /** On for a fresh install. */
  enabledByDefault: boolean;
  /**
   * Modules that must be enabled for this one to work. Disabling a dependency
   * cascades: anything depending on it is disabled too, so the system can
   * never be left in a state where a module is on but unusable.
   */
  requires: FeatureId[];
  /**
   * A module the app cannot run without. These are listed so the UI can show
   * them, but they cannot be switched off.
   */
  locked?: boolean;
}

export const FEATURES: readonly FeatureManifest[] = [
  // ── Operations ──────────────────────────────────────────────────────────
  {
    id: 'table-service',
    category: 'operations',
    nameKey: 'feature.tableService.name',
    descriptionKey: 'feature.tableService.description',
    icon: 'grid',
    enabledByDefault: true,
    requires: [],
    // Without a floor plan there is nowhere to take a dine-in order, and the
    // order terminal is the product. Shown, not switchable.
    locked: true,
  },
  {
    id: 'kds',
    category: 'operations',
    nameKey: 'feature.kds.name',
    descriptionKey: 'feature.kds.description',
    icon: 'chef-hat',
    enabledByDefault: true,
    requires: [],
  },
  {
    id: 'multi-menu',
    category: 'operations',
    nameKey: 'feature.multiMenu.name',
    descriptionKey: 'feature.multiMenu.description',
    icon: 'book-open',
    enabledByDefault: false,
    requires: [],
  },

  // ── Back office ─────────────────────────────────────────────────────────
  {
    id: 'inventory',
    category: 'back-office',
    nameKey: 'feature.inventory.name',
    descriptionKey: 'feature.inventory.description',
    icon: 'inventory',
    enabledByDefault: true,
    requires: [],
  },
  {
    id: 'customers',
    category: 'back-office',
    nameKey: 'feature.customers.name',
    descriptionKey: 'feature.customers.description',
    icon: 'users',
    enabledByDefault: true,
    requires: [],
  },
  {
    id: 'expenses',
    category: 'back-office',
    nameKey: 'feature.expenses.name',
    descriptionKey: 'feature.expenses.description',
    icon: 'dollar',
    enabledByDefault: true,
    requires: [],
  },
  {
    id: 'reports',
    category: 'back-office',
    nameKey: 'feature.reports.name',
    descriptionKey: 'feature.reports.description',
    icon: 'analytics',
    enabledByDefault: true,
    requires: [],
  },
  {
    id: 'accounting',
    category: 'back-office',
    nameKey: 'feature.accounting.name',
    descriptionKey: 'feature.accounting.description',
    icon: 'chart-bar',
    enabledByDefault: false,
    // The ledger draws its revenue from bills and its costs from expenses.
    requires: ['expenses'],
  },

  // ── Growth ──────────────────────────────────────────────────────────────
  {
    id: 'discounts',
    category: 'growth',
    nameKey: 'feature.discounts.name',
    descriptionKey: 'feature.discounts.description',
    icon: 'percent',
    enabledByDefault: true,
    requires: [],
  },
  {
    id: 'coupons',
    category: 'growth',
    nameKey: 'feature.coupons.name',
    descriptionKey: 'feature.coupons.description',
    icon: 'gift',
    enabledByDefault: false,
    // A coupon is a discount with a code and a validity window.
    requires: ['discounts'],
  },
  {
    id: 'loyalty',
    category: 'growth',
    nameKey: 'feature.loyalty.name',
    descriptionKey: 'feature.loyalty.description',
    icon: 'star',
    enabledByDefault: false,
    // Rewards are awarded to a customer record and paid out as a discount.
    requires: ['customers', 'discounts'],
  },
  {
    id: 'qr-receipts',
    category: 'growth',
    nameKey: 'feature.qrReceipts.name',
    descriptionKey: 'feature.qrReceipts.description',
    icon: 'external-link',
    enabledByDefault: false,
    // The QR resolves to a page served by the customer-menu server.
    requires: ['customer-menu'],
  },
  {
    id: 'customer-menu',
    category: 'growth',
    nameKey: 'feature.customerMenu.name',
    descriptionKey: 'feature.customerMenu.description',
    icon: 'phone',
    enabledByDefault: false,
    requires: [],
  },
];

const BY_ID = new Map<FeatureId, FeatureManifest>(FEATURES.map(f => [f.id, f]));

export function getManifest(id: FeatureId): FeatureManifest | undefined {
  return BY_ID.get(id);
}

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === 'string' && BY_ID.has(value as FeatureId);
}

/** Ids of every module that lists `id` among its requirements. */
export function dependentsOf(id: FeatureId): FeatureId[] {
  return FEATURES.filter(f => f.requires.includes(id)).map(f => f.id);
}
