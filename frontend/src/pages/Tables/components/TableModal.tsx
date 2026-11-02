import { Input, Stepper } from '../../../components/atoms';
import React, { useState } from 'react';

import { api } from '../../../lib/ipc';
import { Table } from '../../../types/models';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  onSaved: () => void;
  table?: Table;
}

export default function TableModal({ onSaved, table }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState<number>(table?.capacity ?? 4);
  const [error, setError] = useState('');

  const handleSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      setError(t('validation.positiveNumber'));
      return;
    }

    setError('');

    try {
      const payload: Partial<Table> = {
        name: name.trim(),
        capacity,
        section: table?.section ?? 'Main',
      };
      if (table?.id) {
        payload.id = table.id;
      }

      const res = await api.tables.upsert(payload);
      if (res.success) {
        onSaved();
      } else {
        setError(res.error ?? t('toast.failed'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('toast.unexpectedError'));
    }
  };

  return (
    <form id="table-form" onSubmit={(e) => { void handleSave(e); }} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-danger-subtle text-danger text-sm rounded-control">
          {error}
        </div>
      )}

      <Input
        label={t('tables.tableName')}
        value={name}
        onChange={(e) => { setName(e.target.value); }}
        placeholder="T-1"
        autoFocus
      />

      <div>
        <label className="block text-sm font-medium text-muted mb-1">
          {t('tables.capacity')}
        </label>
        <Stepper value={capacity} onChange={setCapacity} min={1} />
      </div>
    </form>
  );
}
