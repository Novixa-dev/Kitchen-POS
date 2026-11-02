import React from 'react';
import { SvgIcon } from '../../atoms/svg-sprite-loader';
import { useI18n } from '../../../i18n/useI18n';
import { useTheme } from '../../../theme/useTheme';
import type { TranslationKey } from '../../../i18n/types';
import type { ThemePreference } from '../../../theme/context';

const OPTIONS: { value: ThemePreference; labelKey: TranslationKey; icon: string }[] = [
  { value: 'light', labelKey: 'settings.theme.light', icon: 'sun' },
  { value: 'dark', labelKey: 'settings.theme.dark', icon: 'moon' },
  { value: 'system', labelKey: 'settings.theme.system', icon: 'settings' },
];

/**
 * Cycles light → dark → system.
 *
 * A single button rather than a three-way control: the header is dense, and
 * the full choice is available in Settings. The tooltip names what the next
 * press will do, so the cycle is discoverable.
 */
const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();

  const index = OPTIONS.findIndex((o) => o.value === preference);
  const current = OPTIONS[index === -1 ? 0 : index];
  const next = OPTIONS[(index + 1) % OPTIONS.length];

  return (
    <button
      type="button"
      onClick={() => { void setPreference(next.value); }}
      title={`${t('label.theme')}: ${t(current.labelKey)}`}
      aria-label={`${t('label.theme')}: ${t(current.labelKey)}`}
      className={[
        'inline-flex items-center justify-center w-9 h-9 rounded-control',
        'text-muted hover:text-body hover:bg-surface-sunken transition-colors',
        className,
      ].join(' ')}
    >
      <SvgIcon name={current.icon} width="18" height="18" />
    </button>
  );
};

export default ThemeToggle;
