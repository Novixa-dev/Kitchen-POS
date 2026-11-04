/**
 * The printer test bench, exposed to the UI.
 *
 * The harness in `services/printing` exists so the test suite can check a
 * receipt against a dozen printers with nothing plugged in. This makes the
 * same thing available to whoever is setting a till up: choose a model, see
 * the receipt as that printer would lay it out, and find out that the outlet
 * name does not fit a 58 mm roll *before* a customer is handed one.
 *
 * It renders the outlet's real settings, not a canned sample, so what is
 * previewed is what would print.
 */

import { ipcMain } from 'electron';
import { errMsg } from '../lib/errors';
import { getSettings } from '../lib/settings';
import {
  A4_MODEL,
  PRINTER_MODELS,
  UNKNOWN_MODEL,
  getModel,
  matchPrinter,
} from '../services/printing/models';
import { VirtualPrinter, type PrintTarget } from '../services/printing/virtual';
import {
  renderBill,
  renderKot,
  renderTestPage,
  type ReceiptBill,
  type ReceiptItem,
} from '../services/receipt';

/**
 * A representative bill.
 *
 * Deliberately awkward: a long Arabic name, a long Latin one, a discount and
 * a second payment line. A sample that fits easily tells you nothing.
 */
const SAMPLE_BILL: ReceiptBill = {
  bill_number: 'INV-2026-0042',
  taxable_amount: 100,
  tax_amount: 15,
  cgst_amount: 7.5,
  sgst_amount: 7.5,
  discount_amount: 5,
  total_amount: 110,
  created_at: new Date().toISOString(),
};

const SAMPLE_ITEMS: ReceiptItem[] = [
  { name: 'كبسة لحم مع الأرز والمكسرات', qty: 2, unit_price: 40 },
  { name: 'Grilled Chicken Shawarma Platter', qty: 1, unit_price: 35 },
  { name: 'شاي', qty: 3, unit_price: 5, discount: 5 },
];

function isTarget(value: unknown): value is PrintTarget {
  return value === 'receipt' || value === 'kitchen' || value === 'test';
}

export function registerPrinterBenchIPC() {
  /** Every model the app can render against, plus the two fallbacks. */
  ipcMain.handle('printer:models', async () => {
    try {
      return {
        success: true,
        data: { models: [...PRINTER_MODELS, A4_MODEL, UNKNOWN_MODEL] },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Identify an attached printer by the name the OS reports.
   *
   * This is the detection half: it says which model the name looks like and
   * which fragment matched, so a wrong guess is explicable rather than
   * mysterious. It does not install anything — see `models.ts`.
   */
  ipcMain.handle('printer:identify', async (_, payload: unknown) => {
    try {
      const name = typeof payload === 'string'
        ? payload
        : (payload as { name?: unknown } | null)?.name;

      if (typeof name !== 'string' || name.trim() === '') {
        return { success: false, error: 'A printer name is required.' };
      }

      const result = matchPrinter(name);
      return {
        success: true,
        data: {
          model: result.model,
          matched: result.matched,
          recognised: result.recognised,
          /** The paper width to apply if the operator accepts the match. */
          suggestedPaperWidth: result.model.paperWidth,
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Lay a document out as a given printer would, without printing.
   *
   * The paper width comes from the model rather than from settings, which is
   * the point: it answers "what would this look like on *that* printer"
   * without changing how the till is configured.
   */
  ipcMain.handle('printer:virtualPreview', async (_, payload: unknown) => {
    try {
      const { modelId, target } = (payload ?? {}) as { modelId?: unknown; target?: unknown };

      const model = typeof modelId === 'string' ? getModel(modelId) : undefined;
      if (!model) { return { success: false, error: 'Unknown printer model.' }; }

      const chosen: PrintTarget = isTarget(target) ? target : 'receipt';

      // The outlet's own settings, with only the paper width swapped for the
      // model being previewed — so the name, tax number, footer and currency
      // are the real ones.
      const settings = getSettings();
      const asModel = {
        ...settings,
        print: { ...settings.print, paperWidth: model.paperWidth },
      };

      let html: string;
      if (chosen === 'kitchen') {
        html = renderKot(
          {
            items: SAMPLE_ITEMS.map(item => ({
              name: item.name,
              qty: item.qty,
              note: item.name.startsWith('كبسة') ? 'بدون بصل' : null,
            })),
            tableName: 'Table 12',
            kotNumber: 142,
            createdAt: new Date(),
          },
          asModel,
        );
      } else if (chosen === 'test') {
        html = renderTestPage(asModel, `${model.vendor} ${model.model}`);
      } else {
        html = renderBill(SAMPLE_BILL, SAMPLE_ITEMS, asModel, [
          { method: 'cash', amount: 100 },
          { method: 'card', amount: 10 },
        ]);
      }

      // Through the virtual printer, so this exercises the same path the
      // test suite does rather than a parallel one that could drift.
      const printer = new VirtualPrinter({ name: 'preview', modelId: model.id });
      printer.accept({
        target: chosen,
        html,
        printerName: 'preview',
        copies: 1,
        silent: true,
      });

      const paper = printer.paper(-1, { rtl: settings.locale === 'ar' });
      if (!paper) { return { success: false, error: 'Nothing was rendered.' }; }

      return {
        success: true,
        data: {
          model,
          target: chosen,
          columns: model.charsPerLine,
          lines: paper.lines,
          text: paper.text,
          /** Non-empty means the layout does not fit this printer. */
          overflowing: paper.overflowing,
          /** Non-empty means a word had to be broken across lines. */
          hardSplit: paper.hardSplit,
          /** Non-empty means the renderer met markup it cannot lay out. */
          unknown: paper.unknown,
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
