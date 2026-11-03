import React, { useState } from 'react';
import { useAuthStore } from '../../../store/auth';
import Button from '../../atoms/button/button';
import Input from '../../atoms/input/input';
import { useI18n } from '../../../i18n/useI18n';
import LocaleSwitcher from '../navigation/LocaleSwitcher';

/**
 * Blocks the app until a shift is open.
 *
 * Rendered in place of the routed page, not as a dialog, because no order may
 * be taken before the drawer float is recorded.
 */
export default function OpenShiftModal() {
  const { t, currency } = useI18n();

  const [openingCash, setOpeningCash] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openShift = useAuthStore(state => state.openShift);
  const logout = useAuthStore(state => state.logout);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (openingCash === '' || openingCash < 0) {
      setError(t('shift.enterValidFloat'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    openShift(openingCash)
      .then(success => {
        if (!success) {
          setError(t('shift.openFailed'));
          setIsSubmitting(false);
        }
        // On success the store flips `activeShift` and this screen unmounts,
        // so there is nothing to reset.
      })
      .catch(() => {
        setError(t('shift.openFailed'));
        setIsSubmitting(false);
      });
  };

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col items-center justify-center p-4 relative">

      {/* Reachable before any screen the operator can read: this is the first
          thing shown after sign-in. */}
      <div className="absolute top-4 end-4">
        <LocaleSwitcher />
      </div>

      <div className="bg-surface-raised rounded-card shadow-overlay w-full max-w-md overflow-hidden animate-fade-in border border-line">
        <div className="bg-brand px-6 py-5 text-on-brand text-center">
          <h2 className="text-2xl font-bold">{t('shift.openRegister')}</h2>
          <p className="text-sm mt-1 opacity-90">{t('shift.openRegisterHint')}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div role="alert" className="bg-danger-subtle border border-danger/20 text-danger p-3 rounded-control text-sm">
              {error}
            </div>
          )}

          <Input
            label={`${t('shift.openingFloat')} (${currency.symbol || currency.code})`}
            type="number"
            min="0"
            step="0.01"
            required
            autoFocus
            value={openingCash}
            onChange={e => { setOpeningCash(e.target.value === '' ? '' : Number(e.target.value)); }}
            placeholder={t('shift.openingFloatPlaceholder')}
            className="text-xl font-bold text-center tabular"
          />

          <div className="pt-2 flex flex-col gap-3">
            <Button type="submit" variant="primary" block size="lg" isLoading={isSubmitting}>
              {t('shift.startShift')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              block
              onClick={logout}
              className="text-subtle hover:text-body"
            >
              {t('shift.cancelAndLogout')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
