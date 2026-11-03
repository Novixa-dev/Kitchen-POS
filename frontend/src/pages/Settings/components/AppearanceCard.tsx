import React, { useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import { useTheme } from '../../../theme/useTheme';
import { useBranding } from '../../../theme/useBranding';
import { CUSTOM_PRESET, type Density, type FontChoice } from '../../../theme/branding';
import { useToast } from '../../../hooks/useToast';
import { api } from '../../../lib/ipc';
import { refreshAppSettings, announceSettingsChanged } from '../../../lib/useAppSettings';
import type { ThemePreference } from '../../../theme/context';
import type { TranslationKey } from '../../../i18n/types';

const THEMES: { value: ThemePreference; labelKey: TranslationKey }[] = [
  { value: 'light', labelKey: 'settings.theme.light' },
  { value: 'dark', labelKey: 'settings.theme.dark' },
  { value: 'system', labelKey: 'settings.theme.system' },
];

const FONTS: { value: FontChoice; labelKey: TranslationKey }[] = [
  { value: 'system', labelKey: 'font.system' },
  { value: 'naskh', labelKey: 'font.naskh' },
  { value: 'kufi', labelKey: 'font.kufi' },
];

const DENSITIES: { value: Density; labelKey: TranslationKey }[] = [
  { value: 'comfortable', labelKey: 'density.comfortable' },
  { value: 'compact', labelKey: 'density.compact' },
];

/** Reason codes the main process returns when it refuses a logo. */
const LOGO_ERRORS: Record<string, TranslationKey> = {
  'too-large': 'settings.logoTooLarge',
  'not-an-image': 'settings.logoNotAnImage',
  empty: 'settings.logoEmpty',
};

const selected = 'border-brand bg-brand-subtle text-brand';
const unselected = 'border-line text-muted hover:bg-surface-sunken';

/** A row of mutually exclusive choices. */
function ChoiceRow<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  hint?: string;
  options: { value: T; labelKey: TranslationKey }[];
  value: T;
  onChange: (next: T) => void;
  columns: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <span className="block text-sm font-medium text-muted mb-2">{label}</span>
      <div className={`grid ${columns} gap-2 max-w-md`} role="group" aria-label={label}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => { onChange(option.value); }}
            className={`py-2.5 rounded-control border text-sm font-medium transition-colors ${
              value === option.value ? selected : unselected
            }`}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
      {hint !== undefined && <p className="text-xs text-subtle mt-2">{hint}</p>}
    </div>
  );
}

/**
 * Theme, branding and the outlet's logo.
 *
 * The accent is picked here and derived in the main process, so the contrast
 * figures shown are the same numbers an accessibility audit would report —
 * not an approximation computed twice.
 */
