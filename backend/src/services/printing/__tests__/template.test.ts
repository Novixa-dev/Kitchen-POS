import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../lib/settings';
import { renderBill, type ReceiptBill, type ReceiptItem } from '../../receipt';
import { renderToText } from '../text';
import {
  BLOCKS,
  TEMPLATE_PRESETS,
  blocksFor,
  defaultTemplateFor,
  duplicateTemplate,
  getTemplatePreset,
  isBlockId,
  isRequired,
  moveBlock,
  sanitiseTemplate,
  setBlockVisible,
  validateTemplates,
  visibleBlocks,
  type ReceiptTemplate,
} from '../template';

const thermal80 = () => getTemplatePreset('thermal-80')!;

describe('the block catalogue', () => {
  it('gives every block a translation key and at least one kind', () => {
    for (const block of BLOCKS) {
      expect(block.nameKey, block.id).toMatch(/^block\./);
      expect(block.kinds.length, block.id).toBeGreaterThan(0);
    }
  });

  it('recognises its own ids and rejects anything else', () => {
    expect(isBlockId('total')).toBe(true);
    expect(isBlockId('signature')).toBe(false);
    expect(isBlockId(undefined)).toBe(false);
  });

  it('requires the blocks without which a bill is not a bill', () => {
    // An outlet that hid these would produce a document that fails an
    // inspection rather than one that looks the way they wanted.
    for (const id of ['outletName', 'items', 'total', 'billMeta'] as const) {
      expect(isRequired(id), id).toBe(true);
    }
    expect(isRequired('logo')).toBe(false);
  });

  it('keeps money blocks off a kitchen ticket', () => {
    const kitchen = blocksFor('kitchen').map(b => b.id);
    expect(kitchen).not.toContain('total');
    expect(kitchen).not.toContain('payments');
    expect(kitchen).toContain('items');
  });
});

describe('the bundled presets', () => {
  it('has no duplicate ids, stray blocks or hidden required blocks', () => {
    expect(validateTemplates()).toEqual([]);
  });

  it('covers both thermal widths, A4 and the kitchen', () => {
    const ids = TEMPLATE_PRESETS.map(t => t.id);
    expect(ids).toContain('thermal-58');
    expect(ids).toContain('thermal-80');
    expect(ids).toContain('a4-invoice');
    expect(ids).toContain('kitchen-compact');
  });

  it('is not editable in place', () => {
    // An outlet duplicates a preset and edits the copy, so "put it back the
    // way it was" is always available.
    for (const template of TEMPLATE_PRESETS) {
      expect(template.editable, template.id).toBe(false);
    }
  });

  it('drops the address and phone on 58 mm, where columns are scarce', () => {
    const narrow = getTemplatePreset('thermal-58')!;
    const visible = visibleBlocks(narrow);
    expect(visible).not.toContain('outletAddress');
    expect(visible).not.toContain('outletPhone');
    expect(visible).toContain('outletName');
    expect(visible).toContain('total');
  });

  it('keeps a kitchen ticket to what is read at a glance', () => {
    const kitchen = getTemplatePreset('kitchen-compact')!;
    const visible = visibleBlocks(kitchen);
    expect(visible).toContain('items');
    expect(visible).toContain('billMeta');
    expect(visible).not.toContain('thankYou');
  });
});

describe('defaultTemplateFor', () => {
  it('matches the paper width when a preset exists for it', () => {
    expect(defaultTemplateFor('bill', '58mm').id).toBe('thermal-58');
    expect(defaultTemplateFor('bill', '80mm').id).toBe('thermal-80');
    expect(defaultTemplateFor('bill', 'a4').id).toBe('a4-invoice');
  });

  it('falls back within the kind for a pairing with no preset', () => {
    // A kitchen ticket on A4 has no preset of its own; it must still get a
    // kitchen template rather than a bill.
    expect(defaultTemplateFor('kitchen', 'a4').kind).toBe('kitchen');
  });
});

