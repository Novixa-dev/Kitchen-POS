import { describe, expect, it } from 'vitest';
import {
  applyBillDiscount,
  calcBillTotals,
  calcLineTax,
  DEFAULT_TAX_CONFIG,
  toTaxMode,
  type TaxableItem,
  type TaxConfig,
} from '../tax';

const vatExclusive: TaxConfig = { mode: 'vat', rate: 15, inclusive: false };
const vatInclusive: TaxConfig = { mode: 'vat', rate: 15, inclusive: true };
const gstExclusive: TaxConfig = { mode: 'gst', rate: 0, inclusive: false };
const gstInclusive: TaxConfig = { mode: 'gst', rate: 0, inclusive: true };
const noTax: TaxConfig = { mode: 'none', rate: 0, inclusive: false };

const item = (over: Partial<TaxableItem> = {}): TaxableItem => ({
  unit_price: 100,
  qty: 1,
  cgst_rate: 2.5,
  sgst_rate: 2.5,
  ...over,
});

describe('defaults', () => {
  it('defaults to inclusive VAT, which is the Gulf norm', () => {
    expect(DEFAULT_TAX_CONFIG).toEqual({ mode: 'vat', rate: 15, inclusive: true });
  });
});

describe('toTaxMode', () => {
  it('accepts the three regimes', () => {
    expect(toTaxMode('vat')).toBe('vat');
    expect(toTaxMode('gst')).toBe('gst');
    expect(toTaxMode('none')).toBe('none');
  });

  it('falls back to the default for anything else', () => {
    expect(toTaxMode('bogus')).toBe('vat');
    expect(toTaxMode(undefined)).toBe('vat');
    expect(toTaxMode(15)).toBe('vat');
  });
});

describe('calcLineTax — no tax', () => {
  it('charges nothing and leaves the total at the net price', () => {
    const line = calcLineTax(item({ unit_price: 50, qty: 2 }), noTax);
    expect(line).toEqual({
      taxableAmount: 100,
      cgstAmount: 0,
      sgstAmount: 0,
      taxAmount: 0,
      totalAmount: 100,
    });
  });

  it('still honours the line discount', () => {
    const line = calcLineTax(item({ unit_price: 50, qty: 2, discount: 10 }), noTax);
    expect(line.taxableAmount).toBe(90);
    expect(line.totalAmount).toBe(90);
  });
});

describe('calcLineTax — VAT exclusive', () => {
  it('adds the rate on top of the net price', () => {
    const line = calcLineTax(item({ unit_price: 100, qty: 1 }), vatExclusive);
    expect(line.taxableAmount).toBe(100);
    expect(line.taxAmount).toBe(15);
    expect(line.totalAmount).toBe(115);
  });

  it('multiplies by quantity before taxing', () => {
    const line = calcLineTax(item({ unit_price: 20, qty: 3 }), vatExclusive);
    expect(line.taxableAmount).toBe(60);
    expect(line.taxAmount).toBe(9);
    expect(line.totalAmount).toBe(69);
  });

  it('taxes the post-discount amount', () => {
    const line = calcLineTax(item({ unit_price: 100, qty: 1, discount: 20 }), vatExclusive);
    expect(line.taxableAmount).toBe(80);
    expect(line.taxAmount).toBe(12);
    expect(line.totalAmount).toBe(92);
  });

  it('leaves the CGST/SGST columns empty under VAT', () => {
    const line = calcLineTax(item(), vatExclusive);
    expect(line.cgstAmount).toBe(0);
    expect(line.sgstAmount).toBe(0);
  });
});

