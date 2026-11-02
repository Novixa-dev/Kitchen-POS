import React, { useState } from 'react';
import { Customer } from '../../../types/models';
import { api } from '../../../lib/ipc';
import { Input } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import type { TranslationKey } from '../../../i18n/types';

interface Props {
  customer: Customer;
  onSuccess: () => void;
}

const METHODS: { value: string; labelKey: TranslationKey }[] = [
  { value: 'cash', labelKey: 'billing.method.cash' },
  { value: 'card', labelKey: 'billing.method.card' },
  { value: 'wallet', labelKey: 'billing.method.wallet' },
];

const SettleBalanceModal: React.FC<Props> = ({ customer, onSuccess }) => {
  const { t, formatCurrency, currency } = useI18n();

  const [amount, setAmount] = useState(String(customer.outstanding_balance));
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    const settleAmount = Number.parseFloat(amount);

    if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
      setError(t('validation.positiveNumber'));
      return;
    }
    // Over-settling would push the balance negative, which the customer list
    // would then render as a credit the outlet never agreed to.
    if (settleAmount > customer.outstanding_balance) {
      setError(t('customers.cannotSettleMore'));
      return;
    }

    setError('');
    setSaving(true);

    const res = await api.customers.settleBalance({
      customerId: customer.id,
      amount: settleAmount,
      method,
    });

    setSaving(false);

    if (res.success) {
      onSuccess();
    } else {
      setError(res.error ?? t('customers.settleFailed'));
    }
  };

  return (
    <form id="settle-balance-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      <div className="bg-brand-subtle p-4 rounded-control border border-brand/20">
        <p className="text-sm text-brand">
          {t('customers.currentOutstanding')}:{' '}
          <strong className="text-lg text-danger tabular">
            {formatCurrency(customer.outstanding_balance)}
          </strong>
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-danger-subtle text-danger rounded-control text-sm">
          {error}
        </div>
      )}

      <Input
        label={`${t('customers.amountToSettle')} (${currency.symbol || currency.code})`}
        type="number"
        min="0.01"
        step="0.01"
        max={String(customer.outstanding_balance)}
        autoFocus
        value={amount}
        onChange={(e) => { setAmount(e.target.value); }}
        className="text-lg"
        disabled={saving}
      />

      <div>
        <span className="block text-sm font-medium text-muted mb-2">
          {t('billing.paymentMethod')}
        </span>
        <div className="flex gap-2" role="group">
          {METHODS.map(m => (
            <button
              key={m.value}
              type="button"
              aria-pressed={method === m.value}
              onClick={() => { setMethod(m.value); }}
              className={`flex-1 py-2 px-4 rounded-control border font-medium transition-colors ${
                method === m.value
                  ? 'bg-brand-subtle border-brand text-brand'
                  : 'bg-surface border-line text-body hover:bg-surface-sunken'
              }`}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
};

export default SettleBalanceModal;
