import React, { useEffect, useState } from 'react';
import { Button } from '../../components/atoms';
import { api } from '../../lib/ipc';
import { PastOrderData, PastOrderStats } from '../../types/models';
import { useHeader } from '../../contexts/HeaderContext';
import { useI18n } from '../../i18n/useI18n';
import { useToast } from '../../hooks/useToast';
import type { TranslationKey } from '../../i18n/types';

type FilterType = 'daily' | 'weekly' | 'monthly' | 'yearly';

const FILTERS: { value: FilterType; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'range.daily' },
  { value: 'weekly', labelKey: 'range.weekly' },
  { value: 'monthly', labelKey: 'range.monthly' },
  { value: 'yearly', labelKey: 'range.yearly' },
];

const ORDER_TYPE_LABEL: Record<string, TranslationKey> = {
  'dine-in': 'order.type.dineIn',
  takeaway: 'order.type.takeaway',
  delivery: 'order.type.delivery',
};

const ORDER_TYPE_CHIP: Record<string, string> = {
  'dine-in': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  takeaway: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  delivery: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
};

const PAGE_SIZE = 15;

/** Header key paired with its literal alignment class. */
const COLUMNS: [TranslationKey, string][] = [
  ['label.dateTime', 'text-start'],
  ['pastOrders.businessDate', 'text-start'],
  ['customers.title', 'text-start'],
  ['label.type', 'text-start'],
  ['label.amount', 'text-end'],
  ['pastOrders.occupiedTime', 'text-center'],
  ['pastOrders.details', 'text-center'],
];

const PastOrdersPage: React.FC = () => {
  const { t, formatCurrency, formatNumber, formatDateTime } = useI18n();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<FilterType>('daily');
  const [stats, setStats] = useState<PastOrderStats | null>(null);
  // `null` means the first page has not loaded yet.
  const [orders, setOrders] = useState<PastOrderData[] | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [printingId, setPrintingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    api.reports.getPastOrders({ filter, page: currentPage, limit: PAGE_SIZE })
      .then(res => {
        if (!active || !res.success || !res.data) { return; }
        setStats(res.data.stats);
        setOrders(res.data.orders);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error);

    return () => { active = false; };
  }, [filter, currentPage]);

  /** Occupancy as hh:mm, pinned LTR so it is not mirrored in RTL. */
  const occupiedLabel = (ms: number) => {
    const minutes = Math.max(0, Math.floor(ms / 60_000));
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleReprint = (orderId: number) => {
    setPrintingId(orderId);
    api.reports.printPastBill({ orderId })
      .then(res => {
        if (res.success) {
          showToast({ message: t('print.success'), variant: 'success' });
        } else {
          showToast({ message: t('print.failed', { error: res.error ?? '' }), variant: 'error' });
        }
      })
      .catch(() => {
        showToast({ message: t('print.failed', { error: '' }), variant: 'error' });
      })
      .finally(() => { setPrintingId(null); });
  };

  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader(
      t('page.pastOrders'),
      <div className="flex gap-1 bg-surface-sunken p-1 rounded-control" role="group">
        {FILTERS.map(f => (
          <Button
            key={f.value}
            size="sm"
            variant="ghost"
            aria-pressed={filter === f.value}
            onClick={() => {
              if (filter !== f.value) {
                setFilter(f.value);
                setCurrentPage(1);
                setExpandedRow(null);
              }
            }}
            className={
              filter === f.value
                ? 'bg-surface shadow-card text-brand'
                : 'text-muted hover:text-body'
            }
          >
            {t(f.labelKey)}
          </Button>
        ))}
      </div>,
    );
    return () => { setHeader(null, null); };
  }, [filter, setHeader, t]);

  return (
    <div className="container-responsive p-6">

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-raised p-4 rounded-card border border-line shadow-card flex flex-col">
            <span className="text-sm font-medium text-subtle mb-1">{t('reports.revenue')}</span>
            <span className="text-2xl font-bold text-body tabular">
              {formatCurrency(stats.totalRevenue)}
            </span>
          </div>
          <div className="bg-surface-raised p-4 rounded-card border border-line shadow-card flex flex-col">
            <span className="text-sm font-medium text-subtle mb-1">{t('reports.orders')}</span>
            <span className="text-2xl font-bold text-body tabular">
              {formatNumber(stats.totalOrders)}
            </span>
          </div>
          <div className="bg-surface-raised p-4 rounded-card border border-line shadow-card flex flex-col">
            <span className="text-sm font-medium text-subtle mb-1">
              {t('pastOrders.averageOrderValue')}
            </span>
            <span className="text-2xl font-bold text-body tabular">
              {formatCurrency(stats.averageOrderValue)}
            </span>
          </div>
        </div>
      )}

      <div className="bg-surface-raised border border-line rounded-card shadow-card overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-surface-muted sticky top-0 z-10">
              <tr>
                {COLUMNS.map(([key, align]) => (
                  <th
                    key={key}
                    // Alignment classes are literal: Tailwind scans source text,
                    // so a template-built `text-${align}` is never generated.
                    className={`px-6 py-3 text-xs font-medium text-subtle uppercase tracking-wider ${align}`}
                  >
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {orders === null && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-subtle">
                    {t('state.loading')}
                  </td>
                </tr>
              )}

              {orders?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-subtle">
                    {t('pastOrders.empty')}
                  </td>
                </tr>
              )}

              {orders?.map((order) => {
                const type = order.type ?? 'dine-in';
                const isExpanded = expandedRow === order.id;

                return (
                  <React.Fragment key={order.id}>
                    <tr className="hover:bg-surface-sunken transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-body">
                        {formatDateTime(`${order.date}Z`)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-subtle tabular">
                        {order.business_date ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-body">
                          {order.customerName || t('customers.walkIn')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            ORDER_TYPE_CHIP[type] ?? ORDER_TYPE_CHIP['dine-in']
                          }`}
                        >
                          {t(ORDER_TYPE_LABEL[type] ?? 'order.type.dineIn')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-end text-sm font-bold text-body tabular">
                        {formatCurrency(order.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-subtle">
                        <span dir="ltr" className="tabular">
                          {occupiedLabel(order.occupiedTimeMs)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={isExpanded}
                          onClick={() => { setExpandedRow(isExpanded ? null : order.id); }}
                        >
                          {t(isExpanded ? 'pastOrders.hide' : 'pastOrders.view')}
                        </Button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-brand-subtle/40">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="flex justify-between items-start gap-6 flex-wrap">
                            <div className="text-sm text-body space-y-1 flex-1 min-w-[16rem] max-w-md">
                              <h4 className="font-bold mb-2">{t('pastOrders.orderItems')}</h4>
                              {order.items.map((item, idx) => (
                                <div
                                  key={`${order.id}-${idx}`}
                                  className="flex justify-between gap-4 border-b border-line last:border-0 pb-1 last:pb-0"
                                >
                                  <span>{item.name}</span>
                                  <span className="font-medium tabular">×{formatNumber(item.qty)}</span>
                                </div>
                              ))}
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="printer"
                              disabled={printingId === order.id}
                              onClick={() => { handleReprint(order.id); }}
                            >
                              {t('pastOrders.reprint')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-line bg-surface-muted flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-muted">
              {t('pastOrders.page', {
                current: formatNumber(currentPage),
                total: formatNumber(totalPages),
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedRow(null); }}
              >
                {t('action.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setExpandedRow(null); }}
              >
                {t('action.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PastOrdersPage;
