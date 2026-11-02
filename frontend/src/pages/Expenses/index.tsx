import { Button, Input } from '../../components/atoms';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/ipc';
import { Expense } from '../../types/models';
import { Card } from '../../components/atoms/card';
import { useAuthStore } from '../../store/auth';
import ExpenseModal from './components/ExpenseModal';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { useHeader } from '../../contexts/HeaderContext';
import { useI18n } from '../../i18n/useI18n';
import { todayLocal } from '../../lib/datetime';
import { expenseCategoryLabel } from './expenseCategories';

const ExpensesPage: React.FC = () => {
  const { t, formatCurrency, formatDate } = useI18n();
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const staff = useAuthStore(state => state.staff);

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [startDate, setStartDate] = useState(todayLocal);
  const [endDate, setEndDate] = useState(todayLocal);

  const fetchExpenses = useCallback(() => {
    return api.expenses.getAll({ start: startDate, end: endDate }).then(res => {
      if (res.success && res.data) { setExpenses(res.data); }
    });
  }, [startDate, endDate]);

  useEffect(() => {
    fetchExpenses().catch(console.error);
  }, [fetchExpenses]);

  const handleSaveExpense = useCallback(async (data: {
    date: string;
    category: string;
    amount: number;
    description: string;
    staff_id?: number;
  }) => {
    const res = await api.expenses.create({ ...data, staff_id: data.staff_id ?? staff?.id });
    if (res.success) {
      showToast({ message: t('expenses.added'), variant: 'success' });
      hideModal();
      await fetchExpenses();
    } else {
      showToast({ message: res.error ?? t('expenses.addFailed'), variant: 'error' });
    }
  }, [staff?.id, showToast, hideModal, fetchExpenses, t]);

  const handleDelete = (id: number) => {
    showModal({
      title: t('expenses.deleteTitle'),
      content: <p className="text-muted">{t('expenses.deleteConfirm')}</p>,
      actions: (
        <>
          <Button variant="ghost" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              void api.expenses.delete({ id }).then(async (res) => {
                if (res.success) {
                  showToast({ message: t('expenses.deleted'), variant: 'success' });
                  await fetchExpenses();
                } else {
                  showToast({ message: res.error ?? t('expenses.deleteFailed'), variant: 'error' });
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

  const openAddModal = useCallback(() => {
    showModal({
      title: t('expenses.addExpense'),
      content: <ExpenseModal onSave={data => { handleSaveExpense(data).catch(console.error); }} />,
      actions: (
        <>
          <Button variant="ghost" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button type="submit" form="expense-form" variant="primary">
            {t('expenses.saveExpense')}
          </Button>
        </>
      ),
    });
  }, [showModal, hideModal, handleSaveExpense, t]);

  const totalAmount = (expenses ?? []).reduce((sum, exp) => sum + exp.amount, 0);

  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader(
      t('page.expenses'),
      <Button variant="primary" icon="plus" onClick={openAddModal}>
        {t('expenses.addExpense')}
      </Button>,
    );
    return () => { setHeader(null, null); };
  }, [setHeader, openAddModal, t]);

  return (
    <div className="container-responsive p-6 mx-auto h-full flex flex-col">

      <Card className="p-4 mb-6 flex flex-wrap gap-4 items-end shrink-0">
        <div className="w-40">
          <Input
            type="date"
            label={t('reports.startDate')}
            value={startDate}
            max={endDate}
            onChange={e => { setStartDate(e.target.value); }}
          />
        </div>
        <div className="w-40">
          <Input
            type="date"
            label={t('reports.endDate')}
            value={endDate}
            min={startDate}
            onChange={e => { setEndDate(e.target.value); }}
          />
        </div>
        <div className="ms-auto bg-brand-subtle px-4 py-2 rounded-card border border-brand/20">
          <p className="text-sm font-medium text-brand">{t('expenses.total')}</p>
          <p className="text-2xl font-bold text-brand tabular">{formatCurrency(totalAmount)}</p>
        </div>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-surface-muted border-b border-line sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted text-start">{t('label.date')}</th>
                <th className="px-6 py-4 font-semibold text-muted text-start">{t('label.category')}</th>
                <th className="px-6 py-4 font-semibold text-muted text-start">{t('label.description')}</th>
                <th className="px-6 py-4 font-semibold text-muted text-end">{t('label.amount')}</th>
                <th className="px-6 py-4 font-semibold text-muted text-end">{t('label.actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {expenses === null && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-subtle">
                    {t('state.loading')}
                  </td>
                </tr>
              )}

              {expenses?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-subtle">
                    {t('expenses.noneInRange')}
                  </td>
                </tr>
              )}

              {expenses?.map((expense) => (
                <tr key={expense.id} className="hover:bg-surface-sunken transition-colors">
                  <td className="px-6 py-4 text-body">{formatDate(`${expense.date}T00:00:00`)}</td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-sunken text-body">
                      {expenseCategoryLabel(expense.category, t)}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-muted whitespace-normal min-w-[200px]">
                    {expense.description ?? '—'}
                    {expense.staff_name && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-brand-subtle text-brand">
                          {t('expenses.linkedTo', { name: expense.staff_name })}
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 text-body font-medium text-end tabular">
                    {formatCurrency(expense.amount)}
                  </td>

                  <td className="px-6 py-4 text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-subtle"
                      onClick={() => { handleDelete(expense.id); }}
                    >
                      {t('action.delete')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ExpensesPage;