export const AppearanceCard: React.FC = () => {
  const { t, formatNumber } = useI18n();
  const { preference, setPreference } = useTheme();
  const { branding, presets, applyPreset, setBranding, preview, previewing } = useBranding();
  const { showToast } = useToast();

  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The logo lives in outlet settings rather than in branding, because the
  // receipt renderer needs it too. Read it once, then track it locally.
  React.useEffect(() => {
    let cancelled = false;
    void api.settings.get().then((res) => {
      if (cancelled || !res.success || !res.data) { return; }
      setLogoPath(res.data.outlet.logoPath);
    }).catch(() => { /* leave the control in its loading state */ });
    return () => { cancelled = true; };
  }, []);

  const palette = branding.palette.light;
  // While a colour is being dragged the swatch shows the raw value straight
  // away; the derived palette catches up a frame later.
  const swatch = previewing ?? palette.accent;

  const pickLogo = async () => {
    setBusy(true);
    try {
      const res = await api.branding.pickLogo();
      if (!res.success) {
        const key = LOGO_ERRORS[res.error ?? ''] ?? 'settings.logoFailed';
        showToast({ message: t(key), variant: 'error' });
        return;
      }
      if (res.data?.cancelled === true) { return; }

      setLogoPath(res.data?.logoPath ?? '');
      await refreshAppSettings();
      announceSettingsChanged();
      showToast({ message: t('settings.logoUpdated'), variant: 'success' });
    } finally {
      setBusy(false);
    }
  };

  const removeLogo = async () => {
    setBusy(true);
    try {
      const res = await api.branding.clearLogo();
      if (res.success) {
        setLogoPath('');
        await refreshAppSettings();
        announceSettingsChanged();
        showToast({ message: t('settings.logoRemoved'), variant: 'success' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title={t('settings.appearance')}>
      <ChoiceRow
        label={t('label.theme')}
        options={THEMES}
        value={preference}
        onChange={(next) => { void setPreference(next); }}
        columns="grid-cols-3"
      />

      {/* ── Presets ───────────────────────────────────────────────────── */}
      <div>
        <span className="block text-sm font-medium text-muted mb-2">{t('settings.presets')}</span>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md"
          role="group"
          aria-label={t('settings.presets')}
        >
          {presets.map(preset => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={branding.preset === preset.id}
              onClick={() => { void applyPreset(preset.id); }}
              className={`flex items-center gap-2 p-2 rounded-control border text-sm font-medium transition-colors ${
                branding.preset === preset.id ? selected : unselected
              }`}
            >
              <span
                className="h-5 w-5 rounded-full border border-line shrink-0"
                style={{ backgroundColor: preset.accent }}
                aria-hidden="true"
              />
              <span className="truncate text-start">
                {t(preset.nameKey as TranslationKey)}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-subtle mt-2">{t('settings.presetsHint')}</p>
      </div>

      {/* ── Accent ────────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="accent-colour"
          className="block text-sm font-medium text-muted mb-2"
        >
          {t('label.accent')}
          {branding.preset === CUSTOM_PRESET && (
            <span className="ms-2 text-xs font-normal text-subtle">
              ({t('settings.customLook')})
            </span>
          )}
        </label>

        <div className="flex items-center gap-3">
          <input
            id="accent-colour"
            type="color"
            value={swatch}
            // Fires on every frame of a drag: preview without storing, so an
            // abandoned drag leaves nothing behind.
            onChange={(e) => { preview(e.target.value); }}
            // Committed on release, which is what gets saved.
            onBlur={(e) => { void setBranding({ accent: e.target.value }); }}
            className="h-10 w-16 rounded-control border border-line bg-surface p-1 cursor-pointer"
          />
          {/* The hex is an LTR token even in Arabic. */}
          <code className="text-sm text-muted tabular" dir="ltr">{swatch}</code>
          {previewing !== null && (
            <Button
              variant="secondary"
              onClick={() => { void setBranding({ accent: previewing }); }}
            >
              {t('action.apply')}
            </Button>
          )}
        </div>

        {/* Two independent contrast questions, each warned about separately:
            a pale accent can carry perfectly readable dark text and still be
            invisible as a button on a white page. */}
        {!palette.meetsUIContrast && (
          <p className="text-xs text-warning mt-2">
            {t('settings.accentFaint', {
              ratio: formatNumber(palette.surfaceContrast, { maximumFractionDigits: 1 }),
            })}
          </p>
        )}
        {!palette.meetsAA && (
          <p className="text-xs text-warning mt-2">
            {t('settings.accentLabelHard', {
              ratio: formatNumber(palette.contrast, { maximumFractionDigits: 1 }),
            })}
          </p>
        )}
        {palette.meetsUIContrast && palette.meetsAA && (
          <p className="text-xs text-subtle mt-2">
            {t('settings.accentOk', {
              ratio: formatNumber(palette.contrast, { maximumFractionDigits: 1 }),
            })}
          </p>
        )}
      </div>

      <ChoiceRow
        label={t('label.font')}
        hint={t('settings.fontHint')}
        options={FONTS}
        value={branding.font}
        onChange={(next) => { void setBranding({ font: next }); }}
        columns="grid-cols-3"
      />

      <ChoiceRow
        label={t('label.density')}
        hint={t('settings.densityHint')}
        options={DENSITIES}
        value={branding.density}
        onChange={(next) => { void setBranding({ density: next }); }}
        columns="grid-cols-2"
      />

      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div>
        <span className="block text-sm font-medium text-muted mb-2">{t('settings.logo')}</span>
        <div className="flex items-center gap-3 flex-wrap">
          {logoPath !== null && logoPath !== '' ? (
            <img
              src={logoPath}
              alt={t('settings.logo')}
              className="h-12 max-w-32 object-contain rounded-control border border-line bg-surface p-1"
            />
          ) : (
            <span className="text-sm text-subtle">{t('settings.logoNone')}</span>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => { void pickLogo(); }}>
            {t('action.chooseLogo')}
          </Button>
          {logoPath !== null && logoPath !== '' && (
            <Button variant="secondary" disabled={busy} onClick={() => { void removeLogo(); }}>
              {t('action.removeLogo')}
            </Button>
          )}
        </div>
        <p className="text-xs text-subtle mt-2">{t('settings.logoHint')}</p>
      </div>
    </SettingsSection>
  );
};
