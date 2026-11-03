/**
 * Rendering a receipt to fixed-width text — the virtual printer's paper.
 *
 * The app prints HTML through an offscreen Electron window, so the only way
 * to see a receipt has been to print one. That makes "does this fit a 58 mm
 * roll" a question answered by feeding paper into a machine, and it makes a
 * layout regression invisible to the test suite.
 *
 * This renders the same HTML to a column grid instead. The output is plain
 * text, so it reads in a diff and a golden file is reviewable — and because
 * the column count comes from the printer model, the *same* receipt can be
 * checked at 32 columns and at 48 without either printer existing.
 *
 * It is a faithful rendering of this app's own receipt markup, not a general
 * HTML engine. `receipt.ts` emits a known, small vocabulary — `div.center`,
 * `div.row` with two spans, `div.rule`, `div.kot-item` with a nested
 * `div.note`, and one item table with `start`/`center`/`end` cells — and
 * this understands exactly that. Markup it does not recognise is reported
 * rather than silently dropped, so a change to the renderer that this cannot
 * read fails loudly instead of producing a golden file that quietly means
 * less than it appears to.
 */

export interface TextRenderOptions {
  /** Characters per line, from the printer model. */
  columns: number;
  /**
   * Right-to-left output.
   *
   * Only the alignment is mirrored. Reordering the glyphs of an Arabic line
   * is the terminal's or the printer's job, and doing it here would produce
   * text that looks right in a golden file and wrong on paper.
   */
  rtl?: boolean;
}

