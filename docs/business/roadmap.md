# Product Roadmap

What is planned, in priority order. Items are sized by dependency and value,
not dated — a date on an unstarted feature is a guess presented as a
commitment.

For what is already built, see [`features.md`](./features.md). For the
engineering decisions behind each item, including two requests that cannot be
built as described, see
[`../work/10-PLATFORM-SCOPE.md`](../work/10-PLATFORM-SCOPE.md).

---

## Next — Customer menu on the customer's own phone

A local HTTP server on the till's LAN address, serving a fast, mobile-first
bilingual menu: categories, items, prices, photos, and the offers that are
running. Customers reach it by scanning a QR code on the table or the
receipt. No app to install, no login.

**Why this shape.** The original request was for the app to create a Wi-Fi
hotspot that redirects any phone joining it to the menu. An application
cannot do that: creating an access point needs operating-system radio
configuration, and "redirect on join" is a captive portal, which lives in
router firmware. A LAN server reached by QR delivers the actual goal — a
phone showing the live menu — over the Wi-Fi the venue already has.

Includes:
- QR receipts: a code on the bill resolving to a page for that bill
- Visit history held in the phone's own browser storage, so a returning
  customer can see their progress toward a loyalty reward without the outlet
  storing personal data it does not need

---

## Then — Accounting

A small ledger rather than a general ledger: revenue from bills, costs from
expenses, an opening balance, and period reports — daily and monthly profit
and loss, a cash-flow summary, and tax payable. It reconciles against the
shift and trading-day records the app already keeps.

Full double-entry accounting with a chart of accounts is deliberately out of
scope. That is a different product, and a single restaurant does not need it.

---

## Then — Help centre

Searchable documentation inside the app, bundled offline and bilingual, built
from the same Markdown as `docs/guides/`, so the help text cannot drift away
from the written documentation.

---

## Then — Release hardening

- Performance: route-level code splitting, and list virtualisation wherever a
  grid can exceed a few hundred rows
- Accessibility: focus order, keyboard reachability, contrast
- A full regression pass in both languages and both themes

---

## Under consideration

Requested, not committed.

| Feature | Notes |
|---|---|
| **Staff PIN hashing** | Not a feature so much as a debt. It changes the authentication path and the recovery-code flow together, so it needs its own migration and test pass. First item in any security pass |
| Staff performance reports | Orders per staff member, average ticket size by waiter. The data is already recorded; the query and the screen are missing |
| Low-stock notifications | The `low_stock_alert_at` column has existed since the first migration and nothing reads it. The inert "Enable Notifications" toggle that claimed to control it was removed rather than left in place |
| Recipe costing and margin | Recipes and unit costs are both stored; only the calculation and the screen are missing |
| Table reservations | Advance booking with time slots and a deposit |
| Bill delivery by WhatsApp or SMS | An alternative to handing over paper |
| Multi-terminal sync over the LAN | An architectural change: the database is a local file, not a server. Two tills sharing data is a different design, not a setting |
| Cloud backup | Needs credential storage and a provider decision. Manual and scheduled local backup already work |
| ZATCA Phase 2 e-invoicing | The receipt layout and the tax-number field are in place; the cryptographic stamping and clearance chain require certification |
| Automatic updates | Needs a hosted release feed and signed builds |
| Aggregator integration | Importing orders from delivery platforms |
| More interface languages | The i18n layer takes a new locale as a dictionary file; nothing in the code is bilingual-only |

---

## Not planned, and why

| Request | Why not |
|---|---|
| **Downloading and installing printer drivers automatically** | No cross-platform API exposes a driver install; there is no machine-readable index mapping a USB device to its driver; and downloading an executable and running it with administrator rights automatically, on a machine that handles payments, is the shape of a supply-chain compromise. It would also break the offline-first promise. Instead: the app detects the printer, identifies the model against a bundled database, applies the right paper width, prints a calibration page, and for an unrecognised printer points at the vendor's own driver page and will run an installer **the user picks from their own disk**, with an explicit confirmation |
| **A Wi-Fi hotspot with a captive portal** | Not reachable from an application — see the customer-menu item above |
| **Runtime-loaded third-party plugins** | Executing code downloaded at runtime on a till that handles money is an unacceptable risk surface. What "make it a plugin system" actually needs is the ability to turn parts of the system on and off per outlet, which the module registry already provides |

---

## How to request a feature

Raise it with your account contact, or open an issue. Requests from several
active outlets are prioritised.
