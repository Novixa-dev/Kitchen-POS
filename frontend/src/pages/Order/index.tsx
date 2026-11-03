import { BackButton, Button, Input, Select } from '../../components/atoms';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MenuPanel from './components/MenuPanel';
import CartPanel from './components/CartPanel';
import { CartItem, Customer, Menu, MenuItem, OrderItem, Table } from '../../types/models';
import BillModal, { BillModalHandle } from './components/BillModal';
import CancelOrderModal from './components/CancelOrderModal';
import { api } from '../../lib/ipc';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { CustomerSelect } from '../../components/organisms/CustomerSelect';
import { useAuthStore } from '../../store/auth';
import { useBusinessSession } from '../../contexts/BusinessSessionContext';
import { SvgIcon } from '../../components/atoms/svg-sprite-loader';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/types';

type OrderType = 'dine-in' | 'takeaway' | 'delivery';

interface SentKot {
  kotNumber: number;
  items: CartItem[];
}

/** An order read from the database, before it is pushed into component state. */
interface LoadedOrder {
  id: number;
  createdAt: string;
  type: OrderType;
  kots: SentKot[];
  customer: Customer | null;
}

const ORDER_TYPE_LABEL: Record<OrderType, TranslationKey> = {
  'dine-in': 'order.type.dineIn',
  takeaway: 'order.type.takeaway',
  delivery: 'order.type.delivery',
};

/** Table id 0 is the sentinel for a counter/takeaway order with no table. */
const NO_TABLE = 0;

/**
 * Group order items into the kitchen tickets they were sent on.
 *
 * Extracted because the page previously inlined this mapping twice — once on
 * load and again after voiding a line — and the two copies had already
 * drifted apart (one carried `originalQty`, the other did not).
 */
function groupIntoKots(items: OrderItem[]): SentKot[] {
  const byTicket = new Map<number, CartItem[]>();

  for (const item of items) {
    const ticket = typeof item.kot_number === 'number' ? item.kot_number : 0;
    const cartItem: CartItem = {
      id: item.menu_item_id,
      orderItemId: item.id,
      name: item.name,
      price: item.unit_price,
      qty: item.qty,
      note: item.note ?? '',
      status: item.preparation_status,
      originalQty: item.qty,
      kot_number: item.kot_number,
    };
    const bucket = byTicket.get(ticket);
    if (bucket) { bucket.push(cartItem); } else { byTicket.set(ticket, [cartItem]); }
  }

  // Newest ticket first: that is the one staff are asked about.
  return [...byTicket.entries()]
    .map(([kotNumber, kotItems]) => ({ kotNumber, items: kotItems }))
    .sort((a, b) => b.kotNumber - a.kotNumber);
}

