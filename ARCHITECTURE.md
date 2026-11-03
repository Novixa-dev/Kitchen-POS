# Kitchen POS — Architecture

> Single terminal · Windows / macOS / Linux · Offline-first
> Bilingual Arabic (default) / English · Region-configurable tax and currency

This document describes the system as it is. For how to work on it, see
[`README.md`](README.md); for installing, printing, i18n and releasing, see
[`docs/guides/`](docs/guides/).

---

## 1. Process model

Two processes, one boundary.

```
┌─────────────────────────────────────────────────────────────┐
│ Main process (Node.js)                                      │
│   • SQLite (better-sqlite3, WAL)                            │
│   • Settings (electron-store)                               │
│   • Tax engine, bill creation, receipt rendering, printing  │
│   • Backups, scheduler, migrations                          │
└────────────────────────┬────────────────────────────────────┘
                         │ ipcMain.handle / ipcRenderer.invoke
                         │ exposed as `window.api` by preload.ts
┌────────────────────────┴────────────────────────────────────┐
│ Renderer (Chromium, contextIsolation: true)                 │
│   • React 19 UI                                             │
│   • i18n + theme providers                                  │
│   • No Node APIs, no filesystem, no database                │
└─────────────────────────────────────────────────────────────┘
```

**The renderer never computes money or tax.** It asks `billing:preview` for the
authoritative figures and renders them. This is not stylistic: an earlier
version recomputed tax in the renderer with a hardcoded rate, and the total the
cashier collected could differ from the bill that was saved.

---

## 2. Directory layout

```
backend/src/
├── main.ts              App entry: window, protocol, CSP, tray, IPC wiring
├── preload.ts           contextBridge surface — the only renderer entry point
├── scheduler.ts         Auto-backup and reminder timers
├── ipc/                 One module per domain (20)
├── auth/
│   ├── permissions.ts   30 permissions, 6 domains, the role matrix, the
│   │                    admin-only rule and the escalation refusal
│   ├── session.ts       Who is signed in, as the main process knows it
│   └── guard.ts         Channel → permission table; wraps ipcMain.handle
├── features/
│   ├── catalogue.ts     Feature-module manifests
│   └── resolve.ts       Dependency closure, cascade planning
├── db/
│   ├── index.ts         SQLite singleton, WAL mode
│   ├── migrate.ts       Idempotent runner, records applied files
│   └── migrations/      001 … 015
├── lib/
│   ├── settings.ts      Typed schema, coercion, legacy-key migration
│   ├── money.ts         Currency-safe rounding
│   ├── format.ts        Intl formatting for printed documents
│   ├── security.ts      Protocol confinement, CSP, navigation guards
│   ├── colour.ts        WCAG contrast; one accent adapted to both themes
│   ├── branding.ts      Presets, font stacks, density
│   ├── countries.ts     25 country profiles: currency, minor units, tax
│   ├── image.ts         Logo validation by magic bytes, not by extension
│   └── errors.ts        Error narrowing shared by every handler
└── services/
    ├── tax.ts           Regime engine: vat / gst / none
    ├── billing.ts       Bill-creation transaction
    ├── receipt.ts       Pure HTML rendering (no Electron import)
    └── printer.ts       Offscreen window, OS print call, discovery

frontend/src/
├── i18n/                Translator, dictionaries, Intl formatters
├── theme/               light / dark / system, plus the outlet's branding
├── auth/                Permission context, gates, routes, refusal messages
├── features/            Feature-module context, gates, routes
├── layouts/AppLayout    Shell: sidebar + header + content
├── pages/<Name>/        One folder per route, each with its own components/
├── components/
│   ├── atoms/           Button, Input, Select, Stepper, Toggle, …
│   ├── molecules/       KPICard, ChartTooltip
│   └── organisms/       Navigation, modal, toast, FAB, CustomerSelect
├── contexts/            Auth, toast, modal, header, business session
├── store/               Zustand slices (auth, order)
└── lib/
    ├── ipc.ts           Typed API surface + a mock for browser-only dev
    ├── datetime.ts      Parsing SQLite's zone-less timestamps
    ├── useAppSettings.ts Shared settings cache
    ├── csv.ts           RFC 4180 export with a UTF-8 BOM
    └── chartLabels.ts   Locale-aware axis and tooltip labels
```

**Page rule:** every route lives in `pages/<Name>/` with its own `components/`
subfolder. Page-specific components never enter the global `components/` tree.

---

## 3. Data model

SQLite, 15 migrations, applied in filename order and recorded in
`_migrations`. Migrations are idempotent and run on every startup.

### Core tables

