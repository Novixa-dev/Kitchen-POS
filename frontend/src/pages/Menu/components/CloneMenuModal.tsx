import { Input } from '../../../components/atoms';
import React, { useState } from 'react';
import { api } from '../../../lib/ipc';
import { Menu } from '../../../types/models';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  sourceMenu: Menu;
  onSuccess: (newId: number) => void;
}

const CloneMenuModal: React.FC<Props> = ({ sourceMenu, onSuccess }) => {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [name, setName] = useState(() => t('menu.copySuffix', { name: sourceMenu.name }));

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name) {
      showToast({ message: t('validation.nameRequired'), variant: 'warning' });
      return;
    }

    try {
      const res = await api.menu.duplicateMenu({
        id: sourceMenu.id,
        newName: name
      });

      if (res.success && res.data) {
        showToast({ message: t('menu.duplicated'), variant: 'success' });
        onSuccess(res.data.id);
      } else {
        showToast({ message: res.error ?? t('menu.duplicateFailed'), variant: 'error' });
      }
    } catch (e) {
      console.error(e);
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    }
  };

  return (
    <form id="clone-menu-form" onSubmit={(e) => { void handleSubmit(e); }} className="p-4 space-y-4">
      <Input 
        label={t('menu.newMenuName')} 
        value={name} 
        onChange={(e) => { setName(e.target.value); }} 
        placeholder={t('menu.menuPlaceholder')}
        autoFocus
        required
      />
    </form>
  );
};

export default CloneMenuModal;