const OrderPage: React.FC = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { t, formatNumber } = useI18n();
  const staff = useAuthStore(s => s.staff);

  const numericTableId = Number(tableId);

  const [unsentItems, setUnsentItems] = useState<CartItem[]>([]);
  const [sentKOTs, setSentKOTs] = useState<SentKot[]>([]);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tableInfo, setTableInfo] = useState<Table | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<OrderType>(
    numericTableId === NO_TABLE ? 'takeaway' : 'dine-in',
  );
  // Only the clock is state; the label is derived, so nothing is written to
  // state from inside the effect.
  const [now, setNow] = useState(() => Date.now());
  const [isSending, setIsSending] = useState(false);

  const { activeSession } = useBusinessSession();
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const billModalRef = useRef<BillModalHandle>(null);

  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // ── menus ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    api.menu.getMenus().then(res => {
      if (!active || !res.success || !res.data) { return; }
      const activeMenus = res.data.filter(m => m.is_active === 1);
      setMenus(activeMenus);
      if (activeMenus.length > 0) {
        setActiveMenuId((activeMenus.find(m => m.is_default) ?? activeMenus[0]).id);
      }
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  // ── existing order for this table ────────────────────────────────────────

  /**
   * Fetch without touching state, so callers decide when to apply the result.
   *
   * Keeping the two apart means the mount effect can apply inside a `.then`
   * rather than writing state synchronously from the effect body, and the
   * cleanup flag can drop a response that arrives after unmount.
   */
  const fetchOrder = useCallback(async (): Promise<LoadedOrder | null> => {
    if (!tableId) { return null; }

    const res = await api.orders.getByTable({ tableId: numericTableId });
    if (!res.success || !res.data) { return null; }

    const order = res.data;
    let customerRecord: Customer | null = null;

    if (order.customer_id) {
      const custRes = await api.customers.getById(order.customer_id);
      customerRecord = custRes.success && custRes.data
        ? custRes.data
        // The order holds a denormalised name; use it so the cashier still
        // sees who the order belongs to even if the record has gone.
        : {
            id: order.customer_id,
            name: order.customer_name ?? t('state.unknown'),
            phone: null,
            email: null,
            loyalty_points: 0,
            total_visits: 0,
            credit_limit: 0,
            outstanding_balance: 0,
            created_at: '',
          };
    }

    return {
      id: order.id,
      createdAt: order.created_at,
      type: order.type,
      kots: groupIntoKots(order.items),
      customer: customerRecord,
    };
  }, [tableId, numericTableId, t]);

  const applyOrder = useCallback((order: LoadedOrder | null) => {
    if (!order) { return; }
    setOrderId(order.id);
    setCreatedAt(order.createdAt);
    setOrderType(order.type);
    setSentKOTs(order.kots);
    setUnsentItems([]);
    if (order.customer) { setCustomer(order.customer); }
  }, []);

  const refreshOrder = useCallback(
    () => fetchOrder().then(applyOrder),
    [fetchOrder, applyOrder],
  );

  useEffect(() => {
    let active = true;

    fetchOrder()
      .then(order => { if (active) { applyOrder(order); } })
      .catch(console.error);

    api.tables.getAll().then(res => {
      if (!active || !res.success || !res.data) { return; }
      setTableInfo(res.data.find(x => x.id === numericTableId) ?? null);
    }).catch(console.error);

    return () => { active = false; };
  }, [fetchOrder, applyOrder, numericTableId]);

  // ── how long the table has been occupied ─────────────────────────────────
  useEffect(() => {
    if (!createdAt) { return; }
    const timer = setInterval(() => { setNow(Date.now()); }, 30_000);
    return () => { clearInterval(timer); };
  }, [createdAt]);

  const occupiedFor = useMemo(() => {
    if (!createdAt) { return ''; }

    // SQLite stores `CURRENT_TIMESTAMP` as UTC with no zone marker; reading it
    // as local time would skew the age by the machine's offset.
    const iso = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
    const started = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
    if (Number.isNaN(started)) { return ''; }

    const minutes = Math.max(0, Math.floor((now - started) / 60_000));
    const hours = Math.floor(minutes / 60);
    return hours > 0
      ? `${formatNumber(hours)}:${String(minutes % 60).padStart(2, '0')}`
      : `${formatNumber(minutes)}′`;
  }, [createdAt, now, formatNumber]);

  const tableLabel = useMemo(() => {
    if (!tableInfo) { return `${t('tables.title')} ${formatNumber(numericTableId)}`; }
    return tableInfo.custom_name ? `${tableInfo.name} (${tableInfo.custom_name})` : tableInfo.name;
  }, [tableInfo, numericTableId, t, formatNumber]);

  // ── temporary table name ─────────────────────────────────────────────────
  const handleRenameTable = () => {
    if (!tableInfo) { return; }
    let draft = tableInfo.custom_name ?? '';

    showModal({
      title: t('order.renameTable'),
      content: (
        <div className="space-y-2">
          <p className="text-sm text-subtle">{t('order.renameTableHint')}</p>
          <Input
            defaultValue={draft}
            onChange={(e) => { draft = e.target.value; }}
            autoFocus
          />
        </div>
      ),
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => {
              hideModal();
              const customName = draft.trim() === '' ? null : draft.trim();
              api.tables.updateCustomName({ id: tableInfo.id, customName })
                .then(res => {
                  if (res.success) {
                    setTableInfo({ ...tableInfo, custom_name: customName });
                    showToast({ message: t('order.tableRenamed'), variant: 'success' });
                  } else {
                    showToast({ message: res.error ?? t('order.tableRenameFailed'), variant: 'error' });
                  }
                })
                .catch(() => {
                  showToast({ message: t('order.tableRenameFailed'), variant: 'error' });
                });
            }}
          >
            {t('action.save')}
          </Button>
        </>
      ),
    });
  };

  // ── customer ─────────────────────────────────────────────────────────────
  const handleCustomerSelect = async (selected: Customer | null) => {
    setCustomer(selected);
    if (!selected) { return; }

    if (!activeSession && !orderId) {
      showToast({ message: t('order.startBusinessDayFirst'), variant: 'warning' });
      return;
    }

    if (orderId) {
      await api.orders.updateCustomer({ orderId, customerId: selected.id });
      return;
    }

    if (!tableId) { return; }

    // Attaching a customer to an empty table opens the order, which is how
    // staff hold a table for a booking.
    const res = await api.orders.create({
      tableId: numericTableId,
      staffId: staff?.id,
      customerId: selected.id,
      type: orderType,
    });
    if (res.success && res.data) {
      setOrderId(res.data);
      setCreatedAt(new Date().toISOString());
      showToast({ message: t('order.tableReserved', { name: selected.name }), variant: 'success' });
    }
  };

  // ── cart ─────────────────────────────────────────────────────────────────
  const handleAddItem = (menuItem: MenuItem) => {
    setUnsentItems(prev => {
      const existing = prev.find(item => item.id === menuItem.id);
      if (existing) {
        return prev.map(item => item.id === menuItem.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1, note: '' }];
    });
  };

  const handleUpdateQty = (id: number, delta: number) => {
    setUnsentItems(prev =>
      prev
        .map(item => item.id === id ? { ...item, qty: item.qty + delta } : item)
        .filter(item => item.qty > 0),
    );
  };

  const handleUpdateNote = (id: number, note: string) => {
    setUnsentItems(prev => prev.map(item => item.id === id ? { ...item, note } : item));
  };

  const handleCancelItem = (orderItemId: number) => {
    if (!orderId) { return; }

    showModal({
      title: t('order.voidItem'),
      content: (
        <CancelOrderModal
          scope="item"
          onConfirm={(note) => {
            hideModal();
            api.orders.cancelOrderItem({ orderId, orderItemId, note })
              .then(res => {
                if (res.success) {
                  showToast({ message: t('order.itemVoided'), variant: 'success' });
                  void refreshOrder();
                } else {
                  showToast({ message: res.error ?? t('toast.failed'), variant: 'error' });
                }
              })
              .catch(() => { showToast({ message: t('toast.unexpectedError'), variant: 'error' }); });
          }}
        />
      ),
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('order.goBack')}</Button>
          <Button type="submit" form="cancel-order-form" variant="danger">{t('order.confirmVoid')}</Button>
        </>
      ),
    });
  };

  // ── kitchen ──────────────────────────────────────────────────────────────
  const handleSendKOT = async (shouldPrint: boolean) => {
    if (!tableId || (unsentItems.length === 0 && !orderId)) { return; }

    if (!activeSession && !orderId) {
      showToast({ message: t('order.startBusinessDayFirst'), variant: 'warning' });
      return;
    }

    setIsSending(true);
    try {
      const res = await api.orders.sendKOT({
        tableId: numericTableId,
        items: unsentItems,
        staffId: staff?.id,
        customerId: customer?.id,
        type: orderType,
      });

      if (!res.success || !res.data) {
        showToast({ message: res.error ?? t('toast.failed'), variant: 'error' });
        return;
      }

      if (shouldPrint) {
        if (res.data.itemsToPrint.length === 0) {
          showToast({ message: t('order.noItemsToSend'), variant: 'warning' });
        } else {
          // The ticket carries the table's real label and its own number, so
          // the kitchen can match it to the floor plan. The previous payload
          // printed a raw "Table <id>".
          void api.print.kot({
            items: res.data.itemsToPrint.map(i => ({ name: i.name, qty: i.qty, note: i.note })),
            tableName: tableLabel,
            orderType: t(ORDER_TYPE_LABEL[orderType]),
            kotNumber: res.data.itemsToPrint[0]?.kot_number ?? null,
          }).then(printRes => {
            if (!printRes.success) {
              showToast({
                message: t('print.failed', { error: printRes.error ?? '' }),
                variant: 'error',
              });
            }
          }).catch(() => {
            showToast({ message: t('print.failed', { error: '' }), variant: 'error' });
          });
        }
      } else {
        showToast({ message: t('order.saved'), variant: 'success' });
      }

      navigate('/tables');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelOrder = async (note: string) => {
    if (!tableId) { return; }

    // Nothing has been persisted yet — just drop the cart.
    if (!orderId) {
      setUnsentItems([]);
      hideModal();
      navigate('/tables');
      return;
    }

    try {
      const res = await api.orders.cancelOrder({ orderId, note });
      if (res.success) {
        setUnsentItems([]);
        setSentKOTs([]);
        hideModal();
        navigate('/tables');
      } else {
        showToast({ message: res.error ?? t('toast.failed'), variant: 'error' });
      }
    } catch {
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    }
  };

  const openBillModal = () => {
    if (!orderId) {
      showToast({ message: t('order.notSentYet'), variant: 'warning' });
      return;
    }
    if (unsentItems.length > 0) {
      showToast({ message: t('order.saveOrSendFirst'), variant: 'warning' });
      return;
    }

    showModal({
      title: t('order.billTitle'),
      size: 'xl',
      content: (
        <BillModal
          ref={billModalRef}
          orderId={orderId}
          cart={sentKOTs.flatMap(k => k.items)}
          initialCustomer={customer}
          onClose={hideModal}
        />
      ),
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button variant="secondary" onClick={() => { billModalRef.current?.save(); }}>
            {t('order.completeAndSave')}
          </Button>
          <Button variant="primary" onClick={() => { billModalRef.current?.print(); }}>
            {t('order.printReceipt')}
          </Button>
        </>
      ),
    });
  };

  const openVoidModal = () => {
    showModal({
      title: t('order.voidOrder'),
      content: <CancelOrderModal onConfirm={(note) => { void handleCancelOrder(note); }} />,
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('order.goBack')}</Button>
          <Button type="submit" form="cancel-order-form" variant="danger">{t('order.confirmVoid')}</Button>
        </>
      ),
    });
  };

  return (
    <div className="flex h-full bg-surface relative">
      {/* Anchored to the inline start so it stays in the leading corner in RTL. */}
      <div className="absolute top-0 start-0 p-4 z-10">
        <BackButton to="/tables" label={t('order.backToTables')} />
      </div>

      {/* Menu — `border-e` is logical, so the divider follows the direction. */}
      <div className="flex-1 p-6 pt-14 border-e border-line bg-surface-muted flex flex-col overflow-hidden">
        <div className="flex justify-between items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold text-body">{t('menu.title')}</h1>
          {menus.length > 1 && (
            <div className="w-48">
              <Select
                value={String(activeMenuId ?? '')}
                onChange={(e) => { setActiveMenuId(Number(e.target.value)); }}
                aria-label={t('menu.menus')}
              >
                {menus.map(m => (
                  <option key={m.id} value={String(m.id)}>{m.name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <MenuPanel menuId={activeMenuId} onAddItem={handleAddItem} />
      </div>

      {/* Cart */}
      <div className="w-96 bg-surface p-6 flex flex-col shadow-raised z-0">
        <div className="flex justify-between items-start gap-2 mb-4">
          <div className="flex flex-col min-w-0">
            <h2 className="text-xl font-bold text-body">{t('order.currentOrder')}</h2>
            {occupiedFor && (
              <div className="flex items-center gap-1 text-xs font-medium text-subtle mt-0.5">
                <SvgIcon name="clock" width="13" height="13" aria-hidden />
                <span>{t('order.occupiedFor', { time: occupiedFor })}</span>
              </div>
            )}
          </div>

          <span className="px-3 py-1 bg-brand-subtle text-brand rounded-full text-sm font-bold shrink-0">
            {numericTableId === NO_TABLE ? (
              <select
                value={orderType}
                onChange={e => { setOrderType(e.target.value as OrderType); }}
                aria-label={t('label.type')}
                className="bg-transparent font-bold focus:outline-none"
              >
                <option value="takeaway">{t('order.type.takeaway')}</option>
                <option value="delivery">{t('order.type.delivery')}</option>
              </select>
            ) : (
              <span className="flex items-center gap-2">
                <span className="truncate max-w-[9rem]">{tableLabel}</span>
                <button
                  type="button"
                  onClick={handleRenameTable}
                  className="rounded-full p-1 hover:bg-brand/10"
                  title={t('order.renameTable')}
                  aria-label={t('order.renameTable')}
                >
                  <SvgIcon name="edit" width="13" height="13" />
                </button>
              </span>
            )}
          </span>
        </div>

        <div className="mb-4">
          <CustomerSelect
            selectedCustomer={customer}
            onSelect={(c) => { void handleCustomerSelect(c); }}
            placeholder={t('order.assignCustomer')}
          />
        </div>

        <CartPanel
          unsentItems={unsentItems}
          sentKOTs={sentKOTs}
          onUpdateQty={handleUpdateQty}
          onUpdateNote={handleUpdateNote}
          onCancelItem={handleCancelItem}
          onSendKOT={(print) => { if (!isSending) { void handleSendKOT(print); } }}
          onGenerateBill={openBillModal}
          onVoidOrder={openVoidModal}
        />
      </div>
    </div>
  );
};

export default OrderPage;