| Table | Holds | Notes |
|---|---|---|
| `staff` | Name, PIN, role, active flag | Roles: `admin`, `manager`, `cashier`, `waiter`, `kitchen` (migration 015) |
| `tables` | Name, capacity, section, `custom_name` | `custom_name` is a temporary party label, cleared when the bill settles |
| `menus` | Named menus with optional auto-enable schedule | Migrations 008, 009 |
| `categories` | Belong to a menu | |
| `menu_items` | Price, veg flag, availability, image, `cgst_rate`/`sgst_rate`, `hsn_code` | The GST fields are only read under the `gst` regime |
| `orders` | Table, staff, status, covers, type, `business_date` | Status: `open`, `kot_sent`, `billed`, `cancelled` |
| `order_items` | **Snapshotted** name, price and tax rates, plus `kot_number` and `preparation_status` | Snapshotting is why a later price change cannot alter a historical bill |
| `bills` | `bill_number`, taxable, `cgst_amount`, `sgst_amount`, `tax_amount`, `tax_mode`, `tax_rate`, discount, total | `tax_mode`/`tax_rate` snapshot the regime so reprints reproduce the original |
| `payments` | Method, amount, reference | `cash`, `card`, `upi`, `wallet`, `complimentary`, `unpaid` |
| `customers` | Contact, `credit_limit`, `outstanding_balance` | |
| `inventory_items` | Stock, unit, low-stock threshold, cost | |
| `menu_inventory_map` | Recipe: menu item → inventory item + quantity | Drives automatic stock deduction |
| `inventory_log` | Purchase / sale / adjustment / wastage with notes | |
| `shifts` | Open/close times, opening and closing cash, note | Cash reconciliation |
| `business_sessions` | Business day open/close | A unique partial index enforces one open day |
| `expenses` | Date, category, amount, optional staff link | |

### Invariants worth knowing

- **Order items snapshot their tax rates and price** at the moment they are
  ordered. Editing a menu item never changes an existing order.
- **Bills snapshot the tax regime.** Switching from GST to VAT does not
  relabel invoices already issued.
- **Invoice numbers are gapless.** The counter advances only after the bill
  transaction commits, so a failed bill cannot burn a number. Both GST and VAT
  audits require this.
- **Timestamps are zone-less UTC.** `CURRENT_TIMESTAMP` writes
  `YYYY-MM-DD HH:MM:SS` with no marker. Parse it with
  `frontend/src/lib/datetime.ts` or `backend/src/lib/format.ts`, never
  `new Date(string)` — that reads it as local time.
- **One open business session** at a time, enforced by
  `CREATE UNIQUE INDEX … WHERE status = 'open'`.

---

## 4. Tax engine

`backend/src/services/tax.ts`. Three regimes, selected in Settings:

| Regime | Rate source | Shape |
|---|---|---|
| `vat` | One bill-level rate | Single tax line; optionally price-inclusive |
| `gst` | Each item's `cgst_rate` + `sgst_rate` | Two tax lines |
| `none` | — | No tax charged or printed |

### Inclusive pricing

Under inclusive pricing the displayed price already contains the tax, so the
net is `gross / (1 + rate)` and the tax is derived by **subtraction**:

```
net = round(gross / (1 + rate/100))
tax = round(gross - net)
```

Deriving the tax by subtraction rather than `net × rate` guarantees that the
two printed parts add back up to the printed gross. That is the property a tax
auditor checks, and it is covered by a test across a range of prices.

Under inclusive GST the recovered tax is apportioned across CGST and SGST by
their rates, so the halves still sum to the whole.

### Rounding

Line amounts are rounded **before** summing, so the printed line amounts add up
to the printed total — a cashier adding the receipt by hand gets the same
answer.

`lib/money.ts` rounds half away from zero via the number's own decimal string:
`Math.round(v * 100) / 100` is wrong for money, because 8.075 is stored as
8.074999999999999289 and rounds *down* to 8.07.

---

## 5. IPC surface

17 domains. Every handler returns `{ success, data?, error? }`; nothing throws
across the boundary.

