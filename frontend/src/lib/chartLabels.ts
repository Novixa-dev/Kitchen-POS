import type { I18nContextValue } from '../i18n/context';

/**
 * Axis and tooltip labels for the trend charts.
 *
 * The backend groups the series with `strftime`, so a label arrives as one of
 * three shapes: `YYYY-MM-DD` (day), `YYYY-MM` (month) or `HH` (hour). Both the
 * dashboard and the reports page had their own near-identical copy of this,
 * each hardcoding `'en-US'` — so dates stayed English even after the rest of
 * the UI was translated.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const HOUR = /^\d{2}$/;

type Formatters = Pick<I18nContextValue, 'formatDate' | 'formatTime'>;

/** Full label, used in tooltips where there is room. */
export function formatChartLabel(label: string, i18n: Formatters): string {
  if (typeof label !== 'string') { return String(label); }

  if (DAY.test(label)) {
    return i18n.formatDate(`${label}T00:00:00`, 'weekday');
  }
  if (MONTH.test(label)) {
    return i18n.formatDate(`${label}-01T00:00:00`, 'monthYear');
  }
  if (HOUR.test(label)) {
    // Build a local date at that hour so 12/24-hour display follows the
    // locale rather than a hand-rolled AM/PM suffix.
    const at = new Date();
    at.setHours(Number(label), 0, 0, 0);
    return i18n.formatTime(at);
  }
  return label;
}

/** Compact label for a crowded axis. */
export function formatChartLabelShort(label: string, i18n: Formatters): string {
  if (typeof label !== 'string') { return String(label); }

  if (DAY.test(label)) {
    return i18n.formatDate(`${label}T00:00:00`, 'medium');
  }
  if (MONTH.test(label)) {
    return i18n.formatDate(`${label}-01T00:00:00`, 'monthYear');
  }
  if (HOUR.test(label)) {
    const at = new Date();
    at.setHours(Number(label), 0, 0, 0);
    return i18n.formatTime(at);
  }
  return label;
}
