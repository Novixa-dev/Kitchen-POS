import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input, Select, Toggle } from '../../../components/atoms';
import { SettingsSection } from './SettingsSection';
import { useI18n } from '../../../i18n/useI18n';
import {
  api,
  type AppSettings,
  type PaperWidth,
  type PrinterInfo,
  type PrintTarget,
} from '../../../lib/ipc';
import { announceSettingsChanged } from '../../../lib/useAppSettings';
import { useToast } from '../../../hooks/useToast';
import { useSyncedState } from '../../../lib/useSyncedState';
import type { TranslationKey } from '../../../i18n/types';

interface Props {
  settings: AppSettings;
  onSaved: () => void;
}

const PAPER_OPTIONS: { value: PaperWidth; labelKey: TranslationKey }[] = [
  { value: '58mm', labelKey: 'print.paper.58mm' },
  { value: '80mm', labelKey: 'print.paper.80mm' },
  { value: 'a4', labelKey: 'print.paper.a4' },
];

export const PrintingCard: React.FC<Props> = ({ settings, onSaved }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  // `null` until the OS has been asked, so "no printers" is distinguishable
  // from "not yet enumerated".
  const [printers, setPrinters] = useState<PrinterInfo[] | null>(null);
  const print = settings.print;
  const [receiptPrinter, setReceiptPrinter] = useSyncedState(print, p => p.receiptPrinter);
  const [kitchenPrinter, setKitchenPrinter] = useSyncedState(print, p => p.kitchenPrinter);
  const [paperWidth, setPaperWidth] = useSyncedState(print, p => p.paperWidth);
  const [copies, setCopies] = useSyncedState(print, p => String(p.copies));
  const [silent, setSilent] = useSyncedState(print, p => p.silent);
  const [footerText, setFooterText] = useSyncedState(print, p => p.footerText);
  const [showTaxBreakdown, setShowTaxBreakdown] = useSyncedState(print, p => p.showTaxBreakdown);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<PrintTarget | null>(null);

  const loadPrinters = useCallback(() => {
    return api.print.listPrinters().then(res => {
      setPrinters(res.success && res.data ? res.data : []);
    });
  }, []);

  useEffect(() => {
    loadPrinters().catch(console.error);
  }, [loadPrinters]);

  const handleSave = async () => {
    const parsedCopies = Number.parseInt(copies, 10);

    setSaving(true);
    const res = await api.settings.save({
      print: {
        receiptPrinter,
        kitchenPrinter,
        paperWidth,
        copies: Number.isInteger(parsedCopies) ? Math.min(5, Math.max(1, parsedCopies)) : 1,
        silent,
        footerText: footerText.trim(),
        showTaxBreakdown,
      },
    });
    setSaving(false);

    if (res.success) {
      showToast({ message: t('settings.saved'), variant: 'success' });
      announceSettingsChanged();
      onSaved();
    } else {
      showToast({ message: res.error ?? t('settings.saveFailed'), variant: 'error' });
    }
  };

  const handleTestPrint = async (target: PrintTarget) => {
    setTesting(target);
    // Save first: the test page is rendered by the main process from the
    // *stored* settings, so testing unsaved values would print the old ones.
    await handleSave();

    const res = await api.print.test({ target });
    setTesting(null);

    if (res.success) {
      showToast({ message: t('print.testPrintSent'), variant: 'success' });
    } else {
      showToast({ message: t('print.failed', { error: res.error ?? '' }), variant: 'error' });
    }
  };

  const printerSelect = (
    label: string,
    value: string,
    onChange: (next: string) => void,
  ) => (
    <Select label={label} value={value} onChange={e => { onChange(e.target.value); }}>
      {/* An empty value means "whatever the OS considers default", which is
          the right behaviour on a machine with one printer. */}
      <option value="">{t('print.systemDefault')}</option>
      {(printers ?? []).map(p => (
        <option key={p.name} value={p.name}>
          {p.displayName}{p.isDefault ? ` — ${t('print.systemDefault')}` : ''}
        </option>
      ))}
    </Select>
  );

  return (
    <SettingsSection title={t('print.settings')}>

      {printers?.length === 0 && (
        <p className="text-sm text-warning bg-warning-subtle border border-warning/20 rounded-control p-3">
          {t('print.noPrinters')}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {printerSelect(t('print.receiptPrinter'), receiptPrinter, setReceiptPrinter)}
        {printerSelect(t('print.kitchenPrinter'), kitchenPrinter, setKitchenPrinter)}
      </div>

      <Button variant="outline" size="sm" onClick={() => { void loadPrinters(); }}>
        {t('print.refreshPrinters')}
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-line">
        <Select
          label={t('print.paperWidth')}
          value={paperWidth}
          onChange={e => { setPaperWidth(e.target.value as PaperWidth); }}
        >
          {PAPER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
          ))}
        </Select>

        <Input
          label={t('print.copies')}
          type="number"
          min="1"
          max="5"
          value={copies}
          onChange={e => { setCopies(e.target.value); }}
        />
      </div>

      <Toggle
        checked={silent}
        onChange={e => { setSilent(e.target.checked); }}
        label={t('print.silent')}
        description={t('print.silentHint')}
      />

      <Toggle
        checked={showTaxBreakdown}
        onChange={e => { setShowTaxBreakdown(e.target.checked); }}
        label={t('print.showTaxBreakdown')}
      />

      <div>
        <Input
          label={t('print.footerText')}
          value={footerText}
          onChange={e => { setFooterText(e.target.value); }}
          placeholder={t('settings.footerPlaceholder')}
        />
        <p className="text-xs text-subtle mt-1">{t('print.footerTextHint')}</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="primary" onClick={() => { void handleSave(); }} isLoading={saving}>
          {t('action.save')}
        </Button>
        <Button
          variant="secondary"
          icon="printer"
          disabled={testing !== null}
          onClick={() => { void handleTestPrint('receipt'); }}
        >
          {t('print.testPrint')} — {t('print.receiptPrinter')}
        </Button>
        <Button
          variant="outline"
          icon="printer"
          disabled={testing !== null}
          onClick={() => { void handleTestPrint('kitchen'); }}
        >
          {t('print.testPrint')} — {t('print.kitchenPrinter')}
        </Button>
      </div>
    </SettingsSection>
  );
};
