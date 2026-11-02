import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '../../lib/settings';
import {
  escapeHtml,
  renderBill,
  renderKot,
  renderTestPage,
  type ReceiptBill,
  type ReceiptItem,
} from '../receipt';

function settings(over: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...over,
    outlet: { ...DEFAULT_SETTINGS.outlet, name: 'مطعم الأصيل', taxNumber: '300012345600003', ...over.outlet },
    print: { ...DEFAULT_SETTINGS.print, ...over.print },
    tax: { ...DEFAULT_SETTINGS.tax, ...over.tax },
    currency: { ...DEFAULT_SETTINGS.currency, ...over.currency },
  };
}

const bill: ReceiptBill = {
  bill_number: 'INV-2026-0042',
  taxable_amount: 100,
  tax_amount: 15,
  cgst_amount: 0,
  sgst_amount: 0,
  discount_amount: 0,
  total_amount: 115,
  tax_mode: 'vat',
  tax_rate: 15,
  created_at: '2026-03-01T10:00:00Z',
};

const items: ReceiptItem[] = [
  { name: 'كبسة لحم', qty: 2, unit_price: 40 },
  { name: 'Mint Lemonade', qty: 1, unit_price: 35 },
];

describe('escapeHtml', () => {
  it('escapes every character that could break the document', () => {
    expect(escapeHtml('<b>"x"&\'y\'</b>'))
      .toBe('&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;');
  });

  it('renders null and undefined as an empty string, not "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves Arabic text untouched', () => {
    expect(escapeHtml('كبسة لحم')).toBe('كبسة لحم');
  });

  it('escapes ampersands before the entities it produces', () => {
    // A naive ordering would turn "&" into "&amp;" after "<" became "&lt;",
    // double-escaping it into "&amp;lt;".
    expect(escapeHtml('a < b & c')).toBe('a &lt; b &amp; c');
  });
});

describe('renderBill — direction and language', () => {
  it('renders RTL Arabic by default', () => {
    const html = renderBill(bill, items, settings({ locale: 'ar' }));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('فاتورة ضريبية');
  });

  it('renders LTR English when the locale is English', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }));
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('Tax Invoice');
    expect(html).not.toContain('فاتورة ضريبية');
  });

  it('keeps item names in their own script regardless of locale', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }));
    expect(html).toContain('كبسة لحم');
    expect(html).toContain('Mint Lemonade');
  });

  it('isolates numbers so bidi cannot reorder them inside Arabic text', () => {
    const html = renderBill(bill, items, settings({ locale: 'ar' }));
    expect(html).toContain('unicode-bidi: plaintext');
  });
});

describe('renderBill — invoice title', () => {
  it('says "tax invoice" when a tax number is configured', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }));
    expect(html).toContain('Tax Invoice');
  });

  it('downgrades to "simplified invoice" with no tax number', () => {
    // Printing "Tax Invoice" without a registration number is incorrect.
    const html = renderBill(bill, items, settings({ locale: 'en', outlet: { ...DEFAULT_SETTINGS.outlet, taxNumber: '' } }));
    expect(html).toContain('Simplified Invoice');
    expect(html).not.toContain('Tax Invoice');
  });

  it('says plain "invoice" when no tax is charged', () => {
    const html = renderBill(
      { ...bill, tax_mode: 'none', tax_amount: 0 },
      items,
      settings({ locale: 'en', tax: { mode: 'none', rate: 0, inclusive: false } }),
    );
    expect(html).toContain('>Invoice<');
    expect(html).not.toContain('Tax Invoice');
  });

  it('omits the tax number entirely under the no-tax regime', () => {
    const html = renderBill(
      { ...bill, tax_mode: 'none' },
      items,
      settings({ locale: 'en', tax: { mode: 'none', rate: 0, inclusive: false } }),
    );
    expect(html).not.toContain('300012345600003');
  });
});

