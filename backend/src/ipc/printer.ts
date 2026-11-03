import { ipcMain } from 'electron';
import { errMsg } from '../lib/errors';
import {
  listPrinters,
  previewBill,
  previewKot,
  printBill,
  printKOT,
  printTestPage,
  type PrintTarget,
} from '../services/printer';
import type { KotPayload, ReceiptBill, ReceiptItem, ReceiptPayment } from '../services/receipt';

interface BillPrintRequest {
  bill: ReceiptBill;
  orderItems: ReceiptItem[];
  payments?: ReceiptPayment[];
}

function toTarget(value: unknown): PrintTarget {
  return value === 'kitchen' ? 'kitchen' : 'receipt';
}

export function registerPrinterIPC() {
  ipcMain.handle('print:listPrinters', async () => {
    try {
      return { success: true, data: await listPrinters() };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('print:kot', async (_, payload: KotPayload) => {
    try {
      await printKOT(payload);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('print:bill', async (_, payload: BillPrintRequest) => {
    try {
      await printBill(payload.bill, payload.orderItems, payload.payments ?? []);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('print:test', async (_, payload?: { target?: string }) => {
    try {
      const printer = await printTestPage(toTarget(payload?.target));
      return { success: true, data: { printer } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /** Returns receipt HTML for the renderer to show in an iframe. */
  ipcMain.handle('print:previewBill', async (_, payload: BillPrintRequest) => {
    try {
      return {
        success: true,
        data: previewBill(payload.bill, payload.orderItems, payload.payments ?? []),
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('print:previewKot', async (_, payload: KotPayload) => {
    try {
      return { success: true, data: previewKot(payload) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
