import React from 'react';
import { useI18n } from '../../i18n/useI18n';
import { formatChartLabel } from '../../lib/chartLabels';

/**
 * Tooltip body for the revenue trend charts.
 *
 * A module-level component rather than one defined inside the page: a
 * component created during render gets a new identity every render, so
 * Recharts remounts the tooltip on every mouse move. It reads the formatters
 * from context itself, which is why no formatter props are needed.
 */

interface TrendPoint {
  /** Dashboard series. */
  sales?: number;
  /** Reports series. */
  revenue?: number;
  orders?: number;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  label?: string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
  const i18n = useI18n();
  const { t, formatCurrency, formatNumber } = i18n;

  if (!active || !payload || payload.length === 0) { return null; }

  const point = payload[0].payload;
  // The two pages name the money series differently; accept either.
  const amount = point.sales ?? point.revenue ?? 0;

  return (
    <div className="bg-surface-raised p-3 rounded-control shadow-overlay border border-line">
      <p className="font-semibold text-body mb-2">{formatChartLabel(label ?? '', i18n)}</p>
      <div className="space-y-1 text-sm">
        <p className="flex justify-between gap-4">
          <span className="text-subtle">{t('chart.revenue')}</span>
          <span className="font-bold text-brand tabular">{formatCurrency(amount)}</span>
        </p>
        {point.orders !== undefined && (
          <p className="flex justify-between gap-4">
            <span className="text-subtle">{t('chart.orders')}</span>
            <span className="font-bold text-body tabular">{formatNumber(point.orders)}</span>
          </p>
        )}
      </div>
    </div>
  );
};
