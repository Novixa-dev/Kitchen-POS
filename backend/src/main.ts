import { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import { runMigrations } from './db/migrate';
import { getDB } from './db';
import { startScheduler } from './scheduler';
import { registerOrdersIPC } from './ipc/orders';
import { registerMenuIPC } from './ipc/menu';
import { registerTablesIPC } from './ipc/tables';
import { registerBillingIPC } from './ipc/billing';
import { registerInventoryIPC } from './ipc/inventory';
import { registerStaffIPC } from './ipc/staff';
import { registerReportsIPC } from './ipc/reports';
import { registerBackupIPC } from './ipc/backup';
import { registerSettingsIPC } from './ipc/settings';
import { registerPrinterIPC } from './ipc/printer';
import { registerKDSIPC } from './ipc/kds';
import { registerShiftsIPC } from './ipc/shifts';
import { registerExpensesIPC } from './ipc/expenses';
import { registerCustomersIPC } from './ipc/customers';
import { registerDashboardIPC } from './ipc/dashboard';
import { registerBusinessSessionIPC } from './ipc/business-session';
import { registerSystemIPC } from './ipc/system';
import { registerFeaturesIPC } from './ipc/features';
import { registerBrandingIPC } from './ipc/branding';
import { registerPermissionsIPC, readOverrides } from './ipc/permissions';
import { installPermissionGuard } from './auth/guard';
import {
  applyContentSecurityPolicy,
  applyNavigationGuards,
  registerLocalProtocol,
} from './lib/security';
import { getSettings } from './lib/settings';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function isDevBuild(): boolean {
  return !app.isPackaged && process.env.NODE_ENV !== 'production';
}

async function createWindow() {
  const isDev = isDevBuild();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    // Painting only once the renderer is ready avoids the white flash before
    // the stored theme is applied.
    show: false,
    backgroundColor: '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Defence in depth: the renderer has no reason to reach the network.
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  applyNavigationGuards(mainWindow, isDev);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    void mainWindow.loadURL('http://localhost:5205');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Resolve a bundled asset.
 *
 * Packaged, the app runs out of an asar archive and assets live beside it in
 * `resources/`; in development they are at the repository root. The previous
 * version only handled the development path, so the packaged build silently
 * fell back to an empty tray icon.
 */
function assetPath(filename: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', filename)
    : path.join(__dirname, '../../assets', filename);
}

function createTray() {
  // An empty image is a valid tray icon, so a missing file leaves a blank
  // tray rather than throwing during startup.
  let trayIcon = nativeImage.createEmpty();
  try {
    const loaded = nativeImage.createFromPath(assetPath('icon.png'));
    if (!loaded.isEmpty()) { trayIcon = loaded; }
  } catch {
    // Keep the empty image.
  }

  tray = new Tray(trayIcon);

  const showWindow = () => {
    if (!mainWindow) {
      void createWindow();
      return;
    }
    if (mainWindow.isMinimized()) { mainWindow.restore(); }
    mainWindow.focus();
  };

  // The tray menu is drawn by the OS before the renderer exists, so it reads
  // its labels from the stored locale rather than the i18n provider.
  const locale = getSettings().locale;
  const labels = locale === 'ar'
    ? { open: 'فتح', quit: 'إنهاء' }
    : { open: 'Open', quit: 'Quit' };

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: labels.open, click: showWindow },
    { type: 'separator' },
    { label: labels.quit, click: () => { app.quit(); } },
  ]));

  tray.setToolTip('Kitchen POS');
  tray.on('click', showWindow);
}

function registerAllIPC() {
  // Installed first: it wraps `ipcMain.handle`, so every registration below
  // is guarded. Electron offers no middleware, and putting the check in each
  // handler guarantees the channel added next week is the unguarded one.
  // The overrides are read per call, so editing the matrix takes effect
  // without a restart.
  installPermissionGuard(ipcMain, readOverrides);

  registerOrdersIPC();
  registerMenuIPC();
  registerTablesIPC();
  registerBillingIPC();
  registerInventoryIPC();
  registerStaffIPC();
  registerReportsIPC();
  registerBackupIPC();
  registerSettingsIPC();
  registerPrinterIPC();
  registerKDSIPC();
  registerShiftsIPC();
  registerExpensesIPC();
  registerCustomersIPC();
  registerDashboardIPC();
  registerBusinessSessionIPC();
  registerSystemIPC();
  registerFeaturesIPC();
  registerBrandingIPC();
  registerPermissionsIPC();
}

void app.whenReady().then(async () => {
  // Serves dish images from the app's own image directory. The handler is
  // confined to that directory — the previous version forwarded any path
  // straight to `file://`.
  registerLocalProtocol();
  applyContentSecurityPolicy(isDevBuild());

  // Initialize DB and Run migrations before registering IPC
  getDB();
  runMigrations();

  registerAllIPC();
  startScheduler();

  void createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
