import { Button } from '../../components/atoms';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/ipc';
import TableStatusCard from './components/TableStatusCard';
import { useOrderStore } from '../../store/order';
import TableModal from './components/TableModal';
import { useHeader } from '../../contexts/HeaderContext';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/useI18n';
import { SvgIcon } from '../../components/atoms/svg-sprite-loader';

import { Table } from '../../types/models';

/** How often the floor plan re-reads open orders from the database. */
const POLL_INTERVAL_MS = 5000;

const TablesPage: React.FC = () => {
  const { t } = useI18n();
  // `null` distinguishes "not loaded yet" from "loaded and empty", so the
  // empty state cannot flash before the first fetch resolves.
  const [tables, setTables] = useState<Table[] | null>(null);
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { activeOrders, fetchOpenOrders, selectTable } = useOrderStore();

  const loadData = useCallback(() => {
    return api.tables.getAll()
      .then((res) => {
        if (res.success && res.data) { setTables(res.data); }
        return fetchOpenOrders();
      });
  }, [fetchOpenOrders]);

  useEffect(() => {
    loadData().catch(console.error);

    // The KDS and a second terminal mutate the same database, so the floor
    // plan polls rather than trusting its own last write.
    const intervalId = setInterval(() => {
      void fetchOpenOrders();
    }, POLL_INTERVAL_MS);

    return () => { clearInterval(intervalId); };
  }, [loadData, fetchOpenOrders]);

  const { setHeader } = useHeader();

  const openTableModal = useCallback((table?: Table) => {
    showModal({
      title: table ? t('tables.editTable') : t('tables.addTable'),
      content: <TableModal table={table} onSaved={() => { hideModal(); void loadData(); }} />,
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button type="submit" form="table-form" variant="primary">
            {table ? t('action.update') : t('action.create')}
          </Button>
        </>
      ),
    });
  }, [showModal, hideModal, loadData, t]);

  useEffect(() => {
    setHeader(
      t('page.tables'),
      <Button variant="primary" icon="plus" onClick={() => { openTableModal(); }}>
        {t('tables.addTable')}
      </Button>,
    );
    return () => { setHeader(null, null); };
  }, [setHeader, openTableModal, t]);

  const handleTableClick = (id: number) => {
    selectTable(id);
    navigate(`/order/${id}`);
  };

  const handleDelete = useCallback((table: Table) => {
    // Deleting a table is irreversible and removes it from the floor plan, so
    // it is confirmed rather than fired from a hover button.
    showModal({
      title: t('tables.editTable'),
      content: <p className="text-sm text-muted">{t('tables.deleteConfirm', { name: table.name })}</p>,
      actions: (
        <>
          <Button variant="secondary" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              void api.tables.delete({ id: table.id }).then((res) => {
                if (res.success) {
                  showToast({ message: t('toast.deleted'), variant: 'success' });
                  return loadData();
                }
                showToast({ message: res.error ?? t('toast.failed'), variant: 'error' });
                return undefined;
              });
            }}
          >
            {t('action.delete')}
          </Button>
        </>
      ),
    });
  }, [showModal, hideModal, showToast, loadData, t]);

  const getTableStatus = (tableId: number): 'available' | 'occupied' | 'bill_requested' => {
    const order = activeOrders.find(o => o.table_id === tableId);
    if (!order) { return 'available'; }
    if (order.status === 'billed') { return 'bill_requested'; }
    return 'occupied';
  };

  if (tables !== null && tables.length === 0) {
    return (
      <div className="container-responsive p-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SvgIcon name="grid" width="48" height="48" className="text-subtle mb-4" />
          <p className="text-muted max-w-md mb-6">{t('tables.empty')}</p>
          <Button variant="primary" icon="plus" onClick={() => { openTableModal(); }}>
            {t('tables.addTable')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-responsive p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {(tables ?? []).map(table => {
          const order = activeOrders.find(o => o.table_id === table.id);
          const status = getTableStatus(table.id);
          return (
            <TableStatusCard
              key={table.id}
              name={table.custom_name ? `${table.name} (${table.custom_name})` : table.name}
              capacity={table.capacity}
              status={status}
              customerName={order?.customer_name}
              createdAt={order?.created_at}
              onOpen={() => { handleTableClick(table.id); }}
              onEdit={() => { openTableModal(table); }}
              // Only an unoccupied table can be deleted: removing one with an
              // open order would orphan the order.
              onDelete={status === 'available' ? () => { handleDelete(table); } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
};

export default TablesPage;
