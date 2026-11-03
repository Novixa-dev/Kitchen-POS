-- Generalise the tax model beyond Indian GST.
--
-- `cgst_amount` / `sgst_amount` keep their meaning under the `gst` regime, so
-- historical bills are untouched. `tax_amount` holds the total tax under every
-- regime, giving reports a single column to sum, and `tax_mode` / `tax_rate`
-- snapshot the regime onto the bill so a later settings change cannot
-- retroactively alter what was printed.

ALTER TABLE bills ADD COLUMN tax_amount REAL;
ALTER TABLE bills ADD COLUMN tax_mode TEXT;
ALTER TABLE bills ADD COLUMN tax_rate REAL;

-- Existing rows were all GST: their total tax is the sum of the two halves.
UPDATE bills
   SET tax_amount = COALESCE(cgst_amount, 0) + COALESCE(sgst_amount, 0),
       tax_mode   = 'gst'
 WHERE tax_amount IS NULL;

-- Card/wallet are standard elsewhere; UPI is India-specific but kept so
-- historical rows stay valid.
PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS payments_v14 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  method TEXT CHECK(method IN ('cash','card','upi','wallet','complimentary','unpaid')),
  amount REAL NOT NULL,
  reference TEXT,
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payments_v14 (id, order_id, method, amount, reference, paid_at)
SELECT id, order_id, method, amount, reference, paid_at FROM payments;

DROP TABLE payments;
ALTER TABLE payments_v14 RENAME TO payments;

PRAGMA foreign_keys=on;

-- Reports filter bills by date constantly; without these every report is a
-- full table scan.
CREATE INDEX IF NOT EXISTS idx_bills_created_at    ON bills (created_at);
CREATE INDEX IF NOT EXISTS idx_bills_business_date ON bills (business_date);
CREATE INDEX IF NOT EXISTS idx_bills_order_id      ON bills (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_table_id     ON orders (table_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order      ON payments (order_id);
