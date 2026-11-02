import React from 'react';
import { useI18n } from '../../../i18n/useI18n';
import { LOCALES, LOCALE_META, type Locale } from '../../../i18n/types';

/**
 * Language toggle, always reachable from the header.
 *
 * Each option is written in its own language — a user who has landed in the
 * wrong locale cannot read a label in the locale they are trying to leave.
 */
const LocaleSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('label.language')}
      className={`inline-flex rounded-control border border-line overflow-hidden ${className}`}
    >
      {LOCALES.map((code: Locale) => {
        const isActive = code === locale;
        return (
          <button
            key={code}
            type="button"
            // `lang` lets the browser pick the right font and shaping for the
            // label even while the page is in the other language.
            lang={LOCALE_META[code].tag}
            aria-pressed={isActive}
            onClick={() => { void setLocale(code); }}
            className={[
              'px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand text-on-brand'
                : 'bg-surface text-muted hover:bg-surface-sunken hover:text-body',
            ].join(' ')}
          >
            {LOCALE_META[code].nativeName}
          </button>
        );
      })}
    </div>
  );
};

export default LocaleSwitcher;