describe('sanitiseTemplate', () => {
  const fallback = thermal80();

  it('returns the fallback for anything that is not an object', () => {
    expect(sanitiseTemplate(null, fallback)).toEqual(fallback);
    expect(sanitiseTemplate('thermal-80', fallback)).toEqual(fallback);
  });

  it('keeps a valid stored template', () => {
    const stored = {
      id: 'custom-1', nameKey: 'My receipt', kind: 'bill', paperWidth: '80mm',
      editable: true,
      blocks: [{ id: 'outletName', visible: true }, { id: 'items', visible: true }, { id: 'total', visible: true }, { id: 'billMeta', visible: true }],
    };
    const result = sanitiseTemplate(stored, fallback);
    expect(result.id).toBe('custom-1');
    expect(result.nameKey).toBe('My receipt');
    expect(visibleBlocks(result).slice(0, 4))
      .toEqual(['outletName', 'items', 'total', 'billMeta']);
  });

  it('drops a block this build does not know', () => {
    const result = sanitiseTemplate({
      kind: 'bill',
      blocks: [{ id: 'items', visible: true }, { id: 'hologram', visible: true }],
    }, fallback);
    expect(visibleBlocks(result)).not.toContain('hologram');
  });

  it('drops a block that does not belong on this kind of document', () => {
    const result = sanitiseTemplate({
      kind: 'kitchen',
      blocks: [{ id: 'items', visible: true }, { id: 'total', visible: true }],
    }, fallback);
    expect(visibleBlocks(result)).not.toContain('total');
  });

  it('forces a required block visible, however it was stored', () => {
    // A hidden required block reaching the renderer prints a bill with no
    // total — which is the failure this guard exists for.
    const result = sanitiseTemplate({
      kind: 'bill',
      blocks: [{ id: 'total', visible: false }, { id: 'items', visible: false }],
    }, fallback);

    const total = result.blocks.find(b => b.id === 'total');
    const items = result.blocks.find(b => b.id === 'items');
    expect(total?.visible).toBe(true);
    expect(items?.visible).toBe(true);
  });

  it('appends an unmentioned block hidden, rather than losing it', () => {
    // A template written by an older build does not know newer blocks. The
    // outlet does not get one appearing on their receipts, but it is there
    // to switch on.
    const result = sanitiseTemplate({
      kind: 'bill',
      blocks: [{ id: 'outletName', visible: true }],
    }, fallback);

    const logo = result.blocks.find(b => b.id === 'logo');
    expect(logo).toBeDefined();
    expect(logo?.visible).toBe(false);
  });

  it('removes a duplicate of a block that would otherwise print twice', () => {
    const result = sanitiseTemplate({
      kind: 'bill',
      blocks: [{ id: 'total', visible: true }, { id: 'total', visible: true }],
    }, fallback);
    expect(result.blocks.filter(b => b.id === 'total')).toHaveLength(1);
  });

  it('allows separators and spacers to repeat, since that is their purpose', () => {
    const result = sanitiseTemplate({
      kind: 'bill',
      blocks: [
        { id: 'separator', visible: true },
        { id: 'items', visible: true },
        { id: 'separator', visible: true },
      ],
    }, fallback);
    expect(result.blocks.filter(b => b.id === 'separator').length).toBeGreaterThanOrEqual(2);
  });

  it('sanitises every bundled preset to itself', () => {
    // What is shipped must survive a round trip, or an upgrade would alter
    // a layout nobody edited.
    for (const preset of TEMPLATE_PRESETS) {
      const result = sanitiseTemplate(preset, preset);
      expect(visibleBlocks(result), preset.id).toEqual(visibleBlocks(preset));
    }
  });
});

describe('duplicateTemplate', () => {
  it('makes an editable copy with a new id', () => {
    const copy = duplicateTemplate(thermal80(), 'Front counter');
    expect(copy.id).not.toBe('thermal-80');
    expect(copy.editable).toBe(true);
    expect(copy.nameKey).toBe('Front counter');
    expect(visibleBlocks(copy)).toEqual(visibleBlocks(thermal80()));
  });

  it('does not share block objects with the original', () => {
    // Editing the copy must not alter the preset it came from.
    const source = thermal80();
    const copy = duplicateTemplate(source, 'Copy');
    copy.blocks[0].visible = false;
    expect(source.blocks[0].visible).toBe(true);
  });

  it('keeps the source name when none is given', () => {
    expect(duplicateTemplate(thermal80(), '   ').nameKey).toBe(thermal80().nameKey);
  });
});

describe('setBlockVisible', () => {
  it('hides an optional block', () => {
    const result = setBlockVisible(thermal80(), 'logo', false);
    expect(visibleBlocks(result)).not.toContain('logo');
  });

  it('refuses to hide a required one, as a no-op', () => {
    const before = thermal80();
    const after = setBlockVisible(before, 'total', false);
    expect(after).toBe(before);
    expect(visibleBlocks(after)).toContain('total');
  });

  it('shows a hidden block again', () => {
    const hidden = setBlockVisible(thermal80(), 'logo', false);
    expect(visibleBlocks(setBlockVisible(hidden, 'logo', true))).toContain('logo');
  });
});

describe('moveBlock', () => {
  it('moves a block to a new position', () => {
    const template = thermal80();
    const moved = moveBlock(template, 0, 2);
    expect(moved.blocks[2].id).toBe(template.blocks[0].id);
    expect(moved.blocks).toHaveLength(template.blocks.length);
  });

  it('clamps a target past the end rather than throwing', () => {
    // Overshooting the list is a normal drag, not an error.
    const template = thermal80();
    const moved = moveBlock(template, 0, 999);
    expect(moved.blocks[moved.blocks.length - 1].id).toBe(template.blocks[0].id);
  });

  it('ignores a source that is not in the list', () => {
    const template = thermal80();
    expect(moveBlock(template, -1, 0)).toBe(template);
    expect(moveBlock(template, 999, 0)).toBe(template);
  });

  it('is a no-op when nothing would move', () => {
    const template = thermal80();
    expect(moveBlock(template, 1, 1)).toBe(template);
  });

  it('never loses or duplicates a block', () => {
    let template: ReceiptTemplate = thermal80();
    const before = template.blocks.map(b => b.id).sort();

    for (let i = 0; i < 20; i += 1) {
      template = moveBlock(template, i % template.blocks.length, (i * 3) % template.blocks.length);
    }

    expect(template.blocks.map(b => b.id).sort()).toEqual(before);
  });
});

