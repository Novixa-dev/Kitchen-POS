import { useMemo, useState } from 'react';
import { Button, Input, Select, Toggle } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import {
  EMPTY_PROMOTION,
  toPromotionPayload,
  validatePromotionDraft,
  type PromotionDraft,
} from '../rules';

interface MenuOption { id: number; name: string }
interface CategoryOption { id: number; name: string }

interface Props {
  initial?: PromotionDraft;
  items: MenuOption[];
  categories: CategoryOption[];
  onCancel: () => void;
  onSave: (payload: ReturnType<typeof toPromotionPayload>) => Promise<void>;
}

/** Sunday first, matching `Date.getDay()`, which is what the engine reads. */
const WEEKDAY_KEYS = [
  'weekday.short.0', 'weekday.short.1', 'weekday.short.2', 'weekday.short.3',
  'weekday.short.4', 'weekday.short.5', 'weekday.short.6',
] as const;

/**
 * The offer form.
 *
 * Fields appear only when they mean something: a cap belongs to a percentage,
 * a target to an item-scoped rule, an item to a gift. Showing a field that
 * the backend will ignore teaches the admin that it does something.
 */
const PromotionModal: React.FC<Props> = ({ initial, items, categories, onCancel, onSave }) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PromotionDraft>(initial ?? EMPTY_PROMOTION);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const problems = useMemo(() => validatePromotionDraft(draft), [draft]);

  const set = <K extends keyof PromotionDraft>(key: K, value: PromotionDraft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: number) => {
    setDraft(prev => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter(d => d !== day)
        : [...prev.activeDays, day],
    }));
  };

  const handleSave = async () => {
    if (problems.length > 0) { setShowErrors(true); return; }
    setSaving(true);
    try {
      await onSave(toPromotionPayload(draft));
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.kind')}</span>
          <Select
            value={draft.kind}
            onChange={e => { set('kind', e.target.value as PromotionDraft['kind']); }}
          >
            <option value="percent">{t('offers.kind.percent')}</option>
            <option value="amount">{t('offers.kind.amount')}</option>
            <option value="free_item">{t('offers.kind.free_item')}</option>
          </Select>
        </label>

        {draft.kind === 'free_item' ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('offers.freeItem')}</span>
            <Select value={draft.freeItemId} onChange={e => { set('freeItemId', e.target.value); }}>
              <option value="">—</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('offers.value')}</span>
            <Input
              type="number"
              min="0"
              step={draft.kind === 'percent' ? '1' : '0.01'}
              value={draft.value}
              onChange={e => { set('value', e.target.value); }}
            />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.scope')}</span>
          <Select
            value={draft.scope}
            onChange={e => { set('scope', e.target.value as PromotionDraft['scope']); }}
          >
            <option value="bill">{t('offers.scope.bill')}</option>
            <option value="item">{t('offers.scope.item')}</option>
          </Select>
        </label>

        {draft.scope === 'item' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">{t('offers.targetCategory')}</span>
              <Select
                value={draft.targetCategoryId}
                onChange={e => {
                  set('targetCategoryId', e.target.value);
                  // One target, not two: a rule naming both reads as an
                  // intersection the engine does not implement.
                  if (e.target.value) { set('targetItemId', ''); }
                }}
              >
                <option value="">{t('offers.anyItem')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">{t('offers.targetItem')}</span>
              <Select
                value={draft.targetItemId}
                onChange={e => {
                  set('targetItemId', e.target.value);
                  if (e.target.value) { set('targetCategoryId', ''); }
                }}
              >
                <option value="">{t('offers.anyItem')}</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.minSubtotal')}</span>
          <Input
            type="number" min="0" step="0.01"
            value={draft.minSubtotal}
            onChange={e => { set('minSubtotal', e.target.value); }}
          />
        </label>

        {draft.kind === 'percent' && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('offers.maxDiscount')}</span>
            <Input
              type="number" min="0" step="0.01"
              value={draft.maxDiscount}
              onChange={e => { set('maxDiscount', e.target.value); }}
            />
            <span className="text-xs text-subtle">{t('offers.maxDiscountHint')}</span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.code')}</span>
          <Input
            value={draft.code}
            onChange={e => { set('code', e.target.value.toUpperCase()); }}
            placeholder="WELCOME10"
          />
          <span className="text-xs text-subtle">{t('offers.codeHint')}</span>
        </label>

        <div className="flex flex-col gap-3 pt-6">
          <Toggle
            checked={draft.autoApply}
            onChange={e => { set('autoApply', e.target.checked); }}
            label={t('offers.autoApply')}
          />
          <span className="text-xs text-subtle">{t('offers.autoApplyHint')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.startsAt')}</span>
          <Input type="date" value={draft.startsAt} onChange={e => { set('startsAt', e.target.value); }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.endsAt')}</span>
          <Input type="date" value={draft.endsAt} onChange={e => { set('endsAt', e.target.value); }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.startTime')}</span>
          <Input
            placeholder="17:00"
            value={draft.startTime}
            onChange={e => { set('startTime', e.target.value); }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.endTime')}</span>
          <Input
            placeholder="23:00"
            value={draft.endTime}
            onChange={e => { set('endTime', e.target.value); }}
          />
        </label>
      </div>
      <p className="text-xs text-subtle -mt-2">{t('offers.timeHint')}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-muted mb-1">{t('offers.activeDays')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_KEYS.map((key, day) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={draft.activeDays.includes(day) ? 'primary' : 'outline'}
              onClick={() => { toggleDay(day); }}
              aria-pressed={draft.activeDays.includes(day)}
              className="!rounded-full !px-3 !text-xs"
            >
              {t(key)}
            </Button>
          ))}
        </div>
        {draft.activeDays.length === 0 && (
          <span className="text-xs text-subtle">{t('offers.allDays')}</span>
        )}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.usageLimit')}</span>
          <Input
            type="number" min="0" step="1"
            placeholder={t('offers.unlimited')}
            value={draft.usageLimit}
            onChange={e => { set('usageLimit', e.target.value); }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.usageLimitPerCustomer')}</span>
          <Input
            type="number" min="0" step="1"
            placeholder={t('offers.unlimited')}
            value={draft.usageLimitPerCustomer}
            onChange={e => { set('usageLimitPerCustomer', e.target.value); }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('offers.priority')}</span>
          <Input
            type="number" step="1"
            value={draft.priority}
            onChange={e => { set('priority', e.target.value); }}
          />
          <span className="text-xs text-subtle">{t('offers.priorityHint')}</span>
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <Toggle
          checked={draft.stackable}
          onChange={e => { set('stackable', e.target.checked); }}
          label={t('offers.stackable')}
        />
        <span className="text-xs text-subtle -mt-2">{t('offers.stackableHint')}</span>
        <Toggle
          checked={draft.isActive}
          onChange={e => { set('isActive', e.target.checked); }}
          label={t('offers.isActive')}
        />
      </div>

      {showErrors && problems.length > 0 && (
        <ul className="text-sm text-danger list-disc ps-5 space-y-1" role="alert">
          {problems.map(p => <li key={p}>{t(p)}</li>)}
        </ul>
      )}

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="outline" onClick={onCancel}>{t('action.cancel')}</Button>
        <Button
          onClick={() => { void handleSave(); }}
          disabled={saving}
        >
          {t('action.save')}
        </Button>
      </div>
    </div>
  );
};

export default PromotionModal;
