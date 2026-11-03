import { ipcMain } from 'electron';
import { getDB } from '../db';
import { errMsg } from '../lib/errors';
import { round } from '../lib/money';

export type DashboardFilter = 'today' | 'yesterday' | 'weekly' | 'monthly' | 'yearly';

/**
 * A period, plus the equally-long period immediately before it.
 *
 * The dashboard previously showed hardcoded trend percentages ("+12.5% vs
 * last period") and invented sparkline data. Those numbers looked like
 * measurements and were not, so the comparison period is now computed and the
 * deltas are real.
 *
 * `column` is interpolated, never user input — each entry is a literal below.
 */
interface PeriodSpec {
  /** SQL predicate for the current period. */
  current: (column: string) => string;
  /** SQL predicate for the preceding period of the same length. */
  previous: (column: string) => string;
  /** `strftime` pattern the trend series is grouped by. */
  groupBy: string;
}

const PERIODS: Record<DashboardFilter, PeriodSpec> = {
  today: {
    current: (c) => `date(${c}, 'localtime') = date('now', 'localtime')`,
    previous: (c) => `date(${c}, 'localtime') = date('now', '-1 day', 'localtime')`,
    groupBy: '%H',
  },
  yesterday: {
    current: (c) => `date(${c}, 'localtime') = date('now', '-1 day', 'localtime')`,
    previous: (c) => `date(${c}, 'localtime') = date('now', '-2 days', 'localtime')`,
    groupBy: '%H',
  },
  weekly: {
    current: (c) => `date(${c}, 'localtime') >= date('now', '-6 days', 'localtime')`,
    previous: (c) =>
      `date(${c}, 'localtime') >= date('now', '-13 days', 'localtime') ` +
      `AND date(${c}, 'localtime') < date('now', '-6 days', 'localtime')`,
    groupBy: '%Y-%m-%d',
  },
  monthly: {
    current: (c) => `strftime('%Y-%m', ${c}, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`,
    previous: (c) =>
      `strftime('%Y-%m', ${c}, 'localtime') = strftime('%Y-%m', 'now', '-1 month', 'localtime')`,
    groupBy: '%Y-%m-%d',
  },
  // Previously missing: 'yearly' fell through to the default branch and
  // silently showed *today's* figures under a "Yearly" label.
  yearly: {
    current: (c) => `strftime('%Y', ${c}, 'localtime') = strftime('%Y', 'now', 'localtime')`,
    previous: (c) => `strftime('%Y', ${c}, 'localtime') = strftime('%Y', 'now', '-1 year', 'localtime')`,
    groupBy: '%Y-%m',
  },
};

function toFilter(value: unknown): DashboardFilter {
  return value === 'yesterday' || value === 'weekly' || value === 'monthly' || value === 'yearly'
    ? value
    : 'today';
}

interface CoreMetrics {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
}

/** Aggregate the headline figures for one period. */
function readMetrics(
  db: ReturnType<typeof getDB>,
  predicate: (column: string) => string,
): CoreMetrics {
  const sales = db
    .prepare(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM bills WHERE ${predicate('created_at')}`)
    .get() as { total: number };

  const orders = db
    .prepare(
      `SELECT COUNT(id) AS count, COALESCE(SUM(covers), 0) AS covers
         FROM orders
        WHERE ${predicate('created_at')}`,
    )
    .get() as { count: number; covers: number };

  return {
    totalSales: round(sales.total),
    totalOrders: orders.count,
    averageOrderValue: orders.count > 0 ? round(sales.total / orders.count) : 0,
    totalCustomers: orders.covers,
  };
}

/**
 * Percentage change, or null when there is no baseline.
 *
 * Returning null rather than 0 or Infinity matters: "no comparison available"
 * and "no change" are different statements, and the UI must not print
 * "+0%" for a first day of trading.
 */
function delta(current: number, previous: number): number | null {
  if (previous === 0) { return current === 0 ? 0 : null; }
  return round(((current - previous) / previous) * 100, 1);
}

export function registerDashboardIPC() {
  ipcMain.handle('dashboard:getMetrics', async (_event, payload: { filter?: string }) => {
    try {
      const db = getDB();
      const filter = toFilter(payload.filter);
      const spec = PERIODS[filter];

      const current = readMetrics(db, spec.current);
      const previous = readMetrics(db, spec.previous);

      // Outstanding balance is a running total, not a period figure, so it has
      // no meaningful period-over-period comparison.
      const balances = db
        .prepare('SELECT COALESCE(SUM(outstanding_balance), 0) AS total FROM customers')
        .get() as { total: number };

      const trendData = db
        .prepare(`
          SELECT strftime('${spec.groupBy}', created_at, 'localtime') AS label,
                 COALESCE(SUM(total_amount), 0) AS sales,
                 COUNT(id) AS orders
            FROM bills
           WHERE ${spec.current('created_at')}
           GROUP BY label
           ORDER BY label ASC
        `)
        .all() as { label: string; sales: number; orders: number }[];

      const topItemsData = db
        .prepare(`
          SELECT oi.name, SUM(oi.qty) AS quantity
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
           WHERE ${spec.current('o.created_at')}
           GROUP BY oi.menu_item_id, oi.name
           ORDER BY quantity DESC
           LIMIT 5
        `)
        .all() as { name: string; quantity: number }[];

      return {
        success: true,
        data: {
          filter,
          metrics: {
            ...current,
            outstandingBalances: round(balances.total),
          },
          previousMetrics: previous,
          trends: {
            totalSales: delta(current.totalSales, previous.totalSales),
            totalOrders: delta(current.totalOrders, previous.totalOrders),
            averageOrderValue: delta(current.averageOrderValue, previous.averageOrderValue),
            totalCustomers: delta(current.totalCustomers, previous.totalCustomers),
          },
          trendData,
          topItemsData,
        },
      };
    } catch (e: unknown) {
      return { success: false, error: errMsg(e) };
    }
  });
}
