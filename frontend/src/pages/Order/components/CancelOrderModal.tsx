import { Textarea } from '../../../components/atoms';
import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  onConfirm: (note: string) => void;
  /** Voiding a single line uses the same form with a narrower warning. */
  scope?: 'order' | 'item';
}

const CancelOrderModal: React.FC<Props> = ({ onConfirm, scope = 'order' }) => {
  const { t } = useI18n();
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onConfirm(note.trim());
  };

  return (
    <form id="cancel-order-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-danger-subtle text-danger p-3 rounded-control border border-danger/20">
        <p className="font-semibold text-sm">
          {scope === 'item' ? t('order.voidItem') : t('order.voidOrderConfirm')}
        </p>
        <p className="text-xs mt-1 opacity-90">{t('order.voidWarning')}</p>
      </div>

      <Textarea
        label={t('order.voidReason')}
        value={note}
        onChange={(e) => { setNote(e.target.value); }}
        placeholder={t('order.voidReasonPlaceholder')}
        className="min-h-[80px]"
      />
    </form>
  );
};

export default CancelOrderModal;
