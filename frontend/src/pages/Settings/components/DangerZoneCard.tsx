import React, { useState } from 'react';
import { Button, Input } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { api } from '../../../lib/ipc';
import { useModal } from '../../../hooks/useModal';
import { useToast } from '../../../hooks/useToast';

/** The word the operator must type to confirm. Deliberately not translated:
 *  it is a literal safety phrase, and a translated one could be ambiguous. */
const CONFIRM_WORD = 'reset';

const ConfirmReset: React.FC<{ onChange: (value: string) => void }> = ({ onChange }) => {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('settings.factoryResetWarning')}</p>
      <p className="text-sm text-muted">{t('settings.factoryResetHint')}</p>
      <p className="text-sm text-body font-bold">{t('settings.factoryResetPrompt')}</p>
      <Input
        value={value}
        placeholder={t('settings.factoryResetPlaceholder')}
        onChange={(e) => { setValue(e.target.value); onChange(e.target.value); }}
        autoFocus
      />
    </div>
  );
};

export const DangerZoneCard: React.FC = () => {
  const { t } = useI18n();
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();

  const openResetDialog = () => {
    // Captured by reference from the controlled input below, so the confirm
    // button reads whatever is in the field at the moment it is pressed.
    let typed = '';

    showModal({
      title: t('settings.factoryReset'),
      content: <ConfirmReset onChange={(value) => { typed = value; }} />,
      actions: (
        <>
          <Button variant="secondary" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              if (typed.trim().toLowerCase() !== CONFIRM_WORD) {
                showToast({ message: t('settings.factoryResetCancelled'), variant: 'warning' });
                return;
              }
              api.system.factoryReset().catch(console.error);
            }}
          >
            {t('settings.factoryResetConfirm')}
          </Button>
        </>
      ),
    });
  };

  return (
    <SettingsSection title={t('settings.dangerZone')} tone="danger">
      <p className="text-sm text-muted">{t('settings.factoryResetWarning')}</p>
      <Button variant="danger" className="w-fit" onClick={openResetDialog}>
        {t('settings.factoryReset')}
      </Button>
    </SettingsSection>
  );
};
