# Baseline Audit — Kitchen POS

Audit performed on branch `claude/project-review-refactor-ace9f1`, baseline
commit `4dc3216`.

## 1. What the codebase actually is

| Metric | Value |
|---|---|
| Frontend (React/TS) | 113 files · ~12.5k lines |
| Backend (Electron main) | 24 files · ~3.2k lines |
| DB migrations | 13 (`001_init` → `013_custom_table_name`) |
| IPC domains | 17 |
| Automated tests | 39 (20 frontend, 19 backend) |

Stack: Electron 30 · React 19 · TypeScript · Vite 8 · Tailwind 4 · SQLite
(`better-sqlite3`) · Zustand · React Router 7 · Recharts · Vitest.

Functionality present and working: orders, tables, menus (with scheduling),
KDS, inventory + recipes, customers with running balances, expenses, shifts,
business sessions, GST billing, past orders, dashboard, reports, ZIP backups
with scheduling and retention, first-run setup wizard, PIN auth with roles.

This is a **substantial, coherent application**, not a skeleton. The gaps are
about reach (language, region, hardware) and hardening — not core features.

## 2. Findings

### 2.1 Internationalisation — the dominant gap

**There is no i18n layer at all.** Verified by search: no i18n library, no
locale files, no `dir` handling, zero translated strings. Every user-facing
string is a hardcoded English literal inside JSX.

Consequences:
- Arabic is not merely "not default", it is **impossible** without new infrastructure.
- No RTL support. `AppLayout` positions the sidebar with a hardcoded
  `marginLeft`, and the sidebar slides with `-translate-x-full` — both break
  under RTL.
- Dates are formatted with a hardcoded `'en-US'` locale in 6 places
  (`Dashboard`, `Reports`), so they would stay English even after translation.

### 2.2 Region lock-in (India / GST)

- The currency symbol `₹` is hardcoded in **12 places** across pages and
  printer templates. There is no currency setting.
- The tax model is hardcoded as Indian **CGST + SGST**: the `bills` table has
  `cgst_amount` / `sgst_amount` columns, menu items carry `cgst_rate` /
  `sgst_rate` / `hsn_code`, and the receipt prints those labels literally.
- `GSTIN` is the only tax-registration field.

For an Arabic-first market this needs a **VAT** mode (single rate, single
label, optional tax-inclusive pricing) without breaking existing GST data.

### 2.3 Printing

The README claims direct USB ESC/POS via `escpos` + `escpos-usb`. **That is
not what the code does** — `escpos` is not a dependency and there is no ESC/POS
byte generation anywhere. Actual implementation: `services/printer.ts` renders
an HTML receipt into a hidden `BrowserWindow` and calls `webContents.print()`.

That approach is actually the *right* one (it works with every
OS-installed printer and renders Arabic correctly), but the implementation is
thin:

| Gap | Impact |
|---|---|
| `silent: false` always | A dialog pops for **every** KOT and bill — unusable at service speed |
| No printer selection | Cannot send KOT to the kitchen printer and bills to the counter printer |
| No paper-width profile | Fixed `300px` body; wrong on 58 mm and on A4 |
| `show: true` on the print window | A blank window flashes on screen on every print |
| No printer discovery | Users cannot see which printers the app can reach |
| No test print | README tells users to click a "Test Print" button that does not exist |
| No copies / margins / logo | Standard POS expectations |
| English-only template, LTR | Fails requirement R6 |

### 2.4 Electron security

- **`local://` protocol handler is unconfined.** `main.ts` registers
  `protocol.handle('local', req => net.fetch('file://' + req.url.slice(8)))`,
  which turns any renderer-reachable `local://` URL into an arbitrary
  filesystem read. It must be confined to the app's image directory.
- **No Content-Security-Policy** on the renderer.
- No `will-navigate` / `setWindowOpenHandler` guards.

Mitigating context: `contextIsolation: true` and `nodeIntegration: false` are
correctly set, and the app is offline — but the handler is still wrong.

### 2.5 Type safety and correctness

Fixed in this pass (see §3):
- `better-sqlite3`'s `.get()` returns `undefined` for a missing row, but 4 call
  sites cast the result as always-present, then dereferenced it. A deleted or
  missing order would throw a `TypeError` inside a billing transaction.
- `reports:daily` with `filter: 'custom'` pushed `payload.start` /
  `payload.end` into the bind list without checking them; `undefined` binds
  throw in `better-sqlite3`.
- `@types/archiver@8` was installed against `archiver@6` — the v8 types are not
  callable, so the code worked around its own broken types with `as any` twice.
- 76 `any` annotations in the backend (54 in `preload.ts`, 13 `catch (e: any)`).
- `errMsg()` was copy-pasted into two IPC modules.
- The `pruneOldBackups` test suite was **silently vacuous**: its helper created
  `…​.db` fixture files while the production matcher only matches `.zip`
  (backups moved to ZIP in `7f436f3`). 4 assertions passed `[]` against
  themselves; no retention logic was actually covered.

### 2.6 Dead and misleading code

- `Settings` has `darkModeEnabled` / `notificationsEnabled` state that is read
  and set but **never applied to anything** — the dark-mode toggle is a
  decoration.
- `tailwind.config.js` contains only a comment.
- `index.css` ships a design system for a *marketing site* (`heading-primary`
  in purple, `.card` on `bg-white/5`, `animate-gradient-bg`) that does not
  match the actual POS UI and is largely unused.
- Root `README.md` describes a different project state than the code
  (ESC/POS printing, port 5200 vs the real 5205, a `modules/` directory and a
  `services/gst.ts`-based layout that only partly exists).
- `test-db.js` and `backend/test.js` are stray scratch scripts.

### 2.7 Developer experience

- `npm install` at the root does **not** install workspace dependencies —
  there are no npm workspaces, so three separate installs are required.
- `better-sqlite3` needs a native toolchain; there is no documented fallback
  or guidance when the build fails (it failed on this machine).
- No `.env`/config story, no CI workflow, no release checklist.

## 3. Fixed in Phase 0 (green baseline)

| Fix | Files |
|---|---|
| Unsafe `.get()` casts → `\| undefined` + guards | `ipc/orders.ts`, `services/billing.ts`, `ipc/business-session.ts` |
| `reports:daily` custom-range validation | `ipc/reports.ts` |
| `@types/archiver` pinned to v6, `as any` removed | `package.json`, `ipc/backup.ts` |
| `catch (e: any)` → `unknown` + shared `errMsg` | `ipc/{expenses,settings,staff,tables}.ts` |
| Duplicated `errMsg` → `lib/errors.ts` | `ipc/{customers,business-session}.ts` |
| `preload.ts` 54 × `any` → `unknown` + typed event | `preload.ts` |
| Typed `BillRow` / `BillItemRow` / `TableUpsertPayload` | `ipc/{reports,tables}.ts` |
| SQL bind params `any[]` → `(string \| number)[]` | `ipc/{reports,expenses}.ts` |
| Vacuous backup-retention test repaired | `ipc/__tests__/backup-utils.test.ts` |
| Promise-returning JSX handlers extracted | `pages/Settings/index.tsx` |

Backend `any` count: **76 → 0**.

### Verification after Phase 0

```
frontend  tsc ✅   lint ✅ (0)   test ✅ 20/20
backend   tsc ✅   lint ✅ (0)   test ✅ 19/19
```
