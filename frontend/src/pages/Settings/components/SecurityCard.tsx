import React, { useState } from 'react';
import { Button, Input } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { api } from '../../../lib/ipc';
import { useToast } from '../../../hooks/useToast';

interface Props {
  staffId: number;
}

const PIN_LENGTH = 4;

export const SecurityCard: React.FC<Props> = ({ staffId }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [changing, setChanging] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleChangePin = async () => {
    if (newPin.length !== PIN_LENGTH) {
      showToast({ message: t('validation.pinLength'), variant: 'warning' });
      return;
    }

    setChanging(true);
    try {
      const res = await api.staff.changePin({ id: staffId, currentPin, newPin });
      if (res.success) {
        showToast({ message: t('auth.pinChanged'), variant: 'success' });
        setCurrentPin('');
        setNewPin('');
      } else {
        showToast({ message: res.error ?? t('toast.failed'), variant: 'error' });
      }
    } finally {
      setChanging(false);
    }
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await api.system.generateRecoveryCode();
      if (res.success) {
        showToast({ message: t('settings.recoveryCodeSaved'), variant: 'success' });
      } else if (res.error !== 'Cancelled') {
        showToast({ message: res.error ?? t('settings.recoveryCodeFailed'), variant: 'error' });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SettingsSection title={t('settings.security')}>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-body">{t('settings.changeMyPin')}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <Input
            label={t('auth.currentPin')}
            type="password"
            inputMode="numeric"
            value={currentPin}
            maxLength={PIN_LENGTH}
            // Strip non-digits on entry so a mistyped character cannot make
            // the PIN silently fail to match.
            onChange={e => { setCurrentPin(e.target.value.replace(/\D/g, '')); }}
          />
          <Input
            label={t('auth.newPin')}
            type="password"
            inputMode="numeric"
            value={newPin}
            maxLength={PIN_LENGTH}
            onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); }}
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          disabled={!currentPin || newPin.length !== PIN_LENGTH || changing}
          onClick={() => { void handleChangePin(); }}
        >
          {t('settings.updatePin')}
        </Button>
      </div>

      <div className="space-y-3 pt-4 border-t border-line">
        <h3 className="text-sm font-semibold text-body">{t('settings.pinRecovery')}</h3>
        <p className="text-xs text-subtle max-w-lg">{t('settings.pinRecoveryHint')}</p>
        <Button
          variant="outline"
          size="sm"
          disabled={generating}
          onClick={() => { void handleGenerateCode(); }}
        >
          {t('settings.generateNewCode')}
        </Button>
      </div>
    </SettingsSection>
  );
};
