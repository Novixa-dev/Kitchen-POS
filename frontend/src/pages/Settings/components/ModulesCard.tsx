import React, { useState } from 'react';
import { Button, Toggle } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import { useFeatures, type FeatureCategory, type FeatureId } from '../../../features';
import type { TranslationKey } from '../../../i18n/types';

const CATEGORY_ORDER: FeatureCategory[] = ['operations', 'back-office', 'growth'];

const CATEGORY_LABEL: Record<FeatureCategory, TranslationKey> = {
  operations: 'settings.moduleCategory.operations',
  'back-office': 'settings.moduleCategory.back-office',
  growth: 'settings.moduleCategory.growth',
};

export const ModulesCard: React.FC = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { modules, setEnabled, preview, reset } = useFeatures();

  const [busy, setBusy] = useState<FeatureId | null>(null);
  // What the pending toggle would drag with it, so the admin is told rather
  // than having their configuration silently rearranged.
  const [sideEffects, setSideEffects] = useState<{
    id: FeatureId;
    alsoEnabled: FeatureId[];
    alsoDisabled: FeatureId[];
  } | null>(null);

  const nameOf = (id: string): string => {
    const module = modules?.find(m => m.id === id);
    return module ? t(module.nameKey as TranslationKey) : id;
  };

  const handleToggle = async (id: FeatureId, enabled: boolean) => {
    setBusy(id);
    try {
      const plan = await preview(id, enabled);
      const ok = await setEnabled(id, enabled);

      if (!ok) {
        showToast({ message: t('settings.saveFailed'), variant: 'error' });
        return;
      }

      // Surface the cascade, which is the part an admin would otherwise only
      // discover by noticing something else had changed.
      if (plan.alsoEnabled.length > 0 || plan.alsoDisabled.length > 0) {
        setSideEffects({ id, alsoEnabled: plan.alsoEnabled, alsoDisabled: plan.alsoDisabled });
      } else {
        setSideEffects(null);
      }

      showToast({ message: t('settings.saved'), variant: 'success' });
    } finally {
      setBusy(null);
    }
  };

  if (!modules) {
    return (
      <SettingsSection title={t('settings.modules')}>
        <p className="text-sm text-subtle">{t('state.loading')}</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t('settings.modules')} description={t('settings.modulesHint')}>
      {CATEGORY_ORDER.map(category => {
        const inCategory = modules.filter(m => m.category === category);
        if (inCategory.length === 0) { return null; }

        return (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold text-body pt-2">
              {t(CATEGORY_LABEL[category])}
            </h3>

            {inCategory.map(module => {
              const unmet = module.requires.filter(
                dep => !modules.find(m => m.id === dep)?.active,
              );

              return (
                <div
                  key={module.id}
                  className="flex items-start gap-3 p-3 rounded-control border border-line bg-surface"
                >
                  <SvgIcon
                    name={module.icon}
                    width="20"
                    height="20"
                    className={module.active ? 'text-brand mt-0.5' : 'text-subtle mt-0.5'}
                    aria-hidden
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-body">
                        {t(module.nameKey as TranslationKey)}
                      </span>
                      {module.locked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-sunken text-subtle font-semibold uppercase">
                          {t('settings.moduleLocked')}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-subtle mt-0.5">
                      {t(module.descriptionKey as TranslationKey)}
                    </p>

                    {module.requires.length > 0 && (
                      <p className={`text-xs mt-1 ${unmet.length > 0 ? 'text-warning' : 'text-subtle'}`}>
                        {t('settings.moduleRequires', {
                          modules: module.requires.map(nameOf).join(' · '),
                        })}
                      </p>
                    )}

                    {sideEffects?.id === module.id && sideEffects.alsoEnabled.length > 0 && (
                      <p className="text-xs text-success mt-1">
                        {t('settings.moduleWillEnable', {
                          modules: sideEffects.alsoEnabled.map(nameOf).join(' · '),
                        })}
                      </p>
                    )}
                    {sideEffects?.id === module.id && sideEffects.alsoDisabled.length > 0 && (
                      <p className="text-xs text-warning mt-1">
                        {t('settings.moduleWillDisable', {
                          modules: sideEffects.alsoDisabled.map(nameOf).join(' · '),
                        })}
                      </p>
                    )}
                  </div>

                  <Toggle
                    checked={module.enabled}
                    disabled={module.locked || busy === module.id}
                    onChange={e => { void handleToggle(module.id, e.target.checked); }}
                    aria-label={t(module.nameKey as TranslationKey)}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="pt-4 border-t border-line">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void reset().then(() => {
              setSideEffects(null);
              showToast({ message: t('settings.saved'), variant: 'success' });
            });
          }}
        >
          {t('settings.modulesReset')}
        </Button>
      </div>
    </SettingsSection>
  );
};