// ── the templates actually reaching the paper ──────────────────────────────

describe('rendering through a template', () => {
  const settings = (): AppSettings => ({
    ...DEFAULT_SETTINGS,
    outlet: {
      ...DEFAULT_SETTINGS.outlet,
      name: 'Al Nakheel',
      address: '12 King Road',
      phone: '0500000000',
      taxNumber: '300012345600003',
    },
    print: { ...DEFAULT_SETTINGS.print, paperWidth: '80mm', footerText: 'See you soon' },
  });

  const bill: ReceiptBill = {
    bill_number: 'INV-2026-0042',
    taxable_amount: 100,
    tax_amount: 15,
    cgst_amount: 0,
    sgst_amount: 0,
    discount_amount: 0,
    total_amount: 115,
    tax_mode: 'vat',
    tax_rate: 15,
    created_at: '2026-03-01T10:00:00Z',
  };

  const items: ReceiptItem[] = [{ name: 'Mint Lemonade', qty: 1, unit_price: 35 }];

  const asText = (template?: ReceiptTemplate) =>
    renderToText(renderBill(bill, items, settings(), [], template), { columns: 48 }).text;

  it('prints the shipped layout when no template is given', () => {
    // An install that has never touched a template must get exactly the
    // receipt it got before this existed.
    const text = asText();
    expect(text).toContain('Al Nakheel');
    expect(text).toContain('12 King Road');
    expect(text).toContain('INV-2026-0042');
    expect(text).toContain('See you soon');
  });

  it('leaves out a block the template hides', () => {
    const hidden = setBlockVisible(
      setBlockVisible(duplicateTemplate(thermal80(), 'No contact'), 'outletAddress', false),
      'outletPhone', false,
    );

    const text = asText(hidden);
    expect(text).not.toContain('12 King Road');
    expect(text).not.toContain('0500000000');
    // And still prints what matters.
    expect(text).toContain('Al Nakheel');
    expect(text).toContain('INV-2026-0042');
  });

  it('prints blocks in the order the template gives', () => {
    const template = duplicateTemplate(thermal80(), 'Name last');
    const nameAt = template.blocks.findIndex(b => b.id === 'outletName');
    const moved = moveBlock(template, nameAt, template.blocks.length - 1);

    const lines = renderToText(
      renderBill(bill, items, settings(), [], moved),
      { columns: 48 },
    ).lines;

    const nameLine = lines.findIndex(l => l.includes('Al Nakheel'));
    const totalLine = lines.findIndex(l => l.includes('115'));
    expect(nameLine).toBeGreaterThan(totalLine);
  });

  it('still prints a required block the stored template tried to hide', () => {
    // `setBlockVisible` refuses, but a template edited by hand could reach
    // the renderer — and a bill with no total is not a bill.
    const tampered: ReceiptTemplate = {
      ...duplicateTemplate(thermal80(), 'Tampered'),
      blocks: thermal80().blocks.map(b =>
        b.id === 'total' ? { ...b, visible: false } : b,
      ),
    };

    const safe = sanitiseTemplate(tampered, thermal80());
    expect(asText(safe)).toContain('115');
  });

  it('does not leave a stranded rule where a block printed nothing', () => {
    // An outlet with no address and no phone should not get two rules with
    // a gap between them.
    const bare = {
      ...settings(),
      outlet: { ...settings().outlet, address: '', phone: '', logoPath: '' },
    };

    const text = renderToText(
      renderBill(bill, items, bare, []),
      { columns: 48 },
    ).text;

    expect(text).not.toMatch(/-{48}\n-{48}/);
  });

  it('never opens or closes the receipt with a rule', () => {
    const lines = renderToText(renderBill(bill, items, settings(), []), { columns: 48 }).lines;
    expect(lines[0]).not.toMatch(/^-+$/);
    expect(lines[lines.length - 1]).not.toMatch(/^-+$/);
  });

  it('fits every preset on its own paper', () => {
    for (const preset of TEMPLATE_PRESETS.filter(t => t.kind === 'bill')) {
      const COLUMNS: Record<string, number> = { '58mm': 32, '80mm': 48, a4: 80 };
      const columns = COLUMNS[preset.paperWidth];
      const paper = renderToText(
        renderBill(bill, items, {
          ...settings(),
          print: { ...settings().print, paperWidth: preset.paperWidth },
        }, [], preset),
        { columns },
      );

      expect(paper.overflowing, preset.id).toEqual([]);
      expect(paper.unknown, preset.id).toEqual([]);
      expect(paper.text, preset.id).toContain('INV-2026-0042');
    }
  });
});
