# Kitchen POS — Features Reference

A plain-language description of every feature in Kitchen POS: what it does
and what staff can do with it.

Thirteen of these are **modules** that an admin can switch off per outlet.
A switched-off module leaves the navigation and is refused by the main
process, so it cannot be reached by typing a URL either. Those are marked
*(module)*.

---

## 1. Language and layout

The interface is bilingual, and **Arabic is the default**.

- Switch between Arabic and English from the header, the lock screen or the
  open-shift screen
- The whole layout flips to right-to-left — not just the text
- Choose Arabic-Indic (٠١٢٣) or Latin (0123) numerals
- Dates, times, currency and percentages all follow the chosen language
- No font is downloaded from the internet; the Arabic and Latin faces are
  resident on the machine

---

## 2. Order management

Take and manage orders from the moment a customer sits down to the moment
they pay.

**What staff can do:**
- Open a new order for any table, or as a takeaway
- Browse the menu by category and add items
- Set quantities and add per-item instructions ("no onion", "extra spicy")
- Edit or remove items while the order is open
- Record how many guests are at the table (covers)
- Add a note to the kitchen for the whole order
- See every open order across all tables
- Cancel an order, which is a separate permission from taking one

---

## 3. Table management *(module)*

See every table's status at a glance on a visual floor plan.

**What staff can do:**
- See all tables colour-coded by status: free, occupied, bill requested
- See the running total on each occupied table
- Tap a table to open its order or start a new one
- Organise tables into sections (Main Hall, Outdoor, Terrace)
- Add, rename or remove tables
- Set seating capacity per table
- Give a table a temporary custom name, cleared when the bill is settled

---

## 4. Menu management *(multi-menu is a module)*

**What staff can do:**
- Create and organise categories
- Add items with name, price, photo, and the tax fields the active regime
  needs
- Mark an item sold out — it disappears from the order screen at once. This
  is a service decision, so it does not need the permission that editing the
  menu does
- Reorder categories and items
- Build several menus (Dine-In, Takeaway, Ramadan) and clone one to start
  another
- Schedule a menu to switch itself on and off at set times
- Link an item to its ingredients, so stock deducts when it sells

---

## 5. Billing

Legal invoices under whichever tax regime the outlet uses.

**What staff can do:**
- Generate a bill from any occupied table
- See an itemised breakdown that adds up to the printed total — the figures
  come from the main process, which is the same code that writes the bill
- Apply an offer, enter a coupon code, or use a loyalty reward
- Apply a manual discount on top, clamped to what is left
- Take payment by cash, card, UPI, wallet, complimentary, or on account
- Split payment across several methods
- Print the bill, or save it without printing

**What the bill includes:**
- Outlet name, address and tax number
- Sequential invoice number (`INV-YYYY-XXXX`) with **no gaps** — the counter
  advances only after the bill commits, so a failed bill does not burn a
  number
- Date and time
- Each item with quantity, rate and amount
- The tax breakdown for the active regime:
  - **VAT** — taxable amount, rate and tax, with a note when prices include
    tax
  - **GST** — taxable amount, CGST and SGST percentages and amounts, HSN
    codes
  - **None** — no tax lines at all
- Any offers and the loyalty reward, each named
- Grand total

The regime is recorded on the bill itself, so changing the settings later
never alters what an old invoice said.

---

## 6. Kitchen tickets (KOT)

**What staff can do:**
- Send the order to the kitchen, printing a numbered ticket on the kitchen
  printer
- Only new or changed items print — items already sent are not reprinted
- Add a note that appears on the ticket
- Preview the ticket on screen before printing
- Retry if the printer is offline

**What the ticket shows:** table name, ticket number, time, and each item
with quantity and instructions. No prices — the kitchen does not need them.

---

## 7. Kitchen Display Screen *(module)*

**What it does:**
- Shows every open kitchen ticket on a second screen
- Orders appear as soon as they are sent from the till
- Kitchen staff mark items, or a whole order, as being prepared or ready
- Shows how long each order has been waiting, counted correctly regardless
  of the machine's timezone

---

## 8. Offers and coupons *(module)*

Set an offer once rather than trusting every cashier to remember it.

**What admins can do:**
- Create an offer that takes a **percentage**, a **fixed amount**, or gives a
  **free item**
- Apply it to the **whole bill** or to **selected items** — one dish, or a
  whole category
- Set a minimum bill, and a cap on how much a percentage offer can take off
- Set a date window, the days of the week it runs, and the hours of the day.
  A window from 22:00 to 02:00 is understood as crossing midnight
- Limit the total number of redemptions, and the number per customer
- Decide whether it applies automatically or needs a **coupon code**
- Decide whether it can combine with other offers, and which wins when two
  cannot combine

**What staff can do:**
- See the offers that are running, and why one is not
- Enter a coupon code a customer presents, and be told why it was refused —
  "ended on Sunday" rather than "it didn't work"

Every amount is calculated by the main process. The till sends the code; it
never sends a figure.

---

## 9. Loyalty *(module)*

Reward customers for coming back, automatically.

**What admins can do:**
- Reward at a number of **visits**, or a total amount **spent**
- Count that over a rolling window of days, or over the customer's whole
  history
