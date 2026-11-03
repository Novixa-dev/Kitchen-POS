/**
 * Branding IPC: presets, live preview, and the outlet's logo.
 *
 * The colour maths stays in the main process and only the *derived* palette
 * crosses the bridge, so there is one implementation of the contrast rules
 * rather than one here and a drifting copy in the renderer. The renderer's
 * job is to paint the CSS variables it is handed.
 *
 * `preview` exists because a colour input fires continuously while the user
 * drags: the renderer can ask what a colour would look like without writing
 * it to the store, so an abandoned drag leaves no trace.
 */

import { dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { errMsg } from '../lib/errors';
import {
  THEME_PRESETS,
  applyPreset,
  editBranding,
  resolveBranding,
  type BrandingSettings,
  type Density,
  type FontChoice,
  type ResolvedBranding,
} from '../lib/branding';
import { IMAGE_EXTENSIONS, checkLogo, extensionFor } from '../lib/image';
import { imagesDirectory } from '../lib/security';
import { getSettings, patchSettings } from '../lib/settings';

/** Enough bytes for every signature `sniffImageType` checks. */
const SNIFF_BYTES = 16;

function current(): ResolvedBranding {
  return resolveBranding(getSettings().branding);
}

function save(next: BrandingSettings): ResolvedBranding {
  patchSettings({ branding: next });
  return current();
}

/**
 * Copy an approved image into the app's own image directory.
 *
 * The file is copied rather than referenced: an outlet picking a logo off a
 * USB stick or a network share would otherwise get a broken logo on every
 * receipt the moment it is unplugged. The name carries a timestamp so the
 * renderer's `local://` request is not served a cached previous logo.
 */
function storeLogo(sourcePath: string, extension: string): string {
  const directory = imagesDirectory();
  fs.mkdirSync(directory, { recursive: true });

  const destination = path.join(directory, `logo-${Date.now()}.${extension}`);
  fs.copyFileSync(sourcePath, destination);
  return destination;
}

/** Remove a previously stored logo, ignoring one that is already gone. */
function removeStoredLogo(logoPath: string): void {
  if (logoPath === '') { return; }

  const raw = logoPath.startsWith('local://') ? logoPath.slice('local://'.length) : logoPath;
  const resolved = path.resolve(decodeURIComponent(raw));

  // Only ever delete inside our own directory: the stored path came from the
  // settings store, which is schemaless and could hold anything.
  if (path.dirname(resolved) !== path.resolve(imagesDirectory())) { return; }

  try {
    fs.unlinkSync(resolved);
  } catch {
    // Already removed, or held open by a print preview. Not worth failing the
    // upload the user is in the middle of.
  }
}

export function registerBrandingIPC() {
  /**
   * The catalogue, each preset with its palette already derived, plus what
   * is currently applied. One call is all the Appearance screen needs to
   * paint every swatch.
   */
  ipcMain.handle('branding:list', async () => {
    try {
      return {
        success: true,
        data: {
          presets: THEME_PRESETS.map(preset => ({
            ...preset,
            palette: resolveBranding(preset).palette,
          })),
          current: current(),
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /** What a choice would look like, without storing it. */
  ipcMain.handle('branding:preview', async (_, payload: unknown) => {
    try {
      const patch = (payload ?? {}) as Partial<BrandingSettings>;
      return { success: true, data: resolveBranding({ ...getSettings().branding, ...patch }) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('branding:applyPreset', async (_, payload: unknown) => {
    try {
      // The renderer sends the id as a bare string; anything else is not a
      // preset we know, and `applyPreset` treats that as a no-op.
      const id = typeof payload === 'string' ? payload : '';
      return { success: true, data: save(applyPreset(getSettings().branding, id)) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Change one field by hand. The selection becomes `custom` unless the
   * result happens to match a preset again — see `editBranding`.
   */
  ipcMain.handle('branding:set', async (_, payload: unknown) => {
    try {
      const patch = (payload ?? {}) as {
        accent?: string;
        font?: FontChoice;
        density?: Density;
      };
      return { success: true, data: save(editBranding(getSettings().branding, patch)) };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  /**
   * Choose a logo from the local machine.
   *
   * Validation is by content, not by extension: a `.png` that is really a
   * PDF would otherwise reach the receipt template and print nothing.
   */
  ipcMain.handle('branding:pickLogo', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Outlet Logo',
        properties: ['openFile'],
        filters: [{ name: 'Image', extensions: [...IMAGE_EXTENSIONS] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: { cancelled: true, branding: current() } };
      }

      const sourcePath = result.filePaths[0];
      const stat = fs.statSync(sourcePath);

      // Read only the signature: the size comes from the file itself, so the
      // cap applies to the real file and not to this prefix.
      const handle = fs.openSync(sourcePath, 'r');
      const head = Buffer.alloc(SNIFF_BYTES);
      let read = 0;
      try {
        read = fs.readSync(handle, head, 0, SNIFF_BYTES, 0);
      } finally {
        fs.closeSync(handle);
      }

      const check = checkLogo(head.subarray(0, read), stat.size);
      if (!check.ok) {
        // A reason code, not a sentence: the renderer owns the wording in
        // both languages.
        return { success: false, error: check.reason };
      }

      const previous = getSettings().outlet.logoPath;
      const stored = storeLogo(sourcePath, extensionFor(check.type));
      patchSettings({ outlet: { logoPath: `local://${stored.split(path.sep).join('/')}` } });

      // Only after the new one is safely in place.
      removeStoredLogo(previous);

      return {
        success: true,
        data: { cancelled: false, logoPath: getSettings().outlet.logoPath },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });

  ipcMain.handle('branding:clearLogo', async () => {
    try {
      const previous = getSettings().outlet.logoPath;
      patchSettings({ outlet: { logoPath: '' } });
      removeStoredLogo(previous);
      return { success: true, data: { logoPath: '' } };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
