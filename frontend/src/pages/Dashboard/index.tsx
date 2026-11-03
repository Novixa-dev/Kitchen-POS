import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/ipc';
import { Button } from '../../components/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/atoms/card';
import { useHeader } from '../../contexts/HeaderContext';
import SvgIcon from '../../components/atoms/svg-sprite-loader/SvgIcon';
import { KPICard } from '../../components/molecules/KPICard';
import { ChartTooltip } from '../../components/molecules/ChartTooltip';
import { useI18n } from '../../i18n/useI18n';
import { formatChartLabelShort } from '../../lib/chartLabels';
import type { TranslationKey } from '../../i18n/types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Categorical palette for the top-items pie; distinguishable in both themes. */
const SLICE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type FilterType = 'today' | 'yesterday' | 'weekly' | 'monthly' | 'yearly';

const FILTERS: { value: FilterType; labelKey: TranslationKey }[] = [
  { value: 'today', labelKey: 'range.today' },
  { value: 'yesterday', labelKey: 'range.yesterday' },
  { value: 'weekly', labelKey: 'range.weekly' },
  { value: 'monthly', labelKey: 'range.monthly' },
  { value: 'yearly', labelKey: 'range.yearly' },
];

interface Metrics {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  outstandingBalances: number;
}

interface Trends {
  totalSales: number | null;
  totalOrders: number | null;
  averageOrderValue: number | null;
  totalCustomers: number | null;
}

const EMPTY_METRICS: Metrics = {
  totalSales: 0,
  totalOrders: 0,
  averageOrderValue: 0,
  totalCustomers: 0,
  outstandingBalances: 0,
};

const EMPTY_TRENDS: Trends = {
  totalSales: null,
  totalOrders: null,
  averageOrderValue: null,
  totalCustomers: null,
};

const DashboardPage: React.FC = () => {
  const i18n = useI18n();
  const { t, formatCurrency, formatNumber } = i18n;

  const [filter, setFilter] = useState<FilterType>('today');
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [trends, setTrends] = useState<Trends>(EMPTY_TRENDS);
  const [trendData, setTrendData] = useState<{ label: string; sales: number; orders: number }[]>([]);
  const [topItemsData, setTopItemsData] = useState<{ name: string; quantity: number }[]>([]);
  // `null` means "first load has not finished", which is not the same as
  // "loaded and empty".
  const [loadedFilter, setLoadedFilter] = useState<FilterType | null>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    let active = true;

    api.dashboard.getMetrics({ filter })
      .then(res => {
        if (!active || !res.success || !res.data) { return; }
        setMetrics(res.data.metrics);
        setTrends(res.data.trends);
        setTrendData(res.data.trendData);
        setTopItemsData(res.data.topItemsData);
        setLoadedFilter(filter);
      })
      .catch(console.error);

    return () => { active = false; };
  }, [filter]);

  const { setHeader } = useHeader();
  const handleFilterChange = useCallback((next: FilterType) => { setFilter(next); }, []);

  useEffect(() => {
    setHeader(
      t('page.dashboard'),
      <div className="flex bg-surface rounded-control p-1 shadow-card border border-line" role="group">
        {FILTERS.map(f => (
          <Button
            key={f.value}
            variant="ghost"
            size="sm"
            aria-pressed={filter === f.value}
            onClick={() => { handleFilterChange(f.value); }}
            className={
              filter === f.value
                ? 'bg-brand-subtle text-brand'
                : 'text-subtle hover:text-body hover:bg-surface-sunken'
            }
          >
            {t(f.labelKey)}
          </Button>
        ))}
      </div>,
    );
    return () => { setHeader(null, null); };
  }, [setHeader, filter, handleFilterChange, t]);

  const isLoading = loadedFilter === null;
  const vsPrevious = t('dashboard.vsPrevious');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <KPICard
              title={t('dashboard.totalSales')}
              value={formatCurrency(metrics.totalSales)}
              icon={<SvgIcon name="dollar" width={24} height={24} />}
              trend={trends.totalSales}
              trendLabel={vsPrevious}
              colorTheme="blue"
            />
            <KPICard
              title={t('dashboard.totalOrders')}
              value={formatNumber(metrics.totalOrders)}
              icon={<SvgIcon name="cart" width={24} height={24} />}
              trend={trends.totalOrders}
              trendLabel={vsPrevious}
              colorTheme="green"
            />
            <KPICard
              title={t('dashboard.averageOrderValue')}
              value={formatCurrency(metrics.averageOrderValue)}
              icon={<SvgIcon name="trend-up" width={24} height={24} />}
              trend={trends.averageOrderValue}
              trendLabel={vsPrevious}
              colorTheme="purple"
            />
            <KPICard
              title={t('dashboard.totalCustomers')}
              value={formatNumber(metrics.totalCustomers)}
              icon={<SvgIcon name="users" width={24} height={24} />}
              trend={trends.totalCustomers}
              trendLabel={vsPrevious}
              colorTheme="orange"
            />
            {/* A running balance, not a period figure — so no trend. */}
            <KPICard
              title={t('dashboard.outstandingBalances')}
              value={formatCurrency(metrics.outstandingBalances)}
              icon={<SvgIcon name="wallet" width={24} height={24} />}
              colorTheme="blue"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>{t('dashboard.salesTrend')}</CardTitle>
                <div className="flex bg-surface-sunken p-1 rounded-control" role="group">
                  {(['line', 'bar'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={chartType === type}
                      onClick={() => { setChartType(type); }}
                      className={`px-3 py-1 text-sm rounded-control transition-colors ${
                        chartType === type
                          ? 'bg-surface shadow-card text-brand font-medium'
                          : 'text-subtle hover:text-body'
                      }`}
                    >
                      {t(type === 'line' ? 'dashboard.chart.line' : 'dashboard.chart.bar')}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  {trendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-subtle">
                      {t('dashboard.noData')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                      {chartType === 'line' ? (
                        <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickFormatter={(v: string) => formatChartLabelShort(v, i18n)}
                          />
                          <YAxis
                            tickFormatter={(v: number) => formatCurrency(v, { showSymbol: false })}
                            width={72}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="sales"
                            stroke="#2563eb"
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      ) : (
                        <BarChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickFormatter={(v: string) => formatChartLabelShort(v, i18n)}
                          />
                          <YAxis
                            tickFormatter={(v: number) => formatCurrency(v, { showSymbol: false })}
                            width={72}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.topItems')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  {topItemsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                      <PieChart>
                        <Pie
                          data={topItemsData.map((item, i) => ({
                            ...item,
                            fill: SLICE_COLORS[i % SLICE_COLORS.length],
                          }))}
                          dataKey="quantity"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={60}
                          paddingAngle={2}
                          label={({ percent }: { percent?: number }) =>
                            formatNumber(percent ?? 0, { style: 'percent', maximumFractionDigits: 0 })
                          }
                        />
                        <Tooltip
                          // Recharts types the value as `ValueType`, which
                          // includes string and undefined — a pie slice built
                          // from an empty bucket arrives as the latter.
                          formatter={(value) => [formatNumber(Number(value) || 0), t('chart.quantity')]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-subtle text-center px-4">
                      {t('dashboard.noItemSales')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
