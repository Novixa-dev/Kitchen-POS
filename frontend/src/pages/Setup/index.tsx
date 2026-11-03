import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { api, type CountryProfile } from '../../lib/ipc';
import { useToast } from '../../hooks/useToast';
import { Input } from '../../components/atoms';
import Button from '../../components/atoms/button/button';
import { useI18n } from '../../i18n/useI18n';
import { LOCALES, LOCALE_META, type Locale, type TranslationKey } from '../../i18n/types';
import {
  EMPTY_DRAFT,
  FILLABLE_STEPS,
  PIN_LENGTH,
  STEP_TITLES,
  canLeave,
  clearDraft,
  firstIncompleteStep,
  isWorthResuming,
  nextStep,
  previousStep,
  problemsWith,
  readDraft,
  saveDraft,
  stepIndex,
  type SetupDraft,
  type SetupStep,
} from './steps';

const OTHER_COUNTRY = '';

/**
 * First-run setup, as a stepped wizard.
 *
 * It replaces a single form asking for three fields, after which the outlet
 * was left on Saudi defaults whatever country they were in — so an Egyptian
 * restaurant printed 15% VAT in riyals until someone found the Settings
 * screen. Picking a country now fills in the currency, its decimal places
 * and the usual tax rate, and shows what it filled in so it can be checked.
 *
 * The draft is kept in `localStorage` so an interrupted install resumes,
 * minus the PIN — see `draftToStore`.
 */
