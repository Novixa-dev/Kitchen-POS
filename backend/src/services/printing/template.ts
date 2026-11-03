/**
 * Receipt templates: what is printed, in what order.
 *
 * The receipt layout was fixed in code. An outlet that wanted their logo
 * above the name, or no payment breakdown, or a line of Arabic thanks at the
 * bottom, could not have it — and a kitchen ticket that should be three
 * lines printed a full header.
 *
 * A template is an ordered list of blocks with a visible flag. That is
 * deliberately less than a drag-and-drop canvas: a thermal receipt is a
 * single column of stacked blocks and nothing else, so a free-form canvas
 * would offer placements the paper cannot honour. Ordering and hiding is
 * the whole of what the medium allows, and it is enough to cover what was
 * asked for.
 *
 * Pure and dependency-free: the rules are unit-testable, and the renderer
 * consumes the result.
 */

import type { PaperWidth } from '../../lib/settings';

/**
 * Every block a receipt can contain.
 *
 * Fixed rather than open: each one corresponds to a fragment the renderer
 * knows how to produce, so an id that is not here could not be printed.
 */
export type BlockId =
  | 'logo'
  | 'outletName'
  | 'outletAddress'
  | 'outletPhone'
  | 'taxNumber'
  | 'title'
  | 'billMeta'
  | 'items'
  | 'subtotal'
  | 'discount'
  | 'tax'
  | 'total'
  | 'inclusiveNote'
  | 'payments'
  | 'change'
  | 'thankYou'
  | 'footerText'
  | 'separator'
  | 'spacer';

export interface TemplateBlock {
  id: BlockId;
  visible: boolean;
}

export type TemplateKind = 'bill' | 'kitchen';

export interface ReceiptTemplate {
  /** Stable id. `custom-…` for one an outlet made. */
  id: string;
  /** Translation key for a bundled preset; a plain name for a custom one. */
  nameKey: string;
  kind: TemplateKind;
  paperWidth: PaperWidth;
  blocks: TemplateBlock[];
  /** False for the bundled presets, which are not editable in place. */
  editable: boolean;
}

export interface BlockManifest {
  id: BlockId;
  nameKey: string;
  /** Which kinds of document this block makes sense on. */
  kinds: readonly TemplateKind[];
  /**
   * Cannot be hidden.
   *
   * A bill with no items or no total is not a bill, and an outlet that hid
   * them would produce a document that fails an inspection rather than one
   * that looks the way they wanted.
   */
  required?: true;
}

export const BLOCKS: readonly BlockManifest[] = [
  { id: 'logo', nameKey: 'block.logo', kinds: ['bill'] },
  { id: 'outletName', nameKey: 'block.outletName', kinds: ['bill'], required: true },
  { id: 'outletAddress', nameKey: 'block.outletAddress', kinds: ['bill'] },
  { id: 'outletPhone', nameKey: 'block.outletPhone', kinds: ['bill'] },
  { id: 'taxNumber', nameKey: 'block.taxNumber', kinds: ['bill'] },
  { id: 'title', nameKey: 'block.title', kinds: ['bill', 'kitchen'] },
  { id: 'billMeta', nameKey: 'block.billMeta', kinds: ['bill', 'kitchen'], required: true },
  { id: 'items', nameKey: 'block.items', kinds: ['bill', 'kitchen'], required: true },
  { id: 'subtotal', nameKey: 'block.subtotal', kinds: ['bill'] },
  { id: 'discount', nameKey: 'block.discount', kinds: ['bill'] },
  { id: 'tax', nameKey: 'block.tax', kinds: ['bill'] },
  { id: 'total', nameKey: 'block.total', kinds: ['bill'], required: true },
  { id: 'inclusiveNote', nameKey: 'block.inclusiveNote', kinds: ['bill'] },
  { id: 'payments', nameKey: 'block.payments', kinds: ['bill'] },
  { id: 'change', nameKey: 'block.change', kinds: ['bill'] },
  { id: 'thankYou', nameKey: 'block.thankYou', kinds: ['bill', 'kitchen'] },
  { id: 'footerText', nameKey: 'block.footerText', kinds: ['bill', 'kitchen'] },
  { id: 'separator', nameKey: 'block.separator', kinds: ['bill', 'kitchen'] },
  { id: 'spacer', nameKey: 'block.spacer', kinds: ['bill', 'kitchen'] },
];

const BLOCK_IDS = new Set<string>(BLOCKS.map(b => b.id));

export function isBlockId(value: unknown): value is BlockId {
  return typeof value === 'string' && BLOCK_IDS.has(value);
}

export function getBlock(id: BlockId): BlockManifest | undefined {
  return BLOCKS.find(b => b.id === id);
}

