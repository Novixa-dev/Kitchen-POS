# Kitchen POS — User Stories & Acceptance Criteria

Role-based user stories describing what each type of staff member needs from
the system, and how to verify those needs are met.

The roles below describe the **shipped** permission matrix. Every role except
admin is editable — an outlet can give its cashiers the reports screen, or
take table management away from its waiters — so treat each role's stories as
the default rather than the only arrangement. See
[`features.md`](./features.md) §13.

---

## Admin

Admins hold every permission, always. The role is not editable, so no sequence
of changes can lock the last administrator out of the screen where permissions
are edited.

---

**As an admin, I want to configure the outlet name, tax number and address so
that printed bills are legally compliant.**

Acceptance criteria:
- Settings → Outlet has fields for name, address, phone, tax number and logo
- Saved values appear on every ticket and bill printed after the change
- The tax-number field is free text, because the format differs by country —
  a VAT number, a TRN and a GSTIN are not the same shape
- Fields can be left blank for an unregistered business, and a blank field
  prints nothing rather than the word "undefined"

---

**As an admin, I want to set my country, currency and tax regime so that the
till matches how my business is actually taxed.**

Acceptance criteria:
- The first-run wizard asks for the country and sets the currency and
  suggested tax regime from a table of 25 countries
- The currency's minor units are right for that country — three decimal
  places for the Gulf dinars, two for most, zero for none of the 25
- The chosen country is shown back with a note to check it against the
  outlet's own registration, because these are defaults and not authority
- The regime can be set to **VAT** (one rate and label), **GST** (CGST and
  SGST per item) or **None**
- Under VAT, prices can be marked as already including tax, and the tax is
  then derived by subtraction so the parts add back up to the printed total
- Every one of these stays editable afterwards from Settings → Country

---

**As an admin, I want a change of tax settings not to alter old invoices so
that my records stay auditable.**

Acceptance criteria:
- The regime, rate and amounts are written onto each bill when it is created
- Changing the settings afterwards does not change any existing bill
- A reprint of an old bill reproduces the original figures and labels

---

**As an admin, I want to add and manage staff PINs so that each employee has
their own login.**

Acceptance criteria:
- Can create a new staff member with name, 4-digit PIN, and role
- Can edit name, PIN, and role for any existing staff member
- Can deactivate a staff member — they can no longer log in but their historical orders remain linked to them
- Cannot delete a staff member who has orders in the system
- Three consecutive wrong PIN attempts at login results in a 60-second lockout
- If the admin PIN is lost, a recovery code set up during installation
  unlocks a PIN reset

> **Known limitation:** PINs are stored without hashing. Recorded in
> `ARCHITECTURE.md` §9 and first on the list for any security pass.

---

**As an admin, I want to decide what each role may do so that the system fits
how my outlet is actually staffed.**

Acceptance criteria:
- Settings → Permissions shows a matrix of 32 permissions across six areas
- Ticking or unticking a permission for a role takes effect without a restart
- The admin row is not editable
- Six permissions — the ones that would let their holder become an admin,
  erase the records or widen their own access — are shown but cannot be
  granted to any other role, and an attempt to grant one is refused rather
  than stored
- A refusal at the till names what is missing, in the active language, rather
  than failing silently
- The check is enforced in the main process: a screen that is hidden is also
  unreachable by typing its URL

---

**As an admin, I want to switch off the parts of the system my outlet does not
use so that staff are not navigating past features we will never touch.**

Acceptance criteria:
- Settings → Modules lists 13 modules with a bilingual name and description
- Switching one off removes it from the navigation
- Switching off a module that another depends on switches that one off too,
  and says so before the change
- A module the app cannot run without is shown but cannot be switched off
- A disabled module's IPC is refused by the main process, not merely hidden

---

**As an admin, I want to export a backup so that I can recover from hardware
failure.**

Acceptance criteria:
- Settings → Backup → Export opens a file chooser
- The destination receives a single `.zip` containing the database **and the
  dish images** — a database alone restores a menu with no photographs
- The file can be imported on the same or a different machine and restores
  the full state
- An automatic backup can be scheduled to a folder, keeping the last few and
  deleting older ones
- A reminder can be set for a day of the month, and one set for the 29th to
  31st fires on the last day of a short month rather than never

---

**As an admin, I want to import a backup to restore the system so that I can recover from data loss.**

Acceptance criteria:
- Settings → Backup → Import opens a file chooser
- A confirmation dialog warns that the current data will be replaced
- If import succeeds, the app reloads with the restored data
- If import fails (corrupt file, wrong format), the original data is automatically restored and an error message is shown
- The system keeps one automatic rollback copy before every import
- Importing replaces the staff table, so it is a way to install an admin
  account — it sits behind its own admin-only permission

---

**As an admin, I want to see the tax I have collected over any period so that I
can prepare an accurate filing.**

Acceptance criteria:
- Reports covers today, this week, this month, this year, or a custom range
- The tax lines shown follow the active regime: taxable amount and tax under
  VAT; taxable amount, CGST and SGST under GST; no tax lines under None
