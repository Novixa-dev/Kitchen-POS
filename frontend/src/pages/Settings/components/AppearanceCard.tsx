import React from 'react';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { useTheme } from '../../../theme/useTheme';
import type { ThemePreference } from '../../../theme/context';
import type { TranslationKey } from '../../../i18n/types';

const OPTIONS: { value: ThemePreference; labelKey: TranslationKey }[] = [
  { value: 'light', labelKey: 'settings.theme.light' },
  { value: 'dark', labelKey: 'settings.theme.dark' },
  { value: 'system', labelKey: 'settings.theme.system' },
];

/**
 * Theme picker.
 *
 * Replaces a `darkModeEnabled` toggle whose state was read and set but never
 * applied to anything — flipping it showed a success toast and changed
 * nothing on screen.
 */
export const AppearanceCard: React.FC = () => {
  const { t } = useI18n();
  const { preference, setPreference } = useTheme();

  return (
    <SettingsSection title={t('settings.appearance')}>
      <div>
        <span className="block text-sm font-medium text-muted mb-2">{t('label.theme')}</span>
        <div className="grid grid-cols-3 gap-2 max-w-md" role="group">
          {OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={preference === option.value}
              onClick={() => { void setPreference(option.value); }}
              className={`py-2.5 rounded-control border text-sm font-medium transition-colors ${
                preference === option.value
                  ? 'border-brand bg-brand-subtle text-brand'
                  : 'border-line text-muted hover:bg-surface-sunken'
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
};
