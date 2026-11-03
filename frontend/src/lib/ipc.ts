import { Category, MenuItem, InventoryItem, Order, OrderItem, CartItem, KDSTicket, Shift, RecipeItem, Table, Expense, Staff, BusinessSession, AutoBackupConfig, BackupReminderConfig } from '../types/models';

/** A printer as the operating system reports it. */
export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  status: number;
}

export type PrintTarget = 'receipt' | 'kitchen';

export interface KotPrintPayload {
  items: { name: string; qty: number; note?: string | null }[];
  tableName: string;
  orderNote?: string;
  kotNumber?: number | null;
  orderType?: string;
  createdAt?: string;
}

export interface BillPrintPayload {
  bill: {
    bill_number: string;
    taxable_amount: number;
    tax_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    discount_amount: number;
    total_amount: number;
    tax_mode?: TaxMode | null;
    tax_rate?: number | null;
    created_at?: string;
    date?: string;
  };
  orderItems: { name: string; qty: number; unit_price: number; discount?: number }[];
  payments?: { method: string; amount: number }[];
}

export type TaxMode = 'vat' | 'gst' | 'none';
export type PaperWidth = '58mm' | '80mm' | 'a4';

/**
 * Mirrors `backend/src/lib/settings.ts`.
 *
 * The main process validates and clamps every field, so the renderer can
 * treat these as present and well-formed.
 */
export interface AppSettings {
  locale: 'ar' | 'en';
  numerals: 'latn' | 'arab';
  theme: 'light' | 'dark' | 'system';
  currency: { code: string; symbol: string; decimals: number; position: 'before' | 'after' };
  outlet: { name: string; address: string; phone: string; taxNumber: string; logoPath: string };
  tax: { mode: TaxMode; rate: number; inclusive: boolean };
  print: {
    receiptPrinter: string;
    kitchenPrinter: string;
    paperWidth: PaperWidth;
    copies: number;
    silent: boolean;
    footerText: string;
    showTaxBreakdown: boolean;
  };
  kdsEnabled: boolean;
  inventoryAutoDebit: boolean;
}

/**
 * Flat keys that predate the settings schema. `settings:get` derives them
 * from the validated tree, so they can never disagree with it.
 */
export interface LegacySettingAliases {
  outlet_name: string;
  address: string;
  gstin: string;
  is_kds_enabled: boolean;
  inventory_auto_debit: boolean;
  currency_code: string;
  currency_symbol: string;
  currency_decimals: number;
  currency_position: 'before' | 'after';
}

/** A one-level-deep partial: nested groups are merged, not replaced. */
export type SettingsPatch = {
  [K in keyof AppSettings]?: AppSettings[K] extends object
    ? Partial<AppSettings[K]>
    : AppSettings[K];
};

export interface BillTotals {
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
}

export interface BillPreviewLine {
  id: number;
  name: string;
  qty: number;
  unit_price: number;
  taxable_amount: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_amount: number;
}

/**
 * Totals computed by the main process with the same engine that writes the
 * bill, so the figures shown before payment are the figures that get saved.
 */
export interface BillPreview {
  totals: BillTotals;
  tax: { mode: TaxMode; rate: number; inclusive: boolean };
  lines: BillPreviewLine[];
}

export interface CreatedBill extends BillTotals {
  billId: number | bigint;
  bill_number: string;
  tax_mode: TaxMode;
  tax_rate: number;
}

export interface DashboardMetrics {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  outstandingBalances: number;
}

/**
 * Period-over-period change, as a percentage.
 *
 * `null` means there is no baseline to compare against, which the UI must
 * render as "no trend" rather than as 0%.
 */
export interface DashboardTrends {
  totalSales: number | null;
  totalOrders: number | null;
  averageOrderValue: number | null;
  totalCustomers: number | null;
}

export interface DashboardData {
  filter: string;
  metrics: DashboardMetrics;
  trends: DashboardTrends;
  trendData: { label: string; sales: number; orders: number }[];
  topItemsData: { name: string; quantity: number }[];
}

/**
 * One feature module as the main process reports it.
 *
 * The manifest is carried over IPC rather than duplicated in the renderer, so
 * the UI cannot drift from the catalogue that is actually enforced.
 */
