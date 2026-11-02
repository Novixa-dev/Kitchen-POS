import { Button } from '../../components/atoms';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/ipc';
import { KDSTicket, KDSTicketItem } from '../../types/models';
import { splitElapsed } from '../../lib/datetime';
import { useI18n } from '../../i18n/useI18n';
import { SvgIcon } from '../../components/atoms/svg-sprite-loader';
import type { TranslationKey } from '../../i18n/types';

type PrepStatus = KDSTicketItem['preparation_status'];

/** How often the board re-reads tickets written by the order terminals. */
const POLL_MS = 5000;
/** The wait badge shows seconds, so the clock ticks once a second. */
const CLOCK_MS = 1000;

/** Minutes after which a ticket is late / critically late. */
const WARN_AFTER_MIN = 10;
const LATE_AFTER_MIN = 20;

/** Tapping an item walks it forward through the kitchen's own sequence. */
const NEXT_STATUS: Record<PrepStatus, PrepStatus> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: 'pending',
};

const STATUS_LABEL: Record<PrepStatus, TranslationKey> = {
  pending: 'kds.status.pending',
  preparing: 'kds.status.preparing',
  ready: 'kds.status.ready',
  served: 'kds.status.served',
};

/**
 * The KDS keeps its own dark palette rather than the app theme: it runs
 * full-screen on a wall-mounted monitor in a bright kitchen, where a light
 * surface is unreadable at distance and the colour coding is the whole point.
 */
const STATUS_CHIP: Record<PrepStatus, string> = {
  pending: 'bg-red-950 text-red-300 border border-red-900/40',
  preparing: 'bg-amber-950 text-amber-300 border border-amber-900/40',
  ready: 'bg-emerald-950 text-emerald-300 border border-emerald-900/40',
  served: 'bg-gray-800 text-gray-400 border border-gray-700',
};

const TYPE_CHIP: Record<'dine-in' | 'takeaway' | 'delivery', string> = {
  'dine-in': 'bg-emerald-950 text-emerald-400 border-emerald-900',
  takeaway: 'bg-orange-950 text-orange-400 border-orange-900',
  delivery: 'bg-purple-950 text-purple-400 border-purple-900',
};

const TYPE_LABEL: Record<'dine-in' | 'takeaway' | 'delivery', TranslationKey> = {
  'dine-in': 'order.type.dineIn',
  takeaway: 'order.type.takeaway',
  delivery: 'order.type.delivery',
};

