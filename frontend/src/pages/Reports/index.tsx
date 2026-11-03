import { Button, Input } from '../../components/atoms';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/ipc';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/atoms/card';
import { useHeader } from '../../contexts/HeaderContext';
import SvgIcon from '../../components/atoms/svg-sprite-loader/SvgIcon';
import { KPICard } from '../../components/molecules/KPICard';
import { ChartTooltip } from '../../components/molecules/ChartTooltip';
import { useI18n } from '../../i18n/useI18n';
import { useAppSettings } from '../../lib/useAppSettings';
import { useToast } from '../../hooks/useToast';
import { downloadCsv, type CsvValue } from '../../lib/csv';
import { formatChartLabelShort } from '../../lib/chartLabels';
import type { TranslationKey } from '../../i18n/types';

interface SalesReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
  totalDiscount: number;
  totalTaxable: number;
  hourlyData: { hour: string; orders: number; revenue: number }[];
}

type FilterType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const FILTERS: { value: Exclude<FilterType, 'custom'>; labelKey: TranslationKey }[] = [
  { value: 'daily', labelKey: 'range.daily' },
  { value: 'weekly', labelKey: 'range.weekly' },
  { value: 'monthly', labelKey: 'range.monthly' },
  { value: 'yearly', labelKey: 'range.yearly' },
];

