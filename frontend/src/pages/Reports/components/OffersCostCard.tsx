import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/atoms/card';
import { useFeature } from '../../../features';
import { useI18n } from '../../../i18n/useI18n';
import { api, type OffersReport } from '../../../lib/ipc';

interface Props {
  /** The same filter the sales report is showing. */
  filter: string;
  start?: string;
  end?: string;
  /** Revenue over the same period, so the cost can be shown as a share. */
  revenue: number;
}

/**
 * What the offers cost over the reporting period.
 *
 * The figures come from `promotion_redemptions` and `loyalty_redemptions` —
 * what was actually given away, per bill — not from the rules, which only say
 * what an offer *could* cost. An owner deciding whether an offer earns its
 * keep needs the first number.
 *
 * Promotions and loyalty are listed apart because they are different levers:
 * one is presented at the till, the other is earned by coming back.
 */
const OffersCostCard: React.FC<Props> = ({ filter, start, end, revenue }) => {
  const { t, formatCurrency, formatNumber, formatPercent, locale } = useI18n();
  const offersActive = useFeature('discounts');

  const [report, setReport] = useState<OffersReport | null>(null);

  useEffect(() => {
    if (!offersActive) { return; }

    let active = true;
    api.promotions.report({ filter, start, end })
      .then((res) => {
        if (!active || !res.success || !res.data) { return; }
        setReport(res.data);
      })
      .catch(console.error);

    return () => { active = false; };
  }, [offersActive, filter, start, end]);

  if (!offersActive || !report) { return null; }

  const rows = [...report.promotions, ...report.loyalty];
  const total = report.totalPromotions + report.totalLoyalty;

  const nameOf = (row: { name_ar: string; name_en: string }) =>
    (locale === 'ar' ? row.name_ar : row.name_en) || row.name_en || row.name_ar;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('reports.offersCost')}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-subtle text-sm py-4 text-center">{t('reports.noOffersGiven')}</p>
        ) : (
          <div className="space-y-2">
            {report.promotions.map(row => (
              <div key={`p-${row.id}`} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {nameOf(row)}
                  {row.code && <span className="text-subtle"> · {row.code}</span>}
                  <span className="text-subtle tabular">
                    {' '}× {formatNumber(row.redemptions)}
                  </span>
                </span>
                <span className="tabular shrink-0">{formatCurrency(row.total_amount)}</span>
              </div>
            ))}

            {report.loyalty.map(row => (
              <div key={`l-${row.id}`} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {nameOf(row)}
                  <span className="text-subtle"> · {t('offers.tab.loyalty')}</span>
                  <span className="text-subtle tabular">
                    {' '}× {formatNumber(row.redemptions)}
                  </span>
                </span>
                <span className="tabular shrink-0">{formatCurrency(row.total_amount)}</span>
              </div>
            ))}

            <div className="flex justify-between font-bold border-t border-line pt-2 mt-2">
              <span>{t('label.total')}</span>
              <span className="tabular">{formatCurrency(total)}</span>
            </div>

            {/* The share of revenue, which is the figure that decides whether
                an offer is worth running. Suppressed at zero revenue rather
                than shown as a division by nothing. */}
            {revenue > 0 && (
              <p className="text-xs text-subtle text-center pt-1 tabular">
                {t('reports.offersShare', {
                  share: formatPercent((total / revenue) * 100),
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OffersCostCard;
