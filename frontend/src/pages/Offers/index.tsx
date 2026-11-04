import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/atoms';
import { Card } from '../../components/atoms/card';
import { SvgIcon } from '../../components/atoms/svg-sprite-loader';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/useI18n';
import { useCan } from '../../auth';
import { api, type LoyaltyRuleRow, type PromotionRow } from '../../lib/ipc';
import LoyaltyModal from './components/LoyaltyModal';
import PromotionModal from './components/PromotionModal';
import {
  BACKEND_PROBLEM_KEY,
  NOT_LIVE_KEY,
  toLoyaltyDraft,
  toPromotionDraft,
  type LoyaltyDraft,
  type PromotionDraft,
} from './rules';

type Tab = 'promotions' | 'loyalty';

interface MenuOption { id: number; name: string }
interface CategoryOption { id: number; name: string }

/**
 * Offers and loyalty.
 *
 * Both lists live on one screen because an owner thinks of them together —
 * "what am I giving away, and to whom" — and because a loyalty reward is
 * paid out as a discount, so the two are the same money.
 *
 * Someone with `promotions.view` but not `promotions.manage` sees the rules
 * read-only. That is deliberate: a cashier needs to know what offers exist
 * to answer a customer, without being able to write new ones.
 */
const OffersPage: React.FC = () => {
  const { t, formatCurrency, formatPercent, formatNumber, locale } = useI18n();
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const canManage = useCan('promotions.manage');

  const [tab, setTab] = useState<Tab>('promotions');
  const [promotions, setPromotions] = useState<PromotionRow[] | null>(null);
  const [rules, setRules] = useState<LoyaltyRuleRow[] | null>(null);
  const [items, setItems] = useState<MenuOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const load = useCallback(() => {
    return Promise.all([
      api.promotions.list(),
      api.loyalty.listRules(),
      api.menu.getAll(),
    ]).then(([promoRes, ruleRes, menuRes]) => {
      if (promoRes.success && promoRes.data) { setPromotions(promoRes.data); }
      if (ruleRes.success && ruleRes.data) { setRules(ruleRes.data); }

      if (menuRes.success && menuRes.data) {
        const cats = menuRes.data;
        setCategories(cats.map(c => ({ id: c.id, name: c.name })));
        setItems(cats.flatMap(c => c.items.map(i => ({ id: i.id, name: i.name }))));
      }
    });
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  /** The name in the reader's own language, falling back to the other. */
  const nameOf = useCallback(
    (row: { name_ar: string; name_en: string }) =>
      (locale === 'ar' ? row.name_ar : row.name_en) || row.name_en || row.name_ar,
    [locale],
  );

  /** A refusal from the main process, in the reader's language. */
  const refusalMessage = useCallback((code?: string): string => {
    const key = code ? BACKEND_PROBLEM_KEY[code] : undefined;
    return key ? t(key as 'offers.error.nameRequired') : t('toast.unexpectedError');
  }, [t]);

  const openPromotion = (initial?: PromotionDraft) => {
    showModal({
      title: initial ? t('offers.edit') : t('offers.new'),
      size: 'xl',
      content: (
        <PromotionModal
          initial={initial}
          items={items}
          categories={categories}
          onCancel={hideModal}
          onSave={async (payload) => {
            const res = await api.promotions.upsert(payload);
            if (!res.success) {
              // The main process validates independently and answers with its
              // own codes, so a refusal the form missed is translated through
              // the map rather than shown as a raw code.
              showToast({ message: refusalMessage(res.error), variant: 'error' });
              return;
            }
            showToast({ message: t('offers.saved'), variant: 'success' });
            hideModal();
            await load();
          }}
        />
      ),
    });
  };

  const openLoyalty = (initial?: LoyaltyDraft) => {
    showModal({
      title: initial ? t('offers.editLoyalty') : t('offers.newLoyalty'),
      size: 'lg',
      content: (
        <LoyaltyModal
          initial={initial}
          items={items}
          onCancel={hideModal}
          onSave={async (payload) => {
            const res = await api.loyalty.upsertRule(payload);
            if (!res.success) {
              showToast({ message: refusalMessage(res.error), variant: 'error' });
              return;
            }
            showToast({ message: t('offers.savedLoyalty'), variant: 'success' });
            hideModal();
            await load();
          }}
        />
      ),
    });
  };

  const confirmDelete = (onConfirm: () => Promise<void>) => {
    showModal({
      title: t('offers.confirmDelete'),
      content: <p className="text-muted">{t('offers.deactivated')}</p>,
      actions: (
        <>
          <Button variant="ghost" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => { hideModal(); void onConfirm(); }}
          >
            {t('action.delete')}
          </Button>
        </>
      ),
    });
  };

  /** What the offer is worth, in words the owner wrote it in. */
  const valueOf = useCallback((promo: PromotionRow): string => {
    if (promo.kind === 'percent') { return formatPercent(promo.value); }
    if (promo.kind === 'amount') { return formatCurrency(promo.value); }
    return t('offers.kind.free_item');
  }, [formatCurrency, formatPercent, t]);

  const liveCount = useMemo(
    () => (promotions ?? []).filter(p => p.notLiveReason === null).length,
    [promotions],
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-body">{t('offers.title')}</h1>
          <p className="text-sm text-muted mt-1">{t('offers.subtitle')}</p>
        </div>

        {canManage ? (
          <Button
            icon="plus"
            onClick={() => {
              if (tab === 'promotions') { openPromotion(); } else { openLoyalty(); }
            }}
          >
            {tab === 'promotions' ? t('offers.new') : t('offers.newLoyalty')}
          </Button>
        ) : (
          <p className="text-sm text-subtle">{t('offers.readOnly')}</p>
        )}
      </header>

      <div className="flex gap-2 border-b border-line" role="tablist">
        {(['promotions', 'loyalty'] as const).map(id => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => { setTab(id); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted hover:text-body'
            }`}
          >
            {t(id === 'promotions' ? 'offers.tab.promotions' : 'offers.tab.loyalty')}
          </button>
        ))}
      </div>

      {tab === 'promotions' && (
        <section className="space-y-3">
          {promotions !== null && promotions.length > 0 && (
            <p className="text-sm text-muted tabular">
              {formatNumber(liveCount)} / {formatNumber(promotions.length)} · {t('offers.running')}
            </p>
          )}

          {promotions?.length === 0 && (
            <Card className="p-8 text-center text-muted">{t('offers.empty')}</Card>
          )}

          {(promotions ?? []).map(promo => (
            <Card key={promo.id} className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-body truncate">{nameOf(promo)}</h2>
                  {promo.code && (
                    <code className="text-xs bg-surface-muted border border-line rounded px-1.5 py-0.5">
                      {promo.code}
                    </code>
                  )}
                  {promo.stackable === 1 && (
                    <SvgIcon name="copy" className="w-4 h-4 text-subtle" aria-label={t('offers.stackable')} />
                  )}
                </div>

                <p className="text-sm text-muted mt-1">
                  <span className="tabular font-medium">{valueOf(promo)}</span>
                  {' · '}
                  {t(promo.scope === 'bill' ? 'offers.scope.bill' : 'offers.scope.item')}
                  {promo.usage_limit !== null && (
                    <>
                      {' · '}
                      <span className="tabular">
                        {t('offers.usedCount', { count: formatNumber(promo.used_count) })}
                        {' '}
                        {t('offers.limitOf', { limit: formatNumber(promo.usage_limit) })}
                      </span>
                    </>
                  )}
                </p>

                <p className="text-xs mt-1">
                  {promo.notLiveReason === null ? (
                    <span className="text-success">{t('offers.running')}</span>
                  ) : (
                    <span className="text-warning">
                      {t('offers.notRunning')}
                      {' — '}
                      {t((NOT_LIVE_KEY[promo.notLiveReason] ?? 'offers.notLive.inactive') as 'offers.notLive.inactive')}
                    </span>
                  )}
                </p>
              </div>

              {canManage && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    icon="edit"
                    aria-label={t('offers.edit')}
                    onClick={() => { openPromotion(toPromotionDraft(promo)); }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    icon="trash"
                    aria-label={t('action.delete')}
                    onClick={() => {
                      confirmDelete(async () => {
                        const res = await api.promotions.delete({ id: promo.id });
                        if (!res.success) {
                          showToast({ message: res.error ?? t('toast.unexpectedError'), variant: 'error' });
                          return;
                        }
                        showToast({
                          message: res.data?.deactivated ? t('offers.deactivated') : t('offers.deleted'),
                          variant: 'success',
                        });
                        await load();
                      });
                    }}
                  />
                </div>
              )}
            </Card>
          ))}
        </section>
      )}

      {tab === 'loyalty' && (
        <section className="space-y-3">
          {rules?.length === 0 && (
            <Card className="p-8 text-center text-muted">{t('offers.emptyLoyalty')}</Card>
          )}

          {(rules ?? []).map(rule => (
            <Card key={rule.id} className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-body truncate">{nameOf(rule)}</h2>
                <p className="text-sm text-muted mt-1 tabular">
                  {t(rule.basis === 'visits' ? 'offers.basis.visits' : 'offers.basis.spend')}
                  {' ≥ '}
                  {rule.basis === 'visits'
                    ? formatNumber(rule.threshold)
                    : formatCurrency(rule.threshold)}
                  {rule.window_days !== null && (
                    <> {' · '} {t('offers.windowDays')} {formatNumber(rule.window_days)}</>
                  )}
                  {' → '}
                  {rule.reward_kind === 'percent' && formatPercent(rule.reward_value)}
                  {rule.reward_kind === 'amount' && formatCurrency(rule.reward_value)}
                  {rule.reward_kind === 'free_item' && t('offers.kind.free_item')}
                </p>
                {rule.is_active === 0 && (
                  <p className="text-xs text-warning mt-1">{t('offers.notLive.inactive')}</p>
                )}
              </div>

              {canManage && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    icon="edit"
                    aria-label={t('offers.editLoyalty')}
                    onClick={() => { openLoyalty(toLoyaltyDraft(rule)); }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    icon="trash"
                    aria-label={t('action.delete')}
                    onClick={() => {
                      confirmDelete(async () => {
                        const res = await api.loyalty.deleteRule({ id: rule.id });
                        if (!res.success) {
                          showToast({ message: res.error ?? t('toast.unexpectedError'), variant: 'error' });
                          return;
                        }
                        showToast({
                          message: res.data?.deactivated ? t('offers.deactivated') : t('offers.deleted'),
                          variant: 'success',
                        });
                        await load();
                      });
                    }}
                  />
                </div>
              )}
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};

export default OffersPage;
