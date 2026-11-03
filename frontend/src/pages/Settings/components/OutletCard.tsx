import React, { useState } from 'react';
import { Button, Input } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { api, type AppSettings } from '../../../lib/ipc';
import { announceSettingsChanged } from '../../../lib/useAppSettings';
import { useToast } from '../../../hooks/useToast';
import { useSyncedState } from '../../../lib/useSyncedState';

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

/**
 * Outlet identity, as printed at the top of every receipt.
 *
 * The previous version rendered these as bare `<Input label="…" />` with no
 * `value` and no `onChange` — typing in them did nothing at all, and nothing
 * was ever saved.
 */
export const OutletCard: React.FC<Props> = ({ settings, onSaved }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  const outlet = settings.outlet;
  const [name, setName] = useSyncedState(outlet, o => o.name);
  const [address, setAddress] = useSyncedState(outlet, o => o.address);
  const [phone, setPhone] = useSyncedState(outlet, o => o.phone);
  const [taxNumber, setTaxNumber] = useSyncedState(outlet, o => o.taxNumber);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await api.settings.save({
      outlet: {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        taxNumber: taxNumber.trim(),
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
    <SettingsSection title={t('settings.outlet')}>
      <Input
        label={t('settings.outletName')}
        value={name}
        onChange={e => { setName(e.target.value); }}
        placeholder={t('settings.outletNamePlaceholder')}
      />
      <Input
        label={t('settings.outletAddress')}
        value={address}
        onChange={e => { setAddress(e.target.value); }}
        placeholder={t('settings.addressPlaceholder')}
      />
      <Input
        label={t('settings.outletPhone')}
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={e => { setPhone(e.target.value); }}
        placeholder={t('settings.phonePlaceholder')}
      />
      <div>
        <Input
          label={t('tax.registrationNumber')}
          value={taxNumber}
          onChange={e => { setTaxNumber(e.target.value); }}
          placeholder={t('settings.taxNumberPlaceholder')}
        />
        <p className="text-xs text-subtle mt-1">{t('settings.taxNumberHint')}</p>
      </div>

      <Button variant="primary" onClick={() => { void handleSave(); }} isLoading={saving}>
        {t('action.save')}
      </Button>
    </SettingsSection>
  );
};