describe('calcLineTax — VAT inclusive', () => {
  it('backs the tax out of the displayed price', () => {
    // 115 inclusive of 15% -> net 100, tax 15.
    const line = calcLineTax(item({ unit_price: 115, qty: 1 }), vatInclusive);
    expect(line.taxableAmount).toBe(100);
    expect(line.taxAmount).toBe(15);
    expect(line.totalAmount).toBe(115);
  });

  it('never changes the price the customer was shown', () => {
    const line = calcLineTax(item({ unit_price: 33.33, qty: 3 }), vatInclusive);
    expect(line.totalAmount).toBe(99.99);
  });

  it('keeps net + tax equal to the printed gross', () => {
    // The auditable property: the two printed parts must add back up.
    for (const price of [1, 7.77, 19.99, 100, 123.45, 999.99]) {
      const line = calcLineTax(item({ unit_price: price, qty: 1 }), vatInclusive);
      expect(line.taxableAmount + line.taxAmount).toBeCloseTo(line.totalAmount, 10);
    }
  });

  it('charges no tax when the rate is zero', () => {
    const line = calcLineTax(item({ unit_price: 100 }), { ...vatInclusive, rate: 0 });
    expect(line.taxAmount).toBe(0);
    expect(line.taxableAmount).toBe(100);
  });

  it('applies the discount before splitting out the tax', () => {
    const line = calcLineTax(item({ unit_price: 115, qty: 2, discount: 115 }), vatInclusive);
    expect(line.totalAmount).toBe(115);
    expect(line.taxableAmount).toBe(100);
    expect(line.taxAmount).toBe(15);
  });
});

describe('calcLineTax — GST exclusive', () => {
  it('splits the tax into CGST and SGST from the item rates', () => {
    const line = calcLineTax(item({ unit_price: 100, cgst_rate: 2.5, sgst_rate: 2.5 }), gstExclusive);
    expect(line.taxableAmount).toBe(100);
    expect(line.cgstAmount).toBe(2.5);
    expect(line.sgstAmount).toBe(2.5);
    expect(line.taxAmount).toBe(5);
    expect(line.totalAmount).toBe(105);
  });

  it('supports asymmetric rates', () => {
    const line = calcLineTax(item({ unit_price: 200, cgst_rate: 9, sgst_rate: 9 }), gstExclusive);
    expect(line.cgstAmount).toBe(18);
    expect(line.sgstAmount).toBe(18);
    expect(line.totalAmount).toBe(236);
  });

  it('treats missing item rates as zero rather than NaN', () => {
    const line = calcLineTax(
      { unit_price: 100, qty: 1 },
      gstExclusive,
    );
    expect(line.taxAmount).toBe(0);
    expect(line.totalAmount).toBe(100);
  });

  it('ignores the VAT rate setting', () => {
    const line = calcLineTax(item({ unit_price: 100 }), { ...gstExclusive, rate: 99 });
    expect(line.taxAmount).toBe(5);
  });
});

describe('calcLineTax — GST inclusive', () => {
  it('apportions the recovered tax across both components', () => {
    // 105 inclusive of 2.5% + 2.5% -> net 100, tax 5, split evenly.
    const line = calcLineTax(item({ unit_price: 105, cgst_rate: 2.5, sgst_rate: 2.5 }), gstInclusive);
    expect(line.taxableAmount).toBe(100);
    expect(line.cgstAmount).toBe(2.5);
    expect(line.sgstAmount).toBe(2.5);
    expect(line.taxAmount).toBe(5);
    expect(line.totalAmount).toBe(105);
  });

  it('keeps the two halves summing to the whole tax', () => {
    const line = calcLineTax(item({ unit_price: 77.77, cgst_rate: 6, sgst_rate: 6 }), gstInclusive);
    expect(line.cgstAmount + line.sgstAmount).toBeCloseTo(line.taxAmount, 10);
  });

  it('charges no tax when both item rates are zero', () => {
    const line = calcLineTax(item({ unit_price: 100, cgst_rate: 0, sgst_rate: 0 }), gstInclusive);
    expect(line.taxAmount).toBe(0);
    expect(line.taxableAmount).toBe(100);
    expect(line.totalAmount).toBe(100);
  });
});

