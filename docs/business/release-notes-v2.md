# Release Notes — v2.0

The release that takes Kitchen POS from an English, India-only till to a
bilingual, region-agnostic one — and then gives it a platform: modules,
permissions, branding, a real printing subsystem, and offers.

For v1.0, see [`release-notes-v1.md`](./release-notes-v1.md).

---

## Arabic is now the default language

Not a translation layer over an English product.

- **Arabic by default** on a fresh installation; English a first-class
  alternative
- **Full right-to-left layout** — the sidebar, the dialogs, the charts and the
  receipts, not only the text. Every stylesheet uses logical properties, so
  direction is a property of the document rather than a set of overrides
- **Arabic-Indic or Latin numerals**, as a separate choice from the language
- Dates, times, currency, percentages and relative times all follow the
  chosen language
- **No string a user can see is a hardcoded literal.** The English dictionary
  is the reference and the Arabic one is checked against it by the type
  system, so a missing key fails to compile rather than appearing as a raw key
  on a customer's receipt
- **No font is fetched from the internet** — the Arabic and Latin faces are
  resident on the machine, which is what "offline-first" has to mean

## Your tax rules, not India's

The app was hardwired to Indian GST: a CGST and an SGST amount on every bill,
`cgst_rate` and `sgst_rate` on every menu item, and `₹` in twelve places.

- **Three regimes:** `VAT` (one configurable rate and label), `GST` (the
  original per-item split, unchanged) and `None`
- **Tax-inclusive pricing** under VAT, which is the norm across the Gulf. The
  tax is derived by subtraction, so the parts add back up to the printed gross
  — which is what an auditor checks
- **Currency is a setting:** code, symbol, decimal places, and which side the
  symbol sits on. Twelve regional presets
- **A country table of 25 countries** sets the currency and suggests the
  regime, with the right minor units — three decimal places for the Gulf
  dinars
- **Existing GST installations keep working.** The legacy settings are read
  forward, and historical bills are untouched
- **The regime is recorded on each bill**, so changing the settings later
  cannot retroactively alter what an invoice said

## Printing that works with the printer you have

The documentation claimed direct USB ESC/POS printing. The code never did
that — it rendered an HTML receipt into a hidden window and printed it. That
approach is right, because it works with every installed printer and renders
Arabic correctly; the implementation was thin.

- **Printer discovery** — see every printer the operating system exposes
- **Detect my printer** — one press identifies the model against a bundled
  database of 20 receipt printers and applies the printer **and** the right
  paper width together
- **Per-station assignment** — receipts to the counter, tickets to the
  kitchen, with a fallback
- **Paper profiles** — 58 mm, 80 mm and A4
- **Silent printing.** Before this a dialog appeared for every single ticket
  and bill, which is unusable at service speed. A blank window also flashed on
  screen on every print; it no longer does
- **Bilingual right-to-left receipt and kitchen-ticket templates**
- **Editable receipt layout** — 19 blocks, ordered, from four presets. The
  presets stay as shipped, so "put it back" is always available
- **A virtual printer bench** — render your own receipt as any of the 20
  models would print it, and be told when a line would be cut off
- **A real test print**, showing the paper size, a currency sample, both digit
  sets and both scripts. The old one printed a fake kitchen ticket reading
  "If you can read this, printing is working!"

## Modules, so an outlet runs only what it uses

- **13 modules** — the kitchen screen, inventory, customers, expenses,
  reports, multiple menus, accounting, offers, coupons, loyalty and others
- Each has a bilingual name and description, declared dependencies, and a
  default
- Switching off a module that another depends on switches that one off too,
  and says so first
- A disabled module **is refused by the main process**, not merely hidden —
  so it is not reachable by typing its URL

This is a declared registry, not a plugin loader. A till that handles money
does not execute code downloaded at runtime.

## Roles that are actually checked

The app had roles and checked none of them. Every signed-in person — a waiter,
a kitchen hand — could open Settings, edit the menu, read the day's takings,
or factory-reset the till.

- **32 permissions** across six areas
- **An editable matrix**, so an outlet can give its cashiers the reports
  screen or take table management from its waiters
- **Enforced in the main process**, against a session it created by verifying
  a PIN. The screen's copy decides only what to show
- **Admin holds everything, always,** and is not editable — so no sequence of
  changes locks the last administrator out of the permissions screen
- **Six permissions cannot be granted away** — the ones that would let their
  holder become an admin, erase the records, or widen their own access. An
  attempt is refused rather than stored
- A **fifth role**, `kitchen`. The staff form had offered `chef` and
  `cleaner`, which the database rejected with an error the screen swallowed
- The landing screen after sign-in is the first one the person's own
  permissions allow, rather than a dashboard they cannot read

## Appearance

- Outlet **logo**, validated by its content rather than its filename
- **Accent colour** with a WCAG contrast check that warns rather than refuses,
  and a dark-mode accent derived from the same colour
- **Font** from the faces already on the machine
- **Density** — compact or comfortable
- **Light, dark or follow-the-system.** The old dark-mode toggle was read and
  set but applied to nothing

## Offers, coupons, gifts and loyalty

The only discount the till had was a free-form number a cashier typed: no
record of why, no limit, no expiry.

