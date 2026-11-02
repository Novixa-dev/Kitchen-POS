import React, { useEffect, useMemo, useState } from 'react';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';
import { useI18n } from '../../../i18n/useI18n';
import type { TranslationKey } from '../../../i18n/types';

export type TableStatus = 'available' | 'occupied' | 'bill_requested';

interface Props {
  name: string;
  capacity: number;
  status: TableStatus;
  customerName?: string | null;
  createdAt?: string | null;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const STATUS_LABEL: Record<TableStatus, TranslationKey> = {
  available: 'tables.available',
  occupied: 'tables.occupied',
  bill_requested: 'tables.billRequested',
};

/**
 * Status colours are intentionally hardcoded rather than tokenised: on a busy
 * floor the green/amber/red reading is the whole point of the card, and it
 * must not shift with the theme.
 */
const STATUS_CHIP: Record<TableStatus, string> = {
  available: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/60',
  occupied: 'bg-amber-500/10 text-amber-700 border-amber-300/60',
  bill_requested: 'bg-rose-500/10 text-rose-700 border-rose-300/60 animate-pulse',
};

const STATUS_BAR: Record<TableStatus, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-amber-500',
  bill_requested: 'bg-rose-600',
};

/** Minutes between ticks — the card shows hh:mm, so a second-level timer is waste. */
const TICK_MS = 30_000;

/**
 * SQLite writes `CURRENT_TIMESTAMP` as a space-separated UTC string with no
 * zone marker. `new Date()` would read that as *local* time, so a table would
 * appear to have been occupied for hours (or negative time) depending on the
 * machine's offset.
 */
function parseDbTimestamp(value: string): number {
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
}

const TableStatusCard: React.FC<Props> = ({
  name,
  capacity,
  status,
  customerName,
  createdAt,
  onOpen,
  onEdit,
  onDelete,
}) => {
  const { t, formatNumber } = useI18n();

  // Only the clock is state; the label is derived from it. Storing the label
  // instead would mean writing state from inside the effect on every render
  // path, including the "not occupied" one.
  const [now, setNow] = useState(() => Date.now());

  const isTicking = status !== 'available' && Boolean(createdAt);

  useEffect(() => {
    if (!isTicking) { return; }
    const timer = setInterval(() => { setNow(Date.now()); }, TICK_MS);
    return () => { clearInterval(timer); };
  }, [isTicking]);

  const occupiedFor = useMemo(() => {
    if (!isTicking || !createdAt) { return ''; }
    const started = parseDbTimestamp(createdAt);
    if (Number.isNaN(started)) { return ''; }
    const minutes = Math.max(0, Math.floor((now - started) / 60_000));
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }, [isTicking, createdAt, now]);

  return (
    // A real <button> rather than a clickable <div>: the floor plan has to be
    // reachable by keyboard on terminals without a touchscreen.
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name} — ${t(STATUS_LABEL[status])}`}
      className="group relative overflow-hidden rounded-card border border-line bg-surface-raised shadow-card text-start transition-all duration-300 hover:shadow-raised hover:-translate-y-1 flex flex-col h-full"
    >
      <div className={`h-1.5 w-full ${STATUS_BAR[status]}`} />

      <div className="p-4 flex flex-col flex-1 w-full">
        {/* Row actions, revealed on hover/focus. Anchored to the inline end so
            they stay in the corner under RTL. */}
        {(onEdit !== undefined || onDelete !== undefined) && (
          <div className="absolute top-2 end-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-20">
            {onEdit && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onEdit(); }
                }}
                className="p-1.5 text-subtle hover:text-brand hover:bg-brand-subtle rounded-control transition-colors cursor-pointer"
                aria-label={t('tables.editTable')}
              >
                <SvgIcon name="edit" width="14" height="14" />
              </span>
            )}
            {onDelete && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onDelete(); }
                }}
                className="p-1.5 text-subtle hover:text-danger hover:bg-danger-subtle rounded-control transition-colors cursor-pointer"
                aria-label={t('action.delete')}
              >
                <SvgIcon name="trash" width="14" height="14" />
              </span>
            )}
          </div>
        )}

        <div className="flex justify-between items-start gap-2 mb-4 mt-1">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-body leading-tight mb-1.5 truncate">{name}</h3>

            {status !== 'available' && (
              <p className="text-sm font-semibold text-muted mb-2 truncate">
                {customerName ?? t('customers.walkIn')}
              </p>
            )}

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-subtle bg-surface-sunken px-2 py-1 rounded-control">
              <SvgIcon name="users" width="13" height="13" aria-hidden />
              <span className="tabular">{formatNumber(capacity)}</span>
              <span>{t('tables.seats')}</span>
            </div>
          </div>

          {occupiedFor && (
            <div className="flex items-center gap-1.5 bg-surface-sunken rounded-control px-2 py-1 text-xs font-bold text-muted shrink-0">
              <SvgIcon name="clock" width="13" height="13" className="text-amber-500" aria-hidden />
              {/* `dir="ltr"` keeps hh:mm from being mirrored to mm:hh in RTL. */}
              <span dir="ltr" className="tabular">{occupiedFor}</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-3 border-t border-line flex items-center justify-between">
          <span className={`text-[10px] px-2.5 py-1 rounded-control border font-bold uppercase tracking-wider ${STATUS_CHIP[status]}`}>
            {t(STATUS_LABEL[status])}
          </span>

          {/* Affordance hint — flipped under RTL so it still points "forward". */}
          <SvgIcon
            name="caret-right"
            width="16"
            height="16"
            aria-hidden
            className="rtl-flip text-subtle opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </button>
  );
};

export default TableStatusCard;
