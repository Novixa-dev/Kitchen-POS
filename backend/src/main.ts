import { app, BrowserWindow, Menu, Tray } from 'electron';
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
import {
  applyContentSecurityPolicy,
  applyNavigationGuards,
  registerLocalProtocol,
} from './lib/security';

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

function createTray() {
  const iconPath = path.join(__dirname, '../../../assets/icon.png'); // Example icon path, make sure it exists or update logic
  // For now using a native image or resolving later is fine, but here is standard setup.
  // Using an empty NativeImage for robust execution
  void import('electron').then(({ nativeImage }) => {
     let trayIcon = nativeImage.createEmpty();
     try {
       trayIcon = nativeImage.createFromPath(iconPath);
     } catch (_e) { /* Ignore invalid icon paths */ }

    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open', click: () => {
          if (mainWindow) {
             if (mainWindow.isMinimized()) {mainWindow.restore();}
             mainWindow.focus();
          } else {
             void createWindow();
          }
      }},
      { label: 'Quit', click: () => {
          app.quit();
      }}
    ]);
    tray.setToolTip('Restaurant POS');
    tray.setContextMenu(contextMenu);
  });
}

function registerAllIPC() {
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
