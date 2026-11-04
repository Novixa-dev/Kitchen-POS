import { Button, Input, Select, Toggle } from '../../../components/atoms';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { api, type BillPreview } from '../../../lib/ipc';
import { useFeature } from '../../../features';
import { REJECTION_KEY } from '../../Offers/rules';
import { CartItem, Customer } from '../../../types/models';
import { useToast } from '../../../hooks/useToast';
import { CustomerSelect } from '../../../components/organisms/CustomerSelect';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  orderId: number;
  cart: CartItem[];
  initialCustomer?: Customer | null;
  onClose: () => void;
}

export interface BillModalHandle {
  save: () => void;
  print: () => void;
}

interface PaymentRow {
  method: string;
  amount: number;
}

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'wallet', 'complimentary', 'unpaid'] as const;

const METHOD_LABEL = {
  cash: 'billing.method.cash',
  card: 'billing.method.card',
  upi: 'billing.method.upi',
  wallet: 'billing.method.wallet',
  complimentary: 'billing.method.complimentary',
  unpaid: 'billing.method.credit',
} as const;

const QUICK_DISCOUNTS = [5, 10, 15, 20, 25, 30];

/** Payments are compared against the total in minor units, not exactly. */
const BALANCE_EPSILON = 0.005;

const BillModal = forwardRef<BillModalHandle, Props>(
  ({ orderId, cart, initialCustomer, onClose }, ref) => {
    const { t, formatCurrency, formatPercent, locale } = useI18n();
    const { showToast } = useToast();
    // Each panel appears only when its module is on, so an outlet that does
    // not run offers sees the dialog it had before.
    const offersActive = useFeature('discounts');
    const couponsActive = useFeature('coupons');
    const loyaltyActive = useFeature('loyalty');

    const [discount, setDiscount] = useState(0);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer ?? null);
    /** Codes the customer presented. Pricing them is the main process's job. */
    const [couponCodes, setCouponCodes] = useState<string[]>([]);
    const [codeDraft, setCodeDraft] = useState('');
    const [useLoyalty, setUseLoyalty] = useState(false);
    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [preview, setPreview] = useState<BillPreview | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Totals come from the main process, which uses the same engine that
     * writes the bill. The renderer deliberately does not compute tax: the
     * previous version hardcoded a 2.5% + 2.5% GST split here, so the total
     * shown to the cashier could differ from the bill that was saved.
     */
    useEffect(() => {
      let active = true;
      void api.billing.preview({
        orderId,
        discount,
        customerId: selectedCustomer?.id,
        couponCodes,
        useLoyalty,
      }).then((res) => {
        if (!active || !res.success || !res.data) { return; }
        setPreview(res.data);
      }).catch(console.error);
      return () => { active = false; };
    }, [orderId, discount, selectedCustomer?.id, couponCodes, useLoyalty]);

    const grandTotal = preview?.totals.total_amount ?? 0;

    // Seed a single cash payment for the full amount — the common case — and
    // re-seed whenever the total moves.
    useEffect(() => {
      setPayments([{ method: 'cash', amount: grandTotal }]);
    }, [grandTotal]);

    const tendered = useMemo(
      () => payments.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0),
      [payments],
    );

    const outstanding = grandTotal - tendered;
    const isBalanced = Math.abs(outstanding) < BALANCE_EPSILON;

    const updatePayment = (index: number, patch: Partial<PaymentRow>) => {
      setPayments(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    };

    /**
     * Add a code and let the preview price it.
     *
     * The dialog does not ask whether the code is valid first: the preview is
     * the authority, and a second round trip could disagree with it. An
     * unusable code comes back in `rejected` with the reason.
     */
    const applyCode = () => {
      const code = codeDraft.trim().toUpperCase();
      if (code === '') { return; }
      setCouponCodes(prev => (prev.includes(code) ? prev : [...prev, code]));
      setCodeDraft('');
    };

    /** An offer's name in the reader's language, falling back to the other. */
    const offerName = (offer: { nameAr: string; nameEn: string }) =>
      (locale === 'ar' ? offer.nameAr : offer.nameEn) || offer.nameEn || offer.nameAr;

    const handleConfirm = useCallback(async (shouldPrint: boolean) => {
      if (isSubmitting) { return; }

      if (!preview) { return; }

      if (!isBalanced) {
        showToast({ message: t('billing.mustBalance'), variant: 'warning' });
        return;
      }

      const onAccount = payments
        .filter(p => p.method === 'unpaid')
        .reduce((sum, p) => sum + p.amount, 0);

      if (onAccount > 0) {
        if (!selectedCustomer) {
          showToast({ message: t('billing.customerRequiredForCredit'), variant: 'warning' });
          return;
        }
        if (selectedCustomer.outstanding_balance + onAccount > selectedCustomer.credit_limit) {
          showToast({ message: t('billing.creditLimitExceeded'), variant: 'error' });
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const res = await api.billing.createBill({
          orderId,
          payments,
          discount,
          customerId: selectedCustomer?.id,
          // Ids and codes only: the amounts are recomputed in the main
          // process from the same rules the preview used.
          couponCodes,
          useLoyalty,
        });

        if (!res.success || !res.data) {
          showToast({ message: res.error ?? t('billing.generateFailed'), variant: 'error' });
          return;
        }

        if (shouldPrint) {
          const printRes = await api.print.bill({
            bill: res.data,
            orderItems: cart.map(i => ({ name: i.name, qty: i.qty, unit_price: i.price })),
            payments,
          });
          if (!printRes.success) {
            showToast({
              message: t('print.failed', { error: printRes.error ?? '' }),
              variant: 'error',
            });
          }
        }

        showToast({ message: t('billing.generated'), variant: 'success' });
        onClose();
      } catch (e) {
        console.error(e);
        showToast({ message: t('toast.unexpectedError'), variant: 'error' });
      } finally {
        setIsSubmitting(false);
      }
    }, [
      isSubmitting, preview, isBalanced, payments, selectedCustomer,
      orderId, discount, couponCodes, useLoyalty, cart, onClose, showToast, t,
    ]);

    useImperativeHandle(ref, () => ({
      save: () => { void handleConfirm(false); },
      print: () => { void handleConfirm(true); },
    }), [handleConfirm]);

    const taxMode = preview?.tax.mode ?? 'none';
    const taxRate = preview?.tax.rate ?? 0;
    const promotionDiscount = preview?.promotionDiscount ?? 0;

    return (
      <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-8">

        {/* Itemised breakdown */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-body border-b border-line pb-2 mb-4">
            {t('billing.itemisedBreakdown')}
          </h3>

          <div className="space-y-3 mb-6">
            {(preview?.lines ?? []).map(line => (
              <div key={line.id} className="flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-body truncate">
                    {line.name} <span className="tabular">×{line.qty}</span>
                  </p>
                  {taxMode === 'gst' && (
                    <p className="text-xs text-subtle tabular">
                      {t('tax.cgst')}: {formatCurrency(line.cgst_amount, { showSymbol: false })}
                      {' · '}
                      {t('tax.sgst')}: {formatCurrency(line.sgst_amount, { showSymbol: false })}
                    </p>
                  )}
                  {taxMode === 'vat' && line.tax_amount > 0 && (
                    <p className="text-xs text-subtle tabular">
                      {t('tax.vat')}: {formatCurrency(line.tax_amount, { showSymbol: false })}
                    </p>
                  )}
                </div>
                <p className="font-medium text-body shrink-0 tabular">
                  {formatCurrency(line.total_amount)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-line pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{t('billing.taxable')}</span>
              <span className="tabular">{formatCurrency(preview?.totals.taxable_amount ?? 0)}</span>
            </div>

            {offersActive && (
              <div className="border border-line rounded-control p-3 my-2 space-y-2 bg-surface-muted">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                  {t('billing.offers')}
                </p>

                {(preview?.offers ?? []).map(offer => (
                  <div key={offer.promotionId} className="flex justify-between gap-2 text-sm">
                    <span className="text-body truncate">
                      {offerName(offer)}
                      {offer.freeItemId !== null && (
                        <span className="text-xs text-subtle"> · {t('billing.giftIncluded')}</span>
                      )}
                    </span>
                    <span className="tabular text-success shrink-0">
                      {offer.amount > 0 ? `− ${formatCurrency(offer.amount)}` : '—'}
                    </span>
                  </div>
                ))}

                {(preview?.rewards ?? []).map(reward => (
                  <div key={`reward-${reward.ruleId}`} className="flex justify-between gap-2 text-sm">
                    <span className="text-body truncate">
                      {t('billing.loyaltyEarned', { name: offerName(reward) })}
                    </span>
                    <span className="tabular text-success shrink-0">
                      {reward.amount > 0 ? `− ${formatCurrency(reward.amount)}` : '—'}
                    </span>
                  </div>
                ))}

                {(preview?.suppressed ?? []).map(s => (
                  <p key={`sup-${s.promotionId}`} className="text-xs text-subtle">
                    {t('billing.offerSuppressed', { name: offerName(s) })}
                  </p>
                ))}

                {/* Only once a code was actually typed: an automatic offer
                    that did not apply is not the cashier's problem. */}
                {couponCodes.length > 0 && (preview?.rejected ?? []).map(r => (
                  <p key={`rej-${r.promotionId}`} className="text-xs text-warning">
                    {t('billing.couponRefused', {
                      reason: t((REJECTION_KEY[r.reason] ?? 'offers.rejected.noValue') as 'offers.rejected.noValue'),
                    })}
                  </p>
                ))}

                {couponsActive && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={codeDraft}
                      onChange={e => { setCodeDraft(e.target.value.toUpperCase()); }}
                      placeholder={t('billing.couponCode')}
                      aria-label={t('billing.couponCode')}
                      onKeyDown={e => { if (e.key === 'Enter') { applyCode(); } }}
                    />
                    <Button type="button" variant="outline" onClick={applyCode}>
                      {t('billing.applyCoupon')}
                    </Button>
                  </div>
                )}

                {couponCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {couponCodes.map(code => (
                      <Button
                        key={code}
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => { setCouponCodes(prev => prev.filter(c => c !== code)); }}
                        className="!rounded-full !px-2 !text-xs border border-line"
                      >
                        {code} ✕
                      </Button>
                    ))}
                  </div>
                )}

                {loyaltyActive && selectedCustomer && (
                  <Toggle
                    checked={useLoyalty}
                    onChange={e => { setUseLoyalty(e.target.checked); }}
                    label={t('billing.useLoyalty')}
                  />
                )}

                {promotionDiscount > 0 && (
                  <div className="flex justify-between text-sm font-medium border-t border-line pt-2">
                    <span>{t('billing.offerDiscount')}</span>
                    <span className="tabular text-success">− {formatCurrency(promotionDiscount)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1 my-1">
              <div className="flex justify-between items-center gap-3 mt-2">
                <label htmlFor="bill-discount" className="text-muted">
                  {offersActive ? t('billing.manualDiscount') : t('label.discount')}
                </label>
                <div className="w-28">
                  <Input
                    id="bill-discount"
                    type="number"
                    className="text-end"
                    value={discount === 0 ? '' : discount}
                    onChange={e => { setDiscount(Math.max(0, Number(e.target.value) || 0)); }}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div
                className="flex flex-wrap justify-end gap-1.5 mt-1"
                aria-label={t('billing.quickDiscount')}
              >
                {QUICK_DISCOUNTS.map(pct => (
                  <Button
                    key={pct}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Percentages apply to the taxable base, matching how
                      // the backend applies a bill-level discount.
                      const base = preview?.totals.taxable_amount ?? 0;
                      setDiscount(Math.round(base * pct) / 100);
                    }}
                    className="!rounded-full !px-2 !py-0.5 !text-xs"
                  >
                    {formatPercent(pct)}
                  </Button>
                ))}
              </div>
            </div>

            {taxMode === 'gst' && (
              <>
                <div className="flex justify-between text-muted">
                  <span>{t('tax.cgst')}</span>
                  <span className="tabular">{formatCurrency(preview?.totals.cgst_amount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>{t('tax.sgst')}</span>
                  <span className="tabular">{formatCurrency(preview?.totals.sgst_amount ?? 0)}</span>
                </div>
              </>
            )}

            {taxMode === 'vat' && (
              <div className="flex justify-between text-muted">
                <span>{t('tax.vat')} {taxRate > 0 ? formatPercent(taxRate) : ''}</span>
                <span className="tabular">{formatCurrency(preview?.totals.tax_amount ?? 0)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-lg pt-2 border-t border-line mt-2">
              <span>{t('label.grandTotal')}</span>
              <span className="tabular">{formatCurrency(grandTotal)}</span>
            </div>

            {preview?.tax.inclusive && taxMode !== 'none' && (
              <p className="text-xs text-subtle text-center">{t('tax.inclusive')}</p>
            )}
          </div>
        </div>

        {/* Payment split */}
        <div className="w-full md:w-72 bg-surface-muted p-4 rounded-card border border-line flex flex-col max-h-[calc(100vh-14rem)] overflow-y-auto">
          <div className="mb-6">
            <h3 className="font-bold text-body mb-2 border-b border-line pb-2">
              {t('customers.title')}
            </h3>
            <CustomerSelect selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} />
          </div>

          <h3 className="font-bold text-body border-b border-line pb-2 mb-4">
            {t('billing.payments')}
          </h3>

          <div className="space-y-3">
            {payments.map((p, i) => (
              <div key={i} className="flex flex-col gap-2 relative border border-line p-2 rounded-control bg-surface">
                {payments.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setPayments(prev => prev.filter((_, idx) => idx !== i)); }}
                    className="absolute top-1 end-1 text-danger h-6 w-6"
                    aria-label={t('action.remove')}
                  >
                    ✕
                  </Button>
                )}

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={p.method}
                      onChange={(e) => { updatePayment(i, { method: e.target.value }); }}
                      aria-label={t('billing.paymentMethod')}
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{t(METHOD_LABEL[m])}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder={t('label.amount')}
                      value={p.amount === 0 ? '' : p.amount}
                      onChange={(e) => { updatePayment(i, { amount: Number(e.target.value) || 0 }); }}
                      min={p.method === 'unpaid' ? undefined : '0'}
                      step="0.01"
                      aria-label={t('label.amount')}
                    />
                    {p.method === 'unpaid' && (
                      <p className="text-[10px] text-subtle mt-1 leading-tight">
                        {t('billing.advanceHint')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              onClick={() => { setPayments(prev => [...prev, { method: 'card', amount: 0 }]); }}
              className="w-full py-2 border-dashed border-2 bg-transparent text-brand hover:bg-brand-subtle"
            >
              + {t('billing.addSplit')}
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-line">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">{t('billing.tendered')}</span>
              <span className={`font-bold tabular ${isBalanced ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(tendered)}
              </span>
            </div>

            {!isBalanced && (
              <p className="text-xs text-danger text-end tabular">
                {outstanding > 0
                  ? `${t('billing.balanceDue')}: ${formatCurrency(outstanding)}`
                  : `${t('billing.changeDue')}: ${formatCurrency(-outstanding)}`}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  },
);

BillModal.displayName = 'BillModal';

export default BillModal;
