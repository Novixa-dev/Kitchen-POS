# Phase 2 — Platform scope and decisions

> Status tracker: [`11-PLATFORM-TRACKER.md`](./11-PLATFORM-TRACKER.md)
> Phase 1 (bilingual, tax, printing, hardening) is merged in `master`.

This document records what Phase 2 builds, what it deliberately does **not**
build, and the reasoning for each. Two of the requested features cannot be
built as described; both are replaced by something that delivers the same value
and actually works. Those are the first two entries, because they matter most.

---

## 1. Decisions on infeasible requests

### 1.1 "Detect the printer over the internet and install its driver automatically"

**Not built as described. Here is why, and what replaces it.**

What was asked: one button that connects to the internet, identifies the
attached printer, downloads its driver, and installs it silently.

Why that cannot be done responsibly:

| Obstacle | Detail |
|---|---|
| **No programmatic driver install path** | Electron exposes `webContents.getPrintersAsync()`, which *enumerates* printers. Installing a driver means Windows Print Spooler APIs, `printui.exe`, or PowerShell `Add-PrinterDriver` — all requiring UAC elevation, all OS-specific. No Electron-reachable library does this. |
| **No vendor driver index** | There is no machine-readable registry mapping "this USB device" to "this driver download URL". Epson, Star, Xprinter and Rongta each publish drivers on their own site behind their own page structure. Scraping them would break constantly. |
| **It is a supply-chain attack vector** | Downloading an executable from the internet and running it with administrator rights, automatically, is the exact shape of a supply-chain compromise. On a machine that handles payments, that is not a feature. |
| **It contradicts the product promise** | The app's stated guarantee is offline-first: no internet dependency at runtime. A core setup step that *requires* the internet breaks that. |

**What is built instead — "Detect my printer", one button, works offline:**

1. Enumerate every printer the OS exposes, with its driver metadata
   (`options['printer-make-and-model']` and friends, which Windows and CUPS
   both populate).
2. Match the model string against a **bundled database of known thermal and
   receipt printers** — Epson TM series, Star TSP, Xprinter, Rongta, Bixolon,
   Citizen, and generic ESC/POS — and auto-apply the right paper width, cut
   behaviour and character density.
3. Where the model is unknown, fall back to a confident guess from the reported
   paper size, and say that it is a guess.
4. Print a calibration page so the operator can confirm the width is right.
5. For a printer the OS does **not** yet have: show the detected device, link
   to the vendor's own driver page, and offer to run an installer **the user
   selects from their own disk**, with an explicit confirmation naming the file
   and the elevation it needs. The user stays the one who decides what
   executes.
6. The model database can optionally be refreshed from a URL the admin
   configures. Opt-in, never required, and it only ever updates *settings
   recommendations* — never executable code.

That delivers the real goal — "I plug in a printer and the app configures
itself" — for every printer the OS can see, which after step 5 is all of them.

### 1.2 "Wi-Fi hotspot that redirects phones to the menu"

**Not built as described. Here is why, and what replaces it.**

What was asked: the app creates a Wi-Fi hotspot; a phone that joins is
redirected to a page showing categories, products, gifts and coupons.

Why that cannot be done from an Electron app:

- Creating a Wi-Fi access point requires OS-level radio configuration —
  `netsh wlan set hostednetwork` / the Windows Mobile Hotspot API on Windows,
  `hostapd` on Linux, Internet Sharing on macOS. Not reachable from Electron,
  and on much hardware not possible at all while the same adapter is connected
  to a network.
- The "redirect on join" behaviour is a **captive portal**, which needs DNS
  interception and HTTP redirection at the gateway. That is router firmware
  territory, not an application's.

**What is built instead — the value without the false claim:**

A **Customer Menu server**: a local HTTP server on the till's LAN address,
serving a fast, mobile-first, bilingual menu — categories, products, prices,
photos, active offers and coupons. Customers reach it by scanning a QR code on
the table or the receipt. No app install, no login.

This delivers what the hotspot was *for* — a phone showing the live menu —
over the Wi-Fi the venue already has. The app shows the QR code and the URL,
and the admin enables or disables the server like any other feature.

If an outlet genuinely wants a dedicated SSID, that is a router setting; the
guide documents how to point its captive portal at the app's URL.

---

## 2. What Phase 2 builds

Ordered by dependency and by value. Each lands as its own commit with tests.

### 2.1 Feature modules (the "plugin system")

