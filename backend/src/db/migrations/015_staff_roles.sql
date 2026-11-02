-- Allow a `kitchen` role.
--
-- The staff form offered `chef` and `cleaner`, but the CHECK constraint only
-- ever accepted admin/manager/cashier/waiter — so picking either made the
-- insert fail with a constraint error that the UI swallowed into console.error.
-- `kitchen` is the role that actually has a use (the KDS), so it is added here
-- and the bogus two are dropped from the form.
--
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS staff_v15 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin','manager','cashier','waiter','kitchen')) DEFAULT 'waiter',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO staff_v15 (id, name, pin, role, is_active, created_at)
SELECT id,
       name,
       pin,
       -- Map anything unexpected onto a valid role rather than losing the row.
       CASE WHEN role IN ('admin','manager','cashier','waiter','kitchen')
            THEN role
            WHEN role IN ('chef','cook') THEN 'kitchen'
            ELSE 'waiter'
       END,
       is_active,
       created_at
  FROM staff;

DROP TABLE staff;
ALTER TABLE staff_v15 RENAME TO staff;

PRAGMA foreign_keys=on;

-- Login reads by PIN on every sign-in.
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff (is_active);