- Only billed orders are counted — open orders are excluded
- A period with no orders shows zeros rather than an error
- "Today" means the local calendar day, so a report opened late in the
  evening does not show tomorrow
- A custom range missing one of its bounds is refused with a message, rather
  than returning everything

---

**As an admin, I want the menu's tax fields to match my own tax regime so that
bills are legally accurate.**

Acceptance criteria:
- Under GST, each item carries an HSN code and CGST and SGST rates, and those
  print per line on the bill
- Under VAT, the single configured rate applies and no per-item rate fields
  are asked for
- Under None, no tax fields are asked for and none print
- Rates can be changed at any time
- Changing a rate does not alter any historical order or bill — only new
  orders use the new rate

---

**As an admin, I want to set an offer once so that I do not rely on every
cashier remembering it.**

Acceptance criteria:
- An offer can take a percentage, a fixed amount, or give a free item
- It can apply to the whole bill, or to one dish or a whole category
- A minimum bill, and a cap on a percentage offer, can both be set
- A date window, the days of the week, and the hours of the day can all be
  set, and a window from 22:00 to 02:00 is understood as crossing midnight
- A total redemption limit and a per-customer limit can both be set, and both
  actually stop the offer
- The offer either applies automatically or requires a coupon code; a coupon
  is never applied automatically
- Whether it combines with other offers, and which wins when two cannot
  combine, are both settings
- An offer that has already been given out is deactivated rather than deleted,
  so the record of what it cost survives
- The list says why an offer marked active is not running right now

---

**As an admin, I want to reward customers who come back so that they keep
coming back.**

Acceptance criteria:
- A rule rewards at a number of visits, or a total amount spent
- That is counted over a rolling window of days, or the customer's whole
  history
- The reward is a percentage, a fixed amount, or a free item, with a cap
- Taking a reward resets that customer's progress for that rule, so a "fifth
  visit" reward does not also pay out on the sixth
- A customer's progress toward their next reward is visible to staff

---

**As an admin, I want to see what the offers cost me so that I can tell which
ones earn their keep.**

Acceptance criteria:
- Reports shows each offer, how many times it was given, and the total
- Loyalty rewards are listed separately from coupons and automatic offers
- The total is shown as a share of revenue over the same period
- The figures come from what was actually given away, per bill — not from
  what the rules say an offer could cost

---

## Manager

By default a manager holds every permission that is not admin-only: orders,
menu, inventory, customers, expenses, reports, offers, shifts, printing and
reading settings — but not editing the permission matrix, managing staff,
restoring a backup, or resetting the system.

---

**As a manager, I want to view daily sales totals so that I can track revenue without logging into a separate system.**

Acceptance criteria:
- Dashboard shows today's total sales amount and number of orders
- Reports → Daily Summary shows the same totals with a breakdown by payment method
- Figures update in real time as new orders are billed during the day

---

**As a manager, I want to manage the menu so that prices and availability stay current.**

Acceptance criteria:
- Can add new categories and items
- Can edit the name, price, photo and the tax fields the active regime needs
- Can toggle any item as unavailable — it disappears from the order screen immediately
- Can reactivate an unavailable item — it reappears on the order screen immediately
- Changes to price or tax rate do not affect already-open orders

---

**As a manager, I want to see which stock is running low so that I can reorder
before running out.**

Acceptance criteria:
- The inventory screen highlights items at or below their alert threshold
- The threshold is configurable per item

> **Not built:** a dashboard count, or a notification. The `low_stock_alert_at`
> column has existed since the first migration and only the inventory screen
> reads it. The inert "Enable Notifications" toggle that claimed otherwise was
> removed rather than left in place. On the roadmap.

---

**As a manager, I want to log daily expenses so that we have a complete record of costs.**

Acceptance criteria:
- Can add an expense with amount, category, and optional notes
- Expenses are dated automatically to the day they are entered
- Can view expenses filtered by date or category

---

## Cashier

By default a cashier takes and cancels orders, bills them, manages tables,
reads the menu and inventory, manages customers and settles their balances,
reads expenses and reports, reprints a past bill, sees the offers, operates a
shift, and configures printing.

---

**As a cashier, I want to generate a bill so that the customer receives a legal
invoice.**

Acceptance criteria:
- Tapping an occupied table and selecting "Generate Bill" opens the billing
  screen
- The bill shows the outlet name, tax number and address, a sequential
  invoice number, the date and time, each item with its amount, the tax
  breakdown for the active regime, any offers by name, and the grand total
- The invoice number follows `INV-YYYY-XXXX` with **no gaps** — the counter
  advances only after the bill commits, so a failed bill does not burn a
  number
- The figures shown before payment are the figures that get saved: they are
  computed by the main process, by the same code that writes the bill
- The bill is created only after payment is recorded

---

**As a cashier, I want to accept payment by any method the customer offers so
that I am never stuck at the till.**

Acceptance criteria:
- The payment panel offers cash, card, UPI, wallet, complimentary, and on
  account
- Card, UPI and wallet payments can record a reference
- Complimentary marks the order as settled with nothing collected
- On account requires a customer to be selected, and is refused when it would
  take them past their credit limit
- The payments must add up to the bill total before it can be confirmed

