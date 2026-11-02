import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/ipc';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/atoms';
import Button from '../../components/atoms/button/button';
import { useI18n } from '../../i18n/useI18n';
import { LOCALES, LOCALE_META, type Locale } from '../../i18n/types';

const PIN_LENGTH = 4;

const SetupPage: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const [restaurantName, setRestaurantName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const checkSetup = useAuthStore(state => state.checkSetup);
  const navigate = useNavigate();

  const handleSetup = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!restaurantName.trim() || !adminName.trim() || !adminPin) {
      showToast({ message: t('setup.fillAllFields'), variant: 'warning' });
      return;
    }
    if (adminPin.length !== PIN_LENGTH) {
      showToast({ message: t('validation.pinLength'), variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const res = await api.system.completeSetup({
        restaurantName: restaurantName.trim(),
        adminName: adminName.trim(),
        adminPin,
      });

      if (!res.success) {
        showToast({ message: res.error ?? t('setup.failed'), variant: 'error' });
        return;
      }

      // Persist the outlet name and the chosen language together: the receipt
      // header and the UI should agree from the first order onwards.
      await api.settings.save({ outlet: { name: restaurantName.trim() }, locale });

      showToast({ message: t('setup.success'), variant: 'success' });

      const codeRes = await api.system.generateRecoveryCode();
      showToast({
        message: codeRes.success ? t('setup.recoverySaved') : t('setup.recoveryNotSaved'),
        variant: codeRes.success ? 'success' : 'warning',
      });

      void checkSetup();
      navigate('/login');
    } catch (err) {
      console.error(err);
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted p-4">
      <div className="max-w-md w-full bg-surface p-8 rounded-card shadow-raised border border-line">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-body mb-2">{t('setup.welcome')}</h1>
          <p className="text-sm text-subtle">{t('setup.subtitle')}</p>
        </div>

        {/* Language first: every field below it is labelled in the language
            picked here, so choosing it last would be backwards. */}
        <div className="mb-6">
          <span className="block text-sm font-medium text-muted mb-2">
            {t('setup.chooseLanguage')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {LOCALES.map((code: Locale) => (
              <button
                key={code}
                type="button"
                lang={LOCALE_META[code].tag}
                onClick={() => { void setLocale(code); }}
                aria-pressed={code === locale}
                className={[
                  'py-2.5 rounded-control border text-sm font-medium transition-colors',
                  code === locale
                    ? 'border-brand bg-brand-subtle text-brand'
                    : 'border-line text-muted hover:bg-surface-sunken',
                ].join(' ')}
              >
                {LOCALE_META[code].nativeName}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => { void handleSetup(e); }} className="space-y-5">
          <div>
            <label htmlFor="setup-outlet" className="block text-sm font-medium text-muted mb-1">
              {t('setup.restaurantName')}
            </label>
            <Input
              id="setup-outlet"
              value={restaurantName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRestaurantName(e.target.value); }}
              placeholder={t('setup.restaurantNamePlaceholder')}
              autoFocus
              required
            />
          </div>

          <div className="pt-4 border-t border-line">
            <h2 className="text-lg font-semibold text-body mb-4">{t('setup.createAdmin')}</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="setup-admin" className="block text-sm font-medium text-muted mb-1">
                  {t('setup.adminName')}
                </label>
                <Input
                  id="setup-admin"
                  value={adminName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAdminName(e.target.value); }}
                  placeholder={t('setup.adminNamePlaceholder')}
                  required
                />
              </div>
              <div>
                <label htmlFor="setup-pin" className="block text-sm font-medium text-muted mb-1">
                  {t('setup.adminPin')}
                </label>
                <Input
                  id="setup-pin"
                  type="password"
                  inputMode="numeric"
                  value={adminPin}
                  // Stripping non-digits here rather than relying on `pattern`
                  // keeps a paste from silently failing validation later.
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setAdminPin(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder={t('setup.adminPinPlaceholder')}
                  maxLength={PIN_LENGTH}
                  required
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              disabled={loading}
            >
              {loading ? t('setup.saving') : t('setup.complete')}
            </Button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-subtle">
          <p>{t('setup.haveBackup')}</p>
          <p className="mt-1">{t('setup.haveBackupHint')}</p>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
