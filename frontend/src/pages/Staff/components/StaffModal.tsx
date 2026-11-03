import { Input, Select } from '../../../components/atoms';
import React, { useState } from 'react';
import { Staff } from '../../../types/models';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import { STAFF_ROLES, staffRoleLabel } from '../staffRoles';

interface Props {
  onSave: (data: Partial<Staff>) => void;
  initialData?: Staff | null;
}

const PIN_LENGTH = 4;

const StaffModal: React.FC<Props> = ({ onSave, initialData }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [name, setName] = useState(initialData?.name ?? '');
  const [pin, setPin] = useState('');
  // Default to waiter — the most common role on a restaurant floor.
  const [role, setRole] = useState<string>(initialData?.role ?? 'waiter');

  const isEdit = Boolean(initialData);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast({ message: t('validation.nameRequired'), variant: 'warning' });
      return;
    }

    // On create a PIN is mandatory; on edit a blank field means "keep the
    // current one", which the backend now handles explicitly.
    if (!isEdit && pin.length !== PIN_LENGTH) {
      showToast({ message: t('validation.pinLength'), variant: 'warning' });
      return;
    }
    if (pin && pin.length !== PIN_LENGTH) {
      showToast({ message: t('validation.pinLength'), variant: 'warning' });
      return;
    }

    const data: Partial<Staff> & { pin?: string } = { name: name.trim(), role };
    if (pin) { data.pin = pin; }
    if (initialData) { data.id = initialData.id; }

    onSave(data);
  };

  return (
    <form id="staff-form" onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('staff.staffName')}
        value={name}
        onChange={e => { setName(e.target.value); }}
        placeholder={t('staff.namePlaceholder')}
        autoFocus
        required
      />

      <Select
        label={t('label.role')}
        value={role}
        onChange={e => { setRole(e.target.value); }}
        required
      >
        {/* Only roles the database accepts. The previous list offered `chef`
            and `cleaner`, which the CHECK constraint rejected. */}
        {STAFF_ROLES.map(r => (
          <option key={r} value={r}>{staffRoleLabel(r, t)}</option>
        ))}
      </Select>

      <div>
        <Input
          label={isEdit ? t('staff.newPin') : t('staff.pinFourDigits')}
          type="password"
          inputMode="numeric"
          value={pin}
          // Strip non-digits on input rather than relying on a pattern, so a
          // paste cannot fail validation after the fact.
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); }}
          required={!isEdit}
          maxLength={PIN_LENGTH}
        />
        {isEdit && (
          <p className="text-xs text-subtle mt-1">{t('staff.newPinHint')}</p>
        )}
      </div>
    </form>
  );
};

export default StaffModal;
