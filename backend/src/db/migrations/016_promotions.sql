-- Discounts, coupons, gifts and loyalty.
--
-- Until now the only discount the app had was a free-form number the cashier
-- typed into the bill dialog: no record of why, no limit, no expiry, and no
-- way for an owner to say "10% off starters on Tuesdays" once instead of
-- trusting every cashier to remember it. Every rule here is *data*, evaluated
-- in the main process, so the renderer can never invent a discount the books
-- do not know about.
--
-- Three tables and one column:
--
--  * `promotions`            the rules themselves — a manual discount, an
--                            automatic one, or a coupon with a code
--  * `promotion_redemptions` what was actually given away, per bill, which is
--                            the only honest basis for a "what did the offers
--                            cost us" report
--  * `loyalty_rules`         thresholds on visits or spend that award a reward
--  * `bills.promotion_discount` the part of the discount that came from a
--                            rule, kept apart from `discount_amount` so an
--                            auditor can tell a priced offer from a cashier's
--                            override

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- NULL for an offer the cashier picks from a list or that applies by
  -- itself; set for a coupon the customer presents. UNIQUE, because two
  -- live rules answering to the same code is not a decidable situation.
  code TEXT UNIQUE,

  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,

  -- percent    `value` is 0-100
  -- amount     `value` is money in the outlet's currency
  -- free_item  one unit of `free_item_id` is given; `value` is ignored
  kind TEXT NOT NULL CHECK(kind IN ('percent','amount','free_item')),
  value REAL NOT NULL DEFAULT 0,
  free_item_id INTEGER REFERENCES menu_items(id),

  -- bill  applies to the whole bill
  -- item  applies only to matching lines (by item or by category)
  scope TEXT NOT NULL DEFAULT 'bill' CHECK(scope IN ('bill','item')),
  target_item_id INTEGER REFERENCES menu_items(id),
  target_category_id INTEGER REFERENCES categories(id),

  -- Guards. `max_discount` is what stops "50% off" from giving away a
  -- banquet; without it a percentage rule is unbounded by design.
  min_subtotal REAL NOT NULL DEFAULT 0,
  max_discount REAL,

  -- Validity. All optional; absent means unbounded.
  --   starts_at / ends_at   ISO dates, inclusive
  --   active_days           comma-separated weekdays, 0 = Sunday
  --   start_time / end_time 'HH:MM' local; a window that ends before it
  --                         starts is read as crossing midnight
  starts_at TEXT,
  ends_at TEXT,
  active_days TEXT,
  start_time TEXT,
  end_time TEXT,

  -- Caps. `used_count` is maintained inside the billing transaction, so two
  -- tills racing on the last redemption cannot both win.
  usage_limit INTEGER,
  usage_limit_per_customer INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,

  -- Whether this rule may be combined with another. A non-stackable rule
  -- wins alone; `priority` decides which of two non-stackable rules wins
  -- (higher first).
  stackable INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,

  -- When true the rule applies without anyone asking for it, provided its
  -- conditions hold. Coupons are never automatic.
  auto_apply INTEGER NOT NULL DEFAULT 0,

  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promotion_id INTEGER NOT NULL REFERENCES promotions(id),
  bill_id INTEGER REFERENCES bills(id),
  customer_id INTEGER REFERENCES customers(id),
  -- What this rule actually took off this bill, after caps.
  amount REAL NOT NULL DEFAULT 0,
  -- The gift, when the rule was a free item.
  free_item_id INTEGER REFERENCES menu_items(id),
  redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,

  -- visits  count of billed visits
  -- spend   total spent
  basis TEXT NOT NULL CHECK(basis IN ('visits','spend')),
  threshold REAL NOT NULL,
  -- Rolling window in days; NULL means the customer's whole history.
  window_days INTEGER,

  reward_kind TEXT NOT NULL CHECK(reward_kind IN ('percent','amount','free_item')),
  reward_value REAL NOT NULL DEFAULT 0,
  reward_item_id INTEGER REFERENCES menu_items(id),
  reward_max_discount REAL,

  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Loyalty rewards get their own log rather than being squeezed into
-- `promotion_redemptions`: a reward is earned by history, not presented as a
-- code, and conflating the two would make "what did the coupons cost us"
-- unanswerable.
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL REFERENCES loyalty_rules(id),
  bill_id INTEGER REFERENCES bills(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount REAL NOT NULL DEFAULT 0,
  free_item_id INTEGER REFERENCES menu_items(id),
  redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- The discount that came from a rule, as opposed to a cashier's own figure.
ALTER TABLE bills ADD COLUMN promotion_discount REAL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_promotions_active   ON promotions (is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_code     ON promotions (code);
CREATE INDEX IF NOT EXISTS idx_redemptions_promo   ON promotion_redemptions (promotion_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_bill    ON promotion_redemptions (bill_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON promotion_redemptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_active      ON loyalty_rules (is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_redeem_rule ON loyalty_redemptions (rule_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redeem_cust ON loyalty_redemptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer      ON bills (customer_id);
