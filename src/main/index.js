import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { promises as fsp } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ConnectionManager } from './connection-mgr.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let cm = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
  });

  // Forward renderer console messages to main stdout so we can see errors.
  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    const tag = ['VERBOSE', 'INFO', 'WARN', 'ERROR'][level] || 'LOG';
    console.log(`[renderer ${tag}] ${source}:${line} — ${message}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer GONE]', details);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  cm = new ConnectionManager((event, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, payload);
    }
  });
}

function registerIpc() {
  ipcMain.handle('conn:list', () => cm.list());
  ipcMain.handle('conn:create', (_e, spec) => cm.create(spec));
  ipcMain.handle('conn:update', (_e, id, patch) => cm.update(id, patch));
  ipcMain.handle('conn:remove', (_e, id) => cm.remove(id));
  ipcMain.handle('conn:start', (_e, id) => cm.start(id));
  ipcMain.handle('conn:stop', (_e, id) => cm.stop(id));
  ipcMain.handle('conn:send', (_e, id, bytesArray) => cm.send(id, Uint8Array.from(bytesArray)));
  ipcMain.handle('conn:clear', (_e, id) => cm.clearBuffer(id));
  ipcMain.handle('conn:startRecording', (_e, id) => cm.startRecording(id));
  ipcMain.handle('conn:stopRecording', (_e, id) => cm.stopRecording(id));
  ipcMain.handle('serial:listPorts', () => cm.listSerialPorts());
  ipcMain.handle('app:getRecordingsDir', () => cm.getRecordingsDir());
  ipcMain.handle('app:setRecordingsDir', (_e, p) => cm.setRecordingsDir(p));
  ipcMain.handle('app:pickRecordingsDir', async () => {
    const current = cm.getRecordingsDir().path;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose recordings folder',
      defaultPath: current,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain.handle('app:openRecordingsDir', async () => {
    const dir = cm.getRecordingsDir().path;
    try { await fsp.mkdir(dir, { recursive: true }); } catch {}
    const err = await shell.openPath(dir);
    return err ? { error: err } : { ok: true, path: dir };
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (cm) await cm.shutdown();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (cm) await cm.shutdown();
});