- Give a percentage, a fixed amount, or a free item, with a cap

**What staff can do:**
- See how close a customer is to their next reward
- Apply an earned reward at billing

A reward resets that customer's progress, so a "fifth visit" reward does not
also pay out on the sixth.

---

## 10. Inventory and recipes *(module)*

**What staff can do:**
- Add inventory items with a unit of measure
- Set a low-stock level — items below it are highlighted
- Log purchases, wastage and manual adjustments with a note
- Link a menu item to its ingredients, so stock deducts automatically when
  the dish is billed
- See the recent movement history for an item

---

## 11. Customers *(module)*

**What staff can do:**
- Add customers with name and contact details
- See a customer's full order history
- Track an outstanding balance when payment is left on account, against a
  credit limit
- Settle a balance and record the payment

---

## 12. Expenses *(module)*

**What staff can do:**
- Record an expense with amount, category and notes
- Filter by date range
- Track categories such as groceries, utilities and maintenance

---

## 13. Staff, roles and permissions

**What admins can do:**
- Add staff with a name, PIN and role
- Assign one of five roles: **admin**, **manager**, **cashier**, **waiter**,
  **kitchen**
- **Edit what each role may do** — 32 permissions across six areas, from
  taking an order to restoring a backup
- Deactivate someone who has left; their history stays linked to them

Two rules keep the matrix safe to hand to an outlet's own admin:

1. **Admin always holds everything**, and is not editable — so no sequence of
   changes can lock the last administrator out of the screen where
   permissions are edited.
2. **Six permissions cannot be granted to any other role** — the ones that
   would let their holder become an admin, erase the records, or quietly
   widen their own access.

Permissions are enforced in the main process, against a session created by
verifying a PIN. The screen's copy of them decides only what to show.

---

## 14. Shifts and the trading day

**What staff can do:**
- Open a shift with an opening cash count
- Close it with a closing count and a note, and print a shift report
- Open and close the **trading day**, so a report covers the day you actually
  traded rather than a calendar day that cuts through a late service

---

## 15. Reports *(module)*

**What managers and admins can see:**
- **Sales summary** — revenue, orders, average order value, for today, this
  week, this month, this year, or a custom range
- **Tax collected** — the lines the active regime needs
- **Payment breakdown** — by method
- **Hourly chart** — which hours are busiest
- **What the offers cost** — each offer and loyalty reward, what it was given
  for, and that total as a share of revenue
- **CSV export**, with a byte-order mark and proper quoting, so Arabic opens
  correctly in Excel and a dish name containing a comma does not break the
  columns

---

## 16. Past orders *(module)*

**What staff can do:**
- Browse past orders with date, table, amount and status
- Filter by period
- See the items and payments for any past order
- Reprint a settled bill — a separate permission, because a reprint is a
  fraud vector

---

## 17. Dashboard

Today's figures the moment the app opens: sales, orders, average order value,
customers, and outstanding balances. Every number is read from the database —
there are no placeholder trends.

---

## 18. Appearance

**What admins can do:**
- Upload the outlet logo, validated by its actual content rather than its
  filename
- Pick an accent colour, with a contrast check that warns when text on it
  would be hard to read
- Choose a font from the faces already on the machine
- Choose compact or comfortable density
- Switch between light, dark and follow-the-system themes

---

## 19. Printing setup

**What admins can do:**
- See every printer the operating system exposes
- **Detect the attached printer**: one press identifies the model against a
  bundled database of 20 receipt printers and applies both the printer and
  the right paper width — setting one without the other is how an 80 mm
  layout ends up truncated on a 58 mm roll
- Assign a printer per station: receipts to the counter, tickets to the
  kitchen, with a fallback
- Choose the paper profile: 58 mm, 80 mm or A4
- Set copies, and whether printing is silent (it should be — a dialog on
  every ticket is unusable at service speed)
- **Edit the receipt layout**: which blocks appear and in what order, from 19
  blocks, starting from one of four presets. The presets stay as shipped, so
  "put it back" is always available
- **Test on a virtual printer**: render your own receipt as any of the 20
  models would print it, and be told when a line would be cut off

No drivers are bundled or downloaded. For a printer the system does not yet
have, the app names the model and points at the vendor's own driver page.

---

## 20. Backup and restore

**What admins can do:**
- **Export** the whole database and the dish images as a single ZIP, to any
  location
- **Import** from a previous export. The app takes a safety copy first
- Set an **automatic backup** to a folder, on a schedule, keeping the last
  few and deleting older ones
- Set a **reminder** on a day of the month. A reminder set for the 29th to
  31st fires on the last day of a short month rather than never

Restoring replaces the staff table too, so it is a way to install an admin
account — which is why it has its own admin-only permission.

**Recommended practice:** export at the end of every trading day and keep the
copy somewhere other than the till.

---

## 21. Settings

- Outlet name, address, phone, tax number, logo
- Country, currency (code, symbol, decimals, which side the symbol sits)
- Tax regime, rate, label, and whether prices include tax
- Language, numerals, theme
- Which modules this outlet uses
- The role permission matrix
- Printing, templates and the test bench
- Backup schedule and reminders
- Danger zone: reset the invoice counter, generate a recovery code, factory
  reset — each behind an admin-only permission
