# Printing

## How it works, and why

Kitchen POS renders each receipt as an HTML document, loads it into an
offscreen Chromium window, and sends it through the operating system's print
pipeline.

That is a deliberate choice over generating raw ESC/POS bytes:

- **It reaches every printer the OS can see.** USB thermal, network, Bluetooth,
  shared Windows printer, A4 laser — all of them, with no vendor SDK, no driver
  bypass and no USB permission wrangling.
- **Arabic comes out right.** Chromium does the shaping and the bidirectional
  ordering. Thermal firmware ships inconsistent Arabic code pages, and driving
  ESC/POS directly means pre-shaping the text into presentation forms yourself
  and hoping the printer's page matches.
- **Layout is testable.** The renderer is a pure function from data to a string,
  so the output is asserted in unit tests rather than on paper.

The trade-off is that the printer must be installed in the operating system.
Kitchen POS cannot talk to a printer the OS does not know about.

---

## Setting up

### 1. Install the printer in the OS first

Install it, then **print an OS test page**. If that fails, nothing in Kitchen
POS will help.

- **Windows + USB thermal** — most 58/80 mm printers work on the generic
  *Generic / Text Only* driver. If the vendor driver misbehaves, remove it and
  add the printer again with the generic one.
- **Network thermal** — add it as a TCP/IP port printer (usually port 9100),
  not as a WSD device; WSD discovery drops off the network unpredictably.
- **macOS** — add it in *Printers & Scanners*. For a raw thermal printer choose
  *Generic PostScript* or the vendor PPD if supplied.

### 2. Configure Kitchen POS

**Settings → Printing**

| Setting | Notes |
|---|---|
| **Receipt printer** | Where customer bills go. `System default` uses the OS default |
| **Kitchen printer** | Where kitchen tickets go. Falls back to the receipt printer if unset |
| **Paper size** | `58 mm`, `80 mm` or `A4` — see below |
| **Copies** | Bills only; kitchen tickets always print once |
| **Print without showing the dialog** | Leave **on** during service |
| **Receipt footer** | Free text at the bottom of every receipt |
| **Show the tax breakdown** | Off prints only the grand total |

Press **Refresh printer list** after adding a printer in the OS.

### 3. Test print

There is a test page per station. It prints:

- the printer name it was sent to and the configured paper size
- a sample amount in your configured currency
- both digit sets (`0-9` and `٠-٩`)
- an Arabic pangram and a Latin alphabet row

If the Arabic line prints as boxes or in the wrong order, the printer is being
driven as a raw text device rather than a graphics device — reinstall it with
the generic driver.

The test page always shows the dialog, even when silent printing is on: if the
configured printer is wrong, a silent job vanishes with no clue where it went.

---

## Paper profiles

| Profile | Printable width | Behaviour |
|---|---|---|
| `58 mm` | 48 mm | Three columns: name, quantity, amount. The unit-price column is dropped because it does not fit |
| `80 mm` | 72 mm | Four columns, including unit price |
| `A4` | 180 mm | Four columns, larger type, page margins |

Thermal profiles print with `@page { margin: 0 }` so the roll is used
edge-to-edge instead of being scaled onto a letter page. A4 keeps margins.

Everything prints pure black: `print-color-adjust: exact` is set, because
thermal heads render light greys as nothing at all.

---

## What gets printed

### Customer bill

Outlet name, address, phone and tax registration number; the document title;
bill number and timestamp; the item table; subtotal, discount, tax breakdown
and grand total; payment lines with change due; and the footer.

The document title degrades honestly:

| Condition | Title |
|---|---|
| Tax regime set **and** a tax number configured | **Tax invoice** |
| Tax regime set, no tax number | **Simplified invoice** |
| Regime is `none` | **Invoice** |

Printing "Tax Invoice" without a registration number would be incorrect, so the
app does not.

### Kitchen ticket

Ticket number, table label (including any temporary name), order type,
timestamp, and the items in large type with their modifiers. **No prices and no
tax** — the kitchen has no use for them, and the line has to be readable at
arm's length across a hot pass.

### Reprints

A reprint reproduces the **original** document. The tax regime and rate are
stored on each bill, so a bill issued under GST still reprints with its
CGST/SGST split after the outlet moves to VAT.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Printer list is empty | None installed in the OS, or the print spooler is stopped |
| Nothing prints, no error | Silent printing is on and the job went to the wrong printer. Run a test print — it always shows the dialog |
| A dialog appears on every order | *Print without showing the dialog* is off |
| Receipt is cut off on the right | Paper size is set wider than the roll. Try `58 mm` |
| Huge margins on a thermal roll | Paper size is set to `A4` |
| Arabic prints as boxes or reversed | The printer is installed as a raw text device. Reinstall with the generic/graphics driver |
| Faint or missing text | Thermal head needs cleaning, or the roll is loaded with the heat-sensitive side away from the head |
| "The print request timed out" | A stuck spool job. Clear the queue in the OS. Silent jobs time out after 30 s, dialog jobs after 5 min |
| Kitchen and bills go to the same printer | No kitchen printer is assigned, so it falls back to the receipt printer |

---

## Tested hardware

HTML-over-OS printing means any OS-supported printer should work. These have
been used with this architecture:

- Epson TM-T82 / TM-T88 (USB and Ethernet)
- Xprinter XP-58 / XP-80
- Rongta RP326 / RP400
- Any Windows- or macOS-installed A4 laser or inkjet

---

## For developers

| File | Responsibility |
|---|---|
| `backend/src/services/receipt.ts` | Pure rendering: data in, HTML string out. No Electron import, so it is unit-tested directly |
| `backend/src/services/printer.ts` | Offscreen window, OS print call, printer discovery, timeouts |
| `backend/src/ipc/printer.ts` | IPC surface: list, print bill, print KOT, test, preview |

Receipt copy lives in `receipt.ts`, not in the renderer's dictionary, because
the main process prints reprints and scheduled documents with no window open.

Adding a paper profile means one entry in the `PAPER` map — width, font sizes,
padding, and whether there is room for a unit-price column.