- **Offers** — a percentage, a fixed amount, or a free item; the whole bill or
  one dish or a category; a minimum, a cap, a date window, the days of the
  week and the hours of the day
- **Coupons** — a code, matched regardless of case or stray space because it
  is read off a printed slip, with total and per-customer redemption limits
- **Stacking rules** — whether an offer combines with others, and which wins
  when two cannot
- **Loyalty** — reward at a number of visits or an amount spent, over a
  rolling window or a whole history. Taking a reward resets that customer's
  progress, so a "fifth visit" reward does not also pay on the sixth
- **What the offers cost** — in Reports: each offer, how often it was given,
  the total, and that total as a share of revenue. Drawn from what was
  actually given away per bill, not from what the rules say an offer could
  cost
- Every amount is calculated by the main process. The till sends the code; it
  never sends a figure

## A first run that sets the till up

- **A stepped, resumable wizard:** language, country and currency, outlet
  identity and logo, tax regime, printer, modules, admin account and recovery
  code
- The draft survives an interrupted installation — **without** the admin PIN,
  which is not something to leave in browser storage
- Every step is reachable again from Settings

## Security

- **The `local://` protocol handler is confined to the image directory.** It
  previously forwarded any path straight to the filesystem, which made one
  crafted URL in the renderer an arbitrary file read
- **A Content-Security-Policy** on the renderer, plus navigation guards
- **HTML escaping on every value interpolated into a receipt**
- **A recovery code** for a lost admin PIN

## Corrections to figures that were simply wrong

| What it showed | What was wrong |
|---|---|
| The bill dialog's total | It recomputed tax in the renderer with a hardcoded 2.5% + 2.5% split while the main process used the configured regime. A cashier could collect a total the saved bill did not match |
| Any rounded amount | `Math.round(v * 100) / 100` rounds 8.075 **down** to 8.07, because the stored value is 8.074999999999999289 |
| Every dashboard KPI | Carried a hardcoded percentage labelled "vs last period", with fabricated sparkline data |
| The dashboard's "Yearly" filter | Fell through to the default branch and showed **today's** figures under a yearly label |
| Table occupancy, kitchen wait time, order age, trading-day duration | SQLite's zone-less UTC timestamps were parsed as local time — off by three hours in Riyadh |
| Three date pickers | Defaulted to the **UTC** date, so after about 21:00 in Riyadh they opened on tomorrow |
| CSV exports | No byte-order mark, so Excel rendered Arabic as mojibake, and no quoting, so a dish name with a comma broke every following column |

## Things that were there but did nothing

Each of these was removed or made real, rather than left in place:

- The **outlet name and tax number fields** had no value and no change
  handler. Typing did nothing and nothing was saved — and these print on every
  receipt
- The **dark-mode toggle** was read and set but applied to nothing
- **"Enable Notifications"** flipped a local boolean and raised a toast
- **Test Print** sent a fake kitchen ticket
- **Three IPC handlers** returned success without touching the database
- Two icons referenced sprite entries that do not exist, so the table-edit
  button and a chevron rendered nothing

## Crashes and silent failures fixed

- Four unsafe row casts that would have thrown **inside a billing
  transaction** when a row was missing
- A custom report range bound possibly-undefined dates
- Editing a staff member without changing their PIN bound `undefined` and threw
- `extract-zip` was missing from the root package, so a packaged build crashed
  on backup import
- `assets/` did not exist though the build configuration referenced
  `assets/icon.ico`
- The backup reminder accepted day 29–31, so one set for those never fired in
  February
- A customer balance could be settled twice by double-submitting
- The backup-retention test suite was **vacuous**: its fixtures wrote `.db`
  files while the matcher accepted only `.zip`, so four assertions compared an
  empty list to itself and no retention logic was covered at all

## Testing and tooling

| | Before | Now |
|---|---:|---:|
| Automated tests | 39 | **686** |
| Backend `any` annotations | 76 | **0** |

- A **continuous-integration workflow** now runs typecheck, lint, tests and
  the production build on every pull request. They had been run by hand
- A **database verification harness** (`npm run verify:db --prefix backend`)
  starts Electron against a throwaway data directory and asserts what no pure
  unit test can reach: every migration, the schema and indexes each one
  claims, the `CHECK` and `UNIQUE` constraints, the money path, the caps and
  limits, and the rows written inside the billing transaction

## Packaging

- The product name in the build configuration was stale
- `assets/` was missing entirely
- `node_modules/**/*` was shipping every development dependency
- The publish provider was a placeholder

---

## Known limitations

| Limitation | Status |
|---|---|
| **Staff PINs are stored without hashing** | Recorded in `ARCHITECTURE.md` §9. It changes the authentication path and the recovery-code flow together, so it needs its own migration and test pass. First item in any security pass |
| One terminal per installation | The database is a local file. Multi-terminal sync is an architectural change, not a setting |
| No cloud backup | Local manual and scheduled backup both work |
| No automatic updates | Needs a hosted release feed and signed builds |
| No low-stock notification | The inventory screen highlights low stock; nothing alerts you |
| ZATCA Phase 2 cryptographic stamping | The receipt layout and tax-number field are in place; the signing chain requires certification |
| Customer menu by QR, accounting, in-app help | On the roadmap |
