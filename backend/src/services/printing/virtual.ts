/**
 * A printer that exists only in memory.
 *
 * The ask was to test printing without hardware, and more than one printer
 * type at that. This is the piece that makes it possible: it accepts the
 * same jobs the real printer service does and records them, so the whole
 * path — which printer was chosen, how many copies, whether the dialog was
 * suppressed, what HTML was produced — can be asserted in a unit test.
 *
 * Paired with `renderToText` and the model database, one bill can be put
 * through a 32-column Xprinter, a 48-column Epson and an A4 page printer in
 * the same test run, on a machine with nothing plugged into it.
 *
 * What this cannot tell you: whether the paper feeds, whether the cutter
 * fires, or how the thermal head renders a particular glyph. Those need the
 * device. It tells you everything up to the moment the bytes leave.
 */

import { renderToText, type TextRenderResult } from './text';
import { UNKNOWN_MODEL, getModel, type PrinterModel } from './models';

export type PrintTarget = 'receipt' | 'kitchen' | 'test';

export interface PrintJob {
  target: PrintTarget;
  /** The document as the real printer would receive it. */
  html: string;
  /** The OS printer name the job was addressed to, or '' for the default. */
  printerName: string;
  copies: number;
  silent: boolean;
  /** Monotonic within one printer, so ordering can be asserted. */
  sequence: number;
}

export interface VirtualPaper extends TextRenderResult {
  model: PrinterModel;
  job: PrintJob;
}

/**
 * Records jobs instead of printing them.
 *
 * One instance stands for one physical printer, so a test can set up a
 * kitchen printer and a receipt printer and assert that a KOT went to the
 * right one — which is the mistake that is otherwise found by a chef
 * receiving a customer's bill.
 */
export class VirtualPrinter {
  readonly model: PrinterModel;
  readonly name: string;

  private readonly recorded: PrintJob[] = [];
  private sequence = 0;
  private failNext: string | null = null;

  constructor(options: { name: string; modelId?: string } | string) {
    const config = typeof options === 'string' ? { name: options } : options;
    this.name = config.name;
    this.model = (config.modelId !== undefined ? getModel(config.modelId) : undefined)
      ?? UNKNOWN_MODEL;
  }

  /**
   * Accept a job.
   *
   * Throws when `failOnce` has armed a failure, so the calling code's error
   * handling is testable too — a printer that is switched off is the normal
   * case during service, not an exceptional one.
   */
  accept(job: Omit<PrintJob, 'sequence'>): PrintJob {
    if (this.failNext !== null) {
      const reason = this.failNext;
      this.failNext = null;
      throw new Error(reason);
    }

    this.sequence += 1;
    const recorded: PrintJob = { ...job, sequence: this.sequence };
    this.recorded.push(recorded);
    return recorded;
  }

  /** Arm a single failure, for testing the path where a printer is offline. */
  failOnce(reason = 'Printer is offline'): void {
    this.failNext = reason;
  }

  get jobs(): readonly PrintJob[] {
    return this.recorded;
  }

  get lastJob(): PrintJob | undefined {
    return this.recorded[this.recorded.length - 1];
  }

  jobsFor(target: PrintTarget): readonly PrintJob[] {
    return this.recorded.filter(job => job.target === target);
  }

  /** Total sheets, counting copies — what a roll actually spends. */
  get sheets(): number {
    return this.recorded.reduce((total, job) => total + job.copies, 0);
  }

  clear(): void {
    this.recorded.length = 0;
    this.sequence = 0;
    this.failNext = null;
  }

  /**
   * What the last job would look like on this printer's paper.
   *
   * The column count comes from the model, so the same call against two
   * printers answers two different questions.
   */
  paper(index = -1, options: { rtl?: boolean } = {}): VirtualPaper | null {
    // Resolved and bounds-checked explicitly: indexing a TypeScript array
    // is typed as always finding something, so `if (!job)` reads as dead
    // code to the linter while being the only thing standing between an
    // empty bench and a crash.
    const position = index < 0 ? this.recorded.length + index : index;
    if (position < 0 || position >= this.recorded.length) { return null; }

    const job = this.recorded[position];

    return {
      ...renderToText(job.html, { columns: this.model.charsPerLine, rtl: options.rtl }),
      model: this.model,
      job,
    };
  }
}

/**
 * A bench of printers, standing in for the ones attached to a till.
 *
 * `listPrinters` on the real service asks the operating system; this answers
 * from the bench, so the selection logic can be exercised against a 58 mm
 * kitchen printer and an 80 mm receipt printer that do not exist.
 */
export class PrinterBench {
  private readonly printers = new Map<string, VirtualPrinter>();

  add(name: string, modelId?: string): VirtualPrinter {
    const printer = new VirtualPrinter({ name, modelId });
    this.printers.set(name, printer);
    return printer;
  }

  get(name: string): VirtualPrinter | undefined {
    return this.printers.get(name);
  }

  /**
   * Resolve a job's destination the way the real service does: a named
   * printer, or the first on the bench when the name is empty, which stands
   * for the operating system's default.
   */
  resolve(printerName: string): VirtualPrinter | undefined {
    if (printerName !== '') { return this.printers.get(printerName); }
    return [...this.printers.values()][0];
  }

  /** The shape `print:listPrinters` returns, so a caller cannot tell. */
  list(): { name: string; displayName: string; isDefault: boolean }[] {
    return [...this.printers.values()].map((printer, index) => ({
      name: printer.name,
      displayName: `${printer.model.vendor} ${printer.model.model}`.trim(),
      isDefault: index === 0,
    }));
  }

  clear(): void {
    for (const printer of this.printers.values()) { printer.clear(); }
  }
}