export interface FeatureModuleDTO {
  id: string;
  category: 'operations' | 'back-office' | 'growth';
  nameKey: string;
  descriptionKey: string;
  icon: string;
  requires: string[];
  locked: boolean;
  enabled: boolean;
  active: boolean;
}

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const ipcApi = (window as unknown as { api: unknown }).api;

const mockApi = {
  orders: {
    create: () => Promise.resolve({ success: true, data: 1 }),
    getOpen: () => Promise.resolve({ success: true, data: [] }),
    getByTable: () => Promise.resolve({ success: true, data: null }),
    sendKOT: () => Promise.resolve({ success: true, data: 1 }),
    cancelOrder: () => Promise.resolve({ success: true }),
  },
  kds: {
    getActiveTickets: () => Promise.resolve({ success: true, data: [] }),
    updateItemStatus: () => Promise.resolve({ success: true }),
    updateOrderStatus: () => Promise.resolve({ success: true }),
  },
  menu: {
    getAll: () => Promise.resolve({
      success: true,
      data: [
        {
          id: 1, name: 'Starters', sort_order: 1, is_active: 1,
          items: [
            { id: 101, category_id: 1, name: 'Paneer Tikka', price: 250, is_veg: 1, is_available: 1, cgst_rate: 2.5, sgst_rate: 2.5, hsn_code: '2106' },
            { id: 102, category_id: 1, name: 'Chicken Tikka', price: 350, is_veg: 0, is_available: 1, cgst_rate: 2.5, sgst_rate: 2.5, hsn_code: '2106' },
          ]
        },
        {
          id: 2, name: 'Main Course', sort_order: 2, is_active: 1,
          items: [
            { id: 201, category_id: 2, name: 'Butter Chicken', price: 450, is_veg: 0, is_available: 1, cgst_rate: 2.5, sgst_rate: 2.5, hsn_code: '2106' },
            { id: 202, category_id: 2, name: 'Dal Makhani', price: 300, is_veg: 1, is_available: 1, cgst_rate: 2.5, sgst_rate: 2.5, hsn_code: '2106' },
          ]
        },
        {
          id: 3, name: 'Breads', sort_order: 3, is_active: 1,
          items: [
            { id: 301, category_id: 3, name: 'Garlic Naan', price: 60, is_veg: 1, is_available: 1, cgst_rate: 2.5, sgst_rate: 2.5, hsn_code: '1905' },
            { id: 302, category_id: 3, name: 'Butter Roti', price: 30, is_veg: 1, is_available: 1, cgst_rate: 2.5, sgst_rate: 2.5, hsn_code: '1905' },
          ]
        }
      ]
    }),
    getMenus: () => Promise.resolve({ success: true, data: [{ id: 1, name: 'Main Menu', is_active: 1, is_default: 1 }] }),
    upsertMenu: () => Promise.resolve({ success: true, data: { id: 999 } }),
    duplicateMenu: () => Promise.resolve({ success: true, data: { id: 999 } }),
    uploadImage: () => Promise.resolve({ success: true, data: 'file:///tmp/img.png' }),
    upsertItem: () => Promise.resolve({ success: true, data: { id: 999 } }),
    deleteItem: () => Promise.resolve({ success: true }),
    toggleAvailable: () => Promise.resolve({ success: true }),
    upsertCategory: () => Promise.resolve({ success: true, data: { id: 99 } }),
    deleteCategory: () => Promise.resolve({ success: true }),
    getRecipe: () => Promise.resolve({ success: true, data: [] }),
    updateRecipe: () => Promise.resolve({ success: true }),
  },
  tables: {
    getAll: () => Promise.resolve({
      success: true,
      data: [
        { id: 1, name: 'Table 1', capacity: 4, section: 'Main' },
        { id: 2, name: 'Table 2', capacity: 2, section: 'Main' },
        { id: 3, name: 'Table 3', capacity: 6, section: 'Outdoor' },
      ]
    }),
    upsert: () => Promise.resolve({ success: true }),
    delete: () => Promise.resolve({ success: true }),
    updateCustomName: () => Promise.resolve({ success: true }),
  },
  billing: {
    preview: (payload: { orderId: number; discount?: number }) => {
      const taxable = 100;
      const discount = payload.discount ?? 0;
      const tax = 15;
      return Promise.resolve({
        success: true,
        data: {
          totals: {
            taxable_amount: taxable,
            cgst_amount: 0,
            sgst_amount: 0,
            tax_amount: tax,
            discount_amount: discount,
            total_amount: Math.max(0, taxable + tax - discount),
          },
          tax: { mode: 'vat' as const, rate: 15, inclusive: false },
          lines: [{
            id: 1, name: 'Mock Item', qty: 1, unit_price: taxable,
            taxable_amount: taxable, tax_amount: tax,
            cgst_amount: 0, sgst_amount: 0, total_amount: taxable + tax,
          }],
        },
      });
    },
    createBill: () => Promise.resolve({
      success: true,
      data: {
        billId: 1, bill_number: 'INV-2026-0001',
        taxable_amount: 100, cgst_amount: 0, sgst_amount: 0, tax_amount: 15,
        discount_amount: 0, total_amount: 115, tax_mode: 'vat' as const, tax_rate: 15,
      },
    }),
    getBill: () => Promise.resolve({ success: true, data: {} }),
  },
  print: {
    kot: () => Promise.resolve({ success: true }),
    bill: () => Promise.resolve({ success: true }),
    listPrinters: () => Promise.resolve({
      success: true,
      data: [
        { name: 'Mock Thermal 80mm', displayName: 'Mock Thermal 80mm', description: '', isDefault: true, status: 0 },
        { name: 'Mock Kitchen 58mm', displayName: 'Mock Kitchen 58mm', description: '', isDefault: false, status: 0 },
      ],
    }),
    test: () => Promise.resolve({ success: true, data: { printer: 'Mock Thermal 80mm' } }),
    previewBill: () => Promise.resolve({ success: true, data: '<html><body>mock receipt</body></html>' }),
    previewKot: () => Promise.resolve({ success: true, data: '<html><body>mock KOT</body></html>' }),
  },
  inventory: {
    getAll: () => Promise.resolve({ success: true, data: [] }),
    adjust: () => Promise.resolve({ success: true }),
    upsertItem: () => Promise.resolve({ success: true }),
  },
  staff: {
    login: (payload: { pin: string }) => {
      if (payload.pin === '1234') {
        return Promise.resolve({ success: true, data: { id: 1, name: 'Mock Admin', role: 'admin' } });
      }
      return Promise.resolve({ success: false, error: 'Invalid PIN' });
    },
    getAll: () => Promise.resolve({ success: true, data: [] }),
    upsert: () => Promise.resolve({ success: true, data: { id: 2 } }),
    delete: () => Promise.resolve({ success: true }),
    changePin: () => Promise.resolve({ success: true }),
  },
  shifts: (() => {
    let activeShift: Shift | null = null;
    return {
      getActive: () => Promise.resolve({ success: true, data: activeShift }),
      open: (_payload: { staffId: number; openingCash: number }) => {
        activeShift = { id: 1, staff_id: _payload.staffId, opened_at: new Date().toISOString(), opening_cash: _payload.openingCash, closed_at: null, closing_cash: null, note: null };
        return Promise.resolve({ success: true, data: { id: 1 } });
      },
      close: (_payload: { shiftId: number; closingCash: number; note?: string }) => {
        activeShift = null;
        return Promise.resolve({ success: true });
      },
      getTotals: (_payload: { openedAt: string }) => Promise.resolve({ success: true, data: { cash: 0, card: 0, upi: 0, complimentary: 0 } }),
    };
  })(),
  reports: {
    daily: () => Promise.resolve({ 
      success: true, 
      data: {
        date: new Date().toISOString().split('T')[0],
        totalOrders: 0,
        totalRevenue: 0,
        totalCGST: 0,
        totalSGST: 0,
        hourlyData: []
      } 
    }),
  },
  backup: {
    export: () => Promise.resolve({ success: true, data: '/mock/backup.db' }),
    import: () => Promise.resolve({ success: true }),
    getAutoBackupConfig: () => Promise.resolve({ success: true, data: { autoBackup: { enabled: false, frequency: 'daily' as const, path: null, dayOfWeek: 1, lastBackupAt: null }, backupReminder: { enabled: false, frequency: 'daily' as const, time: '20:00', dayOfWeek: 1, dayOfMonth: 1, lastRemindedDate: null } } }),
    setAutoBackupConfig: () => Promise.resolve({ success: true }),
    selectAutoBackupPath: () => Promise.resolve({ success: true, data: '/mock/backups' }),
    triggerNow: () => Promise.resolve({ success: true }),
  },
  features: (() => {
    const MOCK: FeatureModuleDTO[] = [
      { id: 'table-service', category: 'operations', nameKey: 'feature.tableService.name', descriptionKey: 'feature.tableService.description', icon: 'grid', requires: [], locked: true, enabled: true, active: true },
      { id: 'kds', category: 'operations', nameKey: 'feature.kds.name', descriptionKey: 'feature.kds.description', icon: 'chef-hat', requires: [], locked: false, enabled: true, active: true },
      { id: 'multi-menu', category: 'operations', nameKey: 'feature.multiMenu.name', descriptionKey: 'feature.multiMenu.description', icon: 'book-open', requires: [], locked: false, enabled: false, active: false },
      { id: 'inventory', category: 'back-office', nameKey: 'feature.inventory.name', descriptionKey: 'feature.inventory.description', icon: 'inventory', requires: [], locked: false, enabled: true, active: true },
      { id: 'customers', category: 'back-office', nameKey: 'feature.customers.name', descriptionKey: 'feature.customers.description', icon: 'users', requires: [], locked: false, enabled: true, active: true },
      { id: 'expenses', category: 'back-office', nameKey: 'feature.expenses.name', descriptionKey: 'feature.expenses.description', icon: 'dollar', requires: [], locked: false, enabled: true, active: true },
      { id: 'reports', category: 'back-office', nameKey: 'feature.reports.name', descriptionKey: 'feature.reports.description', icon: 'analytics', requires: [], locked: false, enabled: true, active: true },
      { id: 'accounting', category: 'back-office', nameKey: 'feature.accounting.name', descriptionKey: 'feature.accounting.description', icon: 'chart-bar', requires: ['expenses'], locked: false, enabled: false, active: false },
      { id: 'discounts', category: 'growth', nameKey: 'feature.discounts.name', descriptionKey: 'feature.discounts.description', icon: 'percent', requires: [], locked: false, enabled: true, active: true },
      { id: 'coupons', category: 'growth', nameKey: 'feature.coupons.name', descriptionKey: 'feature.coupons.description', icon: 'gift', requires: ['discounts'], locked: false, enabled: false, active: false },
      { id: 'loyalty', category: 'growth', nameKey: 'feature.loyalty.name', descriptionKey: 'feature.loyalty.description', icon: 'star', requires: ['customers', 'discounts'], locked: false, enabled: false, active: false },
      { id: 'qr-receipts', category: 'growth', nameKey: 'feature.qrReceipts.name', descriptionKey: 'feature.qrReceipts.description', icon: 'external-link', requires: ['customer-menu'], locked: false, enabled: false, active: false },
      { id: 'customer-menu', category: 'growth', nameKey: 'feature.customerMenu.name', descriptionKey: 'feature.customerMenu.description', icon: 'phone', requires: [], locked: false, enabled: false, active: false },
    ];
    let state = MOCK.map(m => ({ ...m }));
    const activeIds = () => state.filter(m => m.active).map(m => m.id);
    return {
      list: () => Promise.resolve({ success: true, data: { modules: state.map(m => ({ ...m })), active: activeIds() } }),
      preview: () => Promise.resolve({ success: true, data: { alsoEnabled: [], alsoDisabled: [] } }),
      setEnabled: (payload: { id: string; enabled: boolean }) => {
        state = state.map(m => (m.id === payload.id && !m.locked
          ? { ...m, enabled: payload.enabled, active: payload.enabled }
          : m));
        return Promise.resolve({ success: true, data: { active: activeIds(), alsoEnabled: [], alsoDisabled: [] } });
      },
      reset: () => {
        state = MOCK.map(m => ({ ...m }));
        return Promise.resolve({ success: true, data: { active: activeIds() } });
      },
    };
  })(),
  settings: (() => {
    let settingsStore: Record<string, unknown> = { outlet_name: 'Mock Restaurant' };
    return {
      get: () => Promise.resolve({ success: true, data: settingsStore }),
      save: (payload: Record<string, unknown>) => {
        settingsStore = { ...settingsStore, ...payload };
        return Promise.resolve({ success: true });
      },
    };
  })(),
  system: {
    isSetupComplete: () => Promise.resolve({ success: true, data: true }),
    completeSetup: (_payload: { restaurantName: string; adminName: string; adminPin: string }) => Promise.resolve({ success: true }),
    factoryReset: () => Promise.resolve({ success: true }),
    generateRecoveryCode: () => Promise.resolve({ success: true }),
    verifyRecoveryCode: () => Promise.resolve({ success: true }),
    resetAdminPin: () => Promise.resolve({ success: true }),
  },
  expenses: {
    getAll: () => Promise.resolve({ success: true, data: [] }),
    create: () => Promise.resolve({ success: true, data: { id: 1 } }),
    delete: () => Promise.resolve({ success: true }),
  },
  customers: {
    getAll: () => Promise.resolve({ success: true, data: [] }),
    getById: () => Promise.resolve({ success: true, data: null }),
    create: () => Promise.resolve({ success: true, data: { id: 1 } }),
    update: () => Promise.resolve({ success: true }),
    delete: () => Promise.resolve({ success: true }),
    search: () => Promise.resolve({ success: true, data: [] }),
    settleBalance: () => Promise.resolve({ success: true }),
    getHistory: () => Promise.resolve({ success: true, data: [] }),
  },
  dashboard: {
    getMetrics: () => Promise.resolve({
      success: true,
      data: {
        filter: 'today',
        metrics: { totalSales: 0, totalOrders: 0, averageOrderValue: 0, totalCustomers: 0, outstandingBalances: 0 },
        trends: { totalSales: null, totalOrders: null, averageOrderValue: null, totalCustomers: null },
        trendData: [],
        topItemsData: [],
      },
    }),
  },
  businessSession: (() => {
    let session: BusinessSession | null = null;
    return {
      getActive: () => Promise.resolve({ success: true, data: session }),
      start: (payload: { staffId: number; notes?: string }) => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        session = { id: 1, business_date: `${y}-${m}-${d}`, started_at: now.toISOString(), closed_at: null, status: 'open', started_by: payload.staffId, closed_by: null, notes: payload.notes ?? null };
        return Promise.resolve({ success: true, data: session });
      },
      close: (_payload: { sessionId: number; staffId: number; notes?: string }) => {
        session = null;
        return Promise.resolve({ success: true });
      },
    };
  })(),
  onBackupReminder: (_callback: () => void) => {
    // mock: no-op
  },
  onMenuScheduleTriggered: (_callback: (data: { menuId: number; menuName: string; action: 'enabled' | 'disabled' }) => void) => {
    // mock implementation does nothing
  }
};