A manifest-driven registry. Every optional capability is a module with an id,
bilingual name and description, category, dependencies, and a default state.
The admin enables or disables each one; navigation, routes and IPC all respect
it.

**Not** dynamically loaded third-party code. A POS handling money should not
execute plugins downloaded at runtime — that is the same objection as §1.1, and
it is not what the request actually needs. What it needs is "turn parts of the
system on and off, cleanly, per outlet", which a registry gives with none of
the risk. The architecture is the one VS Code uses for *built-in* features:
declared contributions, resolved dependencies, activation gates.

Modules: `accounting`, `loyalty`, `coupons`, `qr-receipts`, `customer-menu`,
`kds`, `inventory`, `expenses`, `customers`, `reports`, `multi-menu`,
`table-service`.

### 2.2 Branding and appearance

Outlet logo (on screen and on receipts), accent colour with a contrast check,
font choice from the bundled offline stack, density (compact / comfortable),
and named theme presets the admin can apply or copy and edit.

### 2.3 Roles and permissions

Real permission checks, not just a role label. A permission matrix per role,
editable by an admin, enforced on both sides of the IPC boundary — a renderer
check alone is decoration.

### 2.4 Print template designer

Per-document templates (bill, kitchen ticket, shift report) with: paper size,
margins, font scale, which blocks appear and in what order, logo placement,
header and footer text, and a live preview. Ships with presets —
`thermal-58`, `thermal-80`, `a4-invoice`, `kitchen-compact` — which the admin
can duplicate and modify.

### 2.5 Virtual printer harness

Testing printers without hardware, which was explicitly asked for and is
genuinely useful:

- A **mock printer adapter** that records what would have been sent, so print
  flows are assertable end to end.
- **Render-to-file**: every template rendered to PDF and PNG at each paper
  width, so layout is inspected without paper.
- A **profile matrix** simulating the quirks of real models (58 mm narrow
  column loss, codepage limits, no-cutter, monochrome-only) so a template is
  proven against several printer shapes in CI.
- A **golden-file suite**: committed reference renders, diffed on every change,
  so a layout regression fails the build.

### 2.6 Discounts, coupons, gifts and loyalty

Admin-defined discounts (percentage or amount, per item or per bill, with
validity windows and usage caps), coupon codes, and a loyalty rule engine:
thresholds on visit count or spend within a period, awarding a discount, a
free item or a gift. All rules are data, evaluated by the backend.

### 2.7 QR receipts and customer lookup

A QR code on the receipt resolving to a customer-facing page for that bill.
The phone stores its own visit history in browser storage, so a returning
customer's progress toward a loyalty threshold is visible to them without the
outlet holding personal data it does not need.

### 2.8 Accounting

A small double-entry-lite ledger: revenue from bills, expenses, an opening
balance, and period reports — daily/monthly P&L, cash-flow summary, tax
payable. Reconciles against the shift and business-day records that already
exist.

### 2.9 Setup wizard

A stepped first-run flow: language → country and currency → outlet identity and
logo → tax regime → printer detection and calibration → features to enable →
admin account → recovery code. Resumable, with every step revisitable from
Settings afterwards.

### 2.10 Help centre

Searchable in-app documentation, bundled offline, bilingual, with diagrams.
Sourced from the same markdown as `docs/guides/`, so it cannot drift from the
written documentation.

---

## 3. Explicitly out of scope

| Item | Reason |
|---|---|
| Downloading and executing driver installers automatically | §1.1 |
| Creating a Wi-Fi access point or captive portal | §1.2 |
| Runtime-loaded third-party plugin code | §2.1 — unacceptable risk surface on a payments terminal |
| Multi-terminal sync | The database is a local file; this is an architectural change, not a feature |
| Cloud backup | Needs credential storage and a provider decision |
| Full double-entry accounting with a chart of accounts | §2.8 delivers what a single restaurant needs; a general ledger is a different product |
| ZATCA Phase 2 cryptographic stamping | Requires certification |
| Staff PIN hashing | Carried over from Phase 1: deserves its own migration and test pass. Documented limitation |

---

## 4. Principles carried from Phase 1

- No user-facing string outside `t()`; `en.ts` canonical, `ar.ts` type-checked
  against it.
- Logical CSS properties only; RTL is not an afterthought.
- Money never touches a raw float; the renderer never computes tax.
- Database timestamps are zone-less UTC and go through `lib/datetime.ts`.
- Every setting is validated and clamped in the main process.
- A feature that does not work is removed, not left inert.
- `tsc` + `lint` + `test` green on both workspaces before every commit.
