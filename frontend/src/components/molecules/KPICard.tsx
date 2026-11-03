import React from 'react';
import { Card, CardContent } from '../atoms/card';
import SvgIcon from '../atoms/svg-sprite-loader/SvgIcon';
import { useI18n } from '../../i18n/useI18n';

export interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  /**
   * Percentage change against the comparison period.
   *
   * `null` means "no baseline to compare against" — a first day of trading,
   * say — and renders nothing. That is deliberately distinct from `0`, which
   * means "measured, and unchanged".
   */
  trend?: number | null;
  trendLabel?: string;
  colorTheme?: 'blue' | 'green' | 'purple' | 'orange';
}

/**
 * Accent colours stay literal rather than tokenised: the five KPI tiles are
 * distinguished from each other by hue, which is independent of the theme.
 */
const THEME = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
  purple: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300',
} as const;

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  trend,
  trendLabel,
  colorTheme = 'blue',
}) => {
  const { formatNumber } = useI18n();

  const hasTrend = trend !== null && trend !== undefined;
  const isPositive = hasTrend && trend > 0;
  const isNegative = hasTrend && trend < 0;

  let trendColor = 'text-subtle';
  if (isPositive) { trendColor = 'text-success'; }
  else if (isNegative) { trendColor = 'text-danger'; }

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-raised">
      <CardContent className="p-5">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-subtle text-xs font-bold uppercase tracking-wider truncate">
              {title}
            </p>
            <div className="text-2xl font-bold text-body mt-1 tabular">{value}</div>
          </div>
          <div className={`p-3 rounded-full shrink-0 flex items-center justify-center ${THEME[colorTheme]}`}>
            {icon}
          </div>
        </div>

        {(hasTrend || trendLabel) && (
          <div className="flex items-center justify-between gap-2 mt-4">
            {hasTrend && (
              <div className={`flex items-center gap-1 text-sm font-bold ${trendColor}`}>
                {isPositive && <SvgIcon name="trend-up" width={16} height={16} aria-hidden />}
                {isNegative && <SvgIcon name="trend-down" width={16} height={16} aria-hidden />}
                {/* `dir="ltr"` keeps the sign attached to the number. */}
                <span dir="ltr" className="tabular">
                  {formatNumber(Math.abs(trend), { maximumFractionDigits: 1 })}%
                </span>
              </div>
            )}
            {trendLabel && (
              <span className="text-xs text-subtle font-medium truncate">{trendLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
