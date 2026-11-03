/**
 * The bundled printer model database.
 *
 * Two jobs. It lets the app recognise a printer from the name the operating
 * system reports and apply sensible settings without anyone measuring a
 * roll, and it gives the virtual harness a set of real shapes to render
 * against — so a receipt can be checked on a 32-column Xprinter and a
 * 48-column Epson without either being plugged in.
 *
 * What it deliberately does *not* do is download or install a driver. That
 * was asked for and is not possible from inside this app: a driver install
 * is an administrator action, per-OS, per-vendor, from a signed package, and
 * no cross-platform API exposes it. `docs/work/10-PLATFORM-SCOPE.md` §1.1
 * records the reasoning. What this does instead is identify the model and
 * tell the operator exactly what to install, which is the part that was
 * actually slow.
 *
 * Pure and dependency-free.
 */

import type { PaperWidth } from '../../lib/settings';

/**
 * Width of one character in the printer's Font A, in dots.
 *
 * Near-universal on ESC/POS hardware, and it is what ties `dotsPerLine` to
 * `charsPerLine` — a relationship worth asserting rather than entering twice
 * and hoping they agree.
 */
export const FONT_A_DOT_WIDTH = 12;

export interface PrinterModel {
  id: string;
  vendor: string;
  model: string;
  /**
   * Lower-case fragments that identify this model inside the name an OS
   * reports. Drivers name themselves inconsistently — "EPSON TM-T88V
   * Receipt", "TM-T88V", "Epson TM-T88VI" — so matching is on fragments
   * rather than equality.
   */
  match: readonly string[];
  paperWidth: PaperWidth;
  /** Printable width in millimetres, which is less than the roll width. */
  printableMm: number;
  /** Dots across the head. Sets how large a logo can be before it blurs. */
  dotsPerLine: number;
  /** Characters per line in the printer's own default font. */
  charsPerLine: number;
  cutter: boolean;
  /** True when the printer can raster a bitmap logo. */
  bitmapLogo: boolean;
}

/**
 * Ordered most specific first.
 *
 * `matchPrinter` prefers the longest matching fragment, so "TM-T88VI" is not
 * shadowed by "TM-T88V" — but keeping the order meaningful makes the table
 * readable, and a reader should not have to know the algorithm to trust it.
 */
