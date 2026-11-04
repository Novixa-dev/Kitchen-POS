import { useMemo, useState } from 'react';
import { Button, Input, Select, Toggle } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import {
  EMPTY_LOYALTY,
  toLoyaltyPayload,
  validateLoyaltyDraft,
  type LoyaltyDraft,
} from '../rules';

interface MenuOption { id: number; name: string }

interface Props {
  initial?: LoyaltyDraft;
  items: MenuOption[];
  onCancel: () => void;
  onSave: (payload: ReturnType<typeof toLoyaltyPayload>) => Promise<void>;
}

/**
 * The loyalty-rule form.
 *
 * A rule is "count X, then give Y". The two halves are kept visually apart
 * because they are independent choices: counting visits can reward money, and
 * counting spend can reward a dish.
 */
const LoyaltyModal: React.FC<Props> = ({ initial, items, onCancel, onSave }) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState<LoyaltyDraft>(initial ?? EMPTY_LOYALTY);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const problems = useMemo(() => validateLoyaltyDraft(draft), [draft]);

  const set = <K extends keyof LoyaltyDraft>(key: K, value: LoyaltyDraft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (problems.length > 0) { setShowErrors(true); return; }
    setSaving(true);
    try {
      await onSave(toLoyaltyPayload(draft));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 max-h-[80vh] overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.nameAr')}</span>
          <Input value={draft.nameAr} onChange={e => { set('nameAr', e.target.value); }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.nameEn')}</span>
          <Input value={draft.nameEn} onChange={e => { set('nameEn', e.target.value); }} />
        </label>
      </div>

      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-line rounded-card p-4">
        <legend className="text-sm font-medium px-2">{t('offers.basis')}</legend>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.basis')}</span>
          <Select
            value={draft.basis}
            onChange={e => { set('basis', e.target.value as LoyaltyDraft['basis']); }}
          >
            <option value="visits">{t('offers.basis.visits')}</option>
            <option value="spend">{t('offers.basis.spend')}</option>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.threshold')}</span>
          <Input
            type="number"
            min="0"
            step={draft.basis === 'visits' ? '1' : '0.01'}
            value={draft.threshold}
            onChange={e => { set('threshold', e.target.value); }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.windowDays')}</span>
          <Input
            type="number" min="0" step="1"
            value={draft.windowDays}
            onChange={e => { set('windowDays', e.target.value); }}
          />
          <span className="text-xs text-subtle">{t('offers.windowHint')}</span>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-line rounded-card p-4">
        <legend className="text-sm font-medium px-2">{t('offers.rewardKind')}</legend>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.rewardKind')}</span>
          <Select
            value={draft.rewardKind}
            onChange={e => { set('rewardKind', e.target.value as LoyaltyDraft['rewardKind']); }}
          >
            <option value="percent">{t('offers.kind.percent')}</option>
            <option value="amount">{t('offers.kind.amount')}</option>
            <option value="free_item">{t('offers.kind.free_item')}</option>
          </Select>
        </label>

        {draft.rewardKind === 'free_item' ? (
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm text-muted">{t('offers.rewardItem')}</span>
            <Select value={draft.rewardItemId} onChange={e => { set('rewardItemId', e.target.value); }}>
              <option value="">—</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">{t('offers.rewardValue')}</span>
              <Input
                type="number" min="0"
                step={draft.rewardKind === 'percent' ? '1' : '0.01'}
                value={draft.rewardValue}
                onChange={e => { set('rewardValue', e.target.value); }}
              />
            </label>
            {draft.rewardKind === 'percent' && (
              <label className="flex flex-col gap-1">
                <span className="text-sm text-muted">{t('offers.rewardMax')}</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={draft.rewardMaxDiscount}
                  onChange={e => { set('rewardMaxDiscount', e.target.value); }}
                />
              </label>
            )}
          </>
        )}
      </fieldset>

      <Toggle
        checked={draft.isActive}
        onChange={e => { set('isActive', e.target.checked); }}
        label={t('offers.isActive')}
      />

      {showErrors && problems.length > 0 && (
        <ul className="text-sm text-danger list-disc ps-5 space-y-1" role="alert">
          {problems.map(p => <li key={p}>{t(p)}</li>)}
        </ul>
      )}

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="outline" onClick={onCancel}>{t('action.cancel')}</Button>
        <Button onClick={() => { void handleSave(); }} disabled={saving}>
          {t('action.save')}
        </Button>
      </div>
    </div>
  );
};

export default LoyaltyModal;
