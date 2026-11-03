# Phase 2 — Delivery tracker

Scope and decisions: [`10-PLATFORM-SCOPE.md`](./10-PLATFORM-SCOPE.md)

Legend: `[x]` done · `[~]` in progress · `[ ]` not started

Gate for every item: `tsc` + `lint` + `test` green on both workspaces.

---

## Sprint 1 — Foundation

- [x] **Feature module registry**
  - [x] Manifest type, module catalogue, dependency resolution
  - [x] Settings-backed enabled state with defaults
  - [x] `features:list` / `features:setEnabled` IPC
  - [x] `useFeature` hook, `<FeatureGate>`, nav and route filtering
  - [x] Backend guard so a disabled module's IPC is refused, not just hidden
  - [x] Tests: dependency resolution, cycle rejection, cascade on disable

- [x] **Roles and permissions**
  - [x] Permission catalogue: 30 permissions in 6 domains
  - [x] Role → permission matrix, editable, with defaults per role
  - [x] Enforcement in the main process, against a session it created by
        verifying a PIN — the renderer's copy decides only what to show
  - [x] One channel table covering all 90 channels, with a test that reads
        `preload.ts` and fails if a channel is in neither list
  - [x] Settings UI, with admin-only permissions shown but not grantable
  - [x] Navigation, routes and the landing route all derived from permissions
  - [x] Tests: 57 backend, 19 frontend — default matrices, escalation
        refusal, admin self-lockout guard, prototype-chain channel names

## Sprint 2 — Appearance and setup

- [x] **Branding and appearance**
  - [x] Logo upload, stored in app data, validated by content not extension
  - [x] Accent colour with a WCAG contrast check, warned not refused
  - [x] Dark-mode accent derived from the same colour
  - [x] Font choice from the OS-resident stacks (nothing is downloaded)
  - [x] Density (compact / comfortable), applied through the root font size
  - [x] Named theme presets; edit one and it becomes `custom`
  - [x] Tests: 72 backend (colour + branding), 13 (image), 15 frontend
  - [ ] Logo on the receipt — deferred to the template designer in Sprint 3,
        which owns where blocks sit on the paper

- [x] **Setup wizard**
  - [x] Stepped, resumable flow — the draft survives an interrupted install,
        without the admin PIN, which is not something to leave in
        `localStorage`
  - [x] Country → currency → tax regime defaults, from a 25-country table
        with the right minor units (three decimals for the Gulf dinars)
  - [x] The chosen country shown back, with "check this against your own
        registration" — these are defaults, not authority
  - [x] Reachable later from Settings, as a Country card
  - [x] Server-side validation of the admin PIN and outlet name, since this
        creates the account that can erase the till
  - [x] Tests: 17 backend (country table against the rounding rule), 26
        frontend (step rules, draft round trip, PIN never restored)
  - [ ] Printer detection step — waits on Sprint 3, which builds detection
  - [ ] Feature selection step — deferred deliberately: the modules screen
        exists in Settings, and a first-run install has no basis yet for
        deciding whether it wants loyalty

## Sprint 3 — Printing

- [ ] **Virtual printer harness**
  - [ ] Mock adapter recording what would be sent
  - [ ] Render-to-PDF and render-to-PNG per paper width
  - [ ] Printer profile matrix (58 mm, 80 mm, A4, no-cutter, narrow codepage)
  - [ ] Golden-file suite, diffed in CI
  - [ ] Tests: every template against every profile

- [ ] **Printer detection and guided setup**
  - [ ] Bundled model database (Epson, Star, Xprinter, Rongta, Bixolon, Citizen, generic)
  - [ ] One-button detect → match → apply recommended settings
  - [ ] Calibration page
  - [ ] Manual override and driver-install guidance
  - [ ] Tests: model matching, fallback when unknown

- [ ] **Print template designer**
  - [ ] Template schema: blocks, order, visibility, paper, margins, scale
  - [ ] Presets: thermal-58, thermal-80, a4-invoice, kitchen-compact
  - [ ] Duplicate and edit
  - [ ] Live preview
  - [ ] Tests: schema validation, rendering per template

## Sprint 4 — Commerce

- [ ] **Discounts, coupons, gifts, loyalty**
  - [ ] Schema and migrations
  - [ ] Rule engine, evaluated in the main process
  - [ ] Admin UI
  - [ ] Applied at billing
  - [ ] Tests: every rule type, validity windows, usage caps, stacking rules

- [ ] **QR receipts and customer lookup**
  - [ ] QR on the receipt
  - [ ] Customer-facing bill page
  - [ ] Phone-local visit history
  - [ ] Progress toward loyalty thresholds

- [ ] **Customer menu server**
  - [ ] Local HTTP server, enable/disable as a feature
  - [ ] Mobile-first bilingual menu
  - [ ] QR code and URL shown in the app
  - [ ] Tests: route responses, disabled-state refusal

## Sprint 5 — Accounting and help

- [ ] **Accounting**
  - [ ] Ledger schema
  - [ ] Revenue from bills, expenses, opening balance
  - [ ] Daily and monthly P&L, cash flow, tax payable
  - [ ] Reconciliation against shifts and business days
  - [ ] Tests: ledger arithmetic, period boundaries, reconciliation

- [ ] **Help centre**
  - [ ] Bundled offline content from `docs/guides/`
  - [ ] Search
  - [ ] Bilingual, with diagrams

## Sprint 6 — Hardening and release

- [ ] Performance pass: route-level code splitting, list virtualisation where
      a grid can exceed a few hundred rows
- [ ] Accessibility pass: focus order, keyboard reachability, contrast
- [ ] Full regression run, both locales, both themes
- [ ] Update `README.md`, `ARCHITECTURE.md` and the guides
- [ ] Release checklist run

---

## Running verification

| | Frontend | Backend |
|---|---|---|
| Start of Phase 2 | tsc ✅ lint ✅ 94 tests | tsc ✅ lint ✅ 139 tests |
| Current | — | — |

---

## Decisions log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-03 | Printer driver auto-install replaced by detect-and-recommend plus guided manual install | Not reachable from Electron, no vendor driver index, auto-executing downloaded installers on a payments terminal is a supply-chain risk, and it breaks the offline-first promise. See scope §1.1 |
| 2026-11-03 | Wi-Fi hotspot replaced by a LAN customer-menu server reached by QR | An app cannot create an access point or a captive portal. The server delivers the same outcome over existing Wi-Fi. See scope §1.2 |
| 2026-11-03 | Feature modules are a declared registry, not runtime-loaded code | Executing third-party plugin code on a till that handles money is an unacceptable risk surface; a registry delivers the enable/disable requirement with none of it. See scope §2.1 |
