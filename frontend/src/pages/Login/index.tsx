import { Button, Input } from '../../components/atoms';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/ipc';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/useI18n';
import LocaleSwitcher from '../../components/organisms/navigation/LocaleSwitcher';

const PIN_LENGTH = 4;

const LoginPage: React.FC = () => {
  const { t, formatNumber } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'verify' | 'reset'>('verify');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const res = await api.backup.export({});
      if (res.success) {
        showToast({ message: t('settings.exportSuccess', { path: res.data ?? '' }), variant: 'success' });
      } else {
        showToast({ message: res.error ?? t('settings.exportFailed'), variant: 'error' });
      }
    } catch {
      showToast({ message: t('settings.exportFailed'), variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    setIsImporting(true);
    try {
      const res = await api.backup.import({});
      if (res.success) {
        showToast({ message: t('settings.importSuccess'), variant: 'success' });
      } else if (res.error && res.error !== 'Import cancelled') {
        showToast({ message: res.error, variant: 'error' });
      }
    } catch {
      showToast({ message: t('settings.importFailed'), variant: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDigit = useCallback((digit: string) => {
    setPin((prev) => (prev.length >= PIN_LENGTH ? prev : prev + digit));
    setError(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    const success = await login(pin);
    if (success) {
      navigate('/tables');
    } else {
      setError(true);
      setPin('');
    }
  }, [login, navigate, pin]);

  const handleVerifyRecoveryCode = async () => {
    const res = await api.system.verifyRecoveryCode({ code: recoveryCode });
    if (res.success) {
      setRecoveryStep('reset');
      setError(false);
    } else {
      setError(true);
      showToast({ message: t('auth.invalidRecoveryCode'), variant: 'error' });
    }
  };

  const handleResetAdminPin = async () => {
    if (newAdminPin.length !== PIN_LENGTH) {
      showToast({ message: t('auth.pinMustBe4Digits'), variant: 'warning' });
      return;
    }
    const res = await api.system.resetAdminPin({ code: recoveryCode, newPin: newAdminPin });
    if (res.success) {
      showToast({ message: t('auth.pinResetSuccess'), variant: 'success' });
      setIsRecovering(false);
      setRecoveryStep('verify');
      setRecoveryCode('');
      setNewAdminPin('');
    } else {
      showToast({ message: res.error ?? t('auth.pinResetFailed'), variant: 'error' });
    }
  };

  // Physical keypads and numeric keyboards are the norm on POS hardware, so
  // the on-screen pad mirrors real key presses rather than replacing them.
  useEffect(() => {
    if (isRecovering) { return; }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter' && pin.length > 0) {
        void handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [pin, handleDigit, handleBackspace, handleSubmit, isRecovering]);

  const keypadButton =
    'w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 border border-white/10 text-white ' +
    'text-3xl font-light hover:bg-white/20 hover:scale-105 active:scale-95 active:bg-white/30 ' +
    'transition-all duration-200 shadow-sm flex items-center justify-center';

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">

      {/* Language is reachable before sign-in: a user who cannot read the
          screen cannot get past it. */}
      <div className="absolute top-4 end-4">
        <LocaleSwitcher />
      </div>

      <div
        className={[
          'w-80 sm:w-96 p-8 flex flex-col items-center rounded-3xl',
          'bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl animate-fade-in',
          error && !isRecovering ? 'animate-shake' : '',
        ].join(' ')}
      >
        {isRecovering ? (
          <div className="w-full flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-4 text-white">{t('auth.recoverPin')}</h2>

            {recoveryStep === 'verify' ? (
              <>
                <p className="text-sm text-white/80 mb-6 text-center">{t('auth.recoveryCodeHint')}</p>
                <Input
                  placeholder={t('auth.recoveryCode')}
                  value={recoveryCode}
                  onChange={(e) => { setRecoveryCode(e.target.value.toUpperCase()); }}
                  className="mb-6 text-center tracking-widest uppercase font-mono bg-white/20 border-white/30 text-white placeholder:text-white/50"
                  maxLength={6}
                  autoFocus
                />
                <Button
                  variant="primary"
                  className="w-full mb-3 justify-center"
                  onClick={() => { void handleVerifyRecoveryCode(); }}
                >
                  {t('auth.verifyCode')}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-center text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => { setIsRecovering(false); }}
                >
                  {t('action.cancel')}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-white/80 mb-6 text-center">{t('auth.newAdminPinHint')}</p>
                <Input
                  placeholder={t('auth.newAdminPin')}
                  type="password"
                  inputMode="numeric"
                  value={newAdminPin}
                  onChange={(e) => { setNewAdminPin(e.target.value.replace(/\D/g, '')); }}
                  className="mb-6 text-center tracking-widest text-lg bg-white/20 border-white/30 text-white placeholder:text-white/50"
                  maxLength={PIN_LENGTH}
                  autoFocus
                />
                <Button
                  variant="primary"
                  className="w-full mb-3 justify-center"
                  onClick={() => { void handleResetAdminPin(); }}
                >
                  {t('auth.resetPin')}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-center text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => { setIsRecovering(false); setRecoveryStep('verify'); }}
                >
                  {t('action.cancel')}
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-2 text-white">{t('app.name')}</h2>
            <p className="text-sm text-white/70 mb-6">{t('auth.enterPin')}</p>

            {/* PIN progress dots. `dir="ltr"` keeps them filling left-to-right
                in both languages, matching the order digits are entered. */}
            <div dir="ltr" className="flex justify-center gap-3 mb-8">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={[
                    'w-4 h-4 rounded-full transition-all duration-300',
                    i < pin.length
                      ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] scale-110'
                      : 'bg-white/20',
                  ].join(' ')}
                />
              ))}
            </div>

            {/* The keypad keeps its 1-2-3 reading order in both directions:
                a numeric pad is a physical convention, not running text. */}
            <div dir="ltr" className="grid grid-cols-3 gap-4 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <Button
                  key={digit}
                  variant="ghost"
                  onClick={() => { handleDigit(String(digit)); }}
                  className={keypadButton}
                >
                  {formatNumber(digit)}
                </Button>
              ))}
              <Button
                variant="ghost"
                onClick={handleBackspace}
                aria-label={t('action.clear')}
                className={keypadButton}
              >
                ⌫
              </Button>
              <Button
                variant="ghost"
                onClick={() => { handleDigit('0'); }}
                className={keypadButton}
              >
                {formatNumber(0)}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { void handleSubmit(); }}
                aria-label={t('action.confirm')}
                className={`${keypadButton} bg-cyan-500/80 border-cyan-400/50 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]`}
              >
                ✓
              </Button>
            </div>

            {error && (
              <p
                role="alert"
                className="text-red-200 font-medium mt-2 text-sm bg-red-900/40 px-4 py-1 rounded-full backdrop-blur-sm border border-red-500/30"
              >
                {t('auth.incorrectPin')}
              </p>
            )}

            <div className="mt-8 pt-6 border-t border-white/10 w-full flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => { setIsRecovering(true); }}
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                {t('auth.forgotPin')}
              </button>

              {/* Backup restore is reachable from the lock screen on purpose:
                  after a reinstall there is no PIN to sign in with yet. */}
              <div className="flex gap-4 mt-2">
                <button
                  type="button"
                  disabled={isExporting || isImporting}
                  onClick={() => { void handleExportBackup(); }}
                  className="text-xs text-white/40 hover:text-white transition-colors disabled:opacity-50"
                >
                  {isExporting ? t('settings.exporting') : t('settings.exportBackup')}
                </button>
                <button
                  type="button"
                  disabled={isExporting || isImporting}
                  onClick={() => { void handleImportBackup(); }}
                  className="text-xs text-white/40 hover:text-white transition-colors disabled:opacity-50"
                >
                  {isImporting ? t('settings.importing') : t('settings.importBackup')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
