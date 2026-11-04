/**
 * Printing driver.
 *
 * Renders a document in an offscreen `BrowserWindow` and hands it to the OS
 * print pipeline. See `receipt.ts` for why HTML rather than raw ESC/POS.
 *
 * What changed from the original implementation, and why it mattered:
 *  - The window was created with `show: true`, so a blank window flashed on
 *    screen on every print.
 *  - `silent: false` was hardcoded, so a print dialog opened for *every* KOT
 *    and every bill. At service speed that is unusable.
 *  - There was no way to choose a printer, so the kitchen ticket and the
 *    customer bill both went to the system default.
 */

import { BrowserWindow } from 'electron';
import { errMsg } from '../lib/errors';
import { getSettings, type AppSettings } from '../lib/settings';
import {
  renderBill,
  renderKot,
  renderTestPage,
  type KotPayload,
  type ReceiptBill,
  type ReceiptItem,
  type ReceiptPayment,
} from './receipt';

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  status: number;
}

/** Which configured printer a document should go to. */
export type PrintTarget = 'receipt' | 'kitchen';

interface PrintRequest {
  html: string;
  /** OS printer name; '' means the system default. */
  deviceName: string;
  copies: number;
  silent: boolean;
  /** A4 keeps the printable-area margins; thermal rolls need none. */
  useMargins: boolean;
}

/** A print must never hang the UI thread forever. */
const SILENT_TIMEOUT_MS = 30_000;
/** With a dialog open the operator may take a while. */
const DIALOG_TIMEOUT_MS = 5 * 60_000;

/**
 * List the printers the OS exposes.
 *
 * Requires a window: `getPrintersAsync` lives on `webContents`. A hidden
 * throwaway window is used when none is open, which happens when the list is
 * requested from the setup wizard.
 */
export async function listPrinters(): Promise<PrinterInfo[]> {
  const existing = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  const temporary = existing
    ? null
    : new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  const win = existing ?? temporary;

  if (!win) { return []; }

  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description,
      isDefault: p.isDefault,
      status: p.status,
    }));
  } finally {
    if (temporary && !temporary.isDestroyed()) { temporary.destroy(); }
  }
}

/**
 * Render `html` offscreen and print it.
 *
 * The window is offscreen rather than merely `show: false` so it never
 * appears in the taskbar or steals focus mid-service.
 */
async function printHtml(request: PrintRequest): Promise<void> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      // Nothing in a receipt needs Node, and the HTML embeds user-entered
      // item names.
      nodeIntegration: false,
      contextIsolation: true,
      javascript: false,
    },
  });

  const destroy = () => { if (!win.isDestroyed()) { win.destroy(); } };

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => { reject(new Error('The print request timed out.')); },
        request.silent ? SILENT_TIMEOUT_MS : DIALOG_TIMEOUT_MS,
      );

      win.webContents.once('did-fail-load', (_e, _code, description) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to render the document: ${description}`));
      });

      win.webContents.once('did-finish-load', () => {
        win.webContents.print(
          {
            silent: request.silent,
            printBackground: true,
            color: false,
            copies: request.copies,
            // An empty deviceName lets Electron use the system default.
            ...(request.deviceName ? { deviceName: request.deviceName } : {}),
            margins: request.useMargins
              ? { marginType: 'printableArea' }
              : { marginType: 'none' },
          },
          (success, failureReason) => {
            clearTimeout(timeout);
            if (success) {
              resolve();
              return;
            }
            // Cancelling the dialog is a deliberate choice, not a failure.
            if (failureReason === 'cancelled' || failureReason === 'Print job canceled') {
              resolve();
              return;
            }
            reject(new Error(failureReason || 'The printer rejected the job.'));
          },
        );
      });

      void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(request.html)}`);
    });
  } finally {
    destroy();
  }
}

function targetPrinter(settings: AppSettings, target: PrintTarget): string {
  return target === 'kitchen'
    ? settings.print.kitchenPrinter || settings.print.receiptPrinter
    : settings.print.receiptPrinter;
}

async function send(html: string, target: PrintTarget, settings: AppSettings): Promise<void> {
  await printHtml({
    html,
    deviceName: targetPrinter(settings, target),
    // The kitchen only ever needs one ticket; the copies setting is for bills.
    copies: target === 'kitchen' ? 1 : settings.print.copies,
    silent: settings.print.silent,
    useMargins: settings.print.paperWidth === 'a4',
  });
}

export async function printBill(
  bill: ReceiptBill,
  items: ReceiptItem[],
  payments: ReceiptPayment[] = [],
): Promise<void> {
  const settings = getSettings();
  // The outlet's own template, which `getSettings` has already validated.
  await send(renderBill(bill, items, settings, payments, settings.templates.bill), 'receipt', settings);
}

export async function printKOT(payload: KotPayload): Promise<void> {
  const settings = getSettings();
  await send(renderKot(payload, settings), 'kitchen', settings);
}

export async function printTestPage(target: PrintTarget = 'receipt'): Promise<string> {
  const settings = getSettings();
  const deviceName = targetPrinter(settings, target);
  const html = renderTestPage(settings, deviceName);

  await printHtml({
    html,
    deviceName,
    copies: 1,
    // Always show the dialog for a test page: if the configured printer is
    // wrong, a silent job vanishes with no clue where it went.
    silent: false,
    useMargins: settings.print.paperWidth === 'a4',
  });

  return deviceName;
}

/** HTML for the renderer's on-screen preview — nothing is sent to a printer. */
export function previewBill(
  bill: ReceiptBill,
  items: ReceiptItem[],
  payments: ReceiptPayment[] = [],
): string {
  const settings = getSettings();
  return renderBill(bill, items, settings, payments, settings.templates.bill);
}

export function previewKot(payload: KotPayload): string {
  return renderKot(payload, getSettings());
}

export { errMsg };
