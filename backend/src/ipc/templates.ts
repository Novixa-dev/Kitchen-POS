/**
 * The print template designer.
 *
 * Every write goes back through `sanitiseTemplate` before it is stored, so a
 * required block cannot be hidden and a block this build does not know
 * cannot be saved — the refusal lives in the pure layer rather than in this
 * file's validation, which keeps one set of rules.
 */

import { ipcMain } from 'electron';
import { errMsg } from '../lib/errors';
import { getSettings, patchSettings } from '../lib/settings';
import {
  BLOCKS,
  TEMPLATE_PRESETS,
  blocksFor,
  duplicateTemplate,
  getTemplatePreset,
  isBlockId,
  moveBlock,
  sanitiseTemplate,
  setBlockVisible,
  defaultTemplateFor,
  type ReceiptTemplate,
  type TemplateKind,
} from '../services/printing/template';

function isKind(value: unknown): value is TemplateKind {
  return value === 'bill' || value === 'kitchen';
}

function store(kind: TemplateKind, template: ReceiptTemplate) {
  const settings = getSettings();
  const fallback = defaultTemplateFor(kind, settings.print.paperWidth);

  patchSettings({
    templates: {
      ...settings.templates,
      [kind]: sanitiseTemplate(template, fallback),
    },
  });

  return getSettings().templates;
}

/** What the designer screen needs, in one call. */
function catalogue() {
  const settings = getSettings();
  return {
    blocks: BLOCKS,
    presets: TEMPLATE_PRESETS,
    current: settings.templates,
    /** Which blocks are offered for each kind of document. */
    available: {
      bill: blocksFor('bill').map(b => b.id),
      kitchen: blocksFor('kitchen').map(b => b.id),
    },
  };
}

export function registerTemplatesIPC() {
  ipcMain.handle('templates:get', async () => {
    try {
      return { success: true, data: catalogue() };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Adopt a preset.
   *
   * The preset itself stays as shipped — what is stored is a copy, so the
   * outlet can edit it and "put it back the way it was" is always one more
   * press away.
   */
  ipcMain.handle('templates:applyPreset', async (_, payload: unknown) => {
    try {
      const { kind, presetId, name } = (payload ?? {}) as {
        kind?: unknown; presetId?: unknown; name?: unknown;
      };

      if (!isKind(kind)) { return { success: false, error: 'Unknown template kind.' }; }

      const preset = typeof presetId === 'string' ? getTemplatePreset(presetId) : undefined;
      if (!preset) { return { success: false, error: 'Unknown template.' }; }
      if (preset.kind !== kind) {
        // A kitchen preset on a bill would carry blocks a bill needs and a
        // ticket does not; `sanitiseTemplate` would strip them and leave a
        // layout nobody chose.
        return { success: false, error: 'That template is for a different document.' };
      }

      return {
        success: true,
        data: store(kind, duplicateTemplate(preset, typeof name === 'string' ? name : '')),
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('templates:setBlock', async (_, payload: unknown) => {
    try {
      const { kind, id, visible } = (payload ?? {}) as {
        kind?: unknown; id?: unknown; visible?: unknown;
      };

      if (!isKind(kind) || !isBlockId(id) || typeof visible !== 'boolean') {
        return { success: false, error: 'Unknown block.' };
      }

      const current = getSettings().templates[kind];
      // A refused change — a required block — comes back as the unchanged
      // template, and the UI redraws from what is actually stored.
      return { success: true, data: store(kind, setBlockVisible(current, id, visible)) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('templates:move', async (_, payload: unknown) => {
    try {
      const { kind, from, to } = (payload ?? {}) as {
        kind?: unknown; from?: unknown; to?: unknown;
      };

      if (!isKind(kind) || typeof from !== 'number' || typeof to !== 'number') {
        return { success: false, error: 'A position is required.' };
      }

      const current = getSettings().templates[kind];
      return { success: true, data: store(kind, moveBlock(current, from, to)) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /** Back to the preset for the configured paper width. */
  ipcMain.handle('templates:reset', async (_, payload: unknown) => {
    try {
      const kind = typeof payload === 'string'
        ? payload
        : (payload as { kind?: unknown } | null)?.kind;

      if (!isKind(kind)) { return { success: false, error: 'Unknown template kind.' }; }

      const settings = getSettings();
      return {
        success: true,
        data: store(kind, defaultTemplateFor(kind, settings.print.paperWidth)),
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
