import { Button, Toggle } from '../../../components/atoms';
import React from 'react';
import { Category, MenuItem } from '../../../types/models';
import { api } from '../../../lib/ipc';
import { useModal } from '../../../hooks/useModal';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';
import { useAppSettings } from '../../../lib/useAppSettings';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';

type MenuData = Category & { items: MenuItem[] };

interface Props {
  category: MenuData;
  onEdit: (item: MenuItem) => void;
  onRecipeEdit: (item: MenuItem) => void;
  onAdd: () => void;
  onRefresh: () => void;
}

const MenuItemList: React.FC<Props> = ({ category, onEdit, onRecipeEdit, onAdd, onRefresh }) => {
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const { t, tPlural, formatCurrency, formatPercent } = useI18n();
  const settings = useAppSettings();

  // Per-item CGST/SGST rates and HSN codes only mean anything under the Indian
  // GST regime. Showing them to a VAT outlet is noise at best and misleading
  // at worst, since its tax comes from a single bill-level rate.
  const showGstFields = settings?.tax.mode === 'gst';

  const handleDelete = (item: MenuItem) => {
    showModal({
      title: t('menu.deleteDish'),
      size: 'sm',
      content: <p className="text-muted">{t('menu.deleteItemConfirm', { name: item.name })}</p>,
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              api.menu.deleteItem({ id: item.id })
                .then(res => {
                  if (res.success) {
                    showToast({ message: t('menu.dishDeleted'), variant: 'success' });
                    onRefresh();
                  } else {
                    showToast({ message: res.error ?? t('menu.deleteDishFailed'), variant: 'error' });
                  }
                })
                .catch(() => {
                  showToast({ message: t('toast.unexpectedError'), variant: 'error' });
                });
            }}
          >
            {t('action.delete')}
          </Button>
        </>
      ),
    });
  };

  const handleToggle = async (item: MenuItem) => {
    const nextAvailable = item.is_available === 1 ? 0 : 1;
    try {
      const res = await api.menu.toggleAvailable({ id: item.id, is_available: nextAvailable });
      if (res.success) {
        showToast({
          message: t(nextAvailable === 1 ? 'menu.markedAvailable' : 'menu.markedUnavailable'),
          variant: 'success',
        });
        onRefresh();
      } else {
        showToast({ message: res.error ?? t('menu.toggleFailed'), variant: 'error' });
      }
    } catch {
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-line flex justify-between items-center gap-3 bg-surface-muted">
        <div className="min-w-0">
          <h2 className="font-bold text-lg text-body truncate">{category.name}</h2>
          <p className="text-sm text-subtle">{tPlural('menu.itemCount', category.items.length)}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={onAdd}>{t('menu.addDish')}</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {category.items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {category.items.map(item => (
              <div
                key={item.id}
                className="border border-line rounded-card p-4 flex flex-col justify-between bg-surface-raised hover:shadow-raised transition-shadow"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex gap-2 items-center min-w-0">
                    <span
                      className={`inline-block w-3 h-3 rounded-full shrink-0 ${item.is_veg === 1 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      title={t(item.is_veg === 1 ? 'menu.isVeg' : 'menu.nonVeg')}
                    />
                    <h3 className="font-semibold text-body truncate">{item.name}</h3>
                  </div>
                  <span className="font-bold text-body shrink-0 tabular">
                    {formatCurrency(item.price)}
                  </span>
                </div>

                {showGstFields && (
                  <div className="text-xs text-subtle mb-4 flex gap-3 flex-wrap">
                    <span>{t('tax.cgst')}: {formatPercent(item.cgst_rate ?? 0)}</span>
                    <span>{t('tax.sgst')}: {formatPercent(item.sgst_rate ?? 0)}</span>
                    {item.hsn_code && <span>{t('menu.hsnCode')}: {item.hsn_code}</span>}
                  </div>
                )}

                <div className="flex justify-between items-center gap-2 pt-3 border-t border-line flex-wrap">
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={item.is_available === 1}
                      onChange={() => { void handleToggle(item); }}
                      aria-label={t('menu.available')}
                    />
                    <span className={`text-sm font-medium ${item.is_available === 1 ? 'text-success' : 'text-subtle'}`}>
                      {t(item.is_available === 1 ? 'menu.available' : 'menu.unavailable')}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { onRecipeEdit(item); }}>
                      {t('menu.recipe')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { onEdit(item); }}>
                      {t('action.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger hover:bg-danger-subtle"
                      onClick={() => { handleDelete(item); }}
                      aria-label={t('action.delete')}
                    >
                      <SvgIcon name="trash" width="14" height="14" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-subtle">
            {t('menu.noItems')}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuItemList;