export function isRequired(id: BlockId): boolean {
  return getBlock(id)?.required === true;
}

/** The blocks that make sense on a given kind of document. */
export function blocksFor(kind: TemplateKind): BlockManifest[] {
  return BLOCKS.filter(b => b.kinds.includes(kind));
}

const billBlocks = (ids: BlockId[]): TemplateBlock[] =>
  ids.map(id => ({ id, visible: true }));

/**
 * The bundled presets.
 *
 * Not editable in place: an outlet duplicates one and edits the copy, so
 * "put it back the way it was" is always available and a botched edit is
 * never unrecoverable.
 */
export const TEMPLATE_PRESETS: readonly ReceiptTemplate[] = [
  {
    id: 'thermal-80',
    nameKey: 'template.thermal80',
    kind: 'bill',
    paperWidth: '80mm',
    editable: false,
    blocks: billBlocks([
      'logo', 'outletName', 'outletAddress', 'outletPhone', 'taxNumber',
      'separator', 'title', 'separator', 'billMeta', 'separator',
      'items',
      'separator', 'subtotal', 'discount', 'tax', 'total', 'inclusiveNote',
      'separator', 'payments', 'change',
      'separator', 'thankYou', 'footerText',
    ]),
  },
  {
    id: 'thermal-58',
    nameKey: 'template.thermal58',
    kind: 'bill',
    paperWidth: '58mm',
    editable: false,
    // Narrower paper: the address and phone come off, because 32 columns
    // spent on them is 32 columns not spent on the items.
    blocks: [
      ...billBlocks(['outletName', 'taxNumber', 'separator', 'title', 'billMeta', 'separator', 'items', 'separator', 'subtotal']),
      { id: 'discount', visible: true },
      ...billBlocks(['tax', 'total', 'inclusiveNote', 'separator', 'payments', 'change', 'separator', 'thankYou']),
      { id: 'logo', visible: false },
      { id: 'outletAddress', visible: false },
      { id: 'outletPhone', visible: false },
      { id: 'footerText', visible: false },
    ],
  },
  {
    id: 'a4-invoice',
    nameKey: 'template.a4Invoice',
    kind: 'bill',
    paperWidth: 'a4',
    editable: false,
    blocks: billBlocks([
      'logo', 'outletName', 'outletAddress', 'outletPhone', 'taxNumber',
      'separator', 'title', 'billMeta', 'separator',
      'items',
      'separator', 'subtotal', 'discount', 'tax', 'total', 'inclusiveNote',
      'separator', 'payments', 'change',
      'spacer', 'thankYou', 'footerText',
    ]),
  },
  {
    id: 'kitchen-compact',
    nameKey: 'template.kitchenCompact',
    kind: 'kitchen',
    paperWidth: '80mm',
    editable: false,
    // A kitchen ticket is read at a glance over a hot pass. Everything that
    // is not the table, the ticket number and the items is noise.
    blocks: [
      ...billBlocks(['title', 'billMeta', 'separator', 'items']),
      { id: 'thankYou', visible: false },
      { id: 'footerText', visible: false },
      { id: 'separator', visible: true },
    ],
  },
];

export function getTemplatePreset(id: string): ReceiptTemplate | undefined {
  return TEMPLATE_PRESETS.find(t => t.id === id);
}

/** The preset a paper width defaults to, used when nothing is configured. */
export function defaultTemplateFor(
  kind: TemplateKind,
  paperWidth: PaperWidth,
): ReceiptTemplate {
  const match = TEMPLATE_PRESETS.find(t => t.kind === kind && t.paperWidth === paperWidth);
  if (match) { return match; }

  // A kitchen ticket on A4, or any other pairing without its own preset.
  const byKind = TEMPLATE_PRESETS.find(t => t.kind === kind);
  return byKind ?? TEMPLATE_PRESETS[0];
}

/**
 * Validate a stored template.
 *
 * The store is schemaless, so this can hold a block a newer build knew, a
 * duplicate, or a required block that has been hidden. A required block
 * that reached the renderer hidden would print a bill with no total.
 */