describe('calcBillTotals', () => {
  it('aggregates every column across lines', () => {
    const totals = calcBillTotals(
      [
        item({ unit_price: 100, qty: 1 }),
        item({ unit_price: 50, qty: 2, discount: 10 }),
      ],
      vatExclusive,
    );
    expect(totals.taxable_amount).toBe(190);
    expect(totals.tax_amount).toBe(28.5);
    expect(totals.discount_amount).toBe(10);
    expect(totals.total_amount).toBe(218.5);
  });

  it('returns zeroes for an empty bill rather than NaN', () => {
    expect(calcBillTotals([], vatExclusive)).toEqual({
      taxable_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 0,
    });
  });

  it('keeps the printed line totals summing to the printed bill total', () => {
    // Lines are rounded before summing, so the receipt adds up for a cashier
    // checking it by hand.
    const items = Array.from({ length: 7 }, (_, i) => item({ unit_price: 3.33 + i, qty: 3 }));
    const totals = calcBillTotals(items, vatInclusive);
    const lineSum = items
      .map((i) => calcLineTax(i, vatInclusive).totalAmount)
      .reduce((a, b) => a + b, 0);
    expect(totals.total_amount).toBeCloseTo(lineSum, 10);
  });

  it('sums the rounded line totals, so the receipt adds up by hand', () => {
    // Verified end to end against a real database: two lines at 100x2 and
    // 15x1 under 2.5% + 2.5% GST come to 225.76, not 225.75. Each half of the
    // 15.00 line rounds 0.375 -> 0.38, and rounding once at the end
    // (215 x 1.05) would leave the printed total a cent short of its own
    // printed line items.
    const bill = [item({ unit_price: 100, qty: 2 }), item({ unit_price: 15, qty: 1 })];
    const totals = calcBillTotals(bill, gstExclusive);

    expect(totals.total_amount).toBe(225.76);
    expect(
      bill.map(i => calcLineTax(i, gstExclusive).totalAmount).reduce((a, b) => a + b, 0),
    ).toBeCloseTo(totals.total_amount, 10);
  });

  it('keeps the two GST halves summing to the whole across odd amounts', () => {
    const totals = calcBillTotals(
      [item({ unit_price: 15, qty: 1 }), item({ unit_price: 7.77, qty: 3 })],
      gstExclusive,
    );
    expect(totals.cgst_amount + totals.sgst_amount).toBeCloseTo(totals.tax_amount, 10);
  });

  it('keeps taxable + tax equal to the total under inclusive VAT', () => {
    const totals = calcBillTotals(
      [item({ unit_price: 19.99, qty: 3 }), item({ unit_price: 7.5, qty: 1 })],
      vatInclusive,
    );
    expect(totals.taxable_amount + totals.tax_amount).toBeCloseTo(totals.total_amount, 2);
  });

  it('reports CGST and SGST only under the GST regime', () => {
    const gst = calcBillTotals([item({ unit_price: 100 })], gstExclusive);
    expect(gst.cgst_amount).toBe(2.5);

    const vat = calcBillTotals([item({ unit_price: 100 })], vatExclusive);
    expect(vat.cgst_amount).toBe(0);
    expect(vat.sgst_amount).toBe(0);
  });
});

describe('applyBillDiscount', () => {
  const base = () => calcBillTotals([item({ unit_price: 100, qty: 1 })], vatExclusive);

  it('reduces the total and records the discount', () => {
    const totals = applyBillDiscount(base(), 15);
    expect(totals.total_amount).toBe(100);
    expect(totals.discount_amount).toBe(15);
  });

  it('leaves the taxable base untouched, so it still matches the line items', () => {
    const totals = applyBillDiscount(base(), 15);
    expect(totals.taxable_amount).toBe(100);
    expect(totals.tax_amount).toBe(15);
  });

  it('is a no-op for a zero discount', () => {
    expect(applyBillDiscount(base(), 0)).toEqual(base());
  });

  it('never produces a negative total', () => {
    const totals = applyBillDiscount(base(), 10_000);
    expect(totals.total_amount).toBe(0);
    expect(totals.discount_amount).toBe(115);
  });

  it('ignores a negative discount instead of inflating the bill', () => {
    const totals = applyBillDiscount(base(), -50);
    expect(totals.total_amount).toBe(115);
    expect(totals.discount_amount).toBe(0);
  });

  it('adds to, rather than replaces, the line discounts', () => {
    const withLineDiscount = calcBillTotals(
      [item({ unit_price: 100, qty: 1, discount: 10 })],
      vatExclusive,
    );
    const totals = applyBillDiscount(withLineDiscount, 5);
    expect(totals.discount_amount).toBe(15);
  });
});
