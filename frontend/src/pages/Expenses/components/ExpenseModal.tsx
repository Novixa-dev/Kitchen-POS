import { Input, Select } from '../../../components/atoms';
import React, { useEffect, useState } from 'react';
import { Staff } from '../../../types/models';
import { api } from '../../../lib/ipc';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import { todayLocal } from '../../../lib/datetime';
import {
  EXPENSE_CATEGORIES,
  SALARY_CATEGORY,
  expenseCategoryLabel,
} from '../expenseCategories';
import { staffRoleLabel } from '../../Staff/staffRoles';

export interface ExpenseFormData {
  date: string;
  category: string;
  amount: number;
  description: string;
  staff_id?: number;
}

interface Props {
  onSave: (data: ExpenseFormData) => void;
}

const ExpenseModal: React.FC<Props> = ({ onSave }) => {
  const { t, currency } = useI18n();
  const { showToast } = useToast();

  const [date, setDate] = useState(todayLocal);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [staffId, setStaffId] = useState<number | ''>('');
  const [staffList, setStaffList] = useState<Staff[]>([]);

  useEffect(() => {
    let active = true;
    api.staff.getAll().then(res => {
      if (!active || !res.success || !res.data) { return; }
      setStaffList(res.data.filter(s => s.is_active));
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();

    const numAmount = Number.parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      // Previously this returned silently, so the dialog simply did nothing.
      showToast({ message: t('validation.positiveNumber'), variant: 'warning' });
      return;
    }

    const data: ExpenseFormData = {
      date,
      category,
      amount: numAmount,
      description: description.trim(),
    };
    if (staffId !== '') { data.staff_id = staffId; }

    onSave(data);
  };

  return (
    <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('label.date')}
        type="date"
        value={date}
        max={todayLocal()}
        onChange={e => { setDate(e.target.value); }}
        required
      />

      <Select
        label={t('expenses.expenseCategory')}
        value={category}
        onChange={e => {
          setCategory(e.target.value);
          // The staff link only applies to salary, so drop it otherwise.
          if (e.target.value !== SALARY_CATEGORY) { setStaffId(''); }
        }}
        required
      >
        {EXPENSE_CATEGORIES.map(c => (
          <option key={c} value={c}>{expenseCategoryLabel(c, t)}</option>
        ))}
      </Select>

      {category === SALARY_CATEGORY && (
        <Select
          label={t('expenses.linkToStaff')}
          value={staffId}
          onChange={e => { setStaffId(e.target.value ? Number(e.target.value) : ''); }}
        >
          <option value="">{t('expenses.noStaffLinked')}</option>
          {staffList.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} — {staffRoleLabel(s.role, t)}
            </option>
          ))}
        </Select>
      )}

      <Input
        label={`${t('label.amount')} (${currency.symbol || currency.code})`}
        type="number"
        step="0.01"
        min="0.01"
        value={amount}
        onChange={e => { setAmount(e.target.value); }}
        placeholder={t('expenses.amountPlaceholder')}
        required
      />

      <Input
        label={t('label.description')}
        value={description}
        onChange={e => { setDescription(e.target.value); }}
        placeholder={t('expenses.descriptionPlaceholder')}
      />
    </form>
  );
};

export default ExpenseModal;
