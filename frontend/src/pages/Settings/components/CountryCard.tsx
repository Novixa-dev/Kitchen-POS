import React, { useEffect, useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import { api, type AppSettings, type CountryProfile } from '../../../lib/ipc';
import { refreshAppSettings, announceSettingsChanged } from '../../../lib/useAppSettings';
import type { TranslationKey } from '../../../i18n/types';

const OTHER_COUNTRY = '';

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

/**
 * Country, which fills in currency and tax.
 *
 * An outlet that set the till up before this existed, or moved, or picked
 * the wrong country in the wizard, should not have to work out their own
 * currency decimals and tax regime by hand. Applying a country writes both.
 *
 * It does not touch the language. By the time anyone is on this screen they
 * have been using the app in a language they chose, and switching it because
 * they corrected the country would be a surprise.
 */
export const CountryCard: React.FC<Props> = ({ settings, onSaved }) => {
  const { t, formatNumber } = useI18n();
  const { showToast } = useToast();

  const [countries, setCountries] = useState<CountryProfile[]>([]);
  // What is selected in the picker, which may differ from what is saved until
  // the outlet presses the button — applying on change would silently rewrite
  // a tax rate they had deliberately edited.
  const [selected, setSelected] = useState(settings.country);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void api.country.list().then((res) => {
      if (active && res.success && res.data) { setCountries(res.data.countries); }
    }).catch(() => { /* leave the picker empty; the fields below still work */ });
    return () => { active = false; };
  }, []);

  const chosen = countries.find(c => c.code === selected);
  const changed = selected !== settings.country;

  const apply = async () => {
    setSaving(true);
    try {
      const res = await api.country.apply({ code: selected });
      if (!res.success) {
        showToast({ message: res.error ?? t('toast.unexpectedError'), variant: 'error' });
        return;
      }
      await refreshAppSettings();
      announceSettingsChanged();
      onSaved();
      showToast({
        message: selected === OTHER_COUNTRY
          ? t('settings.countryNotListed')
          : t('settings.countryApplied'),
        variant: 'success',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection title={t('label.country')} description={t('settings.countryHint')}>
      <label className="block max-w-md">
        <span className="block text-sm font-medium text-muted mb-1.5">{t('label.country')}</span>
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); }}
          className="w-full rounded-control border border-line bg-surface p-2.5 text-sm text-body"
        >
          {countries.map(country => (
            <option key={country.code} value={country.code}>
              {t(country.nameKey as TranslationKey)}
            </option>
          ))}
          <option value={OTHER_COUNTRY}>{t('country.ZZ')}</option>
        </select>
      </label>

      {chosen && (
        <div className="rounded-control bg-surface-sunken p-3 space-y-1.5 text-sm max-w-md">
          <p className="text-muted">
            <span className="font-medium text-body">{t('setup.summaryCurrency')}:</span>{' '}
            {/* An ISO code and a symbol are LTR tokens even in Arabic. */}
            <span dir="ltr">{chosen.currency.code} {chosen.currency.symbol}</span>
          </p>
          <p className="text-muted">
            <span className="font-medium text-body">{t('setup.summaryTax')}:</span>{' '}
            {chosen.tax.mode === 'none'
              ? t('setup.summaryNoTax')
              : `${chosen.tax.mode.toUpperCase()} ${formatNumber(chosen.tax.rate)}% — ${
                  chosen.tax.inclusive
                    ? t('setup.summaryInclusive')
                    : t('setup.summaryExclusive')
                }`}
          </p>
          <p className="text-xs text-warning pt-1">{t('settings.countryConfirm')}</p>
        </div>
      )}

      {/* Only offered when something would change: pressing it otherwise
          would overwrite the outlet's own edits with the same defaults. */}
      {changed && (
        <Button
          variant="secondary"
          className="w-fit"
          disabled={saving}
          onClick={() => { void apply(); }}
        >
          {t('action.applyCountry')}
        </Button>
      )}
    </SettingsSection>
  );
};
