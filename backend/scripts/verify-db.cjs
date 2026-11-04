/**
 * Database verification, run under Electron against a throwaway data
 * directory.
 *
 *   npm run verify:db --prefix backend
 *
 * Why this exists rather than a Vitest file: `better-sqlite3` built by
 * `@electron/rebuild` targets Electron's ABI, and one built by `npm install`
 * targets Node's. A single install cannot serve both, so the committed unit
 * tests exercise pure modules and never open a database. Everything that
 * needs real SQLite — the migrations, the transactions, the CHECK and UNIQUE
 * constraints, the redemption rows and the usage counters — is proved here.
 *
 * It writes to a fresh temporary directory every run and touches nothing in
 * the developer's own app data.
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// `backend/scripts/` -> `backend/dist/`. Overridable for an unusual layout.
const DIST = process.env.POS_DIST ?? path.join(__dirname, '..', 'dist');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-verify-'));
app.setPath('userData', tmp);
console.log(`data directory: ${tmp}`);

let pass = 0;
const failures = [];
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; } else { failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function truthy(name, value) {
  if (value) { pass++; } else { failures.push(`${name}: expected truthy, got ${JSON.stringify(value)}`); }
}

app.whenReady().then(() => {
  try {
    const { getDB } = require(path.join(DIST, 'db', 'index.js'));
    const { runMigrations } = require(path.join(DIST, 'db', 'migrate.js'));
    runMigrations();
    const db = getDB();

    // ── 1. Migration 016 landed ────────────────────────────────────────
    const applied = db.prepare('SELECT filename FROM _migrations ORDER BY filename').all().map(r => r.filename);
    check('migration count', applied.length, 16);
    truthy('016 applied', applied.includes('016_promotions.sql'));

    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
    for (const t of ['promotions', 'promotion_redemptions', 'loyalty_rules', 'loyalty_redemptions']) {
      truthy(`table ${t}`, tables.has(t));
    }

    const billCols = new Set(db.prepare('PRAGMA table_info(bills)').all().map(c => c.name));
    truthy('bills.promotion_discount', billCols.has('promotion_discount'));

    const indexes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name));
    for (const i of ['idx_promotions_code', 'idx_redemptions_bill', 'idx_loyalty_active', 'idx_bills_customer']) {
      truthy(`index ${i}`, indexes.has(i));
    }

    // Unique code is enforced, not just declared.
    db.prepare("INSERT INTO promotions (code, name_en, name_ar, kind, value) VALUES ('DUP','a','ا','percent',10)").run();
    let dupRejected = false;
    try {
      db.prepare("INSERT INTO promotions (code, name_en, name_ar, kind, value) VALUES ('DUP','b','ب','percent',10)").run();
    } catch { dupRejected = true; }
    truthy('duplicate coupon code refused', dupRejected);
    db.prepare("DELETE FROM promotions WHERE code='DUP'").run();

    // CHECK constraints really constrain.
    let badKind = false;
    try {
      db.prepare("INSERT INTO promotions (name_en, name_ar, kind, value) VALUES ('x','س','bogus',1)").run();
    } catch { badKind = true; }
    truthy('unknown promotion kind refused', badKind);

    // ── 2. Set up a sale ───────────────────────────────────────────────
    const { getTaxConfig, patchSettings } = require(path.join(DIST, 'lib', 'settings.js'));
    // VAT 15% exclusive, so the arithmetic is easy to check by hand.
    patchSettings({ tax: { mode: 'vat', rate: 15, inclusive: false } });
    const taxConfig = getTaxConfig();
    check('tax regime set for the run', [taxConfig.mode, taxConfig.rate, taxConfig.inclusive], ['vat', 15, false]);

    const cat = db.prepare('SELECT id FROM categories LIMIT 1').get();
    const item = db.prepare('SELECT id, price FROM menu_items WHERE category_id = ? LIMIT 1').get(cat.id);
    truthy('seed menu item exists', item && item.id);

    const customerId = Number(db.prepare(
      "INSERT INTO customers (name, phone) VALUES ('Verify', '0500000000')",
    ).run().lastInsertRowid);

    function newOrder(qty, unitPrice) {
      const orderId = Number(db.prepare(
        "INSERT INTO orders (table_id, staff_id, status, covers) VALUES (1, 1, 'open', 2)",
      ).run().lastInsertRowid);
      db.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, name, qty, unit_price, cgst_rate, sgst_rate)
        VALUES (?, ?, 'Verify dish', ?, ?, 2.5, 2.5)
      `).run(orderId, item.id, qty, unitPrice);
      return orderId;
    }

    const { priceOrder } = require(path.join(DIST, 'services', 'pricing.js'));
    const { createBill } = require(path.join(DIST, 'services', 'billing.js'));

    // ── 3. No offers: tax only ─────────────────────────────────────────
    const plain = priceOrder({ orderId: newOrder(2, 100) });
    check('plain taxable', plain.totals.taxable_amount, 200);
    check('plain tax', plain.totals.tax_amount, 30);
    check('plain total', plain.totals.total_amount, 230);
    check('plain promotion discount', plain.promotionDiscount, 0);

    // ── 4. An automatic 10% off the bill ───────────────────────────────
    const tenOff = Number(db.prepare(`
      INSERT INTO promotions (name_en, name_ar, kind, value, scope, auto_apply, stackable, priority)
      VALUES ('Ten percent', 'عشرة بالمئة', 'percent', 10, 'bill', 1, 0, 10)
    `).run().lastInsertRowid);

    const auto = priceOrder({ orderId: newOrder(2, 100) });
    check('auto offer applied', auto.offers.map(o => o.promotionId), [tenOff]);
    check('auto discount', auto.promotionDiscount, 23); // 10% of 230
    check('auto total', auto.totals.total_amount, 207);

    // From here the standing 10% is parked unless it is the subject: it is
    // non-stackable at priority 10, so it legitimately wins every contest and
    // would mask what each later case is actually checking. The contest
    // itself is asserted in step 11.
    const park = () => db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(tenOff);
    const unpark = () => db.prepare('UPDATE promotions SET is_active = 1 WHERE id = ?').run(tenOff);

    // ── 5. A coupon is never automatic, and prices when presented ──────
    const coupon = Number(db.prepare(`
      INSERT INTO promotions (code, name_en, name_ar, kind, value, scope, auto_apply, stackable, priority, usage_limit)
      VALUES ('SAVE20', 'Twenty off', 'عشرون خصما', 'amount', 20, 'bill', 1, 1, 50, 2)
    `).run().lastInsertRowid);

    park();
    const withoutCode = priceOrder({ orderId: newOrder(2, 100) });
    truthy('coupon stays out until presented', !withoutCode.offers.some(o => o.promotionId === coupon));

    const withCode = priceOrder({ orderId: newOrder(2, 100), couponCodes: ['  save20 '] });
    check('coupon prices when presented', withCode.offers.map(o => o.promotionId), [coupon]);
    check('coupon discount', withCode.promotionDiscount, 20);

    // Two stackable offers do combine. A second stackable rule alongside the
    // coupon proves the stack, which the non-stackable 10% cannot.
    const alsoStackable = Number(db.prepare(`
      INSERT INTO promotions (name_en, name_ar, kind, value, scope, auto_apply, stackable, priority)
      VALUES ('Five more', 'خمسة إضافية', 'amount', 5, 'bill', 1, 1, 1)
    `).run().lastInsertRowid);
    const stacked = priceOrder({ orderId: newOrder(2, 100), couponCodes: ['SAVE20'] });
    check('two stackable offers combine', stacked.offers.map(o => o.promotionId), [coupon, alsoStackable]);
    check('stacked discount', stacked.promotionDiscount, 25);
    db.prepare('DELETE FROM promotions WHERE id = ?').run(alsoStackable);

    // ── 6. Caps: nothing can take the bill below zero ──────────────────
    const huge = Number(db.prepare(`
      INSERT INTO promotions (name_en, name_ar, kind, value, scope, auto_apply, stackable)
      VALUES ('Too much', 'كثير جدا', 'amount', 100000, 'bill', 0, 0)
    `).run().lastInsertRowid);
    const capped = priceOrder({ orderId: newOrder(1, 50), promotionIds: [huge] });
    check('capped at the bill', capped.totals.total_amount, 0);
    check('capped discount', capped.promotionDiscount, 57.5);  // 50 + 15% VAT
    db.prepare('DELETE FROM promotions WHERE id = ?').run(huge);

    // ── 7. Manual discount is clamped against what is left ─────────────
    unpark();
    const manual = priceOrder({ orderId: newOrder(2, 100), manualDiscount: 1000 });
    check('manual clamped to what the rules left', manual.manualDiscount, 207);
    check('manual total', manual.totals.total_amount, 0);

    // ── 8. A real sale records the redemption and advances the counter ──
    const saleOrder = newOrder(2, 100);
    const bill = createBill(saleOrder, [{ method: 'cash', amount: 207 }], 0, customerId, {});
    check('sale total', bill.total_amount, 207);
    check('sale promotion discount', bill.promotion_discount, 23);

    const redemptions = db.prepare('SELECT * FROM promotion_redemptions WHERE bill_id = ?').all(bill.billId);
    check('one redemption row', redemptions.length, 1);
    check('redemption amount', redemptions[0].amount, 23);
    check('redemption customer', redemptions[0].customer_id, customerId);

    const used = db.prepare('SELECT used_count FROM promotions WHERE id = ?').get(tenOff);
    check('used_count advanced', used.used_count, 1);

    const storedBill = db.prepare('SELECT promotion_discount, discount_amount, total_amount, tax_mode FROM bills WHERE id = ?').get(bill.billId);
    check('bill row promotion discount', storedBill.promotion_discount, 23);
    check('bill row total', storedBill.total_amount, 207);
    check('regime snapshotted', storedBill.tax_mode, 'vat');
    park();

    // ── 9. A usage limit actually stops the offer ──────────────────────
    db.prepare('UPDATE promotions SET used_count = usage_limit WHERE id = ?').run(coupon);
    const exhausted = priceOrder({ orderId: newOrder(2, 100), couponCodes: ['SAVE20'] });
    truthy('exhausted coupon refused', !exhausted.offers.some(o => o.promotionId === coupon));
    truthy(
      'refusal reason reported',
      exhausted.rejected.some(r => r.promotionId === coupon && r.reason === 'usage-limit-reached'),
    );

    // ── 10. Per-customer limit counts that customer's own redemptions ──
    const once = Number(db.prepare(`
      INSERT INTO promotions (code, name_en, name_ar, kind, value, scope, auto_apply, stackable, usage_limit_per_customer)
      VALUES ('ONCE', 'Once only', 'مرة واحدة', 'amount', 5, 'bill', 0, 1, 1)
    `).run().lastInsertRowid);

    const first = priceOrder({ orderId: newOrder(1, 100), customerId, couponCodes: ['ONCE'] });
    truthy('first use allowed', first.offers.some(o => o.promotionId === once));

    const usedOrder = newOrder(1, 100);
    createBill(usedOrder, [{ method: 'cash', amount: 1 }], 0, customerId, { couponCodes: ['ONCE'] });

    const second = priceOrder({ orderId: newOrder(1, 100), customerId, couponCodes: ['ONCE'] });
    truthy('second use refused', !second.offers.some(o => o.promotionId === once));
    truthy(
      'per-customer reason reported',
      second.rejected.some(r => r.promotionId === once && r.reason === 'customer-limit-reached'),
    );
    // Someone else is unaffected by that customer's history.
    const otherCustomer = Number(db.prepare(
      "INSERT INTO customers (name, phone) VALUES ('Other', '0500000001')",
    ).run().lastInsertRowid);
    const other = priceOrder({ orderId: newOrder(1, 100), customerId: otherCustomer, couponCodes: ['ONCE'] });
    truthy('another customer still allowed', other.offers.some(o => o.promotionId === once));

    // ── 11. Item-scoped offer prices only its own lines ───────────────
    const second_cat = db.prepare('SELECT id FROM categories WHERE id != ? LIMIT 1').get(cat.id);
    const otherItem = db.prepare('SELECT id FROM menu_items WHERE category_id = ? LIMIT 1').get(second_cat.id);

    const mixedOrder = Number(db.prepare(
      "INSERT INTO orders (table_id, staff_id, status, covers) VALUES (1, 1, 'open', 2)",
    ).run().lastInsertRowid);
    db.prepare(`INSERT INTO order_items (order_id, menu_item_id, name, qty, unit_price, cgst_rate, sgst_rate)
                VALUES (?, ?, 'In scope', 1, 100, 0, 0)`).run(mixedOrder, item.id);
    db.prepare(`INSERT INTO order_items (order_id, menu_item_id, name, qty, unit_price, cgst_rate, sgst_rate)
                VALUES (?, ?, 'Out of scope', 1, 200, 0, 0)`).run(mixedOrder, otherItem.id);

    const scoped = Number(db.prepare(`
      INSERT INTO promotions (name_en, name_ar, kind, value, scope, target_category_id, auto_apply, stackable)
      VALUES ('Half off starters', 'نصف خصم', 'percent', 50, 'item', ?, 0, 0)
    `).run(cat.id).lastInsertRowid);

    // The automatic 10% is non-stackable and higher priority, so it would
    // win alone and suppress this one — which is correct behaviour, and
    // separately asserted. Park it to isolate the scope arithmetic.
    db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(tenOff);

    const scopedPriced = priceOrder({ orderId: mixedOrder, promotionIds: [scoped] });
    const scopedOffer = scopedPriced.offers.find(o => o.promotionId === scoped);
    truthy(
      'item-scope offer applied',
      scopedOffer || JSON.stringify(scopedPriced.rejected),
    );
    // 50% of the in-scope line only. Line amounts are pre-tax here; the
    // engine prices item scope against the matching lines' own amounts.
    check('item-scope discount', scopedOffer && scopedOffer.amount, 50);

    // Confirm the suppression that was in the way is real and reported.
    db.prepare('UPDATE promotions SET is_active = 1 WHERE id = ?').run(tenOff);
    const contested = priceOrder({ orderId: mixedOrder, promotionIds: [scoped] });
    check('non-stackable winner takes the bill', contested.offers.map(o => o.promotionId), [tenOff]);
    check('loser is reported as suppressed, not rejected', contested.suppressed.map(s => s.promotionId), [scoped]);
    db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(tenOff);

    // ── 12. Loyalty: earned once, then reset ──────────────────────────
    const rule = Number(db.prepare(`
      INSERT INTO loyalty_rules (name_en, name_ar, basis, threshold, reward_kind, reward_value)
      VALUES ('Third visit', 'الزيارة الثالثة', 'visits', 3, 'percent', 10)
    `).run().lastInsertRowid);

    const loyalCustomer = Number(db.prepare(
      "INSERT INTO customers (name, phone) VALUES ('Loyal', '0500000002')",
    ).run().lastInsertRowid);

    const billsSoFar = db.prepare('SELECT COUNT(*) AS n FROM bills WHERE customer_id = ?').get(loyalCustomer);
    check('loyal customer starts fresh', billsSoFar.n, 0);

    // Two visits: not yet earned.
    for (let i = 0; i < 2; i++) {
      const o = newOrder(1, 100);
      createBill(o, [{ method: 'cash', amount: 1 }], 0, loyalCustomer, {});
    }
    const notYet = priceOrder({ orderId: newOrder(1, 100), customerId: loyalCustomer, useLoyalty: true });
    check('two visits earn nothing', notYet.rewards.length, 0);

    // Third visit: earned.
    const thirdOrder = newOrder(1, 100);
    createBill(thirdOrder, [{ method: 'cash', amount: 1 }], 0, loyalCustomer, {});

    const earnedPriced = priceOrder({ orderId: newOrder(1, 100), customerId: loyalCustomer, useLoyalty: true });
    check('third visit earns', earnedPriced.rewards.map(r => r.ruleId), [rule]);

    // Take it, then confirm it does not pay out again immediately.
    const rewardOrder = newOrder(1, 100);
    const rewardBill = createBill(rewardOrder, [{ method: 'cash', amount: 1 }], 0, loyalCustomer, { useLoyalty: true });
    const logged = db.prepare('SELECT * FROM loyalty_redemptions WHERE bill_id = ?').all(rewardBill.billId);
    check('loyalty logged once', logged.length, 1);
    check('loyalty rule logged', logged[0].rule_id, rule);

    const again = priceOrder({ orderId: newOrder(1, 100), customerId: loyalCustomer, useLoyalty: true });
    check('reward does not repeat', again.rewards.length, 0);

    // ── 13. Offers do not apply without being asked for ───────────────
    const noLoyalty = priceOrder({ orderId: newOrder(1, 100), customerId: loyalCustomer });
    check('loyalty is opt-in per bill', noLoyalty.rewards.length, 0);

    // ── 14. The redemption report adds up ─────────────────────────────
    const { redemptionSummary, loyaltySummary } = require(path.join(DIST, 'services', 'promotion-store.js'));
    const { rangeFor } = require(path.join(DIST, 'lib', 'report-range.js'));

    const built = rangeFor('daily', 'redeemed_at');
    truthy('range builds for the offers report', built.ok);

    const summary = redemptionSummary(built.range.condition, built.range.params);
    const tenRow = summary.find(r => r.id === tenOff);
    truthy('report lists the offer', tenRow && tenRow.redemptions >= 1);
    truthy('report sums the money given away', tenRow && tenRow.total_amount >= 23);
    truthy('report carries the offer kind', tenRow && tenRow.kind === 'percent');

    const loyaltyRows = loyaltySummary(built.range.condition, built.range.params);
    const loyaltyRow = loyaltyRows.find(r => r.id === rule);
    truthy('loyalty is reported apart from the promotions', loyaltyRow && loyaltyRow.redemptions === 1);
    truthy('loyalty rows carry no coupon code', loyaltyRow && loyaltyRow.code === null);

    // A custom range covering today finds the same rows; one covering a past
    // week finds none, which is what proves the period is actually applied.
    const todayDate = (() => {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    })();

    const custom = rangeFor('custom', 'redeemed_at', { start: todayDate, end: todayDate });
    truthy('custom range builds', custom.ok);
    truthy(
      'custom range covering today finds the redemptions',
      redemptionSummary(custom.range.condition, custom.range.params).length === summary.length,
    );

    const past = rangeFor('custom', 'redeemed_at', { start: '2020-01-01', end: '2020-01-02' });
    check('a past range finds nothing', redemptionSummary(past.range.condition, past.range.params).length, 0);

    check('a custom range missing a bound is refused', rangeFor('custom', 'redeemed_at', {}), {
      ok: false,
      error: 'report/custom-range-needs-both-dates',
    });

    // The sales report still works through the shared module.
    const salesRange = rangeFor('weekly', 'created_at');
    const weekBills = db.prepare(
      `SELECT COUNT(*) AS n FROM bills WHERE ${salesRange.range.condition}`,
    ).get(...salesRange.range.params);
    truthy("the sales report range still selects this week's bills", weekBills.n > 0);

    console.log(`\nPASS ${pass}`);
    if (failures.length) {
      console.log(`FAIL ${failures.length}`);
      for (const f of failures) { console.log('  - ' + f); }
    }
    process.exit(failures.length ? 1 : 0);
  } catch (e) {
    console.error('THREW:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
});
