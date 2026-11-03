import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Customer } from '../../types/models';
import { api } from '../../lib/ipc';
import { Autosearch, Button } from '../../components/atoms';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import SettleBalanceModal from './components/SettleBalanceModal';
import CustomerHistoryModal from './components/CustomerHistoryModal';
import { useHeader } from '../../contexts/HeaderContext';
import { useI18n } from '../../i18n/useI18n';

const CustomersPage: React.FC = () => {
  const { t, formatCurrency } = useI18n();
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // `null` means the first load has not finished.
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomers = useCallback(() => {
    return api.customers.getAll().then(res => {
      if (res.success && res.data) { setCustomers(res.data); }
    });
  }, []);

  useEffect(() => {
    loadCustomers().catch(console.error);
  }, [loadCustomers]);

  const handleCreate = useCallback(() => { navigate('/customers/new'); }, [navigate]);

  const searchOptions = useMemo(
    () => (customers ?? []).map(c => ({ value: String(c.id), label: c.name })),
    [customers],
  );

  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader(
      t('page.customers'),
      <div className="flex items-center gap-3">
        <div className="w-64">
          <Autosearch
            placeholder={t('customers.searchByName')}
            options={searchOptions}
            value={searchQuery}
            onChange={setSearchQuery}
            onSelectOption={(opt) => { setSearchQuery(opt.label); }}
          />
        </div>
        <Button onClick={handleCreate} variant="primary" icon="plus">
          {t('customers.addNew')}
        </Button>
      </div>,
    );
    return () => { setHeader(null, null); };
  }, [setHeader, handleCreate, searchQuery, searchOptions, t]);

  const handleDelete = (customer: Customer) => {
    showModal({
      title: t('action.delete'),
      content: <p className="text-muted">{t('customers.deleteConfirm', { name: customer.name })}</p>,
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              void api.customers.delete(customer.id).then(async (res) => {
                if (res.success) {
                  showToast({ message: t('customers.deleted'), variant: 'success' });
                  await loadCustomers();
                } else {
                  showToast({ message: res.error ?? t('customers.deleteFailed'), variant: 'error' });
                }
              });
            }}
          >
            {t('action.delete')}
          </Button>
        </>
      ),
    });
  };

  const handleSettleBalance = (customer: Customer) => {
    showModal({
      title: t('customers.settleTitle', { name: customer.name }),
      content: (
        <SettleBalanceModal
          customer={customer}
          onSuccess={() => { hideModal(); void loadCustomers(); }}
        />
      ),
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button type="submit" form="settle-balance-form" variant="primary">
            {t('customers.settleBalance')}
          </Button>
        </>
      ),
    });
  };

  const handleViewHistory = (customer: Customer) => {
    showModal({
      title: t('customers.historyFor', { name: customer.name }),
      content: <CustomerHistoryModal customer={customer} />,
      actions: <Button variant="outline" onClick={hideModal}>{t('action.close')}</Button>,
    });
  };

  const filteredCustomers = useMemo(() => {
    const all = customers ?? [];
    const needle = searchQuery.trim().toLocaleLowerCase();
    if (!needle) { return all; }
    return all.filter(c =>
      c.name.toLocaleLowerCase().includes(needle) ||
      (c.email?.toLocaleLowerCase().includes(needle) ?? false) ||
      (c.phone?.includes(searchQuery.trim()) ?? false),
    );
  }, [customers, searchQuery]);

  return (
    <div className="p-6">
      <div className="bg-surface-raised rounded-card border border-line shadow-card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-muted border-b border-line">
              <th className="p-4 font-semibold text-muted text-start">{t('label.name')}</th>
              <th className="p-4 font-semibold text-muted text-start">{t('label.phone')}</th>
              <th className="p-4 font-semibold text-muted text-end">{t('customers.creditLimit')}</th>
              <th className="p-4 font-semibold text-muted text-end">{t('customers.outstanding')}</th>
              <th className="p-4 font-semibold text-muted text-end">{t('label.actions')}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {customers === null && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-subtle">{t('state.loading')}</td>
              </tr>
            )}

            {customers !== null && filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-subtle">
                  {t(customers.length === 0 ? 'customers.emptyHint' : 'customers.noResults')}
                </td>
              </tr>
            )}

            {filteredCustomers.map(c => (
              <tr key={c.id} className="hover:bg-surface-sunken transition-colors">
                <td className="p-4">
                  <div className="font-medium text-body">{c.name}</div>
                  <div className="text-sm text-subtle">{c.email ?? t('customers.noEmail')}</div>
                </td>

                <td className="p-4 text-body tabular">{c.phone ?? '—'}</td>

                <td className="p-4 text-end text-body tabular">{formatCurrency(c.credit_limit)}</td>

                <td className="p-4 text-end">
                  <span
                    className={`tabular ${c.outstanding_balance > 0 ? 'text-danger font-bold' : 'text-success'}`}
                  >
                    {formatCurrency(c.outstanding_balance)}
                  </span>
                </td>

                <td className="p-4 text-end">
                  <div className="flex gap-2 justify-end flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => { handleViewHistory(c); }}>
                      {t('customers.history')}
                    </Button>
                    {c.outstanding_balance > 0 && (
                      <Button variant="outline" size="sm" onClick={() => { handleSettleBalance(c); }}>
                        {t('customers.settleBalance')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { navigate(`/customers/${c.id}`); }}
                    >
                      {t('action.edit')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => { handleDelete(c); }}>
                      {t('action.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomersPage;