describe('renderBill — tax lines', () => {
  it('prints a single VAT line with its rate', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }));
    expect(html).toContain('VAT 15%');
    expect(html).not.toContain('CGST');
  });

  it('prints CGST and SGST under the GST regime', () => {
    const html = renderBill(
      { ...bill, tax_mode: 'gst', cgst_amount: 2.5, sgst_amount: 2.5, tax_amount: 5 },
      items,
      settings({ locale: 'en', tax: { mode: 'gst', rate: 0, inclusive: false } }),
    );
    expect(html).toContain('CGST');
    expect(html).toContain('SGST');
    expect(html).not.toContain('VAT');
  });

  it('uses the regime stored on the bill, not current settings', () => {
    // A reprint must reproduce the original document even after the outlet
    // switched regimes.
    const html = renderBill(
      { ...bill, tax_mode: 'gst', cgst_amount: 2.5, sgst_amount: 2.5 },
      items,
      settings({ locale: 'en', tax: { mode: 'vat', rate: 15, inclusive: true } }),
    );
    expect(html).toContain('CGST');
  });

  it('hides the breakdown when the outlet turns it off', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      print: { ...DEFAULT_SETTINGS.print, showTaxBreakdown: false },
    }));
    expect(html).not.toContain('VAT 15%');
    // The grand total is still printed.
    expect(html).toContain('Total');
  });

  it('notes inclusive pricing so the customer knows the total is final', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      tax: { mode: 'vat', rate: 15, inclusive: true },
    }));
    expect(html).toContain('Prices include tax');
  });

  it('omits the inclusive note when prices are tax-exclusive', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      tax: { mode: 'vat', rate: 15, inclusive: false },
    }));
    expect(html).not.toContain('Prices include tax');
  });
});

describe('renderBill — amounts', () => {
  it('formats money with the configured currency and decimals', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      currency: { code: 'AED', symbol: 'AED', decimals: 2, position: 'before' },
    }));
    expect(html).toContain('AED 115.00');
  });

  it('honours a zero-decimal currency', () => {
    const html = renderBill(
      { ...bill, total_amount: 1500 },
      items,
      settings({ locale: 'en', currency: { code: 'JPY', symbol: '¥', decimals: 0, position: 'before' } }),
    );
    expect(html).toContain('¥ 1,500');
  });

  it('prints the line total as qty x price minus the line discount', () => {
    const html = renderBill(bill, [{ name: 'X', qty: 2, unit_price: 40, discount: 10 }], settings({ locale: 'en' }));
    expect(html).toContain('70.00');
  });

  it('shows a discount line only when there is a discount', () => {
    expect(renderBill(bill, items, settings({ locale: 'en' }))).not.toContain('Discount');
    expect(renderBill({ ...bill, discount_amount: 10 }, items, settings({ locale: 'en' })))
      .toContain('Discount');
  });

  it('renders Arabic-Indic digits when that numeral system is selected', () => {
    const html = renderBill(bill, items, settings({ locale: 'ar', numerals: 'arab' }));
    expect(html).toMatch(/[٠-٩]/);
  });
});

describe('renderBill — payments', () => {
  it('lists each payment with a localised method name', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }), [
      { method: 'cash', amount: 100 },
      { method: 'card', amount: 15 },
    ]);
    expect(html).toContain('Cash');
    expect(html).toContain('Card');
  });

  it('translates method names into Arabic', () => {
    const html = renderBill(bill, items, settings({ locale: 'ar' }), [{ method: 'cash', amount: 115 }]);
    expect(html).toContain('نقدًا');
  });

  it('shows change due when the customer overpaid', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }), [{ method: 'cash', amount: 120 }]);
    expect(html).toContain('Change');
    expect(html).toContain('5.00');
  });

  it('omits change when the payment is exact', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }), [{ method: 'cash', amount: 115 }]);
    expect(html).not.toContain('Change');
  });

  it('falls back to the raw method name for an unknown method', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }), [{ method: 'crypto', amount: 115 }]);
    expect(html).toContain('crypto');
  });

  it('prints no payment block when none are supplied', () => {
    const html = renderBill(bill, items, settings({ locale: 'en' }));
    expect(html).not.toContain('Paid');
  });
});

describe('renderBill — paper profiles', () => {
  it('drops the unit-price column on a 58 mm roll', () => {
    // 58 mm leaves ~48 mm printable: name/qty/amount only.
    const html = renderBill(bill, items, settings({
      locale: 'en',
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '58mm' },
    }));
    expect(html).toContain('48mm');
    expect(html).not.toContain('>Price<');
  });

  it('keeps the unit-price column on an 80 mm roll', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '80mm' },
    }));
    expect(html).toContain('72mm');
    expect(html).toContain('>Price<');
  });

  it('uses page margins on A4 but none on a thermal roll', () => {
    const a4 = renderBill(bill, items, settings({
      print: { ...DEFAULT_SETTINGS.print, paperWidth: 'a4' },
    }));
    expect(a4).toContain('@page { margin: 10mm');

    const thermal = renderBill(bill, items, settings({
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '80mm' },
    }));
    expect(thermal).toContain('@page { margin: 0');
  });
});