export const PRINTER_MODELS: readonly PrinterModel[] = [
  // ── Epson ─────────────────────────────────────────────────────────────
  { id: 'epson-tm-t88vi', vendor: 'Epson', model: 'TM-T88VI', match: ['tm-t88vi', 'tm t88vi'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'epson-tm-t88v', vendor: 'Epson', model: 'TM-T88V', match: ['tm-t88v', 'tm t88v'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 512, charsPerLine: 42, cutter: true, bitmapLogo: true },
  { id: 'epson-tm-t82', vendor: 'Epson', model: 'TM-T82', match: ['tm-t82', 'tm t82'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'epson-tm-t20', vendor: 'Epson', model: 'TM-T20', match: ['tm-t20', 'tm t20'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'epson-tm-m30', vendor: 'Epson', model: 'TM-m30', match: ['tm-m30', 'tm m30'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },

  // ── Star ──────────────────────────────────────────────────────────────
  { id: 'star-tsp143', vendor: 'Star', model: 'TSP143', match: ['tsp143', 'tsp 143'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'star-tsp100', vendor: 'Star', model: 'TSP100', match: ['tsp100', 'tsp 100'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'star-tsp654', vendor: 'Star', model: 'TSP654', match: ['tsp654', 'tsp 654'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },

  // ── Bixolon / Citizen ─────────────────────────────────────────────────
  { id: 'bixolon-srp-350', vendor: 'Bixolon', model: 'SRP-350', match: ['srp-350', 'srp350'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'bixolon-srp-330', vendor: 'Bixolon', model: 'SRP-330', match: ['srp-330', 'srp330'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'citizen-ct-s310', vendor: 'Citizen', model: 'CT-S310', match: ['ct-s310', 'cts310'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },

  // ── The inexpensive 58 mm units, very common in small outlets ─────────
  { id: 'xprinter-xp-58', vendor: 'Xprinter', model: 'XP-58', match: ['xp-58', 'xp58'], paperWidth: '58mm', printableMm: 48, dotsPerLine: 384, charsPerLine: 32, cutter: false, bitmapLogo: true },
  { id: 'xprinter-xp-80', vendor: 'Xprinter', model: 'XP-80', match: ['xp-80', 'xp80'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'rongta-rp58', vendor: 'Rongta', model: 'RP58', match: ['rp58', 'rp-58'], paperWidth: '58mm', printableMm: 48, dotsPerLine: 384, charsPerLine: 32, cutter: false, bitmapLogo: true },
  { id: 'rongta-rp80', vendor: 'Rongta', model: 'RP80', match: ['rp80', 'rp-80'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'zjiang-zj-5890', vendor: 'Zjiang', model: 'ZJ-5890', match: ['zj-5890', 'zj5890', '5890'], paperWidth: '58mm', printableMm: 48, dotsPerLine: 384, charsPerLine: 32, cutter: false, bitmapLogo: true },
  { id: 'hprt-tp805', vendor: 'HPRT', model: 'TP805', match: ['tp805', 'tp-805'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: true, bitmapLogo: true },
  { id: 'sunmi-v2', vendor: 'SUNMI', model: 'V2 built-in', match: ['sunmi'], paperWidth: '58mm', printableMm: 48, dotsPerLine: 384, charsPerLine: 32, cutter: false, bitmapLogo: true },

  // ── Fallbacks, matched on the width in the driver name ────────────────
  { id: 'generic-80mm', vendor: 'Generic', model: '80 mm thermal', match: ['80mm', '80 mm', 'pos-80', 'pos80'], paperWidth: '80mm', printableMm: 72, dotsPerLine: 576, charsPerLine: 48, cutter: false, bitmapLogo: true },
  { id: 'generic-58mm', vendor: 'Generic', model: '58 mm thermal', match: ['58mm', '58 mm', 'pos-58', 'pos58'], paperWidth: '58mm', printableMm: 48, dotsPerLine: 384, charsPerLine: 32, cutter: false, bitmapLogo: true },
];

/**
 * An A4 page printer: no roll, no cutter, and a character width that only
 * matters for the plain-text rendering the harness produces.
 */
export const A4_MODEL: PrinterModel = {
  id: 'generic-a4',
  vendor: 'Generic',
  model: 'A4 page printer',
  match: [],
  paperWidth: 'a4',
  printableMm: 180,
  dotsPerLine: 2480,
  charsPerLine: 80,
  cutter: false,
  bitmapLogo: true,
};

/** Used when nothing matches: the commonest shape, and the safest to assume. */
export const UNKNOWN_MODEL: PrinterModel = {
  id: 'unknown',
  vendor: 'Unknown',
  model: 'Unrecognised printer',
  match: [],
  paperWidth: '80mm',
  printableMm: 72,
  dotsPerLine: 576,
  charsPerLine: 48,
  cutter: false,
  bitmapLogo: false,
};

export function getModel(id: string): PrinterModel | undefined {
  if (id === A4_MODEL.id) { return A4_MODEL; }
  if (id === UNKNOWN_MODEL.id) { return UNKNOWN_MODEL; }
  return PRINTER_MODELS.find(m => m.id === id);
}

export interface PrinterMatch {
  model: PrinterModel;
  /** The fragment that matched, for showing *why* a model was chosen. */
  matched: string | null;
  /** False when nothing matched and `UNKNOWN_MODEL` was assumed. */
  recognised: boolean;
}

/**
 * Identify a printer from the name the operating system reports.
 *
 * Prefers the longest matching fragment, so "EPSON TM-T88VI" picks the T88VI
 * rather than the T88V whose fragment is also present. Returns
 * `UNKNOWN_MODEL` rather than null: the caller always needs *some* shape to
 * render against, and `recognised: false` says not to present it as a
 * confident identification.
 */
export function matchPrinter(osName: string): PrinterMatch {
  const name = osName.toLowerCase();

  let best: PrinterModel | null = null;
  let bestFragment = '';

  for (const model of PRINTER_MODELS) {
    for (const fragment of model.match) {
      if (name.includes(fragment) && fragment.length > bestFragment.length) {
        best = model;
        bestFragment = fragment;
      }
    }
  }

  if (!best) {
    return { model: UNKNOWN_MODEL, matched: null, recognised: false };
  }

  return { model: best, matched: bestFragment, recognised: true };
}

/**
 * Catalogue integrity, asserted by the test suite.
 *
 * The one that matters most: two models must not claim the same fragment, or
 * which of them wins depends on table order and a reader cannot tell.
 */
export function validatePrinterModels(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const fragments = new Map<string, string>();

  for (const model of PRINTER_MODELS) {
    if (ids.has(model.id)) { problems.push(`duplicate model id ${model.id}`); }
    ids.add(model.id);

    if (model.match.length === 0) {
      problems.push(`${model.id} can never be matched`);
    }

    for (const fragment of model.match) {
      if (fragment !== fragment.toLowerCase()) {
        problems.push(`${model.id} fragment "${fragment}" is not lower case`);
      }
      const owner = fragments.get(fragment);
      if (owner !== undefined) {
        problems.push(`${model.id} and ${owner} both claim "${fragment}"`);
      }
      fragments.set(fragment, model.id);
    }

    // The column count follows from the print head, not from the paper.
    // Font A is 12 dots wide on ESC/POS hardware, so 576 dots give 48
    // columns and 384 give 32 — but a 512-dot 80 mm printer like the
    // TM-T88V gives 42, and assuming 48 for it would truncate every
    // receipt on the right in production while the harness looked fine.
    const expected = Math.floor(model.dotsPerLine / FONT_A_DOT_WIDTH);
    if (model.charsPerLine !== expected) {
      problems.push(
        `${model.id}: ${model.dotsPerLine} dots implies ${expected} columns, not ${model.charsPerLine}`,
      );
    }
    if (model.printableMm >= 58 && model.paperWidth === '58mm') {
      problems.push(`${model.id} claims ${model.printableMm}mm printable on a 58mm roll`);
    }
  }

  return problems;
}
