# Delivery Tracker

Legend: `[x]` done · `[ ]` not done (with reason)

Gate for every phase: `tsc` + `lint` + `test` green on **both** workspaces.
Final state: **231 tests** (94 frontend, 137 backend), plus a clean production
build.

---

## Phase 0 — Green baseline `[x]`

- [x] Install workspace dependencies; get a real signal from lint and test
- [x] Fix 4 unsafe `.get()` casts that could throw inside a billing transaction
- [x] Validate `reports:daily` custom range before binding
- [x] Pin `@types/archiver` to the installed major; drop the `as any` workaround
- [x] Eliminate all 76 backend `any` annotations
- [x] De-duplicate `errMsg` into `backend/src/lib/errors.ts`
- [x] Repair the vacuous backup-retention test suite
- [x] Clear the 2 frontend lint errors

## Phase 1 — i18n foundation `[x]`

- [x] Zero-dependency, type-safe core: provider, hook, pure translator
- [x] `ar` + `en` dictionaries; `en` canonical so a missing key fails to compile
- [x] Arabic default, persisted to `electron-store` and mirrored in `localStorage`
- [x] `<html lang dir>` driven by locale, seeded before React mounts
- [x] Locale-aware number, currency, percent, date, time, relative, elapsed
- [x] Arabic-Indic vs Latin numerals as an explicit setting
- [x] Standalone translator for code above the provider (error boundaries)
- [x] 52 tests: dictionary parity, placeholder parity, Arabic plural categories,
      currency placement and precision, numeral systems, date edge cases

## Phase 2 — Regional & fiscal configuration `[x]`

- [x] Typed settings schema with coercion and range clamping
- [x] Currency: code, symbol, decimals, symbol side, 12 regional presets
- [x] Tax regimes `vat` / `gst` / `none` with configurable rate and label
- [x] Tax-inclusive pricing, with the tax derived by subtraction so the parts
      sum to the printed gross
- [x] Legacy GST settings read forward, so existing installs keep working
- [x] Regime snapshotted per bill, so reprints reproduce the original
- [x] Migration 014: `tax_amount`, `tax_mode`, `tax_rate`, `wallet` payment
      method, and the 7 indexes every report was missing
- [x] 48 tests across every regime and rounding trap

## Phase 3 — Theming & design system `[x]`

- [x] Design tokens for light and dark, exposed to Tailwind via `@theme inline`
- [x] `light` / `dark` / `system` provider replacing the dead toggle
- [x] Offline Arabic+Latin font stack; no webfont is fetched
- [x] RTL-safe primitives: logical properties, `.rtl-flip`, Arabic leading
- [x] `.tabular` for price columns
- [x] Removed the inherited marketing-site CSS

## Phase 4 — UI translation sweep `[x]`

- [x] Shell: Sidebar, Header, AppLayout, LocaleSwitcher, ThemeToggle
- [x] Auth: Login, Setup, OpenShiftModal
- [x] Core: Tables, Order (cart, menu grid, bill dialog, void dialog), KDS, Menu
      (page + 5 modals)
- [x] Back office: Dashboard, Reports, Past Orders, Inventory, Expenses,
      Customers, Customer detail, Staff, Settings
- [x] Shared: CustomerSelect, QuickActionsFAB, toast, modal, error screens
- [x] Primitives: Select, Stepper, Modal, Toast screen-reader labels
- [x] Empty states, error states, confirmation copy
- [x] Locale switcher reachable from the header, the lock screen and the
      open-shift screen

## Phase 5 — Printing subsystem `[x]`

- [x] Printer discovery IPC
- [x] Per-station assignment (receipt / kitchen, with fallback)
- [x] Paper profiles 58 mm / 80 mm / A4
- [x] Silent printing, copies, margins, timeouts
- [x] Bilingual RTL receipt and KOT templates
- [x] Test print per station, showing paper size, currency sample, both digit
      sets and both scripts
- [x] Print preview IPC
- [x] 52 tests on template rendering

## Phase 6 — Hardening `[x]`

- [x] `local://` protocol handler confined to the image directory
- [x] Content-Security-Policy on the renderer
- [x] `will-navigate` and `setWindowOpenHandler` guards
- [x] HTML escaping on every interpolated receipt value
- [x] Removed 3 stub IPC handlers that returned success without doing anything
- [x] Removed the `reports:gst` stub
- [x] Removed dead marketing code and 2 scratch scripts
- [x] Fixed the packaging config: stale product name, missing `assets/`,
      `extract-zip` absent from the root package, `node_modules/**/*` shipping
      every devDependency, placeholder publish provider

## Phase 7 — Tests & verification `[x]`

- [x] i18n core + formatters (52)
- [x] Money + tax (48)
- [x] Receipt templates (52)
- [x] Path-confinement security boundary (18)
- [x] Date parsing + CSV quoting (22)
- [x] Backup retention, repaired (19)
- [x] Full production build of both workspaces

## Phase 8 — Documentation `[x]`

- [x] Rewrote `README.md` to match the code
- [x] Rewrote `ARCHITECTURE.md` — the old one described ESC/POS printing, a
      `modules/` directory that does not exist, and port 5200
