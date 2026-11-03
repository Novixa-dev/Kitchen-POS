import { Input, Toggle } from '../../../components/atoms';
import React, { useState } from 'react';
import { api } from '../../../lib/ipc';
import { Menu } from '../../../types/models';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  menu: Menu | null;
  onSuccess: () => void;
}

const MenuModal: React.FC<Props> = ({ menu, onSuccess }) => {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [name, setName] = useState(menu?.name ?? '');
  const [isDefault, setIsDefault] = useState(menu?.is_default === 1);
  const [isActive, setIsActive] = useState(menu?.is_active !== 0); // Defaults to true if new
  const [scheduleEnabled, setScheduleEnabled] = useState(menu?.schedule_enabled === 1);
  const [autoEnableTime, setAutoEnableTime] = useState(menu?.auto_enable_time ?? '');
  const [autoDisableTime, setAutoDisableTime] = useState(menu?.auto_disable_time ?? '');

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name) {
      showToast({ message: t('validation.nameRequired'), variant: 'warning' });
      return;
    }

    try {
      const res = await api.menu.upsertMenu({
        id: menu?.id,
        name,
        is_default: isDefault ? 1 : 0,
        is_active: isActive ? 1 : 0,
        schedule_enabled: scheduleEnabled ? 1 : 0,
        auto_enable_time: scheduleEnabled ? autoEnableTime : null,
        auto_disable_time: scheduleEnabled ? autoDisableTime : null,
      });

      if (res.success) {
        showToast({ message: t('menu.menuSaved'), variant: 'success' });
        onSuccess();
      } else {
        showToast({ message: res.error ?? t('menu.menuSaveFailed'), variant: 'error' });
      }
    } catch (e) {
      console.error(e);
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    }
  };

  return (
    <form id="menu-form" onSubmit={(e) => { void handleSubmit(e); }} className="p-4 space-y-4">
      <Input 
        label={t('menu.menuName')} 
        value={name} 
        onChange={(e) => { setName(e.target.value); }} 
        placeholder={t('menu.menuPlaceholder')}
        autoFocus
        required
      />
      <Toggle 
        label={t('menu.makeDefault')} 
        description={t('menu.makeDefaultHint')}
        checked={isDefault} 
        onChange={(e) => { setIsDefault(e.target.checked); }} 
      />
      <Toggle 
        label={t('menu.isActive')} 
        description={t('menu.isActiveHint')}
        checked={isActive} 
        onChange={(e) => { setIsActive(e.target.checked); }} 
      />
      <div className="border-t border-line pt-4 mt-4">
        <Toggle 
          label={t('menu.scheduleEnabled')} 
          description={t('menu.scheduleHint')}
          checked={scheduleEnabled} 
          onChange={(e) => { setScheduleEnabled(e.target.checked); }} 
        />
        {scheduleEnabled && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input 
              type="time"
              label={t('menu.autoEnableTime')} 
              value={autoEnableTime} 
              onChange={(e) => { setAutoEnableTime(e.target.value); }} 
              required={scheduleEnabled}
            />
            <Input 
              type="time"
              label={t('menu.autoDisableTime')} 
              value={autoDisableTime} 
              onChange={(e) => { setAutoDisableTime(e.target.value); }} 
              required={scheduleEnabled}
            />
          </div>
        )}
      </div>
    </form>
  );
};

export default MenuModal;