---

**As a cashier, I want to accept split payment across multiple methods so that customers can pay part cash, part UPI.**

Acceptance criteria:
- Can add several payment entries to one bill (part cash, part card)
- They must add up to the bill total before it can be confirmed, compared in
  minor units rather than exactly, so a rounding artefact does not block a
  balanced bill
- Each method and amount appears separately on the printed receipt

---

**As a cashier, I want to print the bill so that the customer has a copy.**

Acceptance criteria:
- Printing can be triggered when payment is confirmed, or the bill can be
  saved without printing
- The receipt goes to the printer assigned to the counter, or the system
  default when none is assigned
- It prints **silently** — no operating-system dialog, which at service speed
  is the difference between usable and not
- It prints correctly in Arabic, right to left, because it is rendered as a
  document and handed to the operating system's own print path rather than
  pushed as ESC/POS bytes
- The layout follows the paper profile: 58 mm, 80 mm or A4
- It carries the tax lines the active regime requires
- If the printer is unavailable, an error appears with the reason

---

**As a cashier, I want to apply an offer or a coupon so that the customer gets
the price they were promised.**

Acceptance criteria:
- Offers that apply by themselves are already applied when the bill opens
- A coupon code can be typed, and is matched regardless of case or
  surrounding space, because it is read off a printed slip
- A code that cannot be used says why — that it has expired, that the bill is
  below the minimum, or that this customer has already used it
- An earned loyalty reward can be applied when a customer is selected
- A manual discount can be added on top, clamped to what is left
- Every amount is calculated by the main process; the till sends only the code

---

**As a cashier, I want to look up past orders so that I can answer customer queries about previous visits.**

Acceptance criteria:
- Past Orders screen lists all historical orders with date, table, and amount
- Can filter by date
- Tapping an order shows the full item list and payment details

---

## Waiter

By default a waiter takes orders, manages tables, reads the menu and the
kitchen screen, sees customers and the offers, and operates a shift. They do
not bill, cancel an order, or read reports.

---

**As a waiter, I want to open a new order for a table so that I can take a customer's food order.**

Acceptance criteria:
- Tapping a green (available) table on the floor plan opens a new order for that table
- The table colour changes to amber immediately
- Order screen shows the full menu organised by category
- Can record the number of guests at the table

---

**As a waiter, I want to browse the menu and add items to an order so that I can take a complete order accurately.**

Acceptance criteria:
- The menu is organised by category with the item name, price and photo
- Tapping an item adds it to the current order
- Can increase or decrease quantity per item
- Can type a note per item (e.g. "no onion", "extra spicy")
- Only available items are shown

---

**As a waiter, I want to send the order to the kitchen so that the chef knows
what to prepare.**

Acceptance criteria:
- "Send to Kitchen" prints a numbered ticket on the printer assigned to the
  kitchen
- The ticket shows the table name, the ticket number, the time, and each item
  with quantity and notes — and **no prices**, which the kitchen does not need
- Only items not yet sent are printed
- The ticket can be previewed on screen before printing
- After a successful print the order moves to "sent to kitchen", and it
  appears on the kitchen screen
- If the printer fails, an error appears and no items are marked as sent

---

**As a waiter, I want to add items to an order after the KOT has been sent so that I can handle additions mid-meal.**

Acceptance criteria:
- Can add new items to an order even after KOT has been sent
- Sending to kitchen again prints only the newly added items
- Previously sent items are not reprinted

---

**As a waiter, I want to add a general note to an order so that the kitchen has
context for a special request.**

Acceptance criteria:
- The order screen has a note field for the whole order, separate from the
  per-item notes
- It appears at the bottom of the kitchen ticket
- It can be edited before the ticket is sent

---

## Kitchen

By default kitchen staff see and update the kitchen screen and read the menu
and inventory. They do not take orders, bill, or see takings.

---

**As a kitchen hand, I want the orders on a screen so that I am not working
from paper slips.**

Acceptance criteria:
- The kitchen screen shows every open ticket, oldest first
- An order appears as soon as it is sent from the till
- Each item can be marked as being prepared, then ready
- A whole order can be marked ready in one action
- Each order shows how long it has been waiting, counted correctly whatever
  the machine's timezone — the figure is derived from the stored UTC
  timestamp, not from reading it as local time
- A completed or billed order leaves the screen

---

**As a kitchen hand, I want to mark a dish as sold out so that the floor stops
selling it.**

Acceptance criteria:
- An item can be marked unavailable from the menu screen
- It disappears from the order screen at once
- This does not require the permission that editing the menu does, because
  running out of a dish is a service fact rather than a menu change

---

## Anyone signed in

**As a member of staff, I want the app in my own language so that I am not
translating a screen in my head during service.**

Acceptance criteria:
- Arabic is the default on a fresh installation
- The language can be switched from the header, the lock screen and the
  open-shift screen
- The whole layout flips direction, not just the text
- Numerals can be Arabic-Indic or Latin, as a separate choice from the
  language
- Dates, times, currency and percentages all follow the chosen language
- No string a user can see is left untranslated, and no font is fetched from
  the internet