const SetupPage: React.FC = () => {
  const { t, setLocale, formatNumber } = useI18n();
  const { showToast } = useToast();
  const checkSetup = useAuthStore(state => state.checkSetup);
  const navigate = useNavigate();

  const restored = useMemo(() => readDraft(), []);
  const [draft, setDraft] = useState<SetupDraft>(restored ?? EMPTY_DRAFT);
  const [step, setStep] = useState<SetupStep>(
    restored && isWorthResuming(restored) ? firstIncompleteStep(restored) : 'language',
  );
  const [resumed] = useState(() => restored !== null && isWorthResuming(restored));
  const [countries, setCountries] = useState<CountryProfile[]>([]);
  const [saving, setSaving] = useState(false);

  // Keep the draft recoverable as it is filled in.
  useEffect(() => { saveDraft(draft); }, [draft]);

  useEffect(() => {
    let active = true;
    void api.country.list().then((res) => {
      if (active && res.success && res.data) { setCountries(res.data.countries); }
    }).catch(() => { /* the step falls back to a plain currency form */ });
    return () => { active = false; };
  }, []);

  const set = <K extends keyof SetupDraft>(key: K, value: SetupDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const chosen = countries.find(c => c.code === draft.country);
  const problems = problemsWith(step, draft);

  const chooseLanguage = (locale: Locale) => {
    set('locale', locale);
    // Applied immediately: the rest of the wizard should be in the language
    // they just picked, not the one after they finish.
    void setLocale(locale);
  };

  /**
   * Picking a country also moves the language, once.
   *
   * An Egyptian outlet picking Egypt almost certainly wants Arabic. But if
   * they have already chosen a language on the previous step and it differs
   * from the country's default, that was a deliberate choice — a Saudi
   * outlet whose staff read English — so it is left alone.
   */
  const chooseCountry = (code: string) => {
    set('country', code);
    const country = countries.find(c => c.code === code);
    if (country && !resumed && step === 'country' && draft.locale === EMPTY_DRAFT.locale) {
      set('locale', country.defaultLocale);
      void setLocale(country.defaultLocale);
    }
  };

  const goNext = () => {
    if (problems.length > 0) {
      showToast({ message: t(problems[0]), variant: 'warning' });
      return;
    }
    setStep(nextStep(step));
  };

  const finish = async () => {
    setSaving(true);
    try {
      const res = await api.system.completeSetup({
        restaurantName: draft.restaurantName.trim(),
        adminName: draft.adminName.trim(),
        adminPin: draft.adminPin,
        country: draft.country,
        locale: draft.locale,
        numerals: draft.numerals,
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        taxNumber: draft.taxNumber.trim(),
      });

      if (!res.success) {
        showToast({ message: res.error ?? t('setup.failed'), variant: 'error' });
        return;
      }

      const codeRes = await api.system.generateRecoveryCode();
      showToast({
        message: codeRes.success ? t('setup.recoverySaved') : t('setup.recoveryNotSaved'),
        variant: codeRes.success ? 'success' : 'warning',
      });

      clearDraft();
      void checkSetup();
      setStep('done');
    } catch (err) {
      console.error(err);
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    clearDraft();
    setDraft(EMPTY_DRAFT);
    setStep('language');
  };

  const position = stepIndex(step) + 1;

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-muted p-6">
      <div className="card w-full max-w-xl p-6 sm:p-8 space-y-6">

        <header className="space-y-2">
          <h1 className="text-xl font-bold text-body">{t('setup.title')}</h1>
          {step !== 'done' && (
            <p className="text-sm text-subtle">
              {t('setup.stepOf', {
                current: formatNumber(position),
                total: formatNumber(FILLABLE_STEPS.length),
              })}
              {' — '}
              {t(STEP_TITLES[step])}
            </p>
          )}

          {/* Progress. Logical properties, so it fills from the start edge in
              both directions. */}
          <div className="flex gap-1.5" aria-hidden="true">
            {FILLABLE_STEPS.map((candidate, index) => (
              <span
                key={candidate}
                className={`h-1.5 flex-1 rounded-full ${
                  index < position ? 'bg-brand' : 'bg-surface-sunken'
                }`}
              />
            ))}
          </div>
        </header>

        {resumed && step !== 'done' && (
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
            <span className="text-muted">{t('setup.resume')}</span>
            <button
              type="button"
              onClick={startOver}
              className="text-brand hover:underline"
            >
              {t('setup.startOver')}
            </button>
          </div>
        )}

        {/* ── Language ──────────────────────────────────────────────────── */}
        {step === 'language' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('label.language')}>
              {LOCALES.map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={draft.locale === candidate}
                  onClick={() => { chooseLanguage(candidate); }}
                  className={`py-3 rounded-control border text-sm font-medium transition-colors ${
                    draft.locale === candidate
                      ? 'border-brand bg-brand-subtle text-brand'
                      : 'border-line text-muted hover:bg-surface-sunken'
                  }`}
                >
                  {LOCALE_META[candidate].nativeName}
                </button>
              ))}
            </div>
            <p className="text-xs text-subtle">{t('setup.languageHint')}</p>
          </div>
        )}

        {/* ── Country ───────────────────────────────────────────────────── */}
        {step === 'country' && (
          <div className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-muted mb-1.5">
                {t('label.country')}
              </span>
              <select
                value={draft.country}
                onChange={(e) => { chooseCountry(e.target.value); }}
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

            {chosen ? (
              <div className="rounded-control bg-surface-sunken p-3 space-y-1.5 text-sm">
                <p className="text-muted">
                  <span className="font-medium text-body">{t('setup.summaryCurrency')}:</span>{' '}
                  {/* The code and symbol are LTR tokens even in Arabic. */}
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
            ) : (
              <p className="text-sm text-muted">{t('settings.countryNotListed')}</p>
            )}
          </div>
        )}

        {/* ── Outlet ────────────────────────────────────────────────────── */}
        {step === 'outlet' && (
          <div className="space-y-4">
            <Input
              label={t('setup.restaurantName')}
              value={draft.restaurantName}
              placeholder={t('setup.restaurantNamePlaceholder')}
              onChange={(e) => { set('restaurantName', e.target.value); }}
              autoFocus
            />
            <Input
              label={t('label.phone')}
              value={draft.phone}
              onChange={(e) => { set('phone', e.target.value); }}
            />
            <Input
              label={t('label.address')}
              value={draft.address}
              onChange={(e) => { set('address', e.target.value); }}
            />
            <Input
              label={t('tax.registrationNumber')}
              value={draft.taxNumber}
              onChange={(e) => { set('taxNumber', e.target.value); }}
            />
            <p className="text-xs text-subtle">{t('setup.outletHint')}</p>
          </div>
        )}

        {/* ── Administrator ─────────────────────────────────────────────── */}
        {step === 'admin' && (
          <div className="space-y-4">
            <Input
              label={t('setup.adminName')}
              value={draft.adminName}
              onChange={(e) => { set('adminName', e.target.value); }}
              autoFocus
            />
            {/* A PIN pad is digits: LTR, and never spell-checked or
                autocompleted into. */}
            <Input
              label={t('setup.adminPin')}
              type="password"
              inputMode="numeric"
              dir="ltr"
              maxLength={PIN_LENGTH}
              autoComplete="new-password"
              value={draft.adminPin}
              onChange={(e) => { set('adminPin', e.target.value.replace(/\D/g, '')); }}
            />
            <Input
              label={t('setup.pinConfirm')}
              type="password"
              inputMode="numeric"
              dir="ltr"
              maxLength={PIN_LENGTH}
              autoComplete="new-password"
              value={draft.adminPinConfirm}
              onChange={(e) => { set('adminPinConfirm', e.target.value.replace(/\D/g, '')); }}
            />
            <p className="text-xs text-subtle">{t('setup.adminHint')}</p>
          </div>
        )}

        {/* ── Done ──────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-body">{t('setup.doneTitle')}</h2>
            <p className="text-sm text-muted">{t('setup.doneBody')}</p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => { navigate('/login'); }}
            >
              {t('action.signIn')}
            </Button>
          </div>
        )}

        {/* ── Navigation ────────────────────────────────────────────────── */}
        {step !== 'done' && (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              disabled={step === 'language' || saving}
              onClick={() => { setStep(previousStep(step)); }}
            >
              {t('action.back')}
            </Button>

            {step === 'admin' ? (
              <Button
                variant="primary"
                disabled={saving || !canLeave(step, draft)}
                onClick={() => { void finish(); }}
              >
                {t('action.finish')}
              </Button>
            ) : (
              <Button variant="primary" disabled={saving} onClick={goNext}>
                {t('action.next')}
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

export default SetupPage;