export interface TextRenderResult {
  lines: string[];
  text: string;
  /** Markup this renderer did not recognise, so a silent drop is impossible. */
  unknown: string[];
  /**
   * Lines still wider than the column count after wrapping.
   *
   * Should always be empty: wrapping is what a thermal printer does, and
   * what a browser does inside the print window, so a line that cannot be
   * made to fit means this renderer has a bug — or the receipt genuinely
   * does not fit the paper, which is the thing worth finding.
   */
  overflowing: number[];
  /**
   * Text broken mid-word because a single token was longer than the paper.
   *
   * Not an error — a long bill number on a 32-column roll legitimately
   * breaks — but it is what to look at when a receipt reads badly.
   */
  hardSplit: string[];
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decode(value: string): string {
  return value
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, match => ENTITIES[match] ?? match)
    // Anything else numeric, which `escapeHtml` does not emit but a future
    // change might.
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/** Strip tags from an inline fragment and collapse its whitespace. */
function plain(fragment: string): string {
  return decode(fragment.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * Break text to the column width, as the printer itself would.
 *
 * Breaks on spaces; a single token longer than the paper is split, because
 * the alternative is losing it. Splits of that kind are reported separately
 * so they can be looked at without being treated as failures.
 */
function wrap(text: string, columns: number, hardSplit: string[]): string[] {
  if (text.length <= columns) { return [text]; }

  const out: string[] = [];
  let line = '';

  for (const word of text.split(' ')) {
    if (word.length > columns) {
      if (line !== '') { out.push(line); line = ''; }
      hardSplit.push(word);
      for (let i = 0; i < word.length; i += columns) {
        out.push(word.slice(i, i + columns));
      }
      continue;
    }

    const candidate = line === '' ? word : `${line} ${word}`;
    if (candidate.length > columns) {
      out.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line !== '') { out.push(line); }
  return out;
}

function centre(text: string, columns: number): string {
  if (text.length >= columns) { return text; }
  return ' '.repeat(Math.floor((columns - text.length) / 2)) + text;
}

function cell(text: string, width: number, align: 'start' | 'center' | 'end'): string {
  const clipped = text.slice(0, width);
  const slack = width - clipped.length;
  if (slack === 0) { return clipped; }

  if (align === 'end') { return ' '.repeat(slack) + clipped; }
  if (align === 'center') {
    const left = Math.floor(slack / 2);
    return ' '.repeat(left) + clipped + ' '.repeat(slack - left);
  }
  return clipped + ' '.repeat(slack);
}

/**
 * A label on one edge and a value on the other.
 *
 * When the two cannot both fit, the label is truncated rather than the
 * value: on a receipt the number is the part that matters, and a clipped
 * total would be a defect rather than a cosmetic one.
 */
function edges(label: string, value: string, columns: number, rtl: boolean): string {
  const room = columns - value.length - 1;
  const cut = room <= 0 ? '' : label.slice(0, room);
  const gap = Math.max(1, columns - cut.length - value.length);

  return rtl
    ? value + ' '.repeat(gap) + cut
    : cut + ' '.repeat(gap) + value;
}

/** Pull the `<body>` contents out, dropping the head and the stylesheet. */
function bodyOf(html: string): string {
  const match = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match ? match[1] : html;
}

/**
 * Split a fragment into its top-level blocks, tracking depth.
 *
 * A regex cannot do this. `<div class="kot-item">…<div class="note">…</div></div>`
 * is a block containing a block, and a non-greedy `<div>…</div>` stops at
 * the *inner* closing tag — which flattened a kitchen ticket's item and its
 * note onto one line and overran the paper width without saying so.
 */
function topLevelBlocks(fragment: string): string[] {
  const blocks: string[] = [];
  const tag = /<(\/?)(div|table)\b[^>]*>/gi;

  let depth = 0;
  let start = -1;
  let match: RegExpExecArray | null;

  while ((match = tag.exec(fragment)) !== null) {
    if (match[1] !== '/') {
      if (depth === 0) { start = match.index; }
      depth += 1;
      continue;
    }

    depth -= 1;
    if (depth === 0 && start >= 0) {
      blocks.push(fragment.slice(start, match.index + match[0].length));
      start = -1;
    }
    // A stray closing tag would push depth negative and lose everything
    // after it; clamp rather than trust the markup.
    if (depth < 0) { depth = 0; }
  }

  return blocks;
}

/** The class on a block's own opening tag, not on a nested one. */
function classOf(block: string): string {
  return /^<[a-z]+\b[^>]*class="([^"]*)"/i.exec(block)?.[1] ?? '';
}

/** Everything between a block's own tags. */
function contentOf(block: string): string {
  const opened = block.indexOf('>');
  const closed = block.lastIndexOf('<');
  return opened < 0 || closed <= opened ? '' : block.slice(opened + 1, closed);
}

/** A block's own text, with its nested blocks taken out. */
function inlineOf(block: string): string {
  let inner = contentOf(block);
  for (const nested of topLevelBlocks(inner)) {
    inner = inner.replace(nested, ' ');
  }
  return inner;
}

interface Columns {
  name: number;
  qty: number;
  price: number | null;
  amount: number;
}

/**
 * Allocate the item table's columns.
 *
 * Quantity, price and amount get fixed room and the name takes the rest,
 * because the name is the only one that can be wrapped without losing
 * information the customer needs.
 */
function allocate(columns: number, withPrice: boolean): Columns {
  const qty = 3;
  const amount = Math.min(10, Math.max(7, Math.floor(columns / 4)));
  const price = withPrice ? amount : null;
  const fixed = qty + amount + (price ?? 0);
  const gaps = withPrice ? 3 : 2;

  return { name: Math.max(6, columns - fixed - gaps), qty, price, amount };
}

export function renderToText(html: string, options: TextRenderOptions): TextRenderResult {
  const { columns, rtl = false } = options;
  const lines: string[] = [];
  const unknown: string[] = [];
  const hardSplit: string[] = [];

  const emit = (text: string, align: 'start' | 'center', indent = 0) => {
    if (text === '') { return; }

    for (const part of wrap(text, Math.max(1, columns - indent), hardSplit)) {
      if (align === 'center') {
        lines.push(rtl ? cell(part, columns, 'end').trimEnd() : centre(part, columns));
      } else if (rtl) {
        lines.push(cell(part, columns - indent, 'end'));
      } else {
        lines.push(' '.repeat(indent) + part);
      }
    }
  };

  const render = (block: string): void => {
    if (/^<table/i.test(block)) {
      renderTable(block, columns, lines, unknown, hardSplit);
      return;
    }

    const classes = classOf(block);
    const children = topLevelBlocks(contentOf(block));
    const renderChildren = () => { for (const child of children) { render(child); } };

    // Vertical space is a blank line on a column grid. Handled before the
    // generic branches so it is not reported as markup with no rule.
    if (classes.includes('spacer')) { lines.push(''); return; }

    if (classes.includes('rule-solid')) { lines.push('='.repeat(columns)); return; }
    if (classes.includes('rule')) { lines.push('-'.repeat(columns)); return; }

    if (classes.includes('row')) {
      const spans = [...block.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map(m => plain(m[1]));
      if (spans.length >= 2) {
        lines.push(edges(spans[0], spans[spans.length - 1], columns, rtl));
      } else {
        emit(plain(block), 'start');
      }
      return;
    }

    // A kitchen ticket's item: its own line, with the note indented beneath
    // it as a block of its own rather than run onto the same line.
    if (classes.includes('kot-item')) {
      emit(plain(inlineOf(block)), 'start');
      renderChildren();
      return;
    }

    if (classes.includes('note')) {
      emit(plain(inlineOf(block)), 'start', 2);
      renderChildren();
      return;
    }

    if (classes.includes('center')) {
      emit(plain(inlineOf(block)), 'center');
      renderChildren();
      return;
    }

    if (classes === '' || /\b(muted|bold|heading|num|total-row|start|end|big)\b/.test(classes)) {
      emit(plain(inlineOf(block)), 'start');
      renderChildren();
      return;
    }

    // A class this renderer has no rule for. Recorded rather than dropped:
    // a golden file that silently omits a block is worse than no golden file.
    unknown.push(classes);
    emit(plain(inlineOf(block)), 'start');
    renderChildren();
  };

  for (const block of topLevelBlocks(bodyOf(html))) { render(block); }

  const overflowing = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trimEnd().length > columns)
    .map(({ index }) => index);

  return { lines, text: lines.join('\n'), unknown, overflowing, hardSplit };
}

function renderTable(
  table: string,
  columns: number,
  lines: string[],
  unknown: string[],
  hardSplit: string[],
): void {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  if (rows.length === 0) { return; }

  const cellsOf = (row: string) =>
    [...row.matchAll(/<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((m) => {
      const attrs = m[2];
      let align: 'start' | 'center' | 'end' = 'start';
      if (/class="[^"]*\bend\b/.test(attrs)) { align = 'end'; }
      else if (/class="[^"]*\bcenter\b/.test(attrs)) { align = 'center'; }
      return { text: plain(m[3]), align };
    });

  const header = cellsOf(rows[0]);
  // Four cells means a unit-price column; three means it was dropped for a
  // narrow roll. Anything else is markup this renderer does not know.
  if (header.length !== 3 && header.length !== 4) {
    unknown.push(`table with ${header.length} columns`);
    return;
  }

  const withPrice = header.length === 4;
  const widths = allocate(columns, withPrice);
  const order = withPrice
    ? [widths.name, widths.qty, widths.price ?? 0, widths.amount]
    : [widths.name, widths.qty, widths.amount];

  /**
   * One row, wrapping the name across continuation lines.
   *
   * A dish called "Grilled Chicken Shawarma Platter" does not fit the name
   * column on a 58 mm roll, and truncating it leaves the kitchen guessing.
   * Real receipts wrap it and leave the numeric columns blank underneath,
   * which is what this does.
   */
  const renderRow = (cells: ReturnType<typeof cellsOf>) => {
    const used = cells.slice(0, order.length);
    if (used.length === 0) { return; }

    const nameParts = wrap(used[0].text, order[0], hardSplit);
    const rest = used.slice(1).map((c, i) => cell(c.text, order[i + 1], c.align));

    lines.push([cell(nameParts[0], order[0], used[0].align), ...rest].join(' ').trimEnd());

    for (const part of nameParts.slice(1)) {
      lines.push(cell(part, order[0], used[0].align).trimEnd());
    }
  };

  renderRow(header);
  for (const row of rows.slice(1)) {
    renderRow(cellsOf(row));
  }
}
