# Kitchen POS

**نظام نقاط بيع للمطاعم — عربي/إنجليزي، يعمل دون اتصال بالإنترنت**
*Offline-first, bilingual (Arabic / English) restaurant point of sale.*

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Stack](https://img.shields.io/badge/stack-Electron%20%2B%20React%2019%20%2B%20SQLite-purple)
![Locales](https://img.shields.io/badge/locales-ar%20(default)%20%2B%20en-green)
![Offline](https://img.shields.io/badge/offline-first-orange)

Kitchen POS runs entirely on the till. No internet, no cloud account, no
subscription — the whole database is a single SQLite file on the machine, and
every screen works with the network unplugged.

---

## Contents

- [What it does](#what-it-does)
- [Languages and regions](#languages-and-regions)
- [Printing](#printing)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [First run](#first-run)
- [Building an installer](#building-an-installer)
- [Backups](#backups)
- [Documentation](#documentation)
- [Development conventions](#development-conventions)
- [License](#license)

---

## What it does

| Area | Capability |
|---|---|
| **Orders** | Floor plan with live table status, dine-in / takeaway / delivery, temporary table names, per-item notes, kitchen tickets numbered per order, item-level voids with a recorded reason |
| **Kitchen display** | Wall-mounted board, tickets escalating by age, per-item or whole-ticket status, no prices |
| **Billing** | Configurable tax regime, split payments, on-account balances against a credit limit, gapless invoice numbering, reprints that reproduce the original document |
| **Menu** | Multiple menus with time-based auto-enable, categories, dish photos, availability toggles, recipes that deduct stock on sale |
| **Inventory** | Stock levels, purchase / wastage / manual adjustments with notes, low-stock thresholds, automatic deduction via recipes |
| **Customers** | Contact details, running balance against a credit limit, settle-balance flow, visit history |
| **Staff & shifts** | PIN sign-in, five roles, shift open/close with cash reconciliation and automatic discrepancy notes |
| **Business day** | An explicit open/close day that groups sales, independent of shifts |
| **Expenses** | Categorised spend, optional link to a staff member for salary entries |
| **Reporting** | Dashboard with real period-over-period comparison, sales trend, top items, tax report, past orders with reprint, CSV export |
| **Backups** | One-click ZIP of the database *and* dish images, scheduled auto-backup with retention, reminders, restore from the lock screen |

---

## Languages and regions

**Arabic is the default.** English is a first-class alternative, switchable from
the header, the lock screen and the open-shift screen — a user who cannot read
the current language can always reach the switcher.

What switching actually changes:

- Every string, including screen-reader labels and error screens.
- Page direction (`dir="rtl"` / `"ltr"`), with mirrored navigation, drawers and
  icons. Numeric keypads, clocks and stack traces stay left-to-right, because
  those are physical conventions rather than running text.
- Date, time, number and currency formatting, through `Intl`.
- Plural forms. Arabic has six CLDR plural categories against English's two, so
  counts go through `Intl.PluralRules` rather than a `count === 1` check.
- Optional Arabic-Indic digits (`٠١٢`) instead of Latin (`012`), independently
  of the language.

**Region is configuration, not code.** Settings → Language & region covers the
currency (code, symbol, decimal places, symbol side — twelve presets included),
and Settings → Taxes covers the regime:

| Regime | Behaviour |
|---|---|
| `vat` | One configurable rate across the bill, optionally tax-inclusive — the Gulf/EU model |
| `gst` | Per-item CGST + SGST split — the Indian model |
| `none` | No tax charged or printed |

The regime is snapshotted onto each bill, so changing it later never alters an
invoice that has already been issued.

---

## Printing

Receipts are HTML rendered by Chromium and sent through the operating system's
print pipeline. That is deliberate:

- It reaches **every** printer the OS can see — USB thermal, network, Bluetooth,
  A4 laser — with no vendor SDK and no driver bypass.
- Chromium shapes and bidi-orders Arabic correctly. Raw ESC/POS cannot: thermal
  firmware ships inconsistent Arabic code pages, and getting the presentation
  forms right by hand means pre-shaping the text yourself.

Configurable per outlet: separate receipt and kitchen printers, paper profile
(58 mm / 80 mm / A4), copies, silent printing (no dialog — essential at service
speed), receipt footer, and whether to print the tax breakdown. A test page
prints the paper size, a sample amount and both digit sets so the whole chain
can be verified in one go.

See [`docs/guides/PRINTING.md`](docs/guides/PRINTING.md).

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 30 |
| UI | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 with CSS-variable design tokens |
| Routing | React Router 7 (hash router — the packaged app is served from `file://`) |
| State | Zustand + React context |
| Charts | Recharts |
| Database | SQLite via `better-sqlite3`, WAL mode |
| i18n | In-house, zero runtime dependencies, `Intl`-based |
| Testing | Vitest |
| Linting | ESLint 10 + Prettier 3 |
| Packaging | electron-builder (NSIS / DMG) |

No webfonts, no CDNs, no analytics. Nothing is fetched at runtime.

---

## Project layout

```
.
├── backend/                    Electron main process
│   └── src/
│       ├── main.ts             App entry, window, protocol + CSP setup
│       ├── preload.ts          contextBridge surface (window.api)
│       ├── ipc/                One module per domain (17)
│       ├── db/
│       │   ├── index.ts        SQLite singleton (WAL)
│       │   ├── migrate.ts      Idempotent migration runner
│       │   └── migrations/     001 … 015, applied in order on startup
│       ├── lib/
│       │   ├── settings.ts     Typed settings schema with coercion
│       │   ├── money.ts        Currency-safe rounding
│       │   ├── format.ts       Intl formatting for receipts
│       │   ├── security.ts     Protocol confinement, CSP, nav guards
│       │   └── errors.ts       Shared error narrowing
│       └── services/
│           ├── tax.ts          Tax engine (vat / gst / none)
│           ├── billing.ts      Bill creation transaction
│           ├── receipt.ts      Pure HTML receipt + KOT rendering
│           └── printer.ts      Electron print driver
│
├── frontend/                   React renderer
│   └── src/
│       ├── i18n/               Translator, dictionaries, formatters
│       ├── theme/              light / dark / system provider
│       ├── layouts/            App shell
│       ├── pages/<Name>/       One folder per route, with its own components/
│       ├── components/         atoms → molecules → organisms
│       ├── contexts/           Auth, toast, modal, header, business session
│       ├── store/              Zustand slices
│       └── lib/                IPC client, dates, CSV, chart labels, settings
│
├── docs/
│   ├── guides/                 Install, printing, i18n, deployment
│   ├── technical/              Data model, IPC reference, flows
│   ├── business/               Features, roadmap, user stories
│   └── work/                   Plan, audit, delivery tracker
├── ARCHITECTURE.md
└── electron-builder.yml
```

---

## Getting started

### Prerequisites

- **Node.js 20 or later**
- A C/C++ toolchain, because `better-sqlite3` is a native module:
  - **Windows** — "Desktop development with C++" from the Visual Studio Build
    Tools, plus Python 3
  - **macOS** — `xcode-select --install`
  - **Linux** — `build-essential` and `python3`

If the native build fails, [`docs/guides/INSTALL.md`](docs/guides/INSTALL.md)
covers the fallbacks.

### Install

There are no npm workspaces, so each package installs separately:

```bash
npm install && npm install --prefix frontend && npm install --prefix backend
```

### Run in development

```bash
npm run dev
```

This starts the Vite dev server on `:5205`, the backend TypeScript compiler in
watch mode, and Electron pointed at the dev server.

### Checks

```bash
npm run tsc   --prefix frontend   # type-check
npm run lint  --prefix frontend   # lint
npm run test  --prefix frontend   # unit tests
npm run build --prefix backend    # compile main process
npm run lint  --prefix backend
npm run test  --prefix backend
```

---

## First run

1. The setup wizard asks for your **language** first, then the outlet name and
   an admin PIN. Everything after that is labelled in the language you chose.
2. A recovery code is generated and saved — **store it somewhere safe.** It is
   the only way to reset the admin PIN without the PIN.
3. Settings → **Language & region**: currency code, symbol and decimals.
4. Settings → **Taxes**: regime, rate, and whether menu prices include tax.
5. Settings → **Outlet**: name, address, phone and tax registration number.
   These print at the top of every receipt; without a tax number, receipts are
   correctly marked as simplified invoices rather than tax invoices.
6. Settings → **Printing**: assign the receipt and kitchen printers, pick the
   paper size, and run a test print on each.
7. Menu → add categories and dishes. Tables → lay out the floor.
8. Settings → **Backups**: turn on auto-backup and point it at a USB drive or a
   synced folder.

---

## Building an installer

```bash
npm run build     # frontend + backend
npm run package   # electron-builder
```

- **Windows** → `dist-electron/Kitchen POS Setup x.y.z.exe` (NSIS)
- **macOS** → `dist-electron/Kitchen POS-x.y.z.dmg`

macOS distribution outside your own machine needs code signing and
notarisation. See [`docs/guides/DEPLOYMENT.md`](docs/guides/DEPLOYMENT.md).

---

## Backups

A backup is a single ZIP containing the SQLite database **and** the dish images,
so a restore brings back a complete, working install.

- **Manual** — Settings → Data & backups → *Back up now* (to the configured
  folder) or *Export backup* (to a location you pick).
- **Scheduled** — daily or weekly, to a folder of your choosing, with automatic
  pruning of old files.
- **Reminders** — a persistent prompt at a set time if you prefer to run it
  yourself.
- **Restore** — Settings → *Import backup*, or from the lock screen's quick
  actions, which is where you need it after a reinstall when there is no PIN to
  sign in with yet.

Restoring replaces everything and restarts the app. Keep at least a week of
backups off the machine.

---

## Documentation

| Document | Covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Processes, data model, IPC, security model |
| [`docs/guides/INSTALL.md`](docs/guides/INSTALL.md) | Installation, native-module troubleshooting |
| [`docs/guides/PRINTING.md`](docs/guides/PRINTING.md) | Printer setup, paper profiles, Arabic receipts |
| [`docs/guides/I18N.md`](docs/guides/I18N.md) | Adding strings, adding a locale, RTL rules |
| [`docs/guides/DEPLOYMENT.md`](docs/guides/DEPLOYMENT.md) | Release checklist, signing, rollout |
| [`docs/work/02-AUDIT.md`](docs/work/02-AUDIT.md) | Baseline audit of the codebase |
| [`docs/work/01-TRACKER.md`](docs/work/01-TRACKER.md) | Delivery tracker |

---

## Development conventions

- **Pages** live in `src/pages/<Name>/`, each with its own `components/`
  subfolder. Page-specific components never go in the global `components/`.
- **Global components** follow Atomic Design: `atoms/` → `molecules/` →
  `organisms/`.
- **No user-facing string literals.** Everything goes through `t()`. `en.ts`
  defines the key set and `ar.ts` is typed against it, so a missing Arabic
  translation is a compile error.
- **Logical CSS properties only** — `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`,
  `text-start`/`text-end`, `border-s`/`border-e`. Physical `ml-`/`left-`/
  `text-left` breaks RTL.
- **Colours come from tokens** (`bg-surface`, `text-muted`, `border-line`, …).
  Literal palette classes are reserved for things whose colour carries meaning
  independent of the theme: table status, KDS severity, role chips.
- **Money never uses raw floats.** Round through `lib/money.ts` in the backend
  and format through `formatCurrency` in the frontend.
- **Tax is never computed in the renderer.** Ask `billing:preview`; the main
  process owns the arithmetic.
- **Database timestamps** are zone-less UTC. Parse them with
  `lib/datetime.ts` — never `new Date(string)`.
- **New IPC channel**: handler in `backend/src/ipc/<module>.ts`, registered in
  `main.ts`, exposed in `preload.ts`, typed in `frontend/src/lib/ipc.ts`, and
  added to the mock API in the same file.
- **Schema changes** go in a new `backend/src/db/migrations/0NN_*.sql`. Use
  `IF NOT EXISTS`; migrations run once and are recorded.
- **Never import Node built-ins in the renderer.** `fs`, `path` and
  `better-sqlite3` are main-process only; the renderer talks over `window.api`.

---

## License

MIT — see [LICENSE](frontend/LICENSE).
