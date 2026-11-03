/**
 * Typed application settings.
 *
 * `electron-store` is schemaless, and the app previously read it with
 * `store.get('key') as string` in a dozen places — so a missing or
 * mistyped value silently became `undefined` and reached the receipt
 * template. Everything now goes through one schema with explicit defaults
 * and coercion, so a corrupted store degrades to a working default instead
 * of printing "undefined" on a customer's invoice.
 */

import Store from 'electron-store';
import {
  sanitiseOverrides,
  type RolePermissionOverrides,
} from '../auth/permissions';
import { DEFAULT_BRANDING, sanitiseBranding, type BrandingSettings } from './branding';
import { clamp } from './money';
import { DEFAULT_TAX_CONFIG, toTaxMode, type TaxConfig, type TaxMode } from '../services/tax';

export type Locale = 'ar' | 'en';
export type NumeralSystem = 'latn' | 'arab';
export type ThemePreference = 'light' | 'dark' | 'system';
export type PaperWidth = '58mm' | '80mm' | 'a4';
export type SymbolPosition = 'before' | 'after';

export interface CurrencySettings {
  code: string;
  symbol: string;
  decimals: number;
  position: SymbolPosition;
}

export interface OutletSettings {
  name: string;
  address: string;
  phone: string;
  /** Tax registration number (VAT number / GSTIN / TRN). */
  taxNumber: string;
  logoPath: string;
}

export interface PrintSettings {
  /** OS printer name, or '' for the system default. */
  receiptPrinter: string;
  kitchenPrinter: string;
  paperWidth: PaperWidth;
  copies: number;
  /** Print without showing the OS dialog — essential during service. */
  silent: boolean;
  footerText: string;
  showTaxBreakdown: boolean;
}

export interface AppSettings {
  locale: Locale;
  numerals: NumeralSystem;
  theme: ThemePreference;
  /** Accent colour, typeface and density — see `branding.ts`. */
  branding: BrandingSettings;
  /**
   * The admin's changes to the role matrix. An absent role is on the
   * shipped defaults; `admin` is never stored, since it is not editable.
   */
  rolePermissions: RolePermissionOverrides;
  currency: CurrencySettings;
  outlet: OutletSettings;
  tax: TaxConfig;
  print: PrintSettings;
  kdsEnabled: boolean;
  inventoryAutoDebit: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'ar',
  numerals: 'latn',
  theme: 'light',
  branding: DEFAULT_BRANDING,
  rolePermissions: {},
  currency: { code: 'SAR', symbol: 'ر.س', decimals: 2, position: 'after' },
  outlet: { name: '', address: '', phone: '', taxNumber: '', logoPath: '' },
  tax: DEFAULT_TAX_CONFIG,
  print: {
    receiptPrinter: '',
    kitchenPrinter: '',
    paperWidth: '80mm',
    copies: 1,
    silent: true,
    footerText: '',
    showTaxBreakdown: true,
  },
  kdsEnabled: true,
  inventoryAutoDebit: true,
};

/**
 * Created on first use rather than at import time.
 *
 * `new Store()` touches the filesystem, so constructing it at module scope
 * made importing this file — or anything that imports it, including the
 * receipt renderer — write a config file as a side effect.
 */
let storeInstance: Store | null = null;

function store(): Store {
  storeInstance ??= new Store();
  return storeInstance;
}

// ── coercion helpers ────────────────────────────────────────────────────────

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Settings written before this schema existed used flat keys
 * (`outlet_name`, `gstin`, `is_gst_enabled`, …). Read them so an existing
 * install keeps its configuration after upgrading.
 */
interface LegacyShape {
  outlet_name?: unknown;
  address?: unknown;
  gstin?: unknown;
  is_gst_enabled?: unknown;
  is_kds_enabled?: unknown;
  inventory_auto_debit?: unknown;
  currency_code?: unknown;
  currency_symbol?: unknown;
  currency_decimals?: unknown;
  currency_position?: unknown;
}

function readLegacyTaxMode(raw: LegacyShape, nested: unknown): TaxMode {
  if (nested !== undefined) { return toTaxMode(nested); }
  // An install that had GST switched off meant "charge no tax".
  if (raw.is_gst_enabled === false) { return 'none'; }
  // An install that carried a GSTIN was an Indian outlet on GST.
  if (typeof raw.gstin === 'string' && raw.gstin.trim() !== '') { return 'gst'; }
  return DEFAULT_SETTINGS.tax.mode;
}

