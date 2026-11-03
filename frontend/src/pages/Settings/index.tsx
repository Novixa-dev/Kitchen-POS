import React from 'react';
import { Button } from '../../components/atoms';
import { useAuthStore } from '../../store/auth';
import CloseShiftModal from './components/CloseShiftModal';
import { useModal } from '../../hooks/useModal';
import { useI18n } from '../../i18n/useI18n';
import { useAppSettings, refreshAppSettings } from '../../lib/useAppSettings';

import { SettingsSection } from './components/SettingsSection';
import { LocalizationCard } from './components/LocalizationCard';
import { AppearanceCard } from './components/AppearanceCard';
import { OutletCard } from './components/OutletCard';
import { TaxCard } from './components/TaxCard';
import { PrintingCard } from './components/PrintingCard';
import { FeaturesCard } from './components/FeaturesCard';
import { ModulesCard } from './components/ModulesCard';
import { BackupCard } from './components/BackupCard';
import { SecurityCard } from './components/SecurityCard';
import { DangerZoneCard } from './components/DangerZoneCard';
import { PermissionsCard } from './components/PermissionsCard';
import { CountryCard } from './components/CountryCard';
import { PrinterBenchCard } from './components/PrinterBenchCard';
import { PermissionGate } from '../../auth';

/**
 * Settings.
 *
 * Previously one 550-line component holding ten inlined cards, where every
 * section re-rendered on any state change and none could be tested on its
 * own. Each concern is now its own card; this file only composes them and
 * owns the shared settings read.
 */
const SettingsPage: React.FC = () => {
  const { t, formatDateTime } = useI18n();
  const { showModal, hideModal } = useModal();

  const settings = useAppSettings();
  const activeShift = useAuthStore(state => state.activeShift);
  const staff = useAuthStore(state => state.staff);

  const handleSaved = () => { void refreshAppSettings(); };

  const openCloseShift = () => {
    showModal({
      title: t('settings.closeRegister'),
      content: <CloseShiftModal onSuccess={hideModal} />,
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button type="submit" form="close-shift-form" variant="danger">
            {t('settings.reconcileAndClose')}
          </Button>
        </>
      ),
    });
  };

  if (!settings) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <div className="container-responsive p-6 max-w-3xl mx-auto">
      <div className="space-y-8">

        {/* Each card is gated by the permission its own IPC needs, so a
            role that cannot save a change is not shown the form. The main
            process refuses the write regardless — this is about not
            offering an action that would come back refused. */}
        <PermissionGate permission="settings.edit">
          <LocalizationCard settings={settings} onSaved={handleSaved} />
          <AppearanceCard />
        </PermissionGate>

        <PermissionGate permission="settings.features">
          <ModulesCard />
        </PermissionGate>

        <PermissionGate permission="settings.edit">
          <OutletCard settings={settings} onSaved={handleSaved} />
          {/* Before the tax card, since choosing a country fills it in. */}
          <CountryCard settings={settings} onSaved={handleSaved} />
          <TaxCard settings={settings} onSaved={handleSaved} />
          <PrintingCard settings={settings} onSaved={handleSaved} />
          <FeaturesCard settings={settings} onSaved={handleSaved} />
        </PermissionGate>

        {/* Needs only printer configuration rights, not settings.edit —
            previewing changes nothing. */}
        <PermissionGate permission="printers.manage">
          <PrinterBenchCard />
        </PermissionGate>

        <PermissionGate permission="settings.permissions">
          <PermissionsCard />
        </PermissionGate>

        <PermissionGate permission="backup.run">
          <BackupCard />
        </PermissionGate>

        <PermissionGate permission="shifts.operate">
        <SettingsSection title={t('settings.shiftRegister')}>
          {activeShift ? (
            <>
              <p className="text-sm text-muted">
                {t('settings.registerOpenSince', {
                  time: formatDateTime(activeShift.opened_at),
                })}
              </p>
              <Button variant="danger" className="w-fit" onClick={openCloseShift}>
                {t('settings.closeRegister')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-subtle">{t('settings.registerClosed')}</p>
          )}
        </SettingsSection>
        </PermissionGate>

        {staff && <SecurityCard staffId={staff.id} />}

        <PermissionGate permission="system.reset">
          <DangerZoneCard />
        </PermissionGate>
      </div>
    </div>
  );
};

export default SettingsPage;
