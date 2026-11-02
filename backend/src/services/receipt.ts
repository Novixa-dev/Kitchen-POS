/**
 * Receipt and kitchen-ticket rendering.
 *
 * Receipts are HTML rendered by Chromium and sent through the OS print
 * pipeline. That choice is deliberate:
 *
 *  - It works with **every** printer the operating system can see — thermal
 *    USB, network, Bluetooth, A4 laser — with no vendor SDK and no driver
 *    bypass.
 *  - Chromium shapes and bidi-orders Arabic correctly. Raw ESC/POS cannot:
 *    thermal firmware ships inconsistent Arabic code pages, and getting
 *    presentation forms right by hand means pre-shaping the text yourself.
 *
 * This module is pure — it takes a resolved context and returns a string — so
 * the output can be asserted in unit tests without launching Electron.
 */

import { formatCurrency, formatDateTime, formatNumber, type FormatOptions } from '../lib/format';
import type { AppSettings, Locale, PaperWidth } from '../lib/settings';
import type { TaxMode } from './tax';

// ── copy ────────────────────────────────────────────────────────────────────

/**
 * Receipt strings live here rather than in the renderer's dictionary: the
 * main process prints reprints and scheduled documents with no window open.
 */
const RECEIPT_COPY = {
  ar: {
    taxInvoice: 'فاتورة ضريبية',
    simplifiedInvoice: 'فاتورة مبسطة',
    invoice: 'فاتورة',
    billNo: 'رقم الفاتورة',
    date: 'التاريخ',
    taxNumber: 'الرقم الضريبي',
    phone: 'هاتف',
    item: 'الصنف',
    qty: 'الكمية',
    price: 'السعر',
    amount: 'المبلغ',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    taxable: 'الوعاء الضريبي',
    total: 'الإجمالي',
    paid: 'المدفوع',
    change: 'المتبقي للعميل',
    thankYou: 'شكرًا لزيارتكم',
    kot: 'طلب المطبخ',
    kotNumber: 'رقم الطلب',
    table: 'الطاولة',
    note: 'ملاحظة',
    endOfTicket: 'نهاية الطلب',
    testPrint: 'صفحة طباعة تجريبية',
    testPrintBody: 'إذا ظهر هذا النص بوضوح فإن الطابعة مهيّأة بشكل صحيح.',
    printer: 'الطابعة',
    paper: 'مقاس الورق',
    vat: 'ضريبة القيمة المضافة',
    gst: 'ضريبة السلع والخدمات',
    cgst: 'الضريبة المركزية',
    sgst: 'ضريبة الولاية',
    inclusive: 'الأسعار شاملة الضريبة',
    cash: 'نقدًا',
    card: 'بطاقة',
    upi: 'UPI',
    wallet: 'محفظة',
    complimentary: 'ضيافة',
    unpaid: 'على الحساب',
  },
  en: {
    taxInvoice: 'Tax Invoice',
    simplifiedInvoice: 'Simplified Invoice',
    invoice: 'Invoice',
    billNo: 'Bill No.',
    date: 'Date',
    taxNumber: 'Tax No.',
    phone: 'Phone',
    item: 'Item',
    qty: 'Qty',
    price: 'Price',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    taxable: 'Taxable',
    total: 'Total',
    paid: 'Paid',
    change: 'Change',
    thankYou: 'Thank you for your visit',
    kot: 'Kitchen Order',
    kotNumber: 'Ticket No.',
    table: 'Table',
    note: 'Note',
    endOfTicket: 'End of ticket',
    testPrint: 'Printer Test Page',
    testPrintBody: 'If you can read this clearly, the printer is set up correctly.',
    printer: 'Printer',
    paper: 'Paper size',
    vat: 'VAT',
    gst: 'GST',
    cgst: 'CGST',
    sgst: 'SGST',
    inclusive: 'Prices include tax',
    cash: 'Cash',
    card: 'Card',
    upi: 'UPI',
    wallet: 'Wallet',
    complimentary: 'Complimentary',
    unpaid: 'On account',
  },
} as const;

/** The shape every locale must supply, widened from the literal strings. */
type Copy = Record<keyof (typeof RECEIPT_COPY)['en'], string>;

// ── paper profiles ──────────────────────────────────────────────────────────

interface PaperProfile {
  /** Printable width. Thermal rolls lose ~4 mm to the margins. */
  width: string;
  bodyFontSize: string;
  headingFontSize: string;
  totalFontSize: string;
  padding: string;
  /** Whether there is room for a per-unit price column. */
  showUnitPrice: boolean;
}

