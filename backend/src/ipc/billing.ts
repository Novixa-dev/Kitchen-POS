import { ipcMain } from 'electron';
import { getDB } from '../db';
import { errMsg } from '../lib/errors';
import { createBill } from '../services/billing';
import { priceOrder } from '../services/pricing';

interface PaymentPayload {
  method: string;
  amount: number;
  reference?: string;
}

/** What the cashier chose beyond the payments: offers, codes, loyalty. */
interface OfferChoices {
  promotionIds?: number[];
  couponCodes?: string[];
  useLoyalty?: boolean;
}

interface CreateBillPayload extends OfferChoices {
  orderId: number;
  payments: PaymentPayload[];
  discount?: number;
  customerId?: number;
}

interface PreviewPayload extends OfferChoices {
  orderId: number;
  discount?: number;
  customerId?: number;
}

/** Only the ids and codes are taken from the payload, never an amount. */
function choices(payload: OfferChoices): OfferChoices {
  return {
    promotionIds: Array.isArray(payload.promotionIds)
      ? payload.promotionIds.filter(id => Number.isInteger(id))
      : [],
    couponCodes: Array.isArray(payload.couponCodes)
      ? payload.couponCodes.filter(c => typeof c === 'string').slice(0, 5)
      : [],
    useLoyalty: payload.useLoyalty === true,
  };
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
      // The same function that prices the sale, so the dialog and the saved
      // bill cannot round differently or disagree about which offers applied.
      const priced = priceOrder({
        orderId: payload.orderId,
        manualDiscount: payload.discount ?? 0,
        customerId: payload.customerId ?? null,
        ...choices(payload),
      });

      return { success: true, data: priced };
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
        choices(payload),
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
