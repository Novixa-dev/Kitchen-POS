import { createContext } from 'react';
import type { Density, FontChoice, ResolvedBranding, ThemePresetDTO } from './branding';

/**
 * Branding contract, kept out of the provider module so the provider file
 * exports only a component (`react-refresh/only-export-components`).
 */
export interface BrandingContextValue {
  /** What is applied right now. */
  branding: ResolvedBranding;
  /** The bundled presets, each with its palette already derived. */
  presets: readonly ThemePresetDTO[];
  /** True until the main process has answered once. */
  loading: boolean;
  applyPreset: (id: string) => Promise<void>;
  setBranding: (patch: {
    accent?: string;
    font?: FontChoice;
    density?: Density;
  }) => Promise<void>;
  /**
   * Show a colour without storing it, for a picker the user is still
   * dragging. Passing `null` drops the preview and restores what is saved.
   */
  preview: (accent: string | null) => void;
  /** The unsaved colour currently being previewed, if any. */
  previewing: string | null;
}

export const BrandingContext = createContext<BrandingContextValue | null>(null);