- [x] `docs/guides/INSTALL.md`
- [x] `docs/guides/PRINTING.md`
- [x] `docs/guides/I18N.md`
- [x] `docs/guides/DEPLOYMENT.md`
- [x] `assets/README.md` documenting the required icons

---

## Defects found and fixed

Beyond the planned work. Each was a real failure, not a style preference.

### Would have produced wrong numbers

1. **The bill dialog recomputed tax in the renderer** with a hardcoded
   2.5% + 2.5% GST split while the main process computed it from the configured
   regime and each item's own rates. The cashier could collect a total that did
   not match the saved bill.
2. **`Math.round(v * 100) / 100` for money** — 8.075 is stored as
   8.074999999999999289 and rounded *down* to 8.07.
3. **The dashboard showed invented trends.** Every KPI carried a hardcoded
   percentage labelled "vs last period", plus fabricated sparkline data.
4. **The dashboard's `yearly` filter** fell through to the default branch and
   showed *today's* figures under a "Yearly" label.

### Would have crashed or silently failed

5. **Four unsafe `.get()` casts** — `better-sqlite3` returns `undefined` for a
   missing row; a missing order would throw inside the billing transaction.
6. **`reports:daily` with a custom filter** bound possibly-`undefined` dates.
7. **Staff roles `chef` and `cleaner`** were offered by the form but rejected by
   the CHECK constraint; the error was swallowed into `console.error`.
8. **Editing a staff member without changing their PIN** bound `undefined`
   and threw.
9. **`extract-zip` was missing from the root package**, so a packaged build
   crashed on backup import.
10. **`assets/` did not exist** though the build config referenced
    `assets/icon.ico`; the tray icon path never resolved when packaged.
11. **Three stub IPC handlers** returned `{ success: true }` without touching
    the database.

### Wrong by timezone

12. **SQLite's zone-less UTC timestamps parsed with `new Date()`** in four
    places — table occupancy, KDS wait time, order age, business-day duration.
    Off by the machine's offset: three hours in Riyadh, negative west of UTC.
13. **`toISOString().split('T')[0]` as "today"** in three date pickers — the UTC
    date, so after ~21:00 in Riyadh they opened on tomorrow.

### Invisible or inert UI

14. **Outlet name and tax number inputs** had no `value` and no `onChange`.
    Typing did nothing; nothing was saved. These print on every receipt.
15. **The dark-mode toggle** was read and set but never applied to anything.
16. **"Enable Notifications"** toggled a local boolean and raised a toast.
17. **Test Print** sent a fake kitchen ticket reading "If you can read this,
    printing is working!".
18. **`SvgIcon name="pencil"` / `"chevron-down"`** do not exist in the sprite,
    so the table-edit button and the KOT chevron rendered nothing.
19. **A `text-${align}` template class** would never be generated — Tailwind
    scans source text.
20. **`text-red-655`** is not a Tailwind colour.

### Data integrity

21. **The backup-retention test suite was vacuous** — its fixtures wrote `.db`
    files while the matcher accepted only `.zip`, so four assertions compared
    `[]` to itself and no retention logic was covered.
22. **CSV export had no BOM and no escaping** — Excel rendered Arabic as
    mojibake, and a dish name with a comma broke every following column.
23. **The backup reminder accepted day 29–31**, so a reminder set for those
    never fired in February.
24. **`settle-balance` could be submitted twice** while the first request was in
    flight, double-settling.
25. **`@types/archiver@8` installed against `archiver@6`** — the v8 types are
    not callable, so the code worked around its own broken types with `as any`.

### Build and tooling

28. **The frontend typecheck checked nothing.** `frontend/tsconfig.json` is a
    solution file with `"files": []`, so `tsc --noEmit` loaded no program and
    exited zero. `npm run build` was `tsc && vite build`, and Vite only
    transpiles — so neither the test script nor the build ever checked a
    type. Found in Phase 2 while adding the branding module; pointing the
    script at the two real projects surfaced nine errors in committed code,
    including five translation keys used by the Danger Zone card and the
    Staff page that exist in neither dictionary. The compile-time dictionary
    completeness check that should have caught them was running against an
    empty program.

### Security

26. **The `local://` protocol handler was unconfined** — one crafted URL in the
    renderer was an arbitrary file read.
27. **No CSP and no navigation guards** on the renderer.

---

## Not done, and why

| Item | Reason |
|---|---|
| Staff PIN hashing | A real improvement, but it changes the auth path and the recovery-code flow; it needs its own migration and test pass rather than being folded into this one. Documented as a known limitation in `ARCHITECTURE.md` §9 |
| Auto-update | Needs a hosted release feed and signed builds; out of scope and documented in `DEPLOYMENT.md` |
| Multi-terminal LAN sync | Architectural change — the database is a local file |
| Cloud backup | Needs credential storage and a provider choice |
| ZATCA Phase 2 e-invoicing | Cryptographic stamping and clearance require certification; the receipt layout and tax number are in place |
| Splitting the 390 kB dashboard chunk | Recharts. Irrelevant for a desktop app loading from disk; noted in `ARCHITECTURE.md` §12 |
| Low-stock notifications | The "Enable Notifications" toggle claiming to control them was removed rather than left inert. The feature itself is unbuilt |
