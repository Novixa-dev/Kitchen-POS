import { contextBridge, ipcRenderer } from 'electron';

interface MenuScheduleEvent {
  menuId: number;
  menuName: string;
  action: 'enabled' | 'disabled';
}


contextBridge.exposeInMainWorld('api', {
  orders: {
    create: (payload: unknown) => ipcRenderer.invoke('orders:create', payload),
    getOpen: () => ipcRenderer.invoke('orders:getOpen'),
    getByTable: (payload: unknown) => ipcRenderer.invoke('orders:getByTable', payload),
    sendKOT: (payload: unknown) => ipcRenderer.invoke('orders:sendKOT', payload),
    cancelOrder: (payload: unknown) => ipcRenderer.invoke('orders:cancelOrder', payload),
    updateCustomer: (payload: unknown) => ipcRenderer.invoke('orders:updateCustomer', payload),
  },
  kds: {
    getActiveTickets: () => ipcRenderer.invoke('kds:getActiveTickets'),
    updateItemStatus: (payload: unknown) => ipcRenderer.invoke('kds:updateItemStatus', payload),
    updateOrderStatus: (payload: unknown) => ipcRenderer.invoke('kds:updateOrderStatus', payload),
  },
  menu: {
    getMenus: () => ipcRenderer.invoke('menu:getMenus'),
    upsertMenu: (payload: unknown) => ipcRenderer.invoke('menu:upsertMenu', payload),
    duplicateMenu: (payload: unknown) => ipcRenderer.invoke('menu:duplicateMenu', payload),
    uploadImage: () => ipcRenderer.invoke('menu:uploadImage'),
    getAll: (menuId?: number) => ipcRenderer.invoke('menu:getAll', menuId),
    upsertItem: (payload: unknown) => ipcRenderer.invoke('menu:upsertItem', payload),
    deleteItem: (payload: unknown) => ipcRenderer.invoke('menu:deleteItem', payload),
    toggleAvailable: (payload: unknown) => ipcRenderer.invoke('menu:toggleAvailable', payload),
    upsertCategory: (payload: unknown) => ipcRenderer.invoke('menu:upsertCategory', payload),
    deleteCategory: (payload: unknown) => ipcRenderer.invoke('menu:deleteCategory', payload),
    getRecipe: (payload: unknown) => ipcRenderer.invoke('menu:getRecipe', payload),
    updateRecipe: (payload: unknown) => ipcRenderer.invoke('menu:updateRecipe', payload),
  },
  tables: {
    getAll: () => ipcRenderer.invoke('tables:getAll'),
    upsert: (payload: unknown) => ipcRenderer.invoke('tables:upsert', payload),
    delete: (payload: unknown) => ipcRenderer.invoke('tables:delete', payload),
    updateCustomName: (payload: unknown) => ipcRenderer.invoke('tables:updateCustomName', payload),
  },
  billing: {
    preview: (payload: unknown) => ipcRenderer.invoke('billing:preview', payload),
    createBill: (payload: unknown) => ipcRenderer.invoke('billing:createBill', payload),
    getBill: (payload: unknown) => ipcRenderer.invoke('billing:getBill', payload),
  },
  print: {
    kot: (payload: unknown) => ipcRenderer.invoke('print:kot', payload),
    bill: (payload: unknown) => ipcRenderer.invoke('print:bill', payload),
    listPrinters: () => ipcRenderer.invoke('print:listPrinters'),
    test: (payload?: unknown) => ipcRenderer.invoke('print:test', payload),
    previewBill: (payload: unknown) => ipcRenderer.invoke('print:previewBill', payload),
    previewKot: (payload: unknown) => ipcRenderer.invoke('print:previewKot', payload),
  },
  inventory: {
    getAll: () => ipcRenderer.invoke('inventory:getAll'),
    adjust: (payload: unknown) => ipcRenderer.invoke('inventory:adjust', payload),
    upsertItem: (payload: unknown) => ipcRenderer.invoke('inventory:upsertItem', payload),
  },
  staff: {
    login: (payload: unknown) => ipcRenderer.invoke('staff:login', payload),
    getAll: () => ipcRenderer.invoke('staff:getAll'),
    upsert: (payload: unknown) => ipcRenderer.invoke('staff:upsert', payload),
    delete: (payload: unknown) => ipcRenderer.invoke('staff:delete', payload),
  },
  shifts: {
    getActive: () => ipcRenderer.invoke('shifts:getActive'),
    open: (payload: unknown) => ipcRenderer.invoke('shifts:open', payload),
    close: (payload: unknown) => ipcRenderer.invoke('shifts:close', payload),
    getTotals: (payload: unknown) => ipcRenderer.invoke('shifts:getTotals', payload),
  },
  reports: {
    daily: (payload: unknown) => ipcRenderer.invoke('reports:daily', payload),
    getPastOrders: (payload: unknown) => ipcRenderer.invoke('reports:getPastOrders', payload),
    printPastBill: (payload: unknown) => ipcRenderer.invoke('reports:printPastBill', payload),
  },
  backup: {
    export: (payload: unknown) => ipcRenderer.invoke('backup:export', payload),
    import: (payload: unknown) => ipcRenderer.invoke('backup:import', payload),
    getAutoBackupConfig: () => ipcRenderer.invoke('backup:getAutoBackupConfig'),
    setAutoBackupConfig: (payload: unknown) => ipcRenderer.invoke('backup:setAutoBackupConfig', payload),
    selectAutoBackupPath: () => ipcRenderer.invoke('backup:selectAutoBackupPath'),
    triggerNow: () => ipcRenderer.invoke('backup:triggerNow'),
  },
  printerBench: {
    models: () => ipcRenderer.invoke('printer:models'),
    identify: (payload: unknown) => ipcRenderer.invoke('printer:identify', payload),
    virtualPreview: (payload: unknown) => ipcRenderer.invoke('printer:virtualPreview', payload),
  },
  country: {
    list: () => ipcRenderer.invoke('settings:countries'),
    apply: (payload: unknown) => ipcRenderer.invoke('settings:applyCountry', payload),
  },
  permissions: {
    get: () => ipcRenderer.invoke('permissions:get'),
    mine: () => ipcRenderer.invoke('permissions:mine'),
    set: (payload: unknown) => ipcRenderer.invoke('permissions:set', payload),
    resetRole: (payload: unknown) => ipcRenderer.invoke('permissions:resetRole', payload),
  },
  branding: {
    list: () => ipcRenderer.invoke('branding:list'),
    preview: (payload: unknown) => ipcRenderer.invoke('branding:preview', payload),
    applyPreset: (payload: unknown) => ipcRenderer.invoke('branding:applyPreset', payload),
    set: (payload: unknown) => ipcRenderer.invoke('branding:set', payload),
    pickLogo: () => ipcRenderer.invoke('branding:pickLogo'),
    clearLogo: () => ipcRenderer.invoke('branding:clearLogo'),
  },
  features: {
    list: () => ipcRenderer.invoke('features:list'),
    preview: (payload: unknown) => ipcRenderer.invoke('features:preview', payload),
    setEnabled: (payload: unknown) => ipcRenderer.invoke('features:setEnabled', payload),
    reset: () => ipcRenderer.invoke('features:reset'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (payload: unknown) => ipcRenderer.invoke('settings:save', payload),
  },
  expenses: {
    getAll: (payload?: unknown) => ipcRenderer.invoke('expenses:getAll', payload),
    create: (payload: unknown) => ipcRenderer.invoke('expenses:create', payload),
    delete: (payload: unknown) => ipcRenderer.invoke('expenses:delete', payload),
  },
  customers: {
    getAll: () => ipcRenderer.invoke('customers:getAll'),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    create: (payload: unknown) => ipcRenderer.invoke('customers:create', payload),
    update: (payload: unknown) => ipcRenderer.invoke('customers:update', payload),
    delete: (payload: unknown) => ipcRenderer.invoke('customers:delete', payload),
    search: (payload: unknown) => ipcRenderer.invoke('customers:search', payload),
    settleBalance: (payload: unknown) => ipcRenderer.invoke('customers:settleBalance', payload),
    getHistory: (payload: unknown) => ipcRenderer.invoke('customers:getHistory', payload),
  },
  dashboard: {
    getMetrics: (payload: unknown) => ipcRenderer.invoke('dashboard:getMetrics', payload),
  },
  businessSession: {
    getActive: () => ipcRenderer.invoke('businessSession:getActive'),
    start: (payload: { staffId: number; notes?: string }) => ipcRenderer.invoke('businessSession:start', payload),
    close: (payload: { sessionId: number; staffId: number; notes?: string }) => ipcRenderer.invoke('businessSession:close', payload),
  },
  system: {
    isSetupComplete: () => ipcRenderer.invoke('system:isSetupComplete'),
    completeSetup: (payload: unknown) => ipcRenderer.invoke('system:completeSetup', payload),
    factoryReset: () => ipcRenderer.invoke('system:factoryReset'),
    generateRecoveryCode: () => ipcRenderer.invoke('system:generateRecoveryCode'),
    verifyRecoveryCode: (payload: unknown) => ipcRenderer.invoke('system:verifyRecoveryCode', payload),
    resetAdminPin: (payload: unknown) => ipcRenderer.invoke('system:resetAdminPin', payload),
  },
  onBackupReminder: (callback: () => void) => {
    ipcRenderer.on('backup:reminderDue', () => { callback(); });
  },
  onMenuScheduleTriggered: (callback: (data: MenuScheduleEvent) => void) => {
    ipcRenderer.on('menu:scheduleTriggered', (_event, value) => { callback(value as MenuScheduleEvent); });
  }
});
