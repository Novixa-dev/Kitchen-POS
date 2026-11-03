import React, { useEffect, useState } from 'react';
import { Button, Input, Toggle } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import { api } from '../../../lib/ipc';
import { useModal } from '../../../hooks/useModal';
import { useToast } from '../../../hooks/useToast';
import { AutoBackupConfig, BackupReminderConfig } from '../../../types/models';
import type { TranslationKey } from '../../../i18n/types';

const DEFAULT_AUTO_BACKUP: AutoBackupConfig = {
  enabled: false, frequency: 'daily', path: null, dayOfWeek: 1, lastBackupAt: null,
};

const DEFAULT_REMINDER: BackupReminderConfig = {
  enabled: false, frequency: 'daily', time: '20:00', dayOfWeek: 1, dayOfMonth: 1,
  lastRemindedDate: null,
};

/** Weekday translation keys, indexed by `Date.getDay()`. */
const WEEKDAY_KEYS: TranslationKey[] = [
  'weekday.short.0', 'weekday.short.1', 'weekday.short.2', 'weekday.short.3',
  'weekday.short.4', 'weekday.short.5', 'weekday.short.6',
];

const FREQUENCY_KEYS: Record<string, TranslationKey> = {
  daily: 'range.daily',
  weekly: 'range.weekly',
  monthly: 'range.monthly',
};

/** The highest day-of-month that exists in every month. */
const MAX_MONTH_DAY = 28;

