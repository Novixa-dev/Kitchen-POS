import { Input, Select } from '../../../components/atoms';
import React, { useState } from 'react';
import { InventoryItem } from '../../../types/models';
import { api } from '../../../lib/ipc';

import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  onClose: () => void;
  onRefresh: () => void;
  initialData?: InventoryItem | null;
}

export function InventoryItemModal({ onClose, onRefresh, initialData }: Props) {
  const { t, currency } = useI18n();
  const [name, setName] = useState(initialData?.name ?? '');
  const [unit, setUnit] = useState(initialData?.unit ?? 'kg');
  const [lowStockAlertAt, setLowStockAlertAt] = useState<number | ''>(initialData?.low_stock_alert_at ?? 0);
  const [costPerUnit, setCostPerUnit] = useState<number | ''>(initialData?.cost_per_unit ?? 0);

  const { showToast } = useToast();

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();


    const payload = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      name,
      unit,
      low_stock_alert_at: Number(lowStockAlertAt),
      cost_per_unit: Number(costPerUnit),
    };

    api.inventory.upsertItem(payload)
      .then(res => {
        if (res.success) {
          showToast({ message: t('inventory.itemSaved'), variant: 'success' });
          onRefresh();
          onClose();
        } else {
          showToast({ message: res.error ?? t('inventory.itemSaveFailed'), variant: 'error' });

        }
      })
      .catch(() => {
        showToast({ message: t('toast.unexpectedError'), variant: 'error' });
      });
  };

  return (
    <form id="inventory-item-form" onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('inventory.itemName')}
        type="text"
        required
        value={name}
        onChange={e => { setName(e.target.value); }}
        placeholder={t('inventory.itemPlaceholder')}
      />

      <Select
        label={t('inventory.unitOfMeasure')}
        value={unit}
        onChange={e => { setUnit(e.target.value); }}
      >
        <option value="kg">{t('inventory.unit.kg')}</option>
        <option value="g">{t('inventory.unit.g')}</option>
        <option value="L">{t('inventory.unit.l')}</option>
        <option value="ml">{t('inventory.unit.ml')}</option>
        <option value="pcs">{t('inventory.unit.pcs')}</option>
        <option value="pack">{t('inventory.unit.pack')}</option>
      </Select>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t('inventory.lowStockThreshold')}
          type="number"
          min="0"
          step="0.01"
          required
          value={lowStockAlertAt}
          onChange={e => { setLowStockAlertAt(e.target.value === '' ? '' : Number(e.target.value)); }}
        />
        <Input
          label={`${t('inventory.costPerUnit')} (${currency.symbol || currency.code})`}
          type="number"
          min="0"
          step="0.01"
          required
          value={costPerUnit}
          onChange={e => { setCostPerUnit(e.target.value === '' ? '' : Number(e.target.value)); }}
        />
      </div>


    </form>
  );
}
