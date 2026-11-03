/**
 * Tax engine.
 *
 * The app was hardwired to Indian GST: every bill carried a CGST and an SGST
 * amount, and menu items stored `cgst_rate` / `sgst_rate`. That shape does not
 * describe the single-rate VAT used across the Gulf, so tax is now a
 * *regime* the outlet selects.
 *
 * Regimes
 *  - `vat`  One rate for the whole bill (configurable), the Gulf/EU model.
 *           Can be price-inclusive, which is the norm for menu prices there.
 *  - `gst`  The original Indian split, per item: CGST + SGST.
 *  - `none` No tax is charged or printed.
 *
 * Storage stays backwards compatible: `bills.cgst_amount` / `sgst_amount` keep
 * their meaning under `gst`, and the new `tax_amount` column holds the total
 * tax under every regime, so reports have one column to sum.
 */

import { round, sum } from '../lib/money';

export type TaxMode = 'vat' | 'gst' | 'none';

export interface TaxConfig {
  mode: TaxMode;
  /** Whole-number percentage used by `vat`, e.g. 15 for 15%. Ignored by `gst`. */
  rate: number;
  /** When true, item prices already contain the tax and it is backed out. */
  inclusive: boolean;
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  mode: 'vat',
  rate: 15,
  inclusive: true,
};

/** The fields the engine needs from an order item row. */
export interface TaxableItem {
  unit_price: number;
  qty: number;
  /** Only read under the `gst` regime. */
  cgst_rate?: number;
  sgst_rate?: number;
  discount?: number;
}

export interface LineTax {
  /** Net amount the tax is computed on, after the line discount. */
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  /** Total tax on the line: `cgstAmount + sgstAmount` under `gst`. */
  taxAmount: number;
  /** `taxableAmount + taxAmount`. */
  totalAmount: number;
}

export interface BillTotals {
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
}

/**
 * Split a tax-inclusive gross amount into net and tax.
 *
 * net = gross / (1 + rate), tax = gross - net. Deriving the tax by
 * subtraction rather than `net * rate` guarantees the two parts add back up
 * to the printed gross, which is what a tax auditor checks.
 */
function splitInclusive(gross: number, ratePercent: number): { net: number; tax: number } {
  if (ratePercent <= 0) { return { net: round(gross), tax: 0 }; }
  const net = round(gross / (1 + ratePercent / 100));
  return { net, tax: round(gross - net) };
}

/** Compute tax for a single line under the given regime. */
export function calcLineTax(item: TaxableItem, config: TaxConfig): LineTax {
  const discount = item.discount ?? 0;
  const gross = round(item.unit_price * item.qty - discount);

  if (config.mode === 'none') {
    return {
      taxableAmount: gross,
      cgstAmount: 0,
      sgstAmount: 0,
      taxAmount: 0,
      totalAmount: gross,
    };
  }

  if (config.mode === 'gst') {
    const cgstRate = item.cgst_rate ?? 0;
    const sgstRate = item.sgst_rate ?? 0;

    if (config.inclusive) {
      const { net, tax } = splitInclusive(gross, cgstRate + sgstRate);
      // Apportion the recovered tax across the two components by their rates
      // so the halves still sum to the whole.
      const totalRate = cgstRate + sgstRate;
      const cgstAmount = totalRate > 0 ? round(tax * (cgstRate / totalRate)) : 0;
      return {
        taxableAmount: net,
        cgstAmount,
        sgstAmount: round(tax - cgstAmount),
        taxAmount: tax,
        totalAmount: gross,
      };
    }

    const cgstAmount = round(gross * (cgstRate / 100));
    const sgstAmount = round(gross * (sgstRate / 100));
    const taxAmount = round(cgstAmount + sgstAmount);
    return {
      taxableAmount: gross,
      cgstAmount,
      sgstAmount,
      taxAmount,
      totalAmount: round(gross + taxAmount),
    };
  }

  // vat
  if (config.inclusive) {
    const { net, tax } = splitInclusive(gross, config.rate);
    return {
      taxableAmount: net,
      cgstAmount: 0,
      sgstAmount: 0,
      taxAmount: tax,
      totalAmount: gross,
    };
  }

  const taxAmount = round(gross * (config.rate / 100));
  return {
    taxableAmount: gross,
    cgstAmount: 0,
    sgstAmount: 0,
    taxAmount,
    totalAmount: round(gross + taxAmount),
  };
}

/**
 * Aggregate a bill.
 *
 * Each line is rounded before summing, matching what the receipt prints —
 * summing unrounded lines and rounding once at the end can leave the printed
 * line amounts a cent short of the printed total.
 */
export function calcBillTotals(items: TaxableItem[], config: TaxConfig): BillTotals {
  const lines = items.map((item) => calcLineTax(item, config));

  return {
    taxable_amount: sum(lines.map((l) => l.taxableAmount)),
    cgst_amount: sum(lines.map((l) => l.cgstAmount)),
    sgst_amount: sum(lines.map((l) => l.sgstAmount)),
    tax_amount: sum(lines.map((l) => l.taxAmount)),
    discount_amount: sum(items.map((i) => i.discount ?? 0)),
    total_amount: sum(lines.map((l) => l.totalAmount)),
  };
}

/**
 * Apply a bill-level discount after tax has been computed.
 *
 * Kept separate from the line discounts so the taxable base printed on the
 * receipt still matches the line items, which is what the original code did.
 */
export function applyBillDiscount(totals: BillTotals, discount: number): BillTotals {
  const amount = round(Math.max(0, Math.min(discount, totals.total_amount)));
  return {
    ...totals,
    discount_amount: round(totals.discount_amount + amount),
    total_amount: round(totals.total_amount - amount),
  };
}

/** Narrow an untrusted settings value to a `TaxMode`. */
export function toTaxMode(value: unknown): TaxMode {
  return value === 'gst' || value === 'none' || value === 'vat' ? value : DEFAULT_TAX_CONFIG.mode;
}
