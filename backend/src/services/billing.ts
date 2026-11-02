import { getDB } from '../db';
import { getRawSetting, getTaxConfig, setRawSetting } from '../lib/settings';
import { applyBillDiscount, calcBillTotals, type TaxableItem } from './tax';

interface PaymentPayload {
  method: string;
  amount: number;
  reference?: string;
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
) {
  const db = getDB();

  // Read the bill number and the tax config before entering the transaction:
  // electron-store touches the filesystem, which must not happen inside a
  // SQLite transaction.
  const billNumber = getNextBillNumber();
  const taxConfig = getTaxConfig();

  const result = db.transaction(() => {
    const items = db
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .all(orderId) as TaxableItem[];

    const totals = applyBillDiscount(calcBillTotals(items, taxConfig), discount);

    const orderRow = db
      .prepare('SELECT business_date FROM orders WHERE id = ?')
      .get(orderId) as { business_date: string | null } | undefined;

    const info = db.prepare(`
      INSERT INTO bills (
        bill_number, order_id, taxable_amount, cgst_amount, sgst_amount,
        tax_amount, tax_mode, tax_rate, discount_amount, total_amount,
        customer_id, business_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    );

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
      billId: info.lastInsertRowid,
      bill_number: billNumber,
      taxable_amount: totals.taxable_amount,
      cgst_amount: totals.cgst_amount,
      sgst_amount: totals.sgst_amount,
      tax_amount: totals.tax_amount,
      tax_mode: taxConfig.mode,
      tax_rate: taxConfig.rate,
      discount_amount: totals.discount_amount,
      total_amount: totals.total_amount,
    };
  })();

  // Advance the counter only once the DB transaction has committed, so a
  // failed bill does not burn an invoice number. GST and VAT audits both
  // require a gapless sequence.
  const lastNumber = getRawSetting('last_bill_number', 0);
  setRawSetting('last_bill_number', lastNumber + 1);

  return result;
}