export const api = (ipcApi ?? mockApi) as {
  orders: {
    create: (payload: { tableId: number; staffId?: number; covers?: number; note?: string; customerId?: number; type?: 'dine-in' | 'takeaway' | 'delivery' }) => Promise<IPCResponse<number>>;
    getOpen: () => Promise<IPCResponse<unknown>>;
    getByTable: (payload: { tableId: number }) => Promise<IPCResponse<(Order & { items: OrderItem[] }) | null>>;
    sendKOT: (payload: { tableId: number; items: CartItem[]; staffId?: number; covers?: number; note?: string; customerId?: number; type?: 'dine-in' | 'takeaway' | 'delivery' }) => Promise<IPCResponse<{ orderId: number; itemsToPrint: CartItem[] }>>;
    cancelOrder: (payload: { orderId: number; note?: string }) => Promise<IPCResponse<unknown>>;
    cancelOrderItem: (payload: { orderId: number; orderItemId: number; note: string }) => Promise<IPCResponse<unknown>>;
    updateCustomer: (payload: { orderId: number; customerId: number }) => Promise<IPCResponse<unknown>>;
  };
  kds: {
    getActiveTickets: () => Promise<IPCResponse<KDSTicket[]>>;
    updateItemStatus: (payload: { itemId: number; status: 'pending' | 'preparing' | 'ready' | 'served' }) => Promise<IPCResponse<unknown>>;
    updateOrderStatus: (payload: { orderId: number; status: 'pending' | 'preparing' | 'ready' | 'served' }) => Promise<IPCResponse<unknown>>;
  };
  menu: {
    getMenus: () => Promise<IPCResponse<import('../types/models').Menu[]>>;
    upsertMenu: (payload: { id?: number; name: string; is_default?: number; is_active?: number; auto_enable_time?: string | null; auto_disable_time?: string | null; schedule_enabled?: number; }) => Promise<IPCResponse<{ id: number }>>;
    duplicateMenu: (payload: { id: number; newName: string }) => Promise<IPCResponse<{ id: number }>>;
    uploadImage: () => Promise<IPCResponse<string>>;
    getAll: (menuId?: number) => Promise<IPCResponse<(Category & { items: MenuItem[] })[]>>;
    upsertItem: (payload: Partial<MenuItem>) => Promise<IPCResponse<MenuItem>>;
    deleteItem: (payload: { id: number }) => Promise<IPCResponse<unknown>>;
    toggleAvailable: (payload: { id: number; is_available: number }) => Promise<IPCResponse<unknown>>;
    upsertCategory: (payload: Partial<Category>) => Promise<IPCResponse<Category>>;
    deleteCategory: (payload: { id: number }) => Promise<IPCResponse<unknown>>;
    getRecipe: (payload: { menu_item_id: number }) => Promise<IPCResponse<RecipeItem[]>>;
    updateRecipe: (payload: { menu_item_id: number; ingredients: { inventory_item_id: number; qty_used: number }[] }) => Promise<IPCResponse<unknown>>;
  };
  tables: {
    getAll: () => Promise<IPCResponse<Table[]>>;
    upsert: (payload: Partial<Table>) => Promise<IPCResponse<Table>>;
    delete: (payload: { id: number }) => Promise<IPCResponse<unknown>>;
    updateCustomName: (payload: { id: number; customName: string | null }) => Promise<IPCResponse<unknown>>;
  };
  billing: {
    preview: (payload: { orderId: number; discount?: number }) => Promise<IPCResponse<BillPreview>>;
    createBill: (payload: {
      orderId: number;
      payments: { method: string; amount: number; reference?: string }[];
      discount?: number;
      customerId?: number;
    }) => Promise<IPCResponse<CreatedBill>>;
    getBill: (payload: { orderId: number }) => Promise<IPCResponse<unknown>>;
  };
  print: {
    kot: (payload: KotPrintPayload) => Promise<IPCResponse<unknown>>;
    bill: (payload: BillPrintPayload) => Promise<IPCResponse<unknown>>;
    listPrinters: () => Promise<IPCResponse<PrinterInfo[]>>;
    test: (payload?: { target?: PrintTarget }) => Promise<IPCResponse<{ printer: string }>>;
    previewBill: (payload: BillPrintPayload) => Promise<IPCResponse<string>>;
    previewKot: (payload: KotPrintPayload) => Promise<IPCResponse<string>>;
  };
  inventory: {
    getAll: () => Promise<IPCResponse<InventoryItem[]>>;
    adjust: (payload: { item_id: number; type: 'purchase' | 'sale' | 'adjustment' | 'wastage'; qty_change: number; note?: string; }) => Promise<IPCResponse<unknown>>;
    upsertItem: (payload: Partial<InventoryItem>) => Promise<IPCResponse<{ id: number }>>;
  };
  staff: {
    login: (payload: { pin: string }) => Promise<IPCResponse<{ id: number; name: string; role: string }>>;
    getAll: () => Promise<IPCResponse<Staff[]>>;
    upsert: (payload: Partial<Staff>) => Promise<IPCResponse<{ id: number }>>;
    delete: (payload: { id: number }) => Promise<IPCResponse<unknown>>;
    changePin: (payload: { id: number, currentPin: string, newPin: string }) => Promise<IPCResponse<unknown>>;
  };
  shifts: {
    getActive: () => Promise<IPCResponse<Shift | null>>;
    open: (payload: { staffId: number; openingCash: number }) => Promise<IPCResponse<{ id: number }>>;
    close: (payload: { shiftId: number; closingCash: number; note?: string }) => Promise<IPCResponse<unknown>>;
    getTotals: (payload: { openedAt: string }) => Promise<IPCResponse<{ cash: number; card: number; upi: number; complimentary: number }>>;
  };
  reports: {
    daily: (payload: unknown) => Promise<IPCResponse<unknown>>;
    getPastOrders: (payload: { filter: 'daily' | 'weekly' | 'monthly' | 'yearly'; page: number; limit: number }) => Promise<IPCResponse<{ stats: import('../types/models').PastOrderStats; orders: import('../types/models').PastOrderData[]; totalPages: number; currentPage: number }>>;
    printPastBill: (payload: { orderId: number }) => Promise<IPCResponse<unknown>>;
  };
  backup: {
    export: (payload: unknown) => Promise<IPCResponse<string>>;
    import: (payload: unknown) => Promise<IPCResponse<unknown>>;
    getAutoBackupConfig: () => Promise<IPCResponse<{ autoBackup: AutoBackupConfig; backupReminder: BackupReminderConfig }>>;
    setAutoBackupConfig: (payload: { autoBackup?: Partial<AutoBackupConfig>; backupReminder?: Partial<BackupReminderConfig> }) => Promise<IPCResponse<unknown>>;
    selectAutoBackupPath: () => Promise<IPCResponse<string>>;
    triggerNow: () => Promise<IPCResponse<unknown>>;
  };
  features: {
    list: () => Promise<IPCResponse<{ modules: FeatureModuleDTO[]; active: string[] }>>;
    preview: (payload: { id: string; enabled: boolean }) =>
      Promise<IPCResponse<{ alsoEnabled: string[]; alsoDisabled: string[] }>>;
    setEnabled: (payload: { id: string; enabled: boolean }) => Promise<IPCResponse<{
      active: string[];
      alsoEnabled: string[];
      alsoDisabled: string[];
    }>>;
    reset: () => Promise<IPCResponse<{ active: string[] }>>;
  };
  settings: {
    get: () => Promise<IPCResponse<AppSettings & LegacySettingAliases>>;
    save: (payload: SettingsPatch) => Promise<IPCResponse<AppSettings>>;
  };
  system: {
    isSetupComplete: () => Promise<IPCResponse<boolean>>;
    completeSetup: (payload: { restaurantName: string; adminName: string; adminPin: string }) => Promise<IPCResponse<unknown>>;
    factoryReset: () => Promise<IPCResponse<unknown>>;
    generateRecoveryCode: () => Promise<IPCResponse<unknown>>;
    verifyRecoveryCode: (payload: { code: string }) => Promise<IPCResponse<unknown>>;
    resetAdminPin: (payload: { newPin: string; code: string }) => Promise<IPCResponse<unknown>>;
  };
  expenses: {
    getAll: (payload?: { start?: string, end?: string }) => Promise<IPCResponse<Expense[]>>;
    create: (payload: { date: string, category: string, amount: number, description?: string, staff_id?: number }) => Promise<IPCResponse<{id: number}>>;
    delete: (payload: { id: number }) => Promise<IPCResponse<unknown>>;
  };
  customers: {
    getAll: () => Promise<IPCResponse<import('../types/models').Customer[]>>;
    getById: (id: number) => Promise<IPCResponse<import('../types/models').Customer>>;
    create: (payload: Partial<import('../types/models').Customer>) => Promise<IPCResponse<{id: number}>>;
    update: (payload: Partial<import('../types/models').Customer> & {id: number}) => Promise<IPCResponse<unknown>>;
    delete: (payload: number) => Promise<IPCResponse<unknown>>;
    search: (payload: string) => Promise<IPCResponse<import('../types/models').Customer[]>>;
    settleBalance: (payload: { customerId: number; amount: number; method: string }) => Promise<IPCResponse<unknown>>;
    getHistory: (payload: number) => Promise<IPCResponse<import('../types/models').CustomerHistory[]>>;
  };
  dashboard: {
    getMetrics: (payload: { filter: string }) => Promise<IPCResponse<DashboardData>>;
  };
  businessSession: {
    getActive: () => Promise<IPCResponse<BusinessSession | null>>;
    start: (payload: { staffId: number; notes?: string }) => Promise<IPCResponse<BusinessSession>>;
    close: (payload: { sessionId: number; staffId: number; notes?: string }) => Promise<IPCResponse<unknown>>;
  };
  onBackupReminder: (callback: () => void) => void;
  onMenuScheduleTriggered: (callback: (data: { menuId: number; menuName: string; action: 'enabled' | 'disabled' }) => void) => void;
};
