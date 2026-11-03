import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBusinessSession } from '../../../contexts/BusinessSessionContext';
import { useAuthStore } from '../../../store/auth';
import { useToast } from '../../../hooks/useToast';
import { useModal } from '../../../hooks/useModal';
import { SvgIcon } from '../../atoms/svg-sprite-loader';
import Button from '../../atoms/button/button';
import { api } from '../../../lib/ipc';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../../../i18n/useI18n';
import { splitElapsed } from '../../../lib/datetime';

/** The duration label only shows hours and minutes, so a minute tick is enough. */
const TICK_MS = 60_000;

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center gap-3 text-sm">
    <span className="text-subtle">{label}</span>
    <span className="font-medium text-body tabular">{value}</span>
  </div>
);

const QuickActionsFAB: React.FC = () => {
  const { t, formatNumber, formatTime, formatDate } = useI18n();
  const location = useLocation();
  const { showToast } = useToast();
  const { showModal, hideModal } = useModal();

  const isLoginScreen = location.pathname === '/' || location.pathname === '/login';
  const { activeSession, startSession, closeSession } = useBusinessSession();
  const staff = useAuthStore(state => state.staff);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Only the clock is state; the label is derived from it.
  useEffect(() => {
    if (!activeSession) { return; }
    const timer = setInterval(() => { setNow(Date.now()); }, TICK_MS);
    return () => { clearInterval(timer); };
  }, [activeSession]);

  const elapsed = useMemo(() => {
    if (!activeSession) { return ''; }
    // Goes through `splitElapsed`, which parses SQLite's zone-less UTC
    // timestamps correctly. The previous version combined
    // `performance.timeOrigin` with a hand-built date string.
    const { hours, minutes } = splitElapsed(activeSession.started_at, now);
    return t('session.durationValue', {
      hours: formatNumber(hours),
      minutes: formatNumber(minutes),
    });
  }, [activeSession, now, t, formatNumber]);

  // Dismiss on an outside click, and on Escape — the panel is a popover.
  useEffect(() => {
    if (!open) { return; }

    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleStart = async () => {
    if (!staff) { return; }
    setLoading(true);
    const { ok, error } = await startSession(staff.id);
    setLoading(false);
    if (ok) {
      showToast({ message: t('session.started'), variant: 'success' });
      setOpen(false);
    } else {
      showToast({ message: error ?? t('session.startFailed'), variant: 'error' });
    }
  };

  const handleClose = async () => {
    if (!activeSession || !staff) { return; }
    setLoading(true);
    const { ok, error } = await closeSession(activeSession.id, staff.id);
    setLoading(false);
    if (ok) {
      showToast({ message: t('session.closed'), variant: 'success' });
      setOpen(false);
    } else {
      showToast({ message: error ?? t('session.closeFailed'), variant: 'error' });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.backup.export({});
      if (res.success && res.data) {
        showToast({ message: t('settings.exportSuccess', { path: res.data }), variant: 'success' });
        setOpen(false);
      } else {
        showToast({ message: res.error ?? t('settings.exportFailed'), variant: 'error' });
      }
    } catch {
      showToast({ message: t('settings.exportFailed'), variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    showModal({
      title: t('settings.importBackup'),
      content: <p className="text-sm text-muted">{t('settings.importWarning')}</p>,
      actions: (
        <>
          <Button variant="secondary" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              setIsImporting(true);
              api.backup.import({})
                .then(res => {
                  if (!res.success && res.error && res.error !== 'Cancelled') {
                    showToast({ message: res.error, variant: 'error' });
                  }
                })
                .catch(() => {
                  showToast({ message: t('settings.importFailed'), variant: 'error' });
                })
                .finally(() => { setIsImporting(false); });
            }}
          >
            {t('settings.importConfirm')}
          </Button>
        </>
      ),
    });
  };

  const startLabel = (() => {
    if (loading) { return t('session.starting'); }
    if (!staff) { return t('session.loginRequired'); }
    return t('session.start');
  })();

  return (
    // Anchored to the inline end so the FAB sits in the trailing corner in
    // both directions.
    <div ref={panelRef} className="fixed bottom-6 end-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-72 bg-surface-raised rounded-card shadow-overlay border border-line overflow-hidden flex flex-col">
          <div className={`px-4 py-3 border-b ${activeSession ? 'bg-success-subtle border-success/20' : 'bg-surface-muted border-line'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-body">{t('session.businessDay')}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${activeSession ? 'bg-success-subtle text-success' : 'bg-surface-sunken text-subtle'}`}>
                {t(activeSession ? 'state.active' : 'state.inactive')}
              </span>
            </div>
          </div>

          <div className="px-4 py-4 space-y-3">
            {activeSession ? (
              <>
                <InfoRow
                  label={t('session.businessDate')}
                  value={formatDate(`${activeSession.business_date}T00:00:00`)}
                />
                <InfoRow
                  label={t('session.startedAt')}
                  value={formatTime(`${activeSession.started_at}Z`)}
                />
                <InfoRow label={t('session.duration')} value={elapsed} />

                <div className="pt-2 border-t border-line">
                  <Button
                    variant="danger"
                    className="w-full justify-center"
                    onClick={() => { void handleClose(); }}
                    disabled={loading}
                  >
                    {loading ? t('session.closing') : t('session.close')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-subtle">{t('session.noneActiveHint')}</p>
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => { void handleStart(); }}
                  disabled={loading || !staff}
                >
                  {startLabel}
                </Button>
              </>
            )}
          </div>

          {/* Backup is offered on the lock screen because after a reinstall
              there is no PIN to sign in with and reach Settings. */}
          {isLoginScreen && (
            <div className="bg-surface-muted px-4 py-3 border-t border-line">
              <span className="font-semibold text-xs text-muted uppercase tracking-wider block mb-2">
                {t('settings.dataBackups')}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => { void handleExport(); }}
                  disabled={isExporting || isImporting}
                >
                  {isExporting ? t('settings.exporting') : t('action.export')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs text-brand border-brand/30 hover:bg-brand-subtle"
                  onClick={handleImport}
                  disabled={isExporting || isImporting}
                >
                  {isImporting ? t('settings.importing') : t('action.import')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => { setOpen(o => !o); }}
        className={`w-14 h-14 rounded-full shadow-raised flex items-center justify-center transition-all hover:scale-105 active:scale-95 text-white ${
          activeSession
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-slate-700 hover:bg-slate-800'
        }`}
        aria-label={t(activeSession ? 'session.fabActive' : 'session.fabInactive')}
        aria-expanded={open}
      >
        <SvgIcon name="calendar" width="22" height="22" aria-hidden />
      </button>
    </div>
  );
};

export default QuickActionsFAB;
