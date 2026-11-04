import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../lib/settings';
import { renderBill, renderKot, type ReceiptBill, type ReceiptItem } from '../../receipt';
import {
  A4_MODEL,
  FONT_A_DOT_WIDTH,
  PRINTER_MODELS,
  UNKNOWN_MODEL,
  getModel,
  matchPrinter,
  validatePrinterModels,
} from '../models';
import { renderToText } from '../text';
import { PrinterBench, VirtualPrinter } from '../virtual';

function settings(over: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...over,
    outlet: {
      ...DEFAULT_SETTINGS.outlet,
      name: 'مطعم الأصيل',
      taxNumber: '300012345600003',
      ...over.outlet,
    },
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

describe('the model database', () => {
  it('has no duplicate ids, shared fragments or self-contradicting widths', () => {
    expect(validatePrinterModels()).toEqual([]);
  });

  it('covers the printers a small outlet actually buys', () => {
    const vendors = new Set(PRINTER_MODELS.map(m => m.vendor));
    for (const vendor of ['Epson', 'Star', 'Xprinter', 'Rongta', 'Bixolon']) {
      expect(vendors, vendor).toContain(vendor);
    }
  });

  it('derives the column count from the print head, not from the paper', () => {
    // Writing this as "80 mm means 48 columns" was wrong: the TM-T88V is an
    // 80 mm printer with a 512-dot head, which gives 42. Assuming 48 for it
    // would truncate every receipt on the right in production while the
    // harness looked fine — so the relationship asserted is the real one.
    for (const model of PRINTER_MODELS) {
      expect(model.charsPerLine, model.id)
        .toBe(Math.floor(model.dotsPerLine / FONT_A_DOT_WIDTH));
    }
  });

  it('has at least one 80 mm printer that is not 48 columns', () => {
    // Guards the rule above against being quietly weakened back into
    // "80 mm means 48" by a future edit that removes the exception.
    const narrowHead = PRINTER_MODELS.filter(
      m => m.paperWidth === '80mm' && m.charsPerLine !== 48,
    );
    expect(narrowHead.map(m => m.id)).toContain('epson-tm-t88v');
  });
});

describe('matchPrinter', () => {
  it('identifies a printer from the name an OS reports', () => {
    expect(matchPrinter('EPSON TM-T82 Receipt').model.id).toBe('epson-tm-t82');
    expect(matchPrinter('Star TSP143 (TSP100)').model.vendor).toBe('Star');
    expect(matchPrinter('XP-58IIH').model.id).toBe('xprinter-xp-58');
  });

  it('prefers the longest matching fragment', () => {
    // "TM-T88VI" contains "tm-t88v", so a first-match scan would pick the
    // wrong model — and the T88V has a narrower head.
    expect(matchPrinter('EPSON TM-T88VI Receipt').model.id).toBe('epson-tm-t88vi');
    expect(matchPrinter('EPSON TM-T88V Receipt').model.id).toBe('epson-tm-t88v');
  });

  it('is case-insensitive, since drivers are not consistent', () => {
    expect(matchPrinter('epson tm-t20ii').model.id).toBe('epson-tm-t20');
    expect(matchPrinter('EPSON TM-T20II').model.id).toBe('epson-tm-t20');
  });

  it('falls back to a generic profile from the width in the name', () => {
    expect(matchPrinter('POS-80 Printer').model.id).toBe('generic-80mm');
    expect(matchPrinter('58mm Series Printer').model.id).toBe('generic-58mm');
  });

  it('returns a usable shape rather than null when nothing matches', () => {
    // The caller always needs *some* shape to render against; `recognised`
    // says not to present it as a confident identification.
    const result = matchPrinter('Microsoft Print to PDF');
    expect(result.model).toBe(UNKNOWN_MODEL);
    expect(result.recognised).toBe(false);
    expect(result.matched).toBeNull();
    expect(result.model.charsPerLine).toBeGreaterThan(0);
  });

  it('says which fragment matched, so a wrong guess is explicable', () => {
    expect(matchPrinter('RONGTA RP80USE').matched).toBe('rp80');
  });

  it('resolves every model id it can return', () => {
    for (const model of PRINTER_MODELS) {
      expect(getModel(model.id), model.id).toBe(model);
    }
    expect(getModel(A4_MODEL.id)).toBe(A4_MODEL);
    expect(getModel(UNKNOWN_MODEL.id)).toBe(UNKNOWN_MODEL);
    expect(getModel('no-such-printer')).toBeUndefined();
  });
});

describe('renderToText', () => {
  it('renders a bill at 32 columns without overflowing', () => {
    // The whole point: a 58 mm roll is 32 characters, and this is how we
    // find out that a receipt does not fit without feeding paper into one.
    const html = renderBill(bill, items, settings({
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '58mm' },
    }));

    const paper = renderToText(html, { columns: 32 });
    expect(paper.overflowing).toEqual([]);
    expect(paper.unknown).toEqual([]);
    expect(paper.lines.length).toBeGreaterThan(10);
  });

  it('renders the same bill at 48 columns', () => {
    const html = renderBill(bill, items, settings({
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '80mm' },
    }));

    const paper = renderToText(html, { columns: 48 });
    expect(paper.overflowing).toEqual([]);
    expect(paper.unknown).toEqual([]);
  });

  it('carries the numbers that must appear on any width', () => {
    for (const [paperWidth, columns] of [['58mm', 32], ['80mm', 48], ['a4', 80]] as const) {
      const html = renderBill(bill, items, settings({
        print: { ...DEFAULT_SETTINGS.print, paperWidth },
      }));
      const paper = renderToText(html, { columns });

      expect(paper.text, paperWidth).toContain('INV-2026-0042');
      // The total, however the currency is formatted around it.
      expect(paper.text, paperWidth).toMatch(/115/);
      expect(paper.text, paperWidth).toContain('Mint Lemonade');
    }
  });

  it('drops the unit-price column on a narrow roll, and keeps it on a wide one', () => {
    const narrow = renderToText(
      renderBill(bill, items, settings({
        print: { ...DEFAULT_SETTINGS.print, paperWidth: '58mm' },
      })),
      { columns: 32 },
    );
    const wide = renderToText(
      renderBill(bill, items, settings({
        print: { ...DEFAULT_SETTINGS.print, paperWidth: '80mm' },
      })),
      { columns: 48 },
    );

    // The header row tells us how many columns the table has.
    const headerOf = (text: string) =>
      text.split('\n').find(line => line.includes('Item') || line.includes('الصنف')) ?? '';

    expect(headerOf(narrow.text).trim().split(/\s{2,}/).length).toBe(3);
    expect(headerOf(wide.text).trim().split(/\s{2,}/).length).toBe(4);
  });

  it('draws a rule across the full width', () => {
    const paper = renderToText(renderBill(bill, items, settings()), { columns: 32 });
    expect(paper.lines).toContain('-'.repeat(32));
    expect(paper.lines).toContain('='.repeat(32));
  });

  it('puts the label and the value on opposite edges', () => {
    const paper = renderToText(renderBill(bill, items, settings()), { columns: 48 });
    const totalLine = paper.lines.find(line => /^(Total|الإجمالي)/.test(line.trim()));
    expect(totalLine).toBeDefined();
    expect(totalLine!.length).toBeLessThanOrEqual(48);
  });

  it('keeps the value when a label is too long to fit beside it', () => {
    // On a receipt the number is the part that matters; a clipped total
    // would be a defect rather than a cosmetic problem.
    const html = '<body><div class="row"><span>A very long label indeed that will not fit</span><span class="num">1,234.56</span></div></body>';
    const paper = renderToText(html, { columns: 20 });
    expect(paper.lines[0]).toContain('1,234.56');
    expect(paper.lines[0].length).toBeLessThanOrEqual(20);
  });

  it('decodes the entities the renderer escapes', () => {
    const html = '<body><div class="center">Ali &amp; Sons &lt;Cafe&gt;</div></body>';
    expect(renderToText(html, { columns: 32 }).text).toContain('Ali & Sons <Cafe>');
  });

  it('mirrors alignment for right-to-left without reordering glyphs', () => {
    // Reordering Arabic here would produce text that looks right in a golden
    // file and wrong on paper — that is the printer's job.
    const html = '<body><div class="row"><span>الإجمالي</span><span>115.00</span></div></body>';
    const ltr = renderToText(html, { columns: 32 }).lines[0];
    const rtl = renderToText(html, { columns: 32, rtl: true }).lines[0];

    expect(ltr.startsWith('الإجمالي')).toBe(true);
    expect(rtl.startsWith('115.00')).toBe(true);
    expect(rtl).toContain('الإجمالي');
  });

  it('reports markup it does not understand rather than dropping it', () => {
    // A golden file that silently omits a block is worse than no golden file.
    const html = '<body><div class="mystery-block">Important</div></body>';
    const paper = renderToText(html, { columns: 32 });
    expect(paper.unknown).toContain('mystery-block');
    expect(paper.text).toContain('Important');
  });

  it('reports a line that overflows instead of hiding it', () => {
    const html = '<body><div class="row"><span>x</span><span>0123456789012345678901234567890123456789</span></div></body>';
    expect(renderToText(html, { columns: 20 }).overflowing).toEqual([0]);
  });

  it('renders a kitchen ticket too', () => {
    const html = renderKot(
      { items: [{ name: 'كبسة لحم', qty: 2, note: 'بدون بصل' }], tableName: 'T4', kotNumber: 7 },
      settings({ print: { ...DEFAULT_SETTINGS.print, paperWidth: '58mm' } }),
    );
    const paper = renderToText(html, { columns: 32 });
    expect(paper.overflowing).toEqual([]);
    expect(paper.text).toContain('T4');
  });
});

