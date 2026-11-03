import { ipcMain } from 'electron';
import { getDB } from '../db';
import { errMsg } from '../lib/errors';
import { getSettings } from '../lib/settings';
import { createBill } from '../services/billing';
import { applyBillDiscount, calcBillTotals, calcLineTax, type TaxableItem } from '../services/tax';

interface PaymentPayload {
  method: string;
  amount: number;
  reference?: string;
}

interface CreateBillPayload {
  orderId: number;
  payments: PaymentPayload[];
  discount?: number;
  customerId?: number;
}

interface PreviewPayload {
  orderId: number;
  discount?: number;
}

interface OrderItemRow extends TaxableItem {
  id: number;
  name: string;
}

export function registerBillingIPC() {
  /**
   * Compute the exact totals a bill *would* have, without writing anything.
   *
   * The bill dialog used to recompute tax in the renderer with a hardcoded
   * 2.5% + 2.5% GST split. That disagreed with the backend as soon as an item
   * carried different rates, the outlet moved to VAT, or prices were
   * tax-inclusive — so the cashier could take payment for a total the saved
   * bill did not match. The renderer now asks for the authoritative figures
   * instead of deriving its own.
   */
  ipcMain.handle('billing:preview', async (_, payload: PreviewPayload) => {
    try {
      const db = getDB();
      const settings = getSettings();

      const items = db
        .prepare('SELECT id, name, qty, unit_price, cgst_rate, sgst_rate, discount FROM order_items WHERE order_id = ?')
        .all(payload.orderId) as OrderItemRow[];

      const totals = applyBillDiscount(
        calcBillTotals(items, settings.tax),
        payload.discount ?? 0,
      );

      return {
        success: true,
        data: {
          totals,
          tax: settings.tax,
          // Per-line figures so the dialog can show a breakdown that adds up
          // to the same grand total.
          lines: items.map((item) => {
            const line = calcLineTax(item, settings.tax);
            return {
              id: item.id,
              name: item.name,
              qty: item.qty,
              unit_price: item.unit_price,
              taxable_amount: line.taxableAmount,
              tax_amount: line.taxAmount,
              cgst_amount: line.cgstAmount,
              sgst_amount: line.sgstAmount,
              total_amount: line.totalAmount,
            };
          }),
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('billing:createBill', async (_, payload: CreateBillPayload) => {
    try {
      const res = createBill(
        payload.orderId,
        payload.payments,
        payload.discount ?? 0,
        payload.customerId,
      );
      return { success: true, data: res };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('billing:getBill', async (_, payload: { orderId: number }) => {
    try {
      const db = getDB();
      const bill = db
        .prepare('SELECT * FROM bills WHERE order_id = ?')
        .get(payload.orderId) as Record<string, unknown> | undefined;
      return { success: true, data: bill ?? null };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