| Channel group | Representative channels |
|---|---|
| `orders:*` | `create`, `getOpen`, `getByTable`, `sendKOT`, `cancelOrder`, `cancelOrderItem`, `updateCustomer` |
| `billing:*` | `preview`, `createBill`, `getBill` |
| `menu:*` | `getMenus`, `upsertMenu`, `duplicateMenu`, `getAll`, `upsertItem`, `deleteItem`, `toggleAvailable`, `upsertCategory`, `deleteCategory`, `getRecipe`, `updateRecipe`, `uploadImage` |
| `tables:*` | `getAll`, `upsert`, `delete`, `updateCustomName` |
| `kds:*` | `getActiveTickets`, `updateItemStatus`, `updateOrderStatus` |
| `inventory:*` | `getAll`, `adjust`, `upsertItem` |
| `customers:*` | `getAll`, `getById`, `create`, `update`, `delete`, `search`, `settleBalance`, `getHistory` |
| `staff:*` | `login`, `getAll`, `upsert`, `delete`, `changePin` |
| `shifts:*` | `getActive`, `open`, `close`, `getTotals` |
| `businessSession:*` | `getActive`, `start`, `close` |
| `expenses:*` | `getAll`, `create`, `delete` |
| `reports:*` | `daily`, `getPastOrders`, `printPastBill` |
| `dashboard:*` | `getMetrics` |
| `print:*` | `listPrinters`, `bill`, `kot`, `test`, `previewBill`, `previewKot` |
| `backup:*` | `export`, `import`, `getAutoBackupConfig`, `setAutoBackupConfig`, `selectAutoBackupPath`, `triggerNow` |
| `settings:*` | `get`, `save`, `reset` |
| `system:*` | `isSetupComplete`, `completeSetup`, `factoryReset`, `generateRecoveryCode`, `verifyRecoveryCode`, `resetAdminPin` |

Adding a channel means four edits: handler, registration in `main.ts`, exposure
in `preload.ts`, and a typed entry plus a mock in `frontend/src/lib/ipc.ts`.
The mock matters — it is what lets the UI run in a plain browser.

---

## 6. Settings

`backend/src/lib/settings.ts` owns one validated schema:

```
locale, numerals, theme
currency { code, symbol, decimals, position }
outlet   { name, address, phone, taxNumber, logoPath }
tax      { mode, rate, inclusive }
print    { receiptPrinter, kitchenPrinter, paperWidth, copies,
           silent, footerText, showTaxBreakdown }
kdsEnabled, inventoryAutoDebit
```

Every field is coerced and range-clamped on read, so a corrupted store degrades
to a working default instead of leaking `undefined` onto a customer's invoice.
Pre-schema flat keys (`outlet_name`, `gstin`, `is_gst_enabled`) are still read,
so an existing install keeps its configuration: GST switched off maps to
`none`, a stored GSTIN maps to `gst`.

`settings:get` returns the validated tree **plus** flat aliases derived from
it, so older renderer call sites keep working and the two views cannot
disagree. The renderer reads through `lib/useAppSettings.ts`, a module-level
cache refreshed on a `settings-updated` event, so the dozen screens that need
the regime or the currency do not each make their own round trip.

---

## 7. Internationalisation

See [`docs/guides/I18N.md`](docs/guides/I18N.md) for the full treatment.
Architecturally:

- `locales/en.ts` is canonical; `TranslationKey` derives from it, and `ar.ts` is
  typed against it — a missing Arabic key is a compile error.
- `translate.ts` is pure, so it is reusable outside React and cheap to test.
- Plurals go through `Intl.PluralRules`: Arabic has six CLDR categories against
  English's two.
- Direction lives on `<html dir>`; components use CSS logical properties only.
- Receipt copy lives in `services/receipt.ts`, not the renderer dictionary,
  because the main process prints with no window open.
- Zero runtime dependencies, no fetched locale packs — the app is offline.

---

## 8. Printing

HTML rendered by Chromium, sent through the OS print pipeline. The reasoning
and the configuration are in [`docs/guides/PRINTING.md`](docs/guides/PRINTING.md).

Structurally:

- `services/receipt.ts` is **pure** — data in, HTML string out, no Electron
  import — so output is asserted in unit tests rather than on paper.
- `services/printer.ts` owns the offscreen window, the OS print call, printer
  discovery, and timeouts (30 s silent, 5 min with a dialog).
- Paper profiles are a map of width, font sizes, padding, and whether there is
  room for a unit-price column. 58 mm drops that column because 48 mm of
  printable width cannot hold four.
- A cancelled dialog resolves as success, not failure — it is a choice, not an
  error.

---

## 9. Security model

The app is offline and single-user, but it still renders content the user
supplied: dish images chosen from disk, and item names that end up inside
receipt HTML.

