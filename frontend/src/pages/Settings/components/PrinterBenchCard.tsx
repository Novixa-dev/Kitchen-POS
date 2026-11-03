import React, { useEffect, useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import { api, type PrinterModelDTO, type VirtualPreview } from '../../../lib/ipc';
import type { TranslationKey } from '../../../i18n/types';

type Target = 'receipt' | 'kitchen' | 'test';

const TARGETS: { value: Target; labelKey: TranslationKey }[] = [
  { value: 'receipt', labelKey: 'bench.targetReceipt' },
  { value: 'kitchen', labelKey: 'bench.targetKitchen' },
  { value: 'test', labelKey: 'bench.targetTest' },
];

/**
 * The printer test bench.
 *
 * Checking that a receipt fits a 58 mm roll used to mean owning a 58 mm
 * printer and feeding paper into it. This lays the outlet's *own* receipt
 * out as any of the bundled models would, so the outlet name that is two
 * characters too wide is found while setting up rather than by a customer.
 *
 * The preview uses the real settings — name, tax number, currency, footer —
 * with only the paper width swapped for the model being previewed. A canned
 * sample that always fits would tell nobody anything.
 */
export const PrinterBenchCard: React.FC = () => {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [models, setModels] = useState<PrinterModelDTO[]>([]);
  const [modelId, setModelId] = useState('');
  const [target, setTarget] = useState<Target>('receipt');
  const [preview, setPreview] = useState<VirtualPreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void api.printerBench.models().then((res) => {
      if (!active || !res.success || !res.data) { return; }
      const { models: found } = res.data;
      setModels(found);
      setModelId(current => (current === '' ? found[0]?.id ?? '' : current));
    }).catch(() => { /* the card stays empty rather than breaking Settings */ });
    return () => { active = false; };
  }, []);

  const run = async (nextModelId = modelId, nextTarget = target) => {
    if (nextModelId === '') { return; }
    setBusy(true);
    try {
      const res = await api.printerBench.virtualPreview({
        modelId: nextModelId,
        target: nextTarget,
      });
      if (!res.success || !res.data) {
        showToast({ message: res.error ?? t('toast.unexpectedError'), variant: 'error' });
        return;
      }
      setPreview(res.data);
    } finally {
      setBusy(false);
    }
  };

  const chosen = models.find(m => m.id === modelId);
  const fits = preview !== null && preview.overflowing.length === 0;

  return (
    <SettingsSection title={t('bench.title')} description={t('bench.hint')}>
      <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
        <label className="block">
          <span className="block text-sm font-medium text-muted mb-1.5">{t('bench.model')}</span>
          <select
            value={modelId}
            onChange={(e) => { setModelId(e.target.value); void run(e.target.value); }}
            className="w-full rounded-control border border-line bg-surface p-2.5 text-sm text-body"
          >
            {models.map(model => (
              <option key={model.id} value={model.id}>
                {model.vendor} {model.model}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-muted mb-1.5">{t('bench.document')}</span>
          <select
            value={target}
            onChange={(e) => {
              const next = e.target.value as Target;
              setTarget(next);
              void run(modelId, next);
            }}
            className="w-full rounded-control border border-line bg-surface p-2.5 text-sm text-body"
          >
            {TARGETS.map(option => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>
      </div>

      {chosen && (
        <p className="text-xs text-subtle">
          {/* Millimetres, dots and columns are LTR measurements. */}
          <span dir="ltr">
            {chosen.printableMm} mm · {chosen.dotsPerLine} dots · {chosen.charsPerLine} cols
          </span>
          {' · '}
          {chosen.cutter ? t('bench.hasCutter') : t('bench.noCutter')}
        </p>
      )}

      <Button
        variant="secondary"
        className="w-fit"
        disabled={busy || modelId === ''}
        onClick={() => { void run(); }}
      >
        {t('bench.render')}
      </Button>

      {preview && (
        <div className="space-y-2">
          {fits ? (
            <p className="text-xs text-success">
              {t('bench.fits', { columns: String(preview.columns) })}
            </p>
          ) : (
            <p className="text-xs text-danger">
              {t('bench.overflows', {
                count: String(preview.overflowing.length),
                columns: String(preview.columns),
              })}
            </p>
          )}

          {preview.hardSplit.length > 0 && (
            <p className="text-xs text-warning">
              {t('bench.hardSplit', { words: preview.hardSplit.slice(0, 3).join(', ') })}
            </p>
          )}

          {/* The paper. Monospaced and LTR regardless of interface language:
              a column grid is only meaningful if the columns line up, and
              the printer itself lays the glyphs out right-to-left. */}
          <pre
            dir="ltr"
            className="overflow-x-auto rounded-control bg-surface-sunken p-3 text-[11px] leading-snug font-mono text-body"
          >
            {preview.lines
              .map((line, index) =>
                preview.overflowing.includes(index) ? `${line}  ⟵` : line,
              )
              .join('\n')}
          </pre>
        </div>
      )}
    </SettingsSection>
  );
};