describe('VirtualPrinter', () => {
  let printer: VirtualPrinter;

  beforeEach(() => {
    printer = new VirtualPrinter({ name: 'Kitchen', modelId: 'xprinter-xp-58' });
  });

  it('takes its shape from the model', () => {
    expect(printer.model.charsPerLine).toBe(32);
    expect(printer.model.cutter).toBe(false);
  });

  it('falls back to a usable shape for an unknown model id', () => {
    expect(new VirtualPrinter({ name: 'X', modelId: 'nope' }).model).toBe(UNKNOWN_MODEL);
    expect(new VirtualPrinter('Plain').model).toBe(UNKNOWN_MODEL);
  });

  it('records what it was asked to print', () => {
    printer.accept({ target: 'kitchen', html: '<body></body>', printerName: 'Kitchen', copies: 1, silent: true });
    expect(printer.jobs).toHaveLength(1);
    expect(printer.lastJob?.target).toBe('kitchen');
    expect(printer.lastJob?.silent).toBe(true);
  });

  it('numbers jobs in order, so sequencing can be asserted', () => {
    printer.accept({ target: 'kitchen', html: '<body>a</body>', printerName: '', copies: 1, silent: true });
    printer.accept({ target: 'receipt', html: '<body>b</body>', printerName: '', copies: 1, silent: true });
    expect(printer.jobs.map(j => j.sequence)).toEqual([1, 2]);
  });

  it('separates jobs by target, which is how a misrouted ticket is caught', () => {
    // The mistake this finds: a chef receiving a customer's bill.
    printer.accept({ target: 'kitchen', html: '<body>a</body>', printerName: '', copies: 1, silent: true });
    printer.accept({ target: 'receipt', html: '<body>b</body>', printerName: '', copies: 1, silent: true });
    expect(printer.jobsFor('kitchen')).toHaveLength(1);
    expect(printer.jobsFor('test')).toHaveLength(0);
  });

  it('counts copies as sheets, which is what a roll spends', () => {
    printer.accept({ target: 'receipt', html: '<body></body>', printerName: '', copies: 2, silent: true });
    printer.accept({ target: 'receipt', html: '<body></body>', printerName: '', copies: 3, silent: true });
    expect(printer.jobs).toHaveLength(2);
    expect(printer.sheets).toBe(5);
  });

  it('can be made to fail once, so the offline path is testable', () => {
    // A printer that is switched off is the normal case during service.
    printer.failOnce('Printer is offline');
    expect(() => printer.accept({
      target: 'receipt', html: '<body></body>', printerName: '', copies: 1, silent: true,
    })).toThrow('Printer is offline');

    // And then recovers, rather than staying broken.
    expect(() => printer.accept({
      target: 'receipt', html: '<body></body>', printerName: '', copies: 1, silent: true,
    })).not.toThrow();
    expect(printer.jobs).toHaveLength(1);
  });

  it('renders the job it accepted on its own paper', () => {
    const html = renderBill(bill, items, settings({
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '58mm' },
    }));
    printer.accept({ target: 'receipt', html, printerName: 'Kitchen', copies: 1, silent: true });

    const paper = printer.paper();
    expect(paper).not.toBeNull();
    expect(paper!.model.charsPerLine).toBe(32);
    expect(paper!.overflowing).toEqual([]);
    expect(paper!.text).toContain('INV-2026-0042');
  });

  it('returns null for paper when nothing has been printed', () => {
    expect(printer.paper()).toBeNull();
  });

  it('clears', () => {
    printer.accept({ target: 'receipt', html: '<body></body>', printerName: '', copies: 1, silent: true });
    printer.clear();
    expect(printer.jobs).toHaveLength(0);
    expect(printer.sheets).toBe(0);
  });
});

