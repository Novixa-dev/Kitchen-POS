import React from 'react';
import { Button, Input, Select } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { LOCALES, LOCALE_META, type Locale, type NumeralSystem } from '../../../i18n/types';
import { api, type AppSettings } from '../../../lib/ipc';
import { announceSettingsChanged } from '../../../lib/useAppSettings';
import { useToast } from '../../../hooks/useToast';
import { useSyncedState } from '../../../lib/useSyncedState';

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

/** Common currencies, offered as a starting point rather than a closed list. */
const PRESETS: { code: string; symbol: string; decimals: number }[] = [
  { code: 'SAR', symbol: 'ر.س', decimals: 2 },
  { code: 'AED', symbol: 'د.إ', decimals: 2 },
  { code: 'KWD', symbol: 'د.ك', decimals: 3 },
  { code: 'QAR', symbol: 'ر.ق', decimals: 2 },
  { code: 'BHD', symbol: 'د.ب', decimals: 3 },
  { code: 'OMR', symbol: 'ر.ع', decimals: 3 },
  { code: 'EGP', symbol: 'ج.م', decimals: 2 },
  { code: 'JOD', symbol: 'د.أ', decimals: 3 },
  { code: 'INR', symbol: '₹', decimals: 2 },
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
];

export const LocalizationCard: React.FC<Props> = ({ settings, onSaved }) => {
  const { t, locale, setLocale, numerals, setNumerals, formatCurrency } = useI18n();
  const { showToast } = useToast();

  // Seeded from the saved currency and re-seeded if it changes underneath
  // (another window, or a restored backup).
  const currency = settings.currency;
  const [code, setCode] = useSyncedState(currency, c => c.code);
  const [symbol, setSymbol] = useSyncedState(currency, c => c.symbol);
  const [decimals, setDecimals] = useSyncedState(currency, c => String(c.decimals));
  const [position, setPosition] = useSyncedState(currency, c => c.position);

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setCode(preset.code);
    setSymbol(preset.symbol);
    setDecimals(String(preset.decimals));
  };

  const saveCurrency = async () => {
    const parsedDecimals = Number.parseInt(decimals, 10);
    const res = await api.settings.save({
      currency: {
        code: code.trim().toUpperCase(),
        symbol: symbol.trim(),
        // The main process clamps this too; doing it here keeps the field
        // from briefly showing a value that will not be stored.
        decimals: Number.isInteger(parsedDecimals) ? Math.min(4, Math.max(0, parsedDecimals)) : 2,
        position,
      },
    });

    if (res.success) {
      showToast({ message: t('settings.saved'), variant: 'success' });
      announceSettingsChanged();
      onSaved();
    } else {
      showToast({ message: res.error ?? t('settings.saveFailed'), variant: 'error' });
    }
  };

  return (
    <SettingsSection title={t('settings.localization')}>

      <div>
        <span className="block text-sm font-medium text-muted mb-2">{t('label.language')}</span>
        <div className="grid grid-cols-2 gap-2 max-w-sm">
          {LOCALES.map((code2: Locale) => (
            <button
              key={code2}
              type="button"
              lang={LOCALE_META[code2].tag}
              aria-pressed={locale === code2}
              onClick={() => { void setLocale(code2); }}
              className={`py-2.5 rounded-control border text-sm font-medium transition-colors ${
                locale === code2
                  ? 'border-brand bg-brand-subtle text-brand'
                  : 'border-line text-muted hover:bg-surface-sunken'
              }`}
            >
              {LOCALE_META[code2].nativeName}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-muted mb-2">{t('settings.numerals')}</span>
        <div className="grid grid-cols-2 gap-2 max-w-sm">
          {(['latn', 'arab'] as NumeralSystem[]).map(system => (
            <button
              key={system}
              type="button"
              aria-pressed={numerals === system}
              onClick={() => { void setNumerals(system); }}
              className={`py-2.5 rounded-control border text-sm font-medium transition-colors ${
                numerals === system
                  ? 'border-brand bg-brand-subtle text-brand'
                  : 'border-line text-muted hover:bg-surface-sunken'
              }`}
            >
              {t(system === 'latn' ? 'settings.numerals.latn' : 'settings.numerals.arab')}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-line space-y-4">
        <h3 className="text-sm font-semibold text-body">{t('label.currency')}</h3>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <Button
              key={preset.code}
              size="sm"
              variant={code === preset.code ? 'primary' : 'outline'}
              onClick={() => { applyPreset(preset); }}
            >
              {preset.code}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('settings.currencyCode')}
            value={code}
            maxLength={5}
            onChange={e => { setCode(e.target.value.toUpperCase()); }}
          />
          <Input
            label={t('settings.currencySymbol')}
            value={symbol}
            maxLength={8}
            onChange={e => { setSymbol(e.target.value); }}
          />
          <Input
            label={t('settings.currencyDecimals')}
            type="number"
            min="0"
            max="4"
            value={decimals}
            onChange={e => { setDecimals(e.target.value); }}
          />
          <Select
            label={t('settings.currencyPosition')}
            value={position}
            onChange={e => { setPosition(e.target.value === 'before' ? 'before' : 'after'); }}
          >
            <option value="before">{t('settings.currencyPosition.before')}</option>
            <option value="after">{t('settings.currencyPosition.after')}</option>
          </Select>
        </div>

        {/* Shows the saved formatting, so the operator can see what a receipt
            will read before committing the change. */}
        <p className="text-sm text-subtle tabular">
          {t('settings.currencyPreview', { sample: formatCurrency(1234.5) })}
        </p>

        <Button variant="primary" onClick={() => { void saveCurrency(); }}>
          {t('action.save')}
        </Button>
      </div>
    </SettingsSection>
  );
};