export const BackupCard: React.FC = () => {
  const { t, formatDateTime } = useI18n();
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();

  const [autoBackup, setAutoBackup] = useState<AutoBackupConfig>(DEFAULT_AUTO_BACKUP);
  const [reminder, setReminder] = useState<BackupReminderConfig>(DEFAULT_REMINDER);
  const [busy, setBusy] = useState<'backup' | 'export' | 'import' | null>(null);

  useEffect(() => {
    let active = true;
    api.backup.getAutoBackupConfig().then(res => {
      if (!active || !res.success || !res.data) { return; }
      setAutoBackup(res.data.autoBackup);
      setReminder(res.data.backupReminder);
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  const saveAutoBackup = async (patch: Partial<AutoBackupConfig>) => {
    setAutoBackup(prev => ({ ...prev, ...patch }));
    try {
      await api.backup.setAutoBackupConfig({ autoBackup: patch });
      showToast({ message: t('settings.saved'), variant: 'success' });
    } catch {
      showToast({ message: t('settings.saveFailed'), variant: 'error' });
    }
  };

  const saveReminder = async (patch: Partial<BackupReminderConfig>) => {
    setReminder(prev => ({ ...prev, ...patch }));
    try {
      await api.backup.setAutoBackupConfig({ backupReminder: patch });
      showToast({ message: t('settings.saved'), variant: 'success' });
    } catch {
      showToast({ message: t('settings.saveFailed'), variant: 'error' });
    }
  };

  const handleBackupNow = async () => {
    setBusy('backup');
    const res = await api.backup.triggerNow();
    setBusy(null);
    showToast({
      message: res.success ? t('settings.backupSuccess') : (res.error ?? t('settings.backupFailed')),
      variant: res.success ? 'success' : 'error',
    });
  };

  const handleExport = async () => {
    setBusy('export');
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
      setBusy(null);
    }
  };

  const handleImport = async () => {
    hideModal();
    setBusy('import');
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
      setBusy(null);
    }
  };

  const confirmImport = () => {
    showModal({
      title: t('settings.importBackup'),
      content: <p className="text-sm text-muted">{t('settings.importWarning')}</p>,
      actions: (
        <>
          <Button variant="secondary" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button variant="danger" onClick={() => { void handleImport(); }}>
            {t('settings.importConfirm')}
          </Button>
        </>
      ),
    });
  };

  const handleSelectPath = async () => {
    const res = await api.backup.selectAutoBackupPath();
    if (res.success && res.data) {
      await saveAutoBackup({ path: res.data });
    }
  };

  const anyBusy = busy !== null;

  return (
    <SettingsSection title={t('settings.dataBackups')}>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-body">{t('settings.manualBackup')}</h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="primary" disabled={anyBusy} onClick={() => { void handleBackupNow(); }}>
            {busy === 'backup' ? t('settings.backingUp') : t('settings.backupNow')}
          </Button>
          <Button variant="outline" disabled={anyBusy} onClick={() => { void handleExport(); }}>
            {busy === 'export' ? t('settings.exporting') : t('settings.exportBackup')}
          </Button>
          <Button variant="outline" disabled={anyBusy} onClick={confirmImport}>
            {busy === 'import' ? t('settings.importing') : t('settings.importBackup')}
          </Button>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-line">
        <h3 className="text-sm font-semibold text-body">{t('settings.autoBackup')}</h3>
        <Toggle
          checked={autoBackup.enabled}
          onChange={(e) => { void saveAutoBackup({ enabled: e.target.checked }); }}
          label={t('settings.autoBackupEnable')}
          description={t('settings.autoBackupHint')}
        />

        {autoBackup.enabled && (
          // Indented with a logical border so the nesting reads correctly in
          // both directions.
          <div className="ps-4 space-y-3 border-s-2 border-line">
            <div className="flex gap-2">
              {(['daily', 'weekly'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={autoBackup.frequency === f ? 'primary' : 'outline'}
                  onClick={() => { void saveAutoBackup({ frequency: f }); }}
                >
                  {t(FREQUENCY_KEYS[f])}
                </Button>
              ))}
            </div>

            {autoBackup.frequency === 'weekly' && (
              <div className="flex gap-2 flex-wrap">
                {WEEKDAY_KEYS.map((key, idx) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={autoBackup.dayOfWeek === idx ? 'secondary' : 'ghost'}
                    onClick={() => { void saveAutoBackup({ dayOfWeek: idx }); }}
                  >
                    {t(key)}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted flex-1 truncate">
                {autoBackup.path ?? t('settings.defaultFolder')}
              </span>
              <Button size="sm" variant="outline" onClick={() => { void handleSelectPath(); }}>
                {t('settings.changeFolder')}
              </Button>
            </div>

            {autoBackup.lastBackupAt && (
              <p className="text-xs text-subtle">
                {t('settings.lastBackup', { date: formatDateTime(autoBackup.lastBackupAt) })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-line">
        <h3 className="text-sm font-semibold text-body">{t('settings.backupReminder')}</h3>
        <Toggle
          checked={reminder.enabled}
          onChange={(e) => { void saveReminder({ enabled: e.target.checked }); }}
          label={t('settings.backupReminderEnable')}
          description={t('settings.backupReminderHint')}
        />

        {reminder.enabled && (
          <div className="ps-4 space-y-3 border-s-2 border-line">
            <div className="flex gap-2 flex-wrap">
              {(['daily', 'weekly', 'monthly'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={reminder.frequency === f ? 'primary' : 'outline'}
                  onClick={() => { void saveReminder({ frequency: f }); }}
                >
                  {t(FREQUENCY_KEYS[f])}
                </Button>
              ))}
            </div>

            <Input
              label={t('settings.reminderTime')}
              type="time"
              value={reminder.time}
              onChange={(e) => { void saveReminder({ time: e.target.value }); }}
            />

            {reminder.frequency === 'weekly' && (
              <div className="flex gap-2 flex-wrap">
                {WEEKDAY_KEYS.map((key, idx) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={reminder.dayOfWeek === idx ? 'secondary' : 'ghost'}
                    onClick={() => { void saveReminder({ dayOfWeek: idx }); }}
                  >
                    {t(key)}
                  </Button>
                ))}
              </div>
            )}

            {reminder.frequency === 'monthly' && (
              <Input
                label={t('settings.dayOfMonth')}
                type="number"
                min="1"
                max={String(MAX_MONTH_DAY)}
                value={String(reminder.dayOfMonth)}
                // Capped at 28 so the reminder fires in February too.
                onChange={(e) => {
                  const day = Math.min(MAX_MONTH_DAY, Math.max(1, Number(e.target.value) || 1));
                  void saveReminder({ dayOfMonth: day });
                }}
              />
            )}
          </div>
        )}
      </div>
    </SettingsSection>
  );
};
