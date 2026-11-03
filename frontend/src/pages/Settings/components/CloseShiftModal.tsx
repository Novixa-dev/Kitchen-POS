import { Input, Textarea } from '../../../components/atoms';
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/auth';
import { api } from '../../../lib/ipc';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';
import type { TranslationKey } from '../../../i18n/types';

interface PaymentTotals {
  cash: number;
  card: number;
  upi: number;
  complimentary: number;
}

interface Props {
  onSuccess: () => void;
}

const BREAKDOWN: [keyof PaymentTotals, TranslationKey][] = [
  ['cash', 'shift.cashSales'],
  ['card', 'shift.cardSales'],
  ['upi', 'shift.upiSales'],
  ['complimentary', 'shift.complimentary'],
];

const CloseShiftModal: React.FC<Props> = ({ onSuccess }) => {
  const { t, formatCurrency } = useI18n();
  const { showToast } = useToast();

  const activeShift = useAuthStore(state => state.activeShift);
  const closeShift = useAuthStore(state => state.closeShift);
  const logout = useAuthStore(state => state.logout);

  // `null` until the totals arrive.
  const [totals, setTotals] = useState<PaymentTotals | null>(null);
  const [closingCash, setClosingCash] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openedAt = activeShift?.opened_at;

  useEffect(() => {
    if (!openedAt) { return; }

    let active = true;
    api.shifts.getTotals({ openedAt })
      .then(res => {
        if (!active) { return; }
        if (res.success && res.data) {
          setTotals(res.data);
        } else {
          showToast({ message: res.error ?? t('shift.totalsFailed'), variant: 'error' });
          setTotals({ cash: 0, card: 0, upi: 0, complimentary: 0 });
        }
      })
      .catch(() => {
        if (active) {
          showToast({ message: t('shift.totalsFailed'), variant: 'error' });
          setTotals({ cash: 0, card: 0, upi: 0, complimentary: 0 });
        }
      });

    return () => { active = false; };
  }, [openedAt, showToast, t]);

  if (!activeShift) { return null; }

  const expectedCash = activeShift.opening_cash + (totals?.cash ?? 0);
  const totalNonCash = (totals?.card ?? 0) + (totals?.upi ?? 0) + (totals?.complimentary ?? 0);
  const countedCash = typeof closingCash === 'number' ? closingCash : 0;
  const discrepancy = countedCash - expectedCash;

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (closingCash === '' || closingCash < 0) {
      showToast({ message: t('shift.enterCountedCash'), variant: 'error' });
      return;
    }

    // A discrepancy is recorded on the shift note automatically, so the
    // reconciliation is auditable even if the operator leaves the note blank.
    let finalNote = note.trim();
    if (discrepancy !== 0) {
      const marker = `[${t('shift.discrepancyOf', { amount: formatCurrency(discrepancy) })}]`;
      finalNote = finalNote ? `${marker} ${finalNote}` : marker;
    }

    setSubmitting(true);
    closeShift(countedCash, finalNote)
      .then(success => {
        if (success) {
          showToast({ message: t('shift.closed'), variant: 'success' });
          onSuccess();
          // Closing the register ends the session; the next shift signs in.
          logout();
        } else {
          showToast({ message: t('shift.closeFailed'), variant: 'error' });
        }
      })
      .catch(() => {
        showToast({ message: t('shift.closeFailed'), variant: 'error' });
      })
      .finally(() => { setSubmitting(false); });
  };

  if (totals === null) {
    return (
      <div className="p-12 text-center text-subtle">
        <div className="w-8 h-8 border-4 border-danger border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        {t('shift.calculating')}
      </div>
    );
  }

  return (
    <>
      <p className="text-subtle text-sm mb-4">{t('shift.reconcileHint')}</p>

      <form id="close-shift-form" onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-muted p-3.5 border border-line rounded-card">
            <span className="text-xs text-subtle font-bold block uppercase tracking-wide">
              {t('shift.startingCash')}
            </span>
            <span className="text-lg font-bold text-body tabular">
              {formatCurrency(activeShift.opening_cash)}
            </span>
          </div>
          <div className="bg-surface-muted p-3.5 border border-line rounded-card">
            <span className="text-xs text-subtle font-bold block uppercase tracking-wide">
              {t('shift.expectedCash')}
            </span>
            <span className="text-lg font-bold text-body tabular">
              {formatCurrency(expectedCash)}
            </span>
          </div>
        </div>

        <div className="border border-line rounded-card overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-muted border-b border-line text-subtle font-bold">
                <th className="py-2.5 px-3 text-start">{t('billing.paymentMethod')}</th>
                <th className="py-2.5 px-3 text-end">{t('label.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-body">
              {BREAKDOWN.map(([key, labelKey]) => (
                <tr key={key}>
                  <td className="py-2 px-3">{t(labelKey)}</td>
                  <td className="py-2 px-3 text-end tabular">{formatCurrency(totals[key])}</td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-bold">
                <td className="py-2.5 px-3">{t('shift.totalNonCash')}</td>
                <td className="py-2.5 px-3 text-end tabular">{formatCurrency(totalNonCash)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <Input
            label={t('shift.countedCash')}
            type="number"
            min="0"
            step="0.01"
            required
            autoFocus
            value={closingCash}
            onChange={e => { setClosingCash(e.target.value === '' ? '' : Number(e.target.value)); }}
            className="text-lg font-bold"
            placeholder={t('shift.countedCashPlaceholder')}
          />
          {closingCash !== '' && (
            <p className={`text-xs font-semibold mt-1.5 ${discrepancy === 0 ? 'text-success' : 'text-warning'}`}>
              {discrepancy === 0
                ? t('shift.matchesExpected')
                : t('shift.discrepancyOf', { amount: formatCurrency(discrepancy) })}
            </p>
          )}
        </div>

        <Textarea
          label={t('shift.notes')}
          value={note}
          onChange={e => { setNote(e.target.value); }}
          className="text-sm"
          placeholder={t('shift.notesPlaceholder')}
          rows={2}
          disabled={submitting}
        />
      </form>
    </>
  );
};

export default CloseShiftModal;