describe('PrinterBench', () => {
  it('stands in for the printers attached to a till', () => {
    const bench = new PrinterBench();
    bench.add('Front', 'epson-tm-t82');
    bench.add('Kitchen', 'xprinter-xp-58');

    expect(bench.list().map(p => p.name)).toEqual(['Front', 'Kitchen']);
    expect(bench.list()[0].isDefault).toBe(true);
    expect(bench.list()[1].displayName).toBe('Xprinter XP-58');
  });

  it('treats an empty printer name as the default, as the real service does', () => {
    const bench = new PrinterBench();
    bench.add('Front', 'epson-tm-t82');
    bench.add('Kitchen', 'xprinter-xp-58');

    expect(bench.resolve('')?.name).toBe('Front');
    expect(bench.resolve('Kitchen')?.name).toBe('Kitchen');
    expect(bench.resolve('Nowhere')).toBeUndefined();
  });

  it('puts one bill through two different printers at once', () => {
    // The ask was to test more than one printer type without hardware. This
    // is it: the same document, two heads, two column counts.
    const bench = new PrinterBench();
    const wide = bench.add('Front', 'epson-tm-t82');
    const narrow = bench.add('Kitchen', 'xprinter-xp-58');

    const wideHtml = renderBill(bill, items, settings({
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '80mm' },
    }));
    const narrowHtml = renderBill(bill, items, settings({
      print: { ...DEFAULT_SETTINGS.print, paperWidth: '58mm' },
    }));

    wide.accept({ target: 'receipt', html: wideHtml, printerName: 'Front', copies: 1, silent: true });
    narrow.accept({ target: 'receipt', html: narrowHtml, printerName: 'Kitchen', copies: 1, silent: true });

    const widePaper = wide.paper()!;
    const narrowPaper = narrow.paper()!;

    expect(widePaper.model.charsPerLine).toBe(48);
    expect(narrowPaper.model.charsPerLine).toBe(32);
    expect(widePaper.overflowing).toEqual([]);
    expect(narrowPaper.overflowing).toEqual([]);

    // Both carry the bill number; only the wide one has room for unit price.
    expect(widePaper.text).toContain('INV-2026-0042');
    expect(narrowPaper.text).toContain('INV-2026-0042');
    expect(narrowPaper.lines.every(line => line.length <= 32)).toBe(true);
  });

  it('clears every printer on the bench', () => {
    const bench = new PrinterBench();
    const front = bench.add('Front', 'epson-tm-t82');
    front.accept({ target: 'receipt', html: '<body></body>', printerName: '', copies: 1, silent: true });
    bench.clear();
    expect(front.jobs).toHaveLength(0);
  });
});

