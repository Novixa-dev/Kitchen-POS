import React, { useEffect, useState } from 'react';
import { Customer, CustomerHistory } from '../../../types/models';
import { api } from '../../../lib/ipc';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  customer: Customer;
}

const CustomerHistoryModal: React.FC<Props> = ({ customer }) => {
  const { t, formatCurrency, formatNumber, formatDateTime } = useI18n();

  // `null` until the first fetch resolves.
  const [history, setHistory] = useState<CustomerHistory[] | null>(null);

  useEffect(() => {
    let active = true;
    api.customers.getHistory(customer.id)
      .then(res => {
        if (!active) { return; }
        setHistory(res.success && res.data ? res.data : []);
      })
      .catch(() => { if (active) { setHistory([]); } });
    return () => { active = false; };
  }, [customer.id]);

  return (
    <div className="flex flex-col max-h-[70vh]">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-body">{customer.name}</h3>
        <p className="text-sm text-subtle">
          {customer.phone ?? t('customers.noPhone')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pe-2">
        {history === null && (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
          </div>
        )}

        {history?.length === 0 && (
          <div className="text-center py-8 text-subtle bg-surface-muted rounded-card border border-dashed border-line">
            {t('customers.noPastOrders')}
          </div>
        )}

        {history?.map(visit => (
          <div key={visit.orderId} className="border border-line rounded-card overflow-hidden bg-surface-raised shadow-card">
            <div className="bg-surface-muted px-4 py-3 border-b border-line flex justify-between items-center gap-3 flex-wrap">
              <div className="min-w-0">
                <span className="font-bold text-body tabular">{visit.billNumber}</span>
                <span className="text-sm text-subtle ms-3">
                  {formatDateTime(visit.date)}
                </span>
              </div>
              <div className="font-bold text-lg text-body tabular">
                {formatCurrency(visit.totalAmount)}
              </div>
            </div>

            <div className="p-4">
              <ul className="space-y-1">
                {visit.items.map((item, idx) => (
                  <li key={`${visit.orderId}-${idx}`} className="flex justify-between gap-4 text-sm">
                    <span className="text-body">{item.name}</span>
                    <span className="text-subtle font-medium tabular">×{formatNumber(item.qty)}</span>
                  </li>
                ))}
                {visit.items.length === 0 && (
                  <li className="text-sm text-subtle">{t('customers.noItems')}</li>
                )}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerHistoryModal;
