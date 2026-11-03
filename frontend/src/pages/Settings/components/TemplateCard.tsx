import React, { useEffect, useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import { announceSettingsChanged } from '../../../lib/useAppSettings';
import {
  api,
  type BlockManifestDTO,
  type ReceiptTemplateDTO,
  type TemplateKind,
} from '../../../lib/ipc';
import type { TranslationKey } from '../../../i18n/types';

interface Props {
  onSaved: () => void;
}

const KINDS: { value: TemplateKind; labelKey: TranslationKey }[] = [
  { value: 'bill', labelKey: 'template.kindBill' },
  { value: 'kitchen', labelKey: 'template.kindKitchen' },
];

/**
 * The print template designer.
 *
 * A list rather than a canvas, deliberately: a thermal receipt is a single
 * column of stacked blocks, so a free-form canvas would offer placements the
 * paper cannot honour. Ordering and hiding is the whole of what the medium
 * allows.
 *
 * Required blocks are shown with their toggle fixed rather than hidden from
 * the list, so it is clear they exist and why they cannot be removed — a
 * bill with no total is not a bill.
 */
export const TemplateCard: React.FC<Props> = ({ onSaved }) => {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [blocks, setBlocks] = useState<BlockManifestDTO[]>([]);
  const [presets, setPresets] = useState<ReceiptTemplateDTO[]>([]);
  const [current, setCurrent] = useState<Record<TemplateKind, ReceiptTemplateDTO> | null>(null);
  const [kind, setKind] = useState<TemplateKind>('bill');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void api.templates.get().then((res) => {
      if (!active || !res.success || !res.data) { return; }
      setBlocks(res.data.blocks);
      setPresets(res.data.presets);
      setCurrent(res.data.current);
    }).catch(() => { /* the card stays empty rather than breaking Settings */ });
    return () => { active = false; };
  }, []);

  const after = (next: Record<TemplateKind, ReceiptTemplateDTO> | undefined) => {
    if (next) { setCurrent(next); }
    announceSettingsChanged();
    onSaved();
  };

  const run = async (
    action: () => Promise<{ success: boolean; data?: Record<TemplateKind, ReceiptTemplateDTO>; error?: string }>,
  ) => {
    setBusy(true);
    try {
      const res = await action();
      if (!res.success) {
        showToast({ message: res.error ?? t('toast.unexpectedError'), variant: 'error' });
        return;
      }
      after(res.data);
    } finally {
      setBusy(false);
    }
  };

  const template = current?.[kind];
  const manifestOf = (id: string) => blocks.find(b => b.id === id);
  const forKind = presets.filter(p => p.kind === kind);

  return (
    <SettingsSection title={t('template.title')} description={t('template.hint')}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('template.title')}>
        {KINDS.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            onClick={() => { setKind(option.value); }}
            className={`px-3 py-2 rounded-control border text-sm font-medium transition-colors ${
              kind === option.value
                ? 'border-brand bg-brand-subtle text-brand'
                : 'border-line text-muted hover:bg-surface-sunken'
            }`}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>

      {forKind.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{t('template.startFrom')}</span>
          {forKind.map(preset => (
            <Button
              key={preset.id}
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void run(() => api.templates.applyPreset({ kind, presetId: preset.id }));
              }}
            >
              {t(preset.nameKey as TranslationKey)}
            </Button>
          ))}
        </div>
      )}

      {template && (
        <ul className="space-y-1 max-w-xl">
          {template.blocks.map((block, index) => {
            const manifest = manifestOf(block.id);
            const required = manifest?.required === true;

            return (
              <li
                key={`${block.id}-${index}`}
                className="flex items-center gap-2 rounded-control border border-line p-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--kp-brand)]"
                  checked={block.visible}
                  // Required blocks are shown with the toggle fixed rather
                  // than removed from the list, so it is clear why.
                  disabled={required || busy}
                  onChange={(e) => {
                    void run(() => api.templates.setBlock({
                      kind, id: block.id, visible: e.target.checked,
                    }));
                  }}
                />

                <span className="flex-1 min-w-0 text-sm text-body truncate">
                  {manifest ? t(manifest.nameKey as TranslationKey) : block.id}
                  {required && (
                    <span className="ms-2 text-xs text-subtle">{t('template.required')}</span>
                  )}
                </span>

                {/* Up and down rather than drag: it works with a keyboard,
                    on a touchscreen till, and with a mouse. */}
                <button
                  type="button"
                  aria-label={t('template.moveUp')}
                  disabled={busy || index === 0}
                  onClick={() => {
                    void run(() => api.templates.move({ kind, from: index, to: index - 1 }));
                  }}
                  className="px-2 py-1 rounded-control text-muted hover:bg-surface-sunken disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t('template.moveDown')}
                  disabled={busy || index === template.blocks.length - 1}
                  onClick={() => {
                    void run(() => api.templates.move({ kind, from: index, to: index + 1 }));
                  }}
                  className="px-2 py-1 rounded-control text-muted hover:bg-surface-sunken disabled:opacity-40"
                >
                  ↓
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        variant="secondary"
        className="w-fit"
        disabled={busy}
        onClick={() => { void run(() => api.templates.reset({ kind })); }}
      >
        {t('template.reset')}
      </Button>

      <p className="text-xs text-subtle">{t('template.previewHint')}</p>
    </SettingsSection>
  );
};