export default function KDSPage() {
  const { t, formatNumber, formatTime } = useI18n();

  const [tickets, setTickets] = useState<KDSTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchTickets = useCallback(() => {
    return api.kds.getActiveTickets()
      .then(res => {
        if (res.success && res.data) {
          setTickets(res.data);
          setError(null);
        } else {
          setError(res.error ?? t('kds.fetchFailed'));
        }
      })
      .catch(() => { setError(t('kds.fetchFailed')); });
  }, [t]);

  useEffect(() => {
    void fetchTickets();
    const poll = setInterval(() => { void fetchTickets(); }, POLL_MS);
    return () => { clearInterval(poll); };
  }, [fetchTickets]);

  useEffect(() => {
    const clock = setInterval(() => { setNow(Date.now()); }, CLOCK_MS);
    return () => { clearInterval(clock); };
  }, []);

  const advanceItem = (itemId: number, current: PrepStatus) => {
    void api.kds.updateItemStatus({ itemId, status: NEXT_STATUS[current] })
      .then(res => { if (res.success) { return fetchTickets(); } return undefined; })
      .catch(console.error);
  };

  const setOrderStatus = (orderId: number, status: PrepStatus) => {
    void api.kds.updateOrderStatus({ orderId, status })
      .then(res => { if (res.success) { return fetchTickets(); } return undefined; })
      .catch(console.error);
  };

  /** `h m s` built from localised numbers, not a hardcoded English string. */
  const waitLabel = (createdAt: string) => {
    const { hours, minutes, seconds, totalMinutes } = splitElapsed(createdAt, now);
    const parts = [
      hours > 0 ? `${formatNumber(hours)}h` : null,
      `${formatNumber(minutes)}m`,
      `${String(seconds).padStart(2, '0')}s`,
    ].filter(Boolean);
    return { text: parts.join(' '), totalMinutes };
  };

  if (tickets === null) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('kds.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">

      <header className="flex flex-wrap justify-between items-center gap-3 bg-gray-900 border-b border-gray-800 px-6 py-4 shadow-md z-10">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" aria-hidden />
          <h1 className="text-2xl font-bold text-white">{t('kds.title')}</h1>
          <span className="px-2.5 py-1 bg-gray-800 border border-gray-700 text-xs font-semibold rounded text-gray-400">
            {formatNumber(tickets.length)} {t('kds.activeTickets')}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {error && (
            <span role="alert" className="text-red-300 text-sm bg-red-950/50 border border-red-900 px-3 py-1.5 rounded">
              {error}
            </span>
          )}
          {/* `dir="ltr"` keeps the clock from being mirrored in RTL. */}
          <span dir="ltr" className="text-lg tabular text-gray-400">
            {formatTime(now, { withSeconds: true })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void fetchTickets(); }}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            {t('action.refresh')}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {tickets.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <SvgIcon name="chef-hat" width="64" height="64" className="text-gray-800 mx-auto mb-4" aria-hidden />
              <h2 className="text-xl font-semibold text-gray-400">{t('kds.noPendingTitle')}</h2>
              <p className="text-gray-600 mt-1">{t('kds.noPendingHint')}</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 h-full pb-4 overflow-x-auto items-start">
            {tickets.map(ticket => {
              const wait = waitLabel(ticket.created_at);

              // Escalate the whole card, not just the badge: a late ticket has
              // to be findable from across the kitchen.
              let cardTone = 'border-gray-800';
              let badgeTone = 'bg-gray-800 text-gray-400';
              if (wait.totalMinutes >= LATE_AFTER_MIN) {
                cardTone = 'border-red-900/60 ring-1 ring-red-900/40';
                badgeTone = 'bg-red-500 text-white font-bold';
              } else if (wait.totalMinutes >= WARN_AFTER_MIN) {
                cardTone = 'border-amber-900/60';
                badgeTone = 'bg-amber-500 text-black font-semibold';
              }

              return (
                <section
                  key={ticket.order_id}
                  className={`flex flex-col w-80 shrink-0 max-h-full rounded-card border bg-gray-900/80 shadow-2xl ${cardTone}`}
                >
                  <div className="flex justify-between items-start gap-2 p-4 border-b border-gray-800">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">{ticket.table_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">
                          {t('kds.orderId', { id: formatNumber(ticket.order_id) })}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${TYPE_CHIP[ticket.type]}`}>
                          {t(TYPE_LABEL[ticket.type])}
                        </span>
                      </div>
                    </div>
                    <span dir="ltr" className={`px-2 py-0.5 rounded text-xs shrink-0 tabular ${badgeTone}`}>
                      {wait.text}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {ticket.items.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { advanceItem(item.id, item.preparation_status); }}
                        title={t('kds.tapToAdvance')}
                        className="w-full flex justify-between items-start gap-2 p-3 bg-gray-950/50 border border-gray-800 rounded-control text-start hover:bg-gray-800/40 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-blue-400 tabular">
                              {formatNumber(item.qty)}×
                            </span>
                            <span className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                              {item.name}
                            </span>
                          </div>
                          {item.note && (
                            // Modifiers are what the line cook actually acts on.
                            <p className="text-xs text-amber-400 mt-1 ms-7 font-semibold">
                              {item.note}
                            </p>
                          )}
                        </div>

                        <span className={`px-2 py-1 rounded text-xs font-semibold shrink-0 ${STATUS_CHIP[item.preparation_status]}`}>
                          {t(STATUS_LABEL[item.preparation_status])}
                        </span>
                      </button>
                    ))}
                  </div>

                  {ticket.order_note && (
                    <div className="px-4 py-2 border-t border-gray-800 bg-gray-950/30">
                      <p className="text-xs text-gray-500 font-medium">{t('kds.orderNote')}</p>
                      <p className="text-xs text-gray-300 font-semibold">{ticket.order_note}</p>
                    </div>
                  )}

                  <div className="p-3 border-t border-gray-800 bg-gray-950/40 rounded-b-card flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      block
                      onClick={() => { setOrderStatus(ticket.order_id, 'ready'); }}
                      className="text-xs border-gray-700 text-emerald-400 hover:bg-emerald-950/30"
                    >
                      {t('kds.allReady')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      block
                      onClick={() => { setOrderStatus(ticket.order_id, 'served'); }}
                      className="text-xs border-gray-700 text-gray-400 hover:bg-gray-800"
                    >
                      {t('kds.allServed')}
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
