import { Button, Input } from '../../../components/atoms';
import React, { useState } from 'react';
import { MenuItem } from '../../../types/models';
import { api } from '../../../lib/ipc';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';
import { useAppSettings } from '../../../lib/useAppSettings';

interface Props {
  item: MenuItem | null;
  categoryId: number;
  onSuccess: () => void;
}

const MenuItemModal: React.FC<Props> = ({ item, categoryId, onSuccess }) => {
  const { t, currency } = useI18n();
  const { showToast } = useToast();
  const settings = useAppSettings();

  // Per-item CGST/SGST and HSN only exist under the Indian GST regime. A VAT
  // outlet charges one bill-level rate, so asking for a per-dish rate would
  // be a field that silently does nothing.
  const showGstFields = settings?.tax.mode === 'gst';

  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [isVeg, setIsVeg] = useState(item ? item.is_veg === 1 : true);
  const [cgst, setCgst] = useState(item?.cgst_rate?.toString() ?? '2.5');
  const [sgst, setSgst] = useState(item?.sgst_rate?.toString() ?? '2.5');
  const [hsn, setHsn] = useState(item?.hsn_code ?? '');
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '');

  const handleImageUpload = async () => {
    try {
      const res = await api.menu.uploadImage();
      if (res.success && res.data) {
        setImageUrl(res.data);
      } else if (res.error !== 'Upload cancelled') {
        showToast({ message: res.error ?? t('menu.imageUploadFailed'), variant: 'error' });
      }
    } catch {
      showToast({ message: t('menu.imageUploadFailed'), variant: 'error' });
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast({ message: t('validation.nameRequired'), variant: 'warning' });
      return;
    }
    const parsedPrice = Number.parseFloat(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      showToast({ message: t('validation.priceRequired'), variant: 'warning' });
      return;
    }

    try {
      const payload: Partial<MenuItem> = {
        name: name.trim(),
        price: parsedPrice,
        category_id: categoryId,
        is_veg: isVeg ? 1 : 0,
        // Keep the stored rates intact when the fields are hidden, so moving
        // an outlet from GST to VAT and back does not destroy its rates.
        cgst_rate: Number.parseFloat(cgst) || 0,
        sgst_rate: Number.parseFloat(sgst) || 0,
        hsn_code: hsn,
        image_url: imageUrl || null,
        is_available: item ? item.is_available : 1,
      };

      if (item) { payload.id = item.id; }

      const res = await api.menu.upsertItem(payload);
      if (res.success) {
        showToast({ message: t('menu.dishSaved'), variant: 'success' });
        onSuccess();
      } else {
        showToast({ message: res.error ?? t('menu.dishSaveFailed'), variant: 'error' });
      }
    } catch {
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    }
  };

  const priceLabel = `${t('label.price')} (${currency.symbol || currency.code})`;

  return (
    <form id="menu-item-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      <Input
        label={t('menu.itemName')}
        type="text"
        required
        value={name}
        onChange={(e) => { setName(e.target.value); }}
        placeholder={t('menu.dishPlaceholder')}
        autoFocus
      />

      <div>
        <span className="block text-sm font-medium text-muted mb-1">{t('menu.image')}</span>
        <div className="flex items-center gap-3 flex-wrap">
          {imageUrl && (
            // Served through the confined `local://` handler, which the CSP
            // allows; a raw `file://` would be blocked.
            <img
              src={imageUrl.replace('file://', 'local://')}
              alt=""
              className="w-12 h-12 rounded-control object-cover border border-line"
            />
          )}
          <Button type="button" variant="outline" onClick={() => { void handleImageUpload(); }}>
            {imageUrl ? t('menu.changeImage') : t('menu.uploadImage')}
          </Button>
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              className="text-danger"
              onClick={() => { setImageUrl(''); }}
            >
              {t('action.remove')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={priceLabel}
          type="number"
          required
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => { setPrice(e.target.value); }}
          placeholder="0.00"
        />

        <div>
          <span className="block text-sm font-medium text-muted mb-1">{t('menu.dietaryType')}</span>
          <div className="flex bg-surface-sunken rounded-control p-1" role="group">
            <Button
              type="button"
              variant="ghost"
              block
              aria-pressed={isVeg}
              onClick={() => { setIsVeg(true); }}
              className={`rounded-control ${isVeg ? 'bg-surface shadow-card text-emerald-700' : 'text-subtle'}`}
            >
              {t('menu.veg')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              block
              aria-pressed={!isVeg}
              onClick={() => { setIsVeg(false); }}
              className={`rounded-control ${!isVeg ? 'bg-surface shadow-card text-rose-700' : 'text-subtle'}`}
            >
              {t('menu.nonVeg')}
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-line pt-4 mt-2">
        <h3 className="text-sm font-bold text-body mb-3">{t('menu.taxAndBilling')}</h3>

        {showGstFields ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Input
                label={`${t('tax.cgst')} (%)`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={cgst}
                onChange={(e) => { setCgst(e.target.value); }}
              />
              <Input
                label={`${t('tax.sgst')} (%)`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={sgst}
                onChange={(e) => { setSgst(e.target.value); }}
              />
            </div>

            <Input
              label={t('menu.hsnCode')}
              type="text"
              value={hsn}
              onChange={(e) => { setHsn(e.target.value); }}
              placeholder="2106"
            />
          </>
        ) : (
          <p className="text-sm text-subtle">{t('menu.taxFromSettings')}</p>
        )}
      </div>
    </form>
  );
};

export default MenuItemModal;