export function sanitiseTemplate(raw: unknown, fallback: ReceiptTemplate): ReceiptTemplate {
  if (raw === null || typeof raw !== 'object') { return { ...fallback }; }
  const stored = raw as Partial<Record<keyof ReceiptTemplate, unknown>>;

  const kind: TemplateKind = stored.kind === 'kitchen' ? 'kitchen' : 'bill';
  const allowed = new Set(blocksFor(kind).map(b => b.id));

  const seen = new Set<BlockId>();
  const blocks: TemplateBlock[] = [];

  for (const entry of Array.isArray(stored.blocks) ? stored.blocks : []) {
    if (entry === null || typeof entry !== 'object') { continue; }
    const { id, visible } = entry as { id?: unknown; visible?: unknown };

    if (!isBlockId(id) || !allowed.has(id)) { continue; }
    // `separator` and `spacer` are the two that legitimately repeat; every
    // other block appearing twice would print twice.
    if (seen.has(id) && id !== 'separator' && id !== 'spacer') { continue; }
    seen.add(id);

    blocks.push({ id, visible: isRequired(id) ? true : visible !== false });
  }

  // Anything the stored template never mentioned — because it was written by
  // an older build — is appended hidden, rather than silently lost. An
  // outlet upgrading does not get a new block appearing on their receipts,
  // but it is there to switch on.
  for (const manifest of blocksFor(kind)) {
    if (!seen.has(manifest.id)) {
      blocks.push({ id: manifest.id, visible: manifest.required === true });
    }
  }

  if (blocks.length === 0) { return { ...fallback }; }

  return {
    id: typeof stored.id === 'string' && stored.id !== '' ? stored.id : fallback.id,
    nameKey: typeof stored.nameKey === 'string' && stored.nameKey !== ''
      ? stored.nameKey
      : fallback.nameKey,
    kind,
    paperWidth: stored.paperWidth === '58mm' || stored.paperWidth === '80mm' || stored.paperWidth === 'a4'
      ? stored.paperWidth
      : fallback.paperWidth,
    blocks,
    editable: stored.editable !== false,
  };
}

/**
 * Copy a template so it can be edited.
 *
 * This is the duplicate-and-edit path: the presets stay as shipped, and the
 * copy carries a plain name rather than a translation key, because a name
 * the outlet typed is not translatable.
 */
export function duplicateTemplate(source: ReceiptTemplate, name: string): ReceiptTemplate {
  return {
    id: `custom-${source.id}-${Date.now()}`,
    nameKey: name.trim() === '' ? source.nameKey : name.trim(),
    kind: source.kind,
    paperWidth: source.paperWidth,
    blocks: source.blocks.map(block => ({ ...block })),
    editable: true,
  };
}

/** Show or hide a block. Required blocks refuse, as a no-op. */
export function setBlockVisible(
  template: ReceiptTemplate,
  id: BlockId,
  visible: boolean,
): ReceiptTemplate {
  if (!visible && isRequired(id)) { return template; }

  return {
    ...template,
    blocks: template.blocks.map(block => (block.id === id ? { ...block, visible } : block)),
  };
}

/**
 * Move a block up or down.
 *
 * Positions out of range clamp rather than throwing: a drag that overshoots
 * the end of the list is a normal gesture, not an error.
 */
export function moveBlock(
  template: ReceiptTemplate,
  from: number,
  to: number,
): ReceiptTemplate {
  const blocks = [...template.blocks];
  if (from < 0 || from >= blocks.length) { return template; }

  const target = Math.max(0, Math.min(blocks.length - 1, to));
  if (target === from) { return template; }

  const [moved] = blocks.splice(from, 1);
  blocks.splice(target, 0, moved);

  return { ...template, blocks };
}

/** The visible blocks in order, which is what the renderer walks. */
export function visibleBlocks(template: ReceiptTemplate): BlockId[] {
  return template.blocks.filter(b => b.visible).map(b => b.id);
}

/**
 * Catalogue integrity, asserted by the test suite.
 *
 * The one that matters: a preset that hides a required block would print a
 * bill with no total the moment it was selected.
 */
export function validateTemplates(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const template of TEMPLATE_PRESETS) {
    if (ids.has(template.id)) { problems.push(`duplicate template id ${template.id}`); }
    ids.add(template.id);

    if (template.editable) {
      problems.push(`${template.id} is a preset but marked editable`);
    }
    if (!template.nameKey.startsWith('template.')) {
      problems.push(`${template.id} name key is ${template.nameKey}`);
    }

    const allowed = new Set(blocksFor(template.kind).map(b => b.id));
    const present = new Set<BlockId>();

    for (const block of template.blocks) {
      if (!allowed.has(block.id)) {
        problems.push(`${template.id} has ${block.id}, which is not a ${template.kind} block`);
      }
      if (present.has(block.id) && block.id !== 'separator' && block.id !== 'spacer') {
        problems.push(`${template.id} lists ${block.id} twice`);
      }
      present.add(block.id);

      if (isRequired(block.id) && !block.visible) {
        problems.push(`${template.id} hides the required block ${block.id}`);
      }
    }

    for (const manifest of blocksFor(template.kind)) {
      if (manifest.required === true && !present.has(manifest.id)) {
        problems.push(`${template.id} is missing the required block ${manifest.id}`);
      }
    }
  }

  return problems;
}