/**
 * Today as a local calendar date.
 *
 * `toISOString().split('T')[0]` would give the UTC date, which rolls over a
 * day early for anyone east of UTC late in the evening — so a report defaulted
 * to "tomorrow" after 21:00 in Riyadh.
 */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const ReportsPage: React.FC = () => {
  const i18n = useI18n();
  const { t, formatCurrency, formatNumber } = i18n;
  const { showToast } = useToast();
  const settings = useAppSettings();

  const [report, setReport] = useState<SalesReport | null>(null);
  const [filter, setFilter] = useState<FilterType>('daily');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);

  const taxMode = settings?.tax.mode ?? 'none';

  useEffect(() => {
    let active = true;
    const payload = filter === 'custom'
      ? { filter, start: customStart, end: customEnd }
      : { filter };

    api.reports.daily(payload)
      .then(res => {
        if (!active) { return; }
        if (res.success && res.data) {
          setReport(res.data as SalesReport);
        } else if (res.error) {
          showToast({ message: res.error, variant: 'error' });
        }
      })
      .catch(console.error);

    return () => { active = false; };
  }, [filter, customStart, customEnd, showToast]);

  const handleExportCsv = useCallback(() => {
    if (!report) { return; }

    // The tax columns follow the active regime: a VAT outlet has no CGST or
    // SGST to report, and a no-tax outlet has neither.
    const header: string[] = [
      t('label.date'),
      t('reports.orders'),
      t('reports.revenue'),
      t('billing.taxable'),
      t('label.discount'),
    ];
    const row: CsvValue[] = [
      filter === 'custom'
        ? `${customStart} - ${customEnd}`
        : t(`range.${filter}` as TranslationKey),
      report.totalOrders,
      report.totalRevenue,
      report.totalTaxable,
      report.totalDiscount,
    ];

    if (taxMode === 'gst') {
      header.push(t('tax.cgst'), t('tax.sgst'));
      row.push(report.totalCGST, report.totalSGST);
    } else if (taxMode === 'vat') {
      header.push(t('tax.vat'));
      row.push(report.totalTax);
    }

    downloadCsv(`sales-report-${filter}-${today()}.csv`, [header, row]);
    showToast({ message: t('reports.exported'), variant: 'success' });
  }, [report, filter, customStart, customEnd, taxMode, t, showToast]);

  const applyCustomRange = useCallback(() => {
    if (customStart > customEnd) {
      showToast({ message: t('reports.startAfterEnd'), variant: 'warning' });
      return;
    }
    setFilter('custom');
    setShowDatePicker(false);
  }, [customStart, customEnd, showToast, t]);

  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader(
      t('reports.salesSummary'),
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-surface rounded-control p-1 shadow-card border border-line" role="group">
          {FILTERS.map(f => (
            <Button
              key={f.value}
              variant="ghost"
              size="sm"
              aria-pressed={filter === f.value}
              onClick={() => { setFilter(f.value); setShowDatePicker(false); }}
              className={
                filter === f.value
                  ? 'bg-brand-subtle text-brand'
                  : 'text-subtle hover:text-body hover:bg-surface-sunken'
              }
            >
              {t(f.labelKey)}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowDatePicker(!showDatePicker); }}
            className={filter === 'custom' ? 'bg-brand-subtle text-brand border-brand/40' : ''}
          >
            {t('reports.customDates')}
          </Button>

          {showDatePicker && (
            // Anchored to the inline end so the popover opens inside the
            // viewport in both directions.
            <div className="absolute end-0 top-12 w-80 bg-surface-raised border border-line shadow-overlay rounded-card p-4 z-50 flex flex-col gap-4">
              <h4 className="font-semibold text-body">{t('reports.customRange')}</h4>
              <Input
                type="date"
                label={t('reports.startDate')}
                value={customStart}
                max={customEnd}
                onChange={e => { setCustomStart(e.target.value); }}
              />
              <Input
                type="date"
                label={t('reports.endDate')}
                value={customEnd}
                min={customStart}
                onChange={e => { setCustomEnd(e.target.value); }}
              />
              <div className="flex justify-end">
                <Button onClick={applyCustomRange}>{t('action.apply')}</Button>
              </div>
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!report}>
          {t('reports.exportCsv')}
        </Button>
      </div>,
    );
    return () => { setHeader(null, null); };
  }, [
    setHeader, handleExportCsv, applyCustomRange,
    filter, showDatePicker, customStart, customEnd, report, t,
  ]);

  if (!report) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-surface-muted h-full gap-4 flex flex-col overflow-auto">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('reports.orders')}
          value={formatNumber(report.totalOrders)}
          icon={<SvgIcon name="cart" width={24} height={24} />}
          colorTheme="blue"
        />
        <KPICard
          title={t('reports.revenue')}
          value={formatCurrency(report.totalRevenue)}
          icon={<SvgIcon name="dollar" width={24} height={24} />}
          colorTheme="green"
        />

        {taxMode === 'gst' && (
          <>
            <KPICard
              title={t('tax.cgst')}
              value={formatCurrency(report.totalCGST)}
              icon={<SvgIcon name="percent" width={24} height={24} />}
              colorTheme="purple"
            />
            <KPICard
              title={t('tax.sgst')}
              value={formatCurrency(report.totalSGST)}
              icon={<SvgIcon name="percent" width={24} height={24} />}
              colorTheme="orange"
            />
          </>
        )}

        {taxMode === 'vat' && (
          <>
            <KPICard
              title={t('reports.totalTax')}
              value={formatCurrency(report.totalTax)}
              icon={<SvgIcon name="percent" width={24} height={24} />}
              colorTheme="purple"
            />
            <KPICard
              title={t('billing.taxable')}
              value={formatCurrency(report.totalTaxable)}
              icon={<SvgIcon name="chart-bar" width={24} height={24} />}
              colorTheme="orange"
            />
          </>
        )}

        {taxMode === 'none' && (
          <>
            <KPICard
              title={t('label.discount')}
              value={formatCurrency(report.totalDiscount)}
              icon={<SvgIcon name="percent" width={24} height={24} />}
              colorTheme="purple"
            />
            <KPICard
              title={t('dashboard.averageOrderValue')}
              value={formatCurrency(
                report.totalOrders > 0 ? report.totalRevenue / report.totalOrders : 0,
              )}
              icon={<SvgIcon name="trend-up" width={24} height={24} />}
              colorTheme="orange"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.revenueTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            {report.hourlyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-subtle">
                {t('reports.noData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                <BarChart data={report.hourlyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    dy={10}
                    tickFormatter={(v: string) => formatChartLabelShort(v, i18n)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    width={72}
                    tickFormatter={(v: number) => formatCurrency(v, { showSymbol: false })}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