describe('renderBill — outlet details', () => {
  it('prints the outlet name, address and phone when configured', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      outlet: { name: 'Al Aseel', address: 'King Fahd Rd', phone: '0551234567', taxNumber: '3000', logoPath: '' },
    }));
    expect(html).toContain('Al Aseel');
    expect(html).toContain('King Fahd Rd');
    expect(html).toContain('0551234567');
  });

  it('omits optional outlet lines that are blank rather than printing empty rows', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      outlet: { name: 'Al Aseel', address: '', phone: '', taxNumber: '', logoPath: '' },
    }));
    expect(html).not.toContain('Phone');
  });

  it('appends the configured receipt footer', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      print: { ...DEFAULT_SETTINGS.print, footerText: 'Follow us @alaseel' },
    }));
    expect(html).toContain('Follow us @alaseel');
  });

  it('escapes an outlet name containing markup', () => {
    const html = renderBill(bill, items, settings({
      locale: 'en',
      outlet: { ...DEFAULT_SETTINGS.outlet, name: '<script>x</script>' },
    }));
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderKot', () => {
  const kot = {
    items: [
      { name: 'كبسة لحم', qty: 2 },
      { name: 'Grilled Chicken', qty: 1, note: 'no salt' },
    ],
    tableName: '7',
    kotNumber: 3,
    createdAt: '2026-03-01T10:00:00Z',
  };

  it('renders a kitchen ticket in the active locale and direction', () => {
    const html = renderKot(kot, settings({ locale: 'ar' }));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('طلب المطبخ');
  });

  it('shows the ticket number and the table', () => {
    const html = renderKot(kot, settings({ locale: 'en' }));
    expect(html).toContain('Ticket No.');
    expect(html).toContain('Table');
    expect(html).toContain('7');
  });

  it('prints per-item notes, which is what the line cooks act on', () => {
    const html = renderKot(kot, settings({ locale: 'en' }));
    expect(html).toContain('no salt');
  });

  it('prints an order-level note when present', () => {
    const html = renderKot({ ...kot, orderNote: 'serve together' }, settings({ locale: 'en' }));
    expect(html).toContain('serve together');
  });

  it('carries no prices or tax — the kitchen has no use for them', () => {
    const html = renderKot(kot, settings({ locale: 'en' }));
    expect(html).not.toContain('VAT');
    expect(html).not.toContain('Total');
    expect(html).not.toContain('ر.س');
  });

  it('omits the ticket number line when there is none', () => {
    const html = renderKot({ ...kot, kotNumber: null }, settings({ locale: 'en' }));
    expect(html).not.toContain('Ticket No.');
  });

  it('still prints a ticket number of zero', () => {
    // `!= null` semantics: 0 is a real ticket number, not "absent".
    const html = renderKot({ ...kot, kotNumber: 0 }, settings({ locale: 'en' }));
    expect(html).toContain('Ticket No.');
  });

  it('escapes a table label containing markup', () => {
    const html = renderKot({ ...kot, tableName: '<b>7</b>' }, settings({ locale: 'en' }));
    expect(html).toContain('&lt;b&gt;7&lt;/b&gt;');
  });
});

describe('renderTestPage', () => {
  it('names the printer it was sent to', () => {
    const html = renderTestPage(settings({ locale: 'en' }), 'EPSON TM-T82');
    expect(html).toContain('EPSON TM-T82');
  });

  it('shows a dash when printing to the system default', () => {
    const html = renderTestPage(settings({ locale: 'en' }), '');
    expect(html).toContain('—');
  });

  it('prints both digit sets and both scripts so the operator can verify shaping', () => {
    const html = renderTestPage(settings({ locale: 'ar' }), 'X');
    expect(html).toContain('0 1 2 3 4 5 6 7 8 9');
    expect(html).toContain('٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩');
    expect(html).toContain('أبجد هوز حطي كلمن');
    expect(html).toContain('ABCDEFGHIJKLM');
  });

  it('states the configured paper size, which is the usual misconfiguration', () => {
    const html = renderTestPage(settings({
      locale: 'en',
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '58mm' },
    }), 'X');
    expect(html).toContain('58mm');
  });

  it('shows a sample amount with the configured currency', () => {
    const html = renderTestPage(settings({ locale: 'en' }), 'X');
    expect(html).toContain('1,234.56');
  });
});

describe('every document', () => {
  const docs = [
    renderBill(bill, items, settings()),
    renderKot({ items: [{ name: 'x', qty: 1 }], tableName: '1' }, settings()),
    renderTestPage(settings(), 'X'),
  ];

  it('is a complete, standalone HTML document', () => {
    for (const html of docs) {
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain('<meta charset="utf-8">');
      expect(html.trimEnd().endsWith('</html>')).toBe(true);
    }
  });

  it('forces exact colour so thermal heads do not drop grey text', () => {
    for (const html of docs) {
      expect(html).toContain('print-color-adjust: exact');
    }
  });

  it('uses tabular figures so amounts line up in a column', () => {
    for (const html of docs) {
      expect(html).toContain('tabular-nums');
    }
  });
});