/** Read the whole settings tree, with every field validated. */
export function getSettings(): AppSettings {
  const raw = store().store as Record<string, unknown> & LegacyShape;
  const d = DEFAULT_SETTINGS;

  const currency = (raw.currency ?? {}) as Partial<CurrencySettings>;
  const outlet = (raw.outlet ?? {}) as Partial<OutletSettings>;
  const tax = (raw.tax ?? {}) as Partial<TaxConfig>;
  const print = (raw.print ?? {}) as Partial<PrintSettings>;

  return {
    locale: oneOf(raw.locale, ['ar', 'en'] as const, d.locale),
    numerals: oneOf(raw.numerals, ['latn', 'arab'] as const, d.numerals),
    theme: oneOf(raw.theme, ['light', 'dark', 'system'] as const, d.theme),
    // Validated wholesale: a bad accent reaching the CSS variables leaves
    // every button unstyled, so it degrades to the default look.
    branding: sanitiseBranding(raw.branding),
    rolePermissions: sanitiseOverrides(raw.rolePermissions),

    currency: {
      code: str(currency.code ?? raw.currency_code, d.currency.code),
      symbol: str(currency.symbol ?? raw.currency_symbol, d.currency.symbol),
      decimals: num(currency.decimals ?? raw.currency_decimals, d.currency.decimals, 0, 4),
      position: oneOf(
        currency.position ?? raw.currency_position,
        ['before', 'after'] as const,
        d.currency.position,
      ),
    },

    outlet: {
      name: str(outlet.name ?? raw.outlet_name, d.outlet.name),
      address: str(outlet.address ?? raw.address, d.outlet.address),
      phone: str(outlet.phone, d.outlet.phone),
      taxNumber: str(outlet.taxNumber ?? raw.gstin, d.outlet.taxNumber),
      logoPath: str(outlet.logoPath, d.outlet.logoPath),
    },

    tax: {
      mode: readLegacyTaxMode(raw, tax.mode),
      rate: num(tax.rate, d.tax.rate, 0, 100),
      inclusive: bool(tax.inclusive, d.tax.inclusive),
    },

    print: {
      receiptPrinter: str(print.receiptPrinter, d.print.receiptPrinter),
      kitchenPrinter: str(print.kitchenPrinter, d.print.kitchenPrinter),
      paperWidth: oneOf(print.paperWidth, ['58mm', '80mm', 'a4'] as const, d.print.paperWidth),
      copies: Math.round(num(print.copies, d.print.copies, 1, 5)),
      silent: bool(print.silent, d.print.silent),
      footerText: str(print.footerText, d.print.footerText),
      showTaxBreakdown: bool(print.showTaxBreakdown, d.print.showTaxBreakdown),
    },

    kdsEnabled: bool(raw.kdsEnabled ?? raw.is_kds_enabled, d.kdsEnabled),
    inventoryAutoDebit: bool(
      raw.inventoryAutoDebit ?? raw.inventory_auto_debit,
      d.inventoryAutoDebit,
    ),
  };
}

/**
 * Merge a partial update into the store.
 *
 * Nested groups are merged one level deep so the UI can save just
 * `{ print: { copies: 2 } }` without clearing the other print fields.
 */
export function patchSettings(patch: Record<string, unknown>): AppSettings {
  const NESTED = ['currency', 'outlet', 'tax', 'print', 'branding'] as const;

  for (const [key, value] of Object.entries(patch)) {
    if (
      (NESTED as readonly string[]).includes(key) &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const current = (store().get(key) ?? {}) as Record<string, unknown>;
      store().set(key, { ...current, ...(value as Record<string, unknown>) });
    } else {
      store().set(key, value);
    }
  }

  // Re-read so the caller gets the validated result, not its own input.
  return getSettings();
}

/** Read one top-level key with a default — kept for call sites that need it. */
export function getRawSetting<T>(key: string, defaultValue: T): T {
  return store().get(key, defaultValue) as T;
}

export function setRawSetting(key: string, value: unknown): void {
  store().set(key, value);
}

/** The tax configuration alone, which is what billing needs. */
export function getTaxConfig(): TaxConfig {
  return getSettings().tax;
}