const PAPER: Record<PaperWidth, PaperProfile> = {
  // 58 mm rolls have ~48 mm of printable width — barely enough for
  // name/qty/amount, so the unit-price column is dropped.
  '58mm': {
    width: '48mm',
    bodyFontSize: '10px',
    headingFontSize: '13px',
    totalFontSize: '13px',
    padding: '0',
    showUnitPrice: false,
  },
  '80mm': {
    width: '72mm',
    bodyFontSize: '12px',
    headingFontSize: '16px',
    totalFontSize: '15px',
    padding: '0',
    showUnitPrice: true,
  },
  a4: {
    width: '180mm',
    bodyFontSize: '13px',
    headingFontSize: '22px',
    totalFontSize: '17px',
    padding: '12mm',
    showUnitPrice: true,
  },
};

// ── payloads ────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  name: string;
  qty: number;
  unit_price: number;
  discount?: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
}

export interface ReceiptBill {
  bill_number: string;
  taxable_amount: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  discount_amount: number;
  total_amount: number;
  tax_mode?: TaxMode | null;
  tax_rate?: number | null;
  created_at?: string;
  date?: string;
}

export interface KotPayload {
  items: { name: string; qty: number; note?: string | null }[];
  tableName: string;
  orderNote?: string;
  kotNumber?: number | null;
  orderType?: string;
  createdAt?: string | Date;
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape text before interpolation.
 *
 * Item names, table labels and notes are user-entered and end up inside a
 * `data:` URL, so an unescaped `<` would corrupt the document — or inject
 * markup into it.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyFor(locale: Locale): Copy {
  return RECEIPT_COPY[locale];
}

function formatOptions(settings: AppSettings): FormatOptions {
  return {
    locale: settings.locale,
    numerals: settings.numerals,
    currency: settings.currency,
  };
}

function paymentLabel(method: string, copy: Copy): string {
  switch (method) {
    case 'cash': return copy.cash;
    case 'card': return copy.card;
    case 'upi': return copy.upi;
    case 'wallet': return copy.wallet;
    case 'complimentary': return copy.complimentary;
    case 'unpaid': return copy.unpaid;
    default: return method;
  }
}

/**
 * The stylesheet shared by every document.
 *
 * `@page { margin: 0 }` plus a fixed body width is what makes a thermal roll
 * print edge-to-edge instead of being scaled to a letter page.
 */
function styles(profile: PaperProfile, isRtl: boolean, isA4: boolean): string {
  return `
    @page { margin: ${isA4 ? '10mm' : '0'}; size: auto; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      /* Offline-only stack: it must cover Arabic and Latin from what the OS
         already ships, since nothing is fetched while printing. */
      font-family: "Segoe UI", "SF Arabic", "Noto Sans Arabic", Tahoma, Arial, sans-serif;
      font-size: ${profile.bodyFontSize};
      line-height: ${isRtl ? '1.65' : '1.45'};
      color: #000;
      width: ${profile.width};
      padding: ${profile.padding};
      margin: 0 auto;
      /* Thermal heads render thin greys as nothing; keep everything pure black. */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center { text-align: center; }
    .start { text-align: ${isRtl ? 'right' : 'left'}; }
    .end { text-align: ${isRtl ? 'left' : 'right'}; }
    .bold { font-weight: 700; }
    .heading { font-size: ${profile.headingFontSize}; font-weight: 700; }
    .muted { font-size: 0.9em; }
    .rule { border-top: 1px dashed #000; margin: 6px 0; }
    .rule-solid { border-top: 2px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; vertical-align: top; }
    th { border-bottom: 1px solid #000; font-size: 0.95em; }
    /* Prices must line up in a column, and Latin digits inside Arabic text
       must not be reordered by the bidi algorithm. */
    .num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      unicode-bidi: plaintext;
    }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .total-row { font-size: ${profile.totalFontSize}; font-weight: 700; }
    .note { font-size: 0.95em; font-weight: 600; }
    .kot-item { font-size: 1.25em; font-weight: 700; padding: 3px 0; }
  `;
}

function document_(
  { dir, lang, profile, isA4, body }:
  { dir: 'rtl' | 'ltr'; lang: Locale; profile: PaperProfile; isA4: boolean; body: string },
): string {
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><style>${styles(profile, dir === 'rtl', isA4)}</style></head>
<body>${body}</body>
</html>`;
}

/** Tax line label for the active regime, e.g. "VAT 15%". */
function taxLabel(bill: ReceiptBill, settings: AppSettings, copy: Copy, opts: FormatOptions): string {
  // Prefer the regime snapshotted on the bill: a settings change must not
  // relabel an already-issued invoice on reprint.
  const mode = bill.tax_mode ?? settings.tax.mode;
  if (mode === 'gst') { return copy.gst; }
  const rate = bill.tax_rate ?? settings.tax.rate;
  return rate > 0
    ? `${copy.vat} ${formatNumber(rate, opts, { maximumFractionDigits: 2 })}%`
    : copy.vat;
}

// ── bill ────────────────────────────────────────────────────────────────────

export function renderBill(
  bill: ReceiptBill,
  items: ReceiptItem[],
  settings: AppSettings,
  payments: ReceiptPayment[] = [],
): string {
  const copy = copyFor(settings.locale);
  const opts = formatOptions(settings);
  const profile = PAPER[settings.print.paperWidth];
  const dir = settings.locale === 'ar' ? 'rtl' : 'ltr';
  const isA4 = settings.print.paperWidth === 'a4';

  const mode = bill.tax_mode ?? settings.tax.mode;
  const money = (v: number) => formatCurrency(v, opts, { showSymbol: false });

  // A tax-registered outlet issues a "tax invoice"; without a number it is a
  // plain receipt. Printing "Tax Invoice" without a tax number is incorrect.
  let title = copy.invoice;
  if (mode !== 'none') {
    title = settings.outlet.taxNumber ? copy.taxInvoice : copy.simplifiedInvoice;
  }

  const header = `
    <div class="center heading">${escapeHtml(settings.outlet.name || copy.invoice)}</div>
    ${settings.outlet.address ? `<div class="center muted">${escapeHtml(settings.outlet.address)}</div>` : ''}
    ${settings.outlet.phone ? `<div class="center muted">${escapeHtml(copy.phone)}: <span class="num">${escapeHtml(settings.outlet.phone)}</span></div>` : ''}
    ${mode !== 'none' && settings.outlet.taxNumber
      ? `<div class="center muted">${escapeHtml(copy.taxNumber)}: <span class="num">${escapeHtml(settings.outlet.taxNumber)}</span></div>`
      : ''}
    <div class="rule"></div>
    <div class="center bold">${escapeHtml(title)}</div>
    <div class="rule"></div>
    <div class="row"><span>${escapeHtml(copy.billNo)}</span><span class="num">${escapeHtml(bill.bill_number)}</span></div>
    <div class="row"><span>${escapeHtml(copy.date)}</span><span class="num">${escapeHtml(
      formatDateTime(bill.date ?? bill.created_at ?? new Date(), opts),
    )}</span></div>
    <div class="rule"></div>
  `;

  const itemRows = items.map((item) => {
    const lineTotal = item.qty * item.unit_price - (item.discount ?? 0);
    return `
      <tr>
        <td class="start">${escapeHtml(item.name)}</td>
        <td class="center num">${formatNumber(item.qty, opts)}</td>
        ${profile.showUnitPrice ? `<td class="end num">${money(item.unit_price)}</td>` : ''}
        <td class="end num">${money(lineTotal)}</td>
      </tr>`;
  }).join('');

  const itemsTable = `
    <table>
      <thead>
        <tr>
          <th class="start">${escapeHtml(copy.item)}</th>
          <th class="center">${escapeHtml(copy.qty)}</th>
          ${profile.showUnitPrice ? `<th class="end">${escapeHtml(copy.price)}</th>` : ''}
          <th class="end">${escapeHtml(copy.amount)}</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  `;

  const row = (label: string, value: string, cls = '') =>
    `<div class="row ${cls}"><span>${escapeHtml(label)}</span><span class="num">${value}</span></div>`;

  let taxLines = '';
  if (mode !== 'none' && settings.print.showTaxBreakdown) {
    taxLines = mode === 'gst'
      ? row(copy.cgst, money(bill.cgst_amount)) + row(copy.sgst, money(bill.sgst_amount))
      : row(taxLabel(bill, settings, copy, opts), money(bill.tax_amount));
  }

  const totals = `
    <div class="rule"></div>
    ${row(copy.subtotal, money(bill.taxable_amount))}
    ${bill.discount_amount > 0 ? row(copy.discount, `-${money(bill.discount_amount)}`) : ''}
    ${taxLines}
    <div class="rule-solid"></div>
    ${row(copy.total, formatCurrency(bill.total_amount, opts), 'total-row')}
    ${mode !== 'none' && settings.tax.inclusive ? `<div class="center muted">${escapeHtml(copy.inclusive)}</div>` : ''}
  `;

  const paid = payments.reduce((acc, p) => acc + p.amount, 0);
  const change = paid - bill.total_amount;
  const paymentLines = payments.length === 0 ? '' : `
    <div class="rule"></div>
    ${payments.map((p) => row(paymentLabel(p.method, copy), money(p.amount))).join('')}
    ${change > 0 ? row(copy.change, money(change)) : ''}
  `;

  const footer = `
    <div class="rule"></div>
    <div class="center bold">${escapeHtml(copy.thankYou)}</div>
    ${settings.print.footerText ? `<div class="center muted">${escapeHtml(settings.print.footerText)}</div>` : ''}
  `;

  return document_({
    dir,
    lang: settings.locale,
    profile,
    isA4,
    body: header + itemsTable + totals + paymentLines + footer,
  });
}

// ── kitchen order ticket ────────────────────────────────────────────────────

export function renderKot(payload: KotPayload, settings: AppSettings): string {
  const copy = copyFor(settings.locale);
  const opts = formatOptions(settings);
  const profile = PAPER[settings.print.paperWidth];
  const dir = settings.locale === 'ar' ? 'rtl' : 'ltr';

  // The kitchen reads this across a hot line at arm's length: no prices, no
  // tax, large type, quantity first.
  const items = payload.items.map((item) => `
    <div class="kot-item">
      <span class="num">${formatNumber(item.qty, opts)}×</span> ${escapeHtml(item.name)}
      ${item.note ? `<div class="note">— ${escapeHtml(item.note)}</div>` : ''}
    </div>`).join('');

  const body = `
    <div class="center heading">${escapeHtml(copy.kot)}</div>
    ${payload.kotNumber !== null && payload.kotNumber !== undefined
      ? `<div class="center bold">${escapeHtml(copy.kotNumber)}: <span class="num">${formatNumber(payload.kotNumber, opts)}</span></div>`
      : ''}
    <div class="rule"></div>
    <div class="center heading">${escapeHtml(copy.table)}: ${escapeHtml(payload.tableName)}</div>
    ${payload.orderType ? `<div class="center">${escapeHtml(payload.orderType)}</div>` : ''}
    <div class="center muted num">${escapeHtml(formatDateTime(payload.createdAt ?? new Date(), opts))}</div>
    <div class="rule"></div>
    ${items}
    ${payload.orderNote
      ? `<div class="rule"></div><div class="note">${escapeHtml(copy.note)}: ${escapeHtml(payload.orderNote)}</div>`
      : ''}
    <div class="rule"></div>
    <div class="center muted">${escapeHtml(copy.endOfTicket)}</div>
  `;

  return document_({ dir, lang: settings.locale, profile, isA4: false, body });
}

// ── test page ───────────────────────────────────────────────────────────────

export function renderTestPage(settings: AppSettings, printerName: string): string {
  const copy = copyFor(settings.locale);
  const opts = formatOptions(settings);
  const profile = PAPER[settings.print.paperWidth];
  const dir = settings.locale === 'ar' ? 'rtl' : 'ltr';

  // Prints a sample amount and both digit sets so the operator can confirm
  // the paper width, the Arabic shaping and the currency symbol in one go.
  const body = `
    <div class="center heading">${escapeHtml(copy.testPrint)}</div>
    <div class="rule"></div>
    <div class="center">${escapeHtml(copy.testPrintBody)}</div>
    <div class="rule"></div>
    <div class="row"><span>${escapeHtml(copy.printer)}</span><span>${escapeHtml(printerName || '—')}</span></div>
    <div class="row"><span>${escapeHtml(copy.paper)}</span><span class="num">${escapeHtml(settings.print.paperWidth)}</span></div>
    <div class="row"><span>${escapeHtml(copy.total)}</span><span class="num">${formatCurrency(1234.56, opts)}</span></div>
    <div class="rule"></div>
    <div class="center num">0 1 2 3 4 5 6 7 8 9</div>
    <div class="center num">٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩</div>
    <div class="center">${escapeHtml('أبجد هوز حطي كلمن')}</div>
    <div class="center">ABCDEFGHIJKLM</div>
    <div class="rule"></div>
    <div class="center muted num">${escapeHtml(formatDateTime(new Date(), opts))}</div>
  `;

  return document_({ dir, lang: settings.locale, profile, isA4: settings.print.paperWidth === 'a4', body });
}

/** Exposed for tests and for the renderer's print preview. */
export const PAPER_PROFILES = PAPER;
