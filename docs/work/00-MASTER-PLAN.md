# Kitchen POS — Production Readiness Master Plan

> Owner: engineering · Status tracker: [`01-TRACKER.md`](./01-TRACKER.md)
> Audit baseline: [`02-AUDIT.md`](./02-AUDIT.md)

## Goal

Take Kitchen POS from "feature-rich English/India-only prototype" to a
**production-ready, bilingual (Arabic-default / English), region-agnostic
restaurant POS** that installs easily, prints on any printer, and is covered
by automated tests.

## Non-negotiables

| # | Requirement | Why |
|---|---|---|
| R1 | Arabic is the **default** locale; English is a first-class alternative | Primary market |
| R2 | Full **RTL** layout, not just translated strings | Arabic UX |
| R3 | **Zero** hardcoded user-facing strings | Maintainability |
| R4 | Currency, tax regime and tax labels are **configurable** (not hardcoded ₹ / CGST / SGST) | Multi-region |
| R5 | Printing works with **any OS-installed printer** (thermal 58/80 mm, A4, network, USB) | Hardware reality |
| R6 | Receipts render **Arabic correctly** | R1 + R5 |
| R7 | Offline-first — **no network dependency at runtime**, no CDN fonts | Core product promise |
| R8 | `tsc`, `lint`, `test` and `build` all green | Deployability |

## Phases

### Phase 1 — Internationalisation foundation
- Zero-dependency, type-safe i18n core (`frontend/src/i18n/`)
- Locale persistence (`localStorage` + `electron-store`), Arabic default
- `dir` / `lang` switching on `<html>`, RTL-aware layout primitives
- Locale-aware formatters: currency, number, date, time, relative time
- Arabic & Latin numeral systems

### Phase 2 — Regional & fiscal configuration
- `currency` (code, symbol, decimals, position)
- `taxMode`: `vat` | `gst` | `none`; configurable rate + label
- Tax-inclusive vs tax-exclusive pricing
- Backwards compatible with existing GST (CGST/SGST) data

### Phase 3 — Theming & design system
- Design tokens (CSS custom properties) for light **and** dark
- Real theme provider: `light` | `dark` | `system` (replaces the dead toggle)
- Arabic-capable offline font stack
- RTL-safe utilities (logical properties everywhere)

### Phase 4 — UI translation sweep
Every page, layout, modal, toast and empty state goes through `t()`.

### Phase 5 — Printing subsystem overhaul
- Printer discovery + per-station assignment (receipt / kitchen)
- Paper profiles: 58 mm, 80 mm, A4
- Silent printing, copies, margins, logo
- Bilingual RTL receipt + KOT templates
- Test print & print preview

### Phase 6 — Hardening
- Electron security: CSP, protocol-handler path confinement
- Typed settings layer (no `any`)
- Input validation on IPC boundaries

### Phase 7 — Tests & verification
Unit tests for i18n, money, tax, receipt rendering, settings, backup.

### Phase 8 — Documentation & release
Bilingual README, install/deploy guide, printing guide, i18n contributor guide.

## Out of scope (recorded, not done)
- LAN multi-terminal sync
- Cloud backup
- Payment-gateway integration
- ZATCA e-invoicing cryptographic stamping (QR layout is in scope, the
  certified signing chain is not)