describe('every bundled model, against a real bill', () => {
  it('fits a receipt without overflowing on any of them', () => {
    // A matrix run: the same bill against every profile in the database.
    // This is what "test more than one printer without hardware" buys.
    for (const model of [...PRINTER_MODELS, A4_MODEL, UNKNOWN_MODEL]) {
      const html = renderBill(bill, items, settings({
        print: { ...DEFAULT_SETTINGS.print, paperWidth: model.paperWidth },
      }));

      const paper = renderToText(html, { columns: model.charsPerLine });
      expect(paper.overflowing, `${model.id} overflowed`).toEqual([]);
      expect(paper.unknown, `${model.id} had unreadable markup`).toEqual([]);
      expect(paper.text, model.id).toContain('INV-2026-0042');
    }
  });

  it('fits a kitchen ticket on every one of them too', () => {
    for (const model of [...PRINTER_MODELS, A4_MODEL]) {
      const html = renderKot(
        {
          items: [
            { name: 'كبسة لحم مع الأرز والمكسرات', qty: 2, note: 'بدون بصل وبدون ثوم' },
            { name: 'Grilled Chicken Shawarma Platter', qty: 1 },
          ],
          tableName: 'Table 12',
          kotNumber: 142,
        },
        settings({ print: { ...DEFAULT_SETTINGS.print, paperWidth: model.paperWidth } }),
      );

      const paper = renderToText(html, { columns: model.charsPerLine });
      expect(paper.overflowing, `${model.id} overflowed`).toEqual([]);
      expect(paper.unknown, `${model.id} had unreadable markup`).toEqual([]);
    }
  });
});
