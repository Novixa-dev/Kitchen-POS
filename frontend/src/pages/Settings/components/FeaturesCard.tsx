import React from 'react';
import { Toggle } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { api, type AppSettings } from '../../../lib/ipc';
import { announceSettingsChanged } from '../../../lib/useAppSettings';
import { useToast } from '../../../hooks/useToast';

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

export const FeaturesCard: React.FC<Props> = ({ settings, onSaved }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  /**
   * Toggles save immediately — there is no Save button here, so a flipped
   * switch that did not persist would be invisible until the next restart.
   *
   * The previous version passed the *entire* settings object back on every
   * toggle, which round-tripped derived aliases and could overwrite a value
   * another window had just changed. Only the changed field is sent now.
   */
  const toggle = async (patch: Partial<Pick<AppSettings, 'kdsEnabled' | 'inventoryAutoDebit'>>) => {
    const res = await api.settings.save(patch);
    if (res.success) {
      showToast({ message: t('settings.saved'), variant: 'success' });
      announceSettingsChanged();
      onSaved();
    } else {
      showToast({ message: res.error ?? t('settings.saveFailed'), variant: 'error' });
    }
  };

  return (
    <SettingsSection title={t('settings.features')}>
      <Toggle
        checked={settings.kdsEnabled}
        onChange={e => { void toggle({ kdsEnabled: e.target.checked }); }}
        label={t('settings.kdsEnabled')}
        description={t('settings.kdsHint')}
      />

      <Toggle
        checked={settings.inventoryAutoDebit}
        onChange={e => { void toggle({ inventoryAutoDebit: e.target.checked }); }}
        label={t('settings.autoDebitTitle')}
        description={t('inventory.autoDebitHint')}
      />
    </SettingsSection>
  );
};