| Control | Implementation |
|---|---|
| `contextIsolation: true`, `nodeIntegration: false` | `main.ts` — the renderer has no Node access |
| **Confined `local://` protocol** | `lib/security.ts`. Serves only the app's `images/` directory, rejecting `..` traversal, percent-encoded traversal, NUL bytes, malformed escapes, and the `images-secret` sibling-prefix trap a `startsWith` check would allow |
| **Content-Security-Policy** | `script-src 'self'`, `object-src 'none'`, `form-action 'none'`, `connect-src 'self'` in production |
| **Navigation guards** | `will-navigate` blocks leaving the app; `setWindowOpenHandler` sends http(s) to the default browser and refuses every other scheme, so a `file:` URL cannot launch a handler |
| **HTML escaping** | `receipt.ts` escapes every interpolated value — item names and outlet details are user-entered and land inside a `data:` URL |
| **No JS in print windows** | `javascript: false` on the offscreen print window |
| **Permissions enforced in the main process** | `auth/guard.ts` wraps `ipcMain.handle` once, before any module registers, and answers a refused channel with a reason code. Every channel appears either in `CHANNEL_PERMISSIONS` or in `OPEN_CHANNELS` with a stated reason; a channel in neither fails closed, and a test reads `preload.ts` to prove none is missing |
| **The session lives in the main process** | `auth/session.ts`. `staff:login` verifies the PIN and records the role there. The renderer's copy decides only what to *show* — it used to be the only check, persisted in `localStorage`, where changing one field to `"role":"admin"` unlocked every screen |
| **Admin-only permissions cannot be granted away** | `auth/permissions.ts`. `staff.manage`, `settings.permissions`, `backup.restore`, `system.reset`, `system.recovery` and `settings.features` are refused by the setter *and* stripped by `permissionsFor`, so a hand-edited config is not honoured either |
| **Logos validated by content** | `lib/image.ts` sniffs the magic bytes. A `.png` that is really a PDF would otherwise reach the receipt template and print nothing, at the till, during service |

### Why admin always holds every permission

Not an oversight, and not editable. Two consequences follow from the rule, and
both are the reason for it:

- No sequence of edits can lock the last administrator out of the screen where
  permissions are edited.
- A permission added in a later version cannot be forgotten in the default
  matrix and silently withheld from the only role that can grant it.

The role is therefore absent from `DEFAULT_ROLE_PERMISSIONS` entirely, rather
than listed with everything ticked.

### Signing in is required after a restart

`useAuthStore` persists only the setup flag. It used to persist `staff` and
`isAuthenticated`, so the till came back signed in as whoever last used it —
and since that is `localStorage`, the stored role was editable by hand. With
the authority in the main process there is no PIN to re-verify on boot, so
restoring a session would leave the shell looking signed in while every
guarded channel refused.

Known limitation, recorded deliberately: **staff PINs are stored in plaintext**
in the `staff` table. The threat model is a single trusted till, and a PIN is a
convenience credential rather than a secret, but it is not password storage and
should not be described as such.

---

## 10. Backups

A backup is one ZIP containing `pos.db` **and** the `images/` directory, so a
restore yields a complete working install.

- The database is copied with SQLite's own `backup()` API, not a file copy —
  WAL mode means a live file copy can be inconsistent.
- The ZIP is assembled with `archiver`, read back with `extract-zip`.
- Import validates that the archive contains `pos.db` and that the file is a
  real SQLite database before replacing anything, and keeps a rollback copy.
- Scheduled backups prune to a retention count; the matcher is
  `kitchen-pos-backup-<timestamp>.zip`.
- Restore is reachable from the lock screen, because after a reinstall there is
  no PIN to sign in with yet.

---

## 11. Verification

| Workspace | Commands | Coverage |
|---|---|---|
| frontend | `tsc`, `lint`, `test` | i18n dictionary parity and plural categories, formatters, date parsing, CSV quoting, SVG sprite utils, auth context |
| backend | `build`, `lint`, `test` | Tax engine across every regime and inclusive/exclusive, money rounding traps, receipt rendering in both locales and all paper profiles, `local://` path confinement, backup retention |

Current: **231 tests** (94 frontend, 137 backend), with `tsc`, ESLint and a
production build green on both workspaces.

---

## 12. Known risks

| Risk | Mitigation / status |
|---|---|
| Single local database — hardware failure loses everything | Scheduled ZIP backups with retention, reminders, restore from the lock screen. Documented routine: keep a copy off the machine |
| `better-sqlite3` is a native module | Fails loudly at install with a documented fallback; `@electron/rebuild` documented |
| No downgrade path for migrations | Documented: back up before updating, rollback is "reinstall old version + import backup" |
| Staff PINs stored in plaintext | Acknowledged above; acceptable only for a single trusted terminal |
| No auto-update | Deliberate: updates are manual, documented in `DEPLOYMENT.md` |
| No multi-terminal sync | Out of scope; the database is a local file |
| Dashboard chunk is ~390 kB | Recharts. Acceptable for a desktop app loading from disk; would need splitting for a web deployment |
| Not certified for ZATCA Phase 2 | Receipts carry the tax number and breakdown; cryptographic stamping and clearance are not implemented |
