import { getDB } from '../db';
import { getRawSetting, setRawSetting } from '../lib/settings';
import { priceOrder } from './pricing';
import { recordLoyaltyRedemptions, recordRedemptions } from './promotion-store';

interface PaymentPayload {
  method: string;
  amount: number;
  reference?: string;
}

/** What the cashier chose in the bill dialog, beyond the payments. */
export interface BillOptions {
  promotionIds?: number[];
  couponCodes?: string[];
  useLoyalty?: boolean;
}

export function getNextBillNumber(): string {
  const lastNumber = getRawSetting('last_bill_number', 0);
  const year = new Date().getFullYear();
  return `INV-${year}-${(lastNumber + 1).toString().padStart(4, '0')}`;
}

export function createBill(
  orderId: number,
  payments: PaymentPayload[],
  discount: number,
  customerId?: number,
  options: BillOptions = {},
) {
  const db = getDB();

  // Read the bill number and price the order before entering the transaction:
  // electron-store touches the filesystem, which must not happen inside a
  // SQLite transaction.
  const billNumber = getNextBillNumber();

  // The same function the dialog previewed with, so the saved bill and the
  // figures the cashier read off the screen cannot disagree.
  const priced = priceOrder({
    orderId,
    manualDiscount: discount,
    customerId: customerId ?? null,
    promotionIds: options.promotionIds,
    couponCodes: options.couponCodes,
    useLoyalty: options.useLoyalty,
  });

  const taxConfig = priced.tax;
  const totals = priced.totals;

  const result = db.transaction(() => {
    const orderRow = db
      .prepare('SELECT business_date FROM orders WHERE id = ?')
      .get(orderId) as { business_date: string | null } | undefined;

    const info = db.prepare(`
      INSERT INTO bills (
        bill_number, order_id, taxable_amount, cgst_amount, sgst_amount,
        tax_amount, tax_mode, tax_rate, discount_amount, total_amount,
        customer_id, business_date, promotion_discount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      billNumber,
      orderId,
      totals.taxable_amount,
      totals.cgst_amount,
      totals.sgst_amount,
      totals.tax_amount,
      taxConfig.mode,
      taxConfig.mode === 'vat' ? taxConfig.rate : null,
      totals.discount_amount,
      totals.total_amount,
      customerId ?? null,
      orderRow?.business_date ?? null,
      priced.promotionDiscount,
    );

    const billId = Number(info.lastInsertRowid);

    // Inside the transaction, so a bill and the offers it consumed commit
    // together. Outside it, a crash in between would grant a capped offer
    // without counting it.
    if (priced.redemptions.length > 0) {
      recordRedemptions(billId, customerId ?? null, priced.redemptions);
    }
    if (priced.loyaltyRedemptions.length > 0 && customerId) {
      recordLoyaltyRedemptions(billId, customerId, priced.loyaltyRedemptions);
    }

    for (const p of payments) {
      db.prepare(
        'INSERT INTO payments (order_id, method, amount, reference) VALUES (?, ?, ?, ?)',
      ).run(orderId, p.method, p.amount, p.reference ?? null);

      if (p.method === 'unpaid') {
        if (!customerId) {
          throw new Error('A customer must be selected before leaving a balance unpaid.');
        }
        db.prepare(
          'UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?',
        ).run(p.amount, customerId);
      }
    }

    db.prepare('UPDATE orders SET status = ?, customer_id = ? WHERE id = ?')
      .run('billed', customerId ?? null, orderId);

    const orderRecord = db
      .prepare('SELECT table_id FROM orders WHERE id = ?')
      .get(orderId) as { table_id: number } | undefined;
    if (orderRecord?.table_id) {
      db.prepare('UPDATE tables SET custom_name = NULL WHERE id = ?').run(orderRecord.table_id);
    }

    return {
      billId,
      bill_number: billNumber,
      taxable_amount: totals.taxable_amount,
      cgst_amount: totals.cgst_amount,
      sgst_amount: totals.sgst_amount,
      tax_amount: totals.tax_amount,
      tax_mode: taxConfig.mode,
      tax_rate: taxConfig.rate,
      discount_amount: totals.discount_amount,
      promotion_discount: priced.promotionDiscount,
      manual_discount: priced.manualDiscount,
      total_amount: totals.total_amount,
      offers: priced.offers,
      rewards: priced.rewards,
    };
  })();

  // Advance the counter only once the DB transaction has committed, so a
  // failed bill does not burn an invoice number. GST and VAT audits both
  // require a gapless sequence.
  const lastNumber = getRawSetting('last_bill_number', 0);
  setRawSetting('last_bill_number', lastNumber + 1);

  return result;
}
