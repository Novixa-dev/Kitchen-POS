import { Autosearch, Button } from '../../components/atoms';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/ipc';
import { InventoryItem } from '../../types/models';
import { InventoryItemModal } from './components/InventoryItemModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { Card } from '../../components/atoms/card';
import { useModal } from '../../hooks/useModal';
import { useHeader } from '../../contexts/HeaderContext';
import { useI18n } from '../../i18n/useI18n';

export default function InventoryPage() {
  const { t, formatCurrency, formatNumber } = useI18n();
  const { showModal, hideModal } = useModal();

  // `null` distinguishes "not loaded" from "loaded and empty".
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInventory = useCallback(() => {
    return api.inventory.getAll()
      .then(res => {
        if (res.success && res.data) {
          setItems(res.data);
          setError(null);
        } else {
          setError(res.error ?? t('inventory.loadFailed'));
        }
      })
      .catch(() => { setError(t('inventory.loadFailed')); });
  }, [t]);

  useEffect(() => {
    fetchInventory().catch(console.error);
  }, [fetchInventory]);

  const openItemModal = useCallback((item: InventoryItem | null) => {
    showModal({
      title: t(item ? 'inventory.editItem' : 'inventory.addItem'),
      content: (
        <InventoryItemModal
          initialData={item}
          onClose={hideModal}
          onRefresh={() => { void fetchInventory(); }}
        />
      ),
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button type="submit" form="inventory-item-form" variant="primary">
            {t('inventory.saveItem')}
          </Button>
        </>
      ),
    });
  }, [showModal, hideModal, fetchInventory, t]);

  const openAdjustModal = (item: InventoryItem) => {
    showModal({
      title: t('inventory.adjustFor', { name: item.name }),
      content: (
        <StockAdjustmentModal
          item={item}
          onClose={hideModal}
          onRefresh={() => { void fetchInventory(); }}
        />
      ),
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button type="submit" form="stock-adjust-form" variant="primary">
            {t('action.confirm')}
          </Button>
        </>
      ),
    });
  };

  const searchOptions = useMemo(
    () => (items ?? []).map(item => ({ value: String(item.id), label: item.name })),
    [items],
  );

  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader(
      t('page.inventory'),
      <div className="flex items-center gap-3">
        <div className="w-64">
          <Autosearch
            placeholder={t('inventory.searchPlaceholder')}
            options={searchOptions}
            value={searchQuery}
            onChange={setSearchQuery}
            onSelectOption={(opt) => { setSearchQuery(opt.label); }}
          />
        </div>
        <Button variant="primary" icon="plus" onClick={() => { openItemModal(null); }}>
          {t('inventory.addItem')}
        </Button>
      </div>,
    );
    return () => { setHeader(null, null); };
  }, [setHeader, searchQuery, searchOptions, openItemModal, t]);

  const filteredItems = useMemo(() => {
    const needle = searchQuery.trim().toLocaleLowerCase();
    const all = items ?? [];
    if (!needle) { return all; }
    return all.filter(item => item.name.toLocaleLowerCase().includes(needle));
  }, [items, searchQuery]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-danger mb-4">{error}</p>
        <Button variant="outline" onClick={() => { void fetchInventory(); }}>
          {t('action.retry')}
        </Button>
      </div>
    );
  }

  if (items === null) {
    return <div className="p-8 text-center text-subtle">{t('inventory.loading')}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="container-responsive p-6">
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <p className="text-muted max-w-md">{t('inventory.empty')}</p>
          <Button variant="primary" icon="plus" onClick={() => { openItemModal(null); }}>
            {t('inventory.addItem')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-responsive p-6 mx-auto h-full flex flex-col">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-muted border-b border-line text-sm font-medium text-subtle">
                <th className="py-3 px-4 text-start">{t('inventory.itemName')}</th>
                <th className="py-3 px-4 text-end">{t('inventory.inStockColumn')}</th>
                <th className="py-3 px-4 text-end">{t('inventory.costPerUnit')}</th>
                <th className="py-3 px-4 text-center">{t('label.status')}</th>
                <th className="py-3 px-4 text-end">{t('label.actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-subtle">
                    {t('inventory.noResults')}
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isLowStock = item.qty_in_stock <= item.low_stock_alert_at;
                  return (
                    <tr key={item.id} className="hover:bg-surface-sunken transition-colors group">
                      <td className="py-3 px-4 font-medium text-body">{item.name}</td>

                      <td className="py-3 px-4 text-end whitespace-nowrap">
                        <span className={`font-semibold tabular ${isLowStock ? 'text-danger' : 'text-body'}`}>
                          {formatNumber(item.qty_in_stock, { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-subtle text-sm ms-1">{item.unit}</span>
                      </td>

                      <td className="py-3 px-4 text-end text-muted tabular">
                        {formatCurrency(item.cost_per_unit)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isLowStock
                              ? 'bg-danger-subtle text-danger'
                              : 'bg-success-subtle text-success'
                          }`}
                        >
                          {t(isLowStock ? 'inventory.lowStock' : 'inventory.healthy')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-end">
                        {/* Revealed on hover *and* focus, so the row actions are
                            reachable by keyboard. */}
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button variant="secondary" size="sm" onClick={() => { openAdjustModal(item); }}>
                            {t('inventory.adjustStock')}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { openItemModal(item); }}>
                            {t('inventory.editDetails')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
