import React, { useState } from 'react';
import { Button, Input, Select, Toggle } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { api, type AppSettings, type TaxMode } from '../../../lib/ipc';
import { announceSettingsChanged } from '../../../lib/useAppSettings';
import { useToast } from '../../../hooks/useToast';
import { useSyncedState } from '../../../lib/useSyncedState';

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

export const TaxCard: React.FC<Props> = ({ settings, onSaved }) => {
  const { t, formatPercent } = useI18n();
  const { showToast } = useToast();

  const tax = settings.tax;
  const [mode, setMode] = useSyncedState(tax, x => x.mode);
  const [rate, setRate] = useSyncedState(tax, x => String(x.rate));
  const [inclusive, setInclusive] = useSyncedState(tax, x => x.inclusive);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const parsedRate = Number.parseFloat(rate);
    if (mode === 'vat' && (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100)) {
      showToast({ message: t('validation.invalidNumber'), variant: 'warning' });
      return;
    }

    setSaving(true);
    const res = await api.settings.save({
      tax: {
        mode,
        rate: Number.isFinite(parsedRate) ? parsedRate : 0,
        inclusive,
      },
    });
    setSaving(false);

    if (res.success) {
      showToast({ message: t('settings.saved'), variant: 'success' });
      announceSettingsChanged();
      onSaved();
    } else {
      showToast({ message: res.error ?? t('settings.saveFailed'), variant: 'error' });
    }
  };

  return (
    <SettingsSection title={t('settings.taxes')}>
      <div>
        <Select
          label={t('tax.mode')}
          value={mode}
          onChange={e => { setMode(e.target.value as TaxMode); }}
        >
          <option value="vat">{t('tax.vat')}</option>
          <option value="gst">{t('tax.gst')}</option>
          <option value="none">{t('tax.none')}</option>
        </Select>
        <p className="text-xs text-subtle mt-1">{t('settings.taxModeHint')}</p>
      </div>

      {/* The rate is a bill-level setting only under VAT; GST reads each
          item's own CGST/SGST rates. */}
      {mode === 'vat' && (
        <Input
          label={`${t('tax.rate')} (%)`}
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={rate}
          onChange={e => { setRate(e.target.value); }}
        />
      )}

      {mode !== 'none' && (
        <Toggle
          checked={inclusive}
          onChange={e => { setInclusive(e.target.checked); }}
          label={t('tax.inclusive')}
          description={t('tax.inclusiveHint')}
        />
      )}

      {mode === 'vat' && Number.isFinite(Number.parseFloat(rate)) && (
        <p className="text-sm text-subtle">
          {t('tax.vat')} {formatPercent(Number.parseFloat(rate))}
        </p>
      )}

      <Button variant="primary" onClick={() => { void handleSave(); }} isLoading={saving}>
        {t('action.save')}
      </Button>
    </SettingsSection>
  );
};
