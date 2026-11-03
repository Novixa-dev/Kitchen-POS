import { Input, Select, Textarea } from '../../../components/atoms';
import React, { useState } from 'react';
import { InventoryItem } from '../../../types/models';
import { api } from '../../../lib/ipc';

import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  onClose: () => void;
  onRefresh: () => void;
  item: InventoryItem;
}

export function StockAdjustmentModal({ onClose, onRefresh, item }: Props) {
  const { t, formatNumber } = useI18n();
  const [type, setType] = useState<'purchase' | 'adjustment' | 'wastage'>('purchase');
  const [qtyChange, setQtyChange] = useState<number | ''>('');
  const [note, setNote] = useState('');

  const { showToast } = useToast();

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (qtyChange === '') {
      showToast({ message: t('inventory.enterValidQty'), variant: 'error' });
      return;
    }

    let finalQty = qtyChange;
    // For wastage, the user enters a positive amount they want to remove, so we negate it.
    if (type === 'wastage' && finalQty > 0) {
      finalQty = -finalQty;
    }

    api.inventory.adjust({
      item_id: item.id,
      type,
      qty_change: finalQty,
      note: note.trim() || undefined
    })
      .then(res => {
        if (res.success) {
          showToast({ message: t('inventory.stockAdjusted'), variant: 'success' });
          onRefresh();
          onClose();
        } else {
          showToast({ message: res.error ?? t('inventory.adjustFailed'), variant: 'error' });

        }
      })
      .catch(() => {
        showToast({ message: t('toast.unexpectedError'), variant: 'error' });
      });
  };
  // The label has to state the sign convention: under "wastage" the user
  // types a positive number and the handler negates it, which is only
  // obvious if the field says so.
  let quantityLabel = t('inventory.qtyChangeHint');
  if (type === 'wastage') { quantityLabel = t('inventory.qtyToRemove'); }
  else if (type === 'purchase') { quantityLabel = t('inventory.qtyToAdd'); }

  return (
    <form id="stock-adjust-form" onSubmit={handleSubmit} className="space-y-4">

      <div className="bg-brand-subtle text-brand p-3 rounded-control text-sm mb-4">
        {t('inventory.currentStock2', {
          qty: formatNumber(item.qty_in_stock, { maximumFractionDigits: 2 }),
          unit: item.unit,
        })}
      </div>

      <Select
        label={t('inventory.adjustmentType')}
        value={type}
        onChange={e => { setType(e.target.value as 'purchase' | 'adjustment' | 'wastage'); }}
      >
        <option value="purchase">{t('inventory.adjustment.purchaseLong')}</option>
        <option value="adjustment">{t('inventory.adjustment.adjustmentLong')}</option>
        <option value="wastage">{t('inventory.adjustment.wastageLong')}</option>
      </Select>

      <Input
        label={quantityLabel}
        type="number"
        step="0.01"
        required
        value={qtyChange}
        onChange={e => { setQtyChange(e.target.value === '' ? '' : Number(e.target.value)); }}
        placeholder={type === 'adjustment' ? '-5.5' : '5.5'}
      />

      <Textarea
        label={t('label.note')}
        value={note}
        onChange={e => { setNote(e.target.value); }}
        placeholder={t('inventory.notePlaceholder')}
        rows={2}
      />


    </form>
  );
}
