import React, { useCallback, useEffect, useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import {
  api,
  type AppSettings,
  type PaperWidth,
  type PrinterInfo,
  type PrinterModelDTO,
} from '../../../lib/ipc';
import { announceSettingsChanged } from '../../../lib/useAppSettings';

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

interface Detected {
  printer: PrinterInfo;
  model: PrinterModelDTO;
  matched: string | null;
  recognised: boolean;
  suggestedPaperWidth: PaperWidth;
}

/**
 * Detect the attached printers and configure one in a single press.
 *
 * What this does: asks the operating system what is attached, identifies
 * each by name against the bundled model database, and applies the right
 * paper width — which is the setting people get wrong, because nobody knows
 * off-hand that their roll gives 48 printable millimetres.
 *
 * What it deliberately does not do is download and install a driver. That
 * was asked for and is not possible from inside the app: installing a
 * printer driver is an administrator action, per operating system, per
 * vendor, from a signed package, and no cross-platform API exposes it.
 * Claiming otherwise would mean a button that silently does nothing. The
 * honest version is this: say exactly which printer is attached and what it
 * needs, so the person installing it knows what to look for — then one press
 * to apply everything the app itself controls.
 */
export const PrinterDetectCard: React.FC<Props> = ({ settings, onSaved }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  // `null` until the OS has been asked, so "no printers attached" reads
  // differently from "not yet enumerated".
  const [detected, setDetected] = useState<Detected[] | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Ask the OS what is attached and identify each one.
   *
   * Kept free of state so the mount effect can apply the result inside a
   * `.then` and drop a response that arrives after unmount, rather than
   * writing state from the effect body.
   */
  const identifyAll = useCallback(async (): Promise<Detected[]> => {
    const res = await api.print.listPrinters();
    const printers = res.success && res.data ? res.data : [];

    const identified = await Promise.all(printers.map(async (printer) => {
      const match = await api.printerBench.identify({ name: printer.name });
      if (!match.success || !match.data) { return null; }
      return { printer, ...match.data };
    }));

    return identified.filter((entry): entry is Detected => entry !== null);
  }, []);

  const scan = useCallback(async () => {
    setBusy(true);
    try {
      setDetected(await identifyAll());
    } finally {
      setBusy(false);
    }
  }, [identifyAll]);

  useEffect(() => {
    let active = true;
    identifyAll()
      .then((entries) => { if (active) { setDetected(entries); } })
      .catch(() => { if (active) { setDetected([]); } });
    return () => { active = false; };
  }, [identifyAll]);

  /**
   * Apply everything the app controls for this printer, in one press.
   *
   * The receipt printer *and* the paper width together: setting the printer
   * without the width is how an 80 mm layout ends up truncated on a 58 mm
   * roll, which is the failure this card exists to prevent.
   */
  const apply = async (entry: Detected) => {
    setBusy(true);
    try {
      const res = await api.settings.save({
        print: {
          ...settings.print,
          receiptPrinter: entry.printer.name,
          paperWidth: entry.suggestedPaperWidth,
        },
      });

      if (!res.success) {
        showToast({ message: res.error ?? t('toast.unexpectedError'), variant: 'error' });
        return;
      }

      announceSettingsChanged();
      onSaved();
      showToast({ message: t('detect.applied', { name: entry.printer.name }), variant: 'success' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title={t('detect.title')} description={t('detect.hint')}>
      {detected === null && (
        <p className="text-sm text-subtle">{t('detect.scanning')}</p>
      )}

      {detected?.length === 0 && (
        <p className="text-sm text-muted">{t('detect.none')}</p>
      )}

      {detected !== null && detected.length > 0 && (
        <ul className="space-y-3">
          {detected.map(entry => (
            <li
              key={entry.printer.name}
              className="rounded-control border border-line p-3 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  {/* A printer name is a device identifier, not prose. */}
                  <p className="text-sm font-medium text-body truncate" dir="ltr">
                    {entry.printer.displayName || entry.printer.name}
                  </p>
                  <p className="text-xs text-subtle">
                    {entry.recognised
                      ? t('detect.recognised', {
                          model: `${entry.model.vendor} ${entry.model.model}`,
                        })
                      : t('detect.unrecognised')}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => { void apply(entry); }}
                >
                  {t('detect.apply')}
                </Button>
              </div>

              <p className="text-xs text-muted">
                {t('detect.suggested', {
                  paper: entry.suggestedPaperWidth,
                  columns: String(entry.model.charsPerLine),
                })}
              </p>

              {!entry.recognised && (
                <p className="text-xs text-warning">{t('detect.driverHelp')}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        className="w-fit"
        disabled={busy}
        onClick={() => { void scan(); }}
      >
        {t('detect.refresh')}
      </Button>
    </SettingsSection>
  );
};
