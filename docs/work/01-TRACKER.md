# Delivery Tracker

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

Gate for every phase: `tsc` + `lint` + `test` green on **both** workspaces.

---

## Phase 0 — Green baseline  `[x]`

- [x] Install workspace dependencies, get a real signal from lint/test
- [x] Fix 4 unsafe `.get()` casts that could throw inside a billing transaction
- [x] Validate `reports:daily` custom range before binding
- [x] Pin `@types/archiver` to the installed major, drop the `as any` workaround
- [x] Eliminate all 76 backend `any` annotations
- [x] De-duplicate `errMsg` into `backend/src/lib/errors.ts`
- [x] Repair the vacuous backup-retention test suite
- [x] Clear the 2 frontend lint errors

## Phase 1 — i18n foundation  `[x]`

- [x] `frontend/src/i18n/` core: provider, hook, typed keys, interpolation, plurals
- [x] `ar` + `en` dictionaries (single source of truth for key shape)
- [x] Arabic default, persisted to `electron-store` and `localStorage`
- [x] `<html lang dir>` driven by locale
- [x] Locale-aware formatters: number, currency, date, time, relative
- [x] Arabic-Indic vs Latin numeral option
- [x] Unit tests for the i18n core and formatters

## Phase 2 — Regional & fiscal configuration  `[x]`

- [x] Typed settings schema shared by main and renderer
- [x] Currency: code, symbol, decimals, symbol position
- [x] Tax modes: `vat` / `gst` / `none` with configurable rate and label
- [x] Tax-inclusive pricing support
- [x] Preserve existing GST (CGST/SGST) behaviour and data
- [x] Unit tests for tax + money

## Phase 3 — Theming & design system  `[x]`

- [x] Design tokens for light + dark
- [x] `light` / `dark` / `system` theme provider, wired to the real toggle
- [x] Offline Arabic-capable font stack
- [x] RTL-safe layout: logical properties, mirrored sidebar/drawer
- [x] Remove the marketing-site CSS that does not belong

## Phase 4 — UI translation sweep  `[x]`

- [x] Shell: sidebar, header, layout, FAB, toasts, modals
- [x] Auth: Login, Setup
- [x] Core: Tables, Order, KDS, Menu
- [x] Back office: Dashboard, Reports, Past Orders, Inventory, Expenses,
      Customers, Staff, Settings
- [x] Empty states, error states, confirmation copy
- [x] Locale switcher in the UI

## Phase 5 — Printing subsystem  `[x]`

- [x] Printer discovery IPC
- [x] Per-station printer assignment (receipt / kitchen)
- [x] Paper profiles: 58 mm / 80 mm / A4
- [x] Silent printing, copies, margins
- [x] Bilingual RTL receipt + KOT templates
- [x] Test print
- [x] Print preview
- [x] Unit tests for template rendering

## Phase 6 — Hardening  `[x]`

- [x] Confine the `local://` protocol handler to the image directory
- [x] Content-Security-Policy on the renderer
- [x] Navigation / window-open guards
- [x] Remove stray scratch scripts

## Phase 7 — Tests & verification  `[x]`

- [x] i18n core + formatter tests
- [x] Money + tax tests
- [x] Receipt template tests
- [x] Settings schema tests
- [x] Full build of both workspaces

## Phase 8 — Documentation  `[x]`

- [x] Rewrite root `README.md` to match reality
- [x] `docs/guides/INSTALL.md`
- [x] `docs/guides/PRINTING.md`
- [x] `docs/guides/I18N.md`
- [x] `docs/guides/DEPLOYMENT.md`
- [x] Update `ARCHITECTURE.md`
