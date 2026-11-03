import { Button, Input, Stepper } from '../../../components/atoms';
import React, { useState } from 'react';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';
import { useI18n } from '../../../i18n/useI18n';
import type { TranslationKey } from '../../../i18n/types';

import { CartItem } from '../../../types/models';

interface Props {
  unsentItems: CartItem[];
  sentKOTs: { kotNumber: number; items: CartItem[] }[];
  onUpdateQty: (id: number, delta: number) => void;
  onUpdateNote: (id: number, note: string) => void;
  onCancelItem: (orderItemId: number) => void;
  onSendKOT: (print: boolean) => void;
  onGenerateBill: () => void;
  onVoidOrder: () => void;
}

const STATUS_LABEL: Partial<Record<string, TranslationKey>> = {
  pending: 'kds.status.pending',
  preparing: 'kds.status.preparing',
  ready: 'kds.status.ready',
  served: 'kds.status.served',
};

const CartPanel: React.FC<Props> = ({
  unsentItems,
  sentKOTs,
  onUpdateQty,
  onUpdateNote,
  onCancelItem,
  onSendKOT,
  onGenerateBill,
  onVoidOrder,
}) => {
  const { t, tPlural, formatCurrency, formatNumber } = useI18n();
  const [expandedKOTs, setExpandedKOTs] = useState<number[]>([]);

  const toggleKOT = (num: number) => {
    setExpandedKOTs(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const allSentItems = sentKOTs.flatMap(k => k.items);
  const subtotal = [...unsentItems, ...allSentItems].reduce((s, i) => s + i.price * i.qty, 0);
  const hasAnything = sentKOTs.length > 0 || unsentItems.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-4 pe-2">

        {/* Tickets already sent to the kitchen, newest first. Collapsed by
            default — during service the cashier cares about what is *unsent*. */}
        {sentKOTs.map(kot => {
          const isOpen = expandedKOTs.includes(kot.kotNumber);
          const count = kot.items.reduce((s, i) => s + i.qty, 0);

          return (
            <div key={kot.kotNumber} className="border border-line rounded-control overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 bg-surface-sunken hover:bg-surface-muted transition-colors"
                onClick={() => { toggleKOT(kot.kotNumber); }}
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-body">
                    {t('order.kotLabel', { number: formatNumber(kot.kotNumber) })}
                  </span>
                  <span className="text-xs text-subtle font-medium">
                    {tPlural('order.itemCount', count)}
                  </span>
                </div>
                <SvgIcon
                  name="caret-down"
                  width="16"
                  height="16"
                  className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="p-3 bg-surface divide-y divide-line">
                  {kot.items.map(item => {
                    const orderItemId = item.orderItemId;
                    return (
                    <div
                      key={orderItemId ?? item.id}
                      className="py-2 flex justify-between items-start gap-2 first:pt-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-body">
                            <span className="tabular">{formatNumber(item.qty)}×</span> {item.name}
                          </span>
                          {item.status && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-surface-sunken text-muted rounded font-bold">
                              {(() => {
                                const key = STATUS_LABEL[item.status];
                                return key ? t(key) : item.status;
                              })()}
                            </span>
                          )}
                        </div>
                        {item.note && <p className="text-xs text-subtle mt-0.5">{item.note}</p>}
                      </div>

                      <div className="flex flex-col items-end ps-2 shrink-0">
                        <span className="text-sm font-bold text-body tabular">
                          {formatCurrency(item.price * item.qty)}
                        </span>
                        {orderItemId !== undefined && (
                          <button
                            type="button"
                            onClick={() => { onCancelItem(orderItemId); }}
                            className="text-danger hover:underline text-xs mt-1 font-medium flex items-center gap-1"
                            title={t('order.voidItem')}
                          >
                            <SvgIcon name="trash" width="12" height="12" />
                            {t('order.void')}
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Items still in the cart. Highlighted, because these are the ones
            that have not reached the kitchen yet. */}
        {unsentItems.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-subtle uppercase tracking-wider mb-2">
              {t('order.unsentItems')}
            </h3>
            <div className="space-y-2">
              {unsentItems.map(item => (
                <div key={item.id} className="border border-brand/30 rounded-control p-3 bg-brand-subtle">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-medium text-body">{item.name}</h4>
                    <p className="font-bold text-body shrink-0 tabular">
                      {formatCurrency(item.price * item.qty)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Stepper
                      value={item.qty}
                      onChange={(newQty) => { onUpdateQty(item.id, newQty - item.qty); }}
                      min={0}
                    />
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder={t('order.addNote')}
                        value={item.note}
                        onChange={(e) => { onUpdateNote(item.id, e.target.value); }}
                        className="bg-surface"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasAnything && (
          <div className="flex flex-col items-center justify-center h-full text-subtle gap-2">
            <SvgIcon name="cart" width="32" height="32" aria-hidden />
            <p className="text-sm text-center">{t('order.cartEmpty')}</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-line">
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-muted font-medium">{t('label.total')}</span>
          <span className="text-xl font-bold tabular">{formatCurrency(subtotal)}</span>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" block onClick={() => { onSendKOT(false); }} disabled={unsentItems.length === 0}>
              {t('order.saveKot')}
            </Button>
            <Button variant="secondary" block onClick={() => { onSendKOT(true); }} disabled={unsentItems.length === 0}>
              {t('order.printKot')}
            </Button>
          </div>

          <Button variant="primary" block onClick={onGenerateBill} disabled={sentKOTs.length === 0}>
            {t('order.generateBill')}
          </Button>

          <Button variant="outline" block className="text-danger border-danger hover:bg-danger-subtle" onClick={onVoidOrder} disabled={!hasAnything}>
            {t('order.voidOrder')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CartPanel;
