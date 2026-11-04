# Kitchen POS — Product Overview

## What is Kitchen POS?

Kitchen POS is an offline-first point-of-sale system for restaurants. It runs
as a desktop application on Windows or macOS — no internet connection
required, no monthly subscription, and no data sent anywhere. Everything stays
in a database file on your own machine.

The system handles the full service workflow: taking orders, sending tickets
to the kitchen, printing bills, tracking inventory, managing staff and
shifts, running offers, and reporting — all from a single terminal.

**The interface is bilingual, and Arabic is the default.** Right-to-left
layout is built into the design rather than bolted on, and every screen,
dialog, message and receipt reads correctly in both Arabic and English.

---

## Who is it for?

- Standalone restaurants, cafés and quick-service outlets
- Cloud kitchens with a single billing point
- Food stalls and counters
- Any food business that needs a till that keeps working when the internet
  does not

**Region:** the app is region-agnostic. The first-run wizard asks which
country you are in and sets the currency and tax regime from a table of 25
countries — including the Gulf states, where the dinar's three decimal places
are handled correctly. Every one of those settings stays editable afterwards.

| Tax regime | Where it fits |
|---|---|
| **VAT** — one rate, one label, optionally included in menu prices | The Gulf, Europe, most of the world |
| **GST** — CGST and SGST per item, with HSN codes | India |
| **None** — no tax charged or printed | Unregistered businesses |

The regime is **snapshotted onto each bill**, so changing it later never
alters what an old invoice said.

---

## Key benefits

- **Works without internet.** Power cuts, network outages and SIM failures do
  not stop service.
- **Arabic first.** Not a translation layer over an English product — the
  default locale, the layout direction, the numerals and the receipt
  templates all start from Arabic.
- **Your tax rules, not someone else's.** Currency, rate, label and
  inclusive-or-exclusive pricing are all settings.
- **No recurring fees.** Pay once.
- **Your data stays with you.** No cloud account, no third party reading your
  sales.
- **Prints to any printer the computer can already see** — thermal 58 mm or
  80 mm, or A4. The app renders the receipt and hands it to the operating
  system's own print path, which is why Arabic comes out right.
- **Fast on a touchscreen.** Staff learn the order screen in minutes.

---

## What's included

| Feature | What it does |
|---|---|
| Order management | Dine-in and takeaway orders, per-item notes, covers |
| Table management | Visual floor plan with live status and live table totals |
| Menu management | Categories, items, prices, photos, multiple menus, scheduling |
| Billing | Legal invoices under VAT, GST or no tax, with a gapless invoice sequence |
| Kitchen tickets (KOT) | Printed to the kitchen printer, numbered |
| Kitchen Display Screen | Pending orders on a second screen, with per-item status |
| Inventory and recipes | Stock levels, automatic deduction on sale, wastage and purchases |
| Customers | Customer list, order history, running balance and credit limit |
| Expenses | Daily expenses by category |
| Staff and shifts | PIN login, five roles, an editable permission matrix, shift cash counts |
| Trading day | Open and close the business day, so reports match how you actually trade |
| **Offers and coupons** | Percentage, fixed amount or free item; whole bill or selected items; validity windows, usage limits, stacking rules |
| **Loyalty** | Reward returning customers automatically by visit count or spend |
| Reports | Sales by period, tax collected, payment breakdown, hourly chart, what the offers cost, CSV export |
| Past orders | Full history with a separate permission for reprinting a settled bill |
| Dashboard | Today's figures at a glance |
| Appearance | Logo, accent colour with a contrast check, font and density |
| Printing setup | Printer detection, per-station assignment, editable receipt templates, a test bench that renders your own receipt as any printer model would |
| Backup and restore | Full ZIP export including images, automatic on a schedule, with retention |
| Settings | Outlet identity, tax number, country, currency, language, numerals, theme, modules |

**Modules can be switched off.** Thirteen capabilities — the kitchen screen,
inventory, customers, expenses, offers, loyalty and others — are each a module
an owner enables or disables. A switched-off module disappears from the
navigation *and* is refused by the main process, so it cannot be reached by
typing a URL.

---

## Platform requirements

| Requirement | Details |
|---|---|
| Operating system | Windows 10 or later · macOS 12 (Monterey) or later |
| Internet | Not required for any feature |
| Printer | Any printer installed in the operating system. Thermal 58 mm and 80 mm receipt printers and A4 are all supported. 20 common receipt-printer models are recognised by name and configured automatically |
| Screen | 1280×720 minimum |
| Storage | ~200 MB for the installation; the database grows with use |

No printer drivers are bundled or downloaded. If the operating system can
print to it, so can Kitchen POS; if it cannot, the app identifies the model
and tells you what to install.

---

## First-time setup

The first run opens a wizard. It is resumable — if the installation is
interrupted, the draft survives.

1. **Language** — Arabic or English
2. **Country and currency** — sets the currency and suggests the tax regime
3. **Outlet identity** — name, address, phone, tax number, logo
4. **Tax** — regime, rate, label, and whether menu prices include tax
5. **Printer** — detect the attached printer and calibrate the paper width
6. **Modules** — which capabilities this outlet uses
7. **Admin account** — name and PIN, plus a recovery code

Every step is reachable again afterwards from Settings.

> **Take a backup once you are set up:** Settings → Backup → Export. Keep it
> on a USB drive or external storage. You can also set an automatic daily
> backup to a folder of your choosing.

---

## Known limitation

**Staff PINs are stored without hashing.** The database is a local file on
the restaurant's own machine and is not exposed on a network, but this is a
real limitation and is recorded as such in `ARCHITECTURE.md` §9. It should be
addressed before the app is used anywhere the database file is reachable by
people who should not read it.
