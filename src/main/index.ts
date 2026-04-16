import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { loadConfig, saveConfig } from './config'
import { openDatabase, closeDatabase, createDatabase, dbFileExists } from './db'
import { registerStrumentiIpc } from './ipc/strumenti.ipc'
import { registerAnagraficheIpc } from './ipc/anagrafiche.ipc'
import { registerMetodiIpc } from './ipc/metodi.ipc'
import { registerCompostiIpc } from './ipc/composti.ipc'
import { registerPreparazioniIpc } from './ipc/preparazioni.ipc'
import { registerEluentiIpc } from './ipc/eluenti.ipc'
import { registerConsumabiliIpc } from './ipc/consumabili.ipc'
import { registerDiarioIpc } from './ipc/diario.ipc'
import { registerQueryIpc } from './ipc/query.ipc'
import { registerMigrationIpc } from './ipc/migration.ipc'
import { registerWorkIpc } from './ipc/work.ipc'
import { registerSchemaCalibrazioneIpc } from './ipc/schemaCalibrazione.ipc'
import { registerMetodoAnalitiIpc } from './ipc/metodo-analiti.ipc'
import { registerDashboardIpc } from './ipc/dashboard.ipc'
import { registerSessionsIpc, startSession, stopSession } from './ipc/sessions.ipc'

let mainWindow: BrowserWindow | null = null

let watchedDbPath: string | null = null
const WATCH_POLL_MS = 2000

function stopDbWatcher(): void {
  if (watchedDbPath) {
    try { fs.unwatchFile(watchedDbPath) } catch (_) { /* ignore */ }
    watchedDbPath = null
  }
}

function startDbWatcher(dbPath: string): void {
  stopDbWatcher()
  if (!fs.existsSync(dbPath)) return
  watchedDbPath = dbPath
  fs.watchFile(dbPath, { interval: WATCH_POLL_MS, persistent: false }, (curr, prev) => {
    if (curr.mtimeMs <= prev.mtimeMs) return
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('db:external-change')
    }
  })
}

function createWindow(): void {
  const config = loadConfig()
  const bounds = config.windowBounds || { width: 1400, height: 900 }

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  }

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      const config = loadConfig()
      config.windowBounds = bounds
      saveConfig(config)
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── IPC: Config & Setup ──
ipcMain.handle('config:get', () => {
  const config = loadConfig()
  return {
    dbPath: config.dbPath,
    dbExists: config.dbPath ? dbFileExists(config.dbPath) : false,
  }
})

ipcMain.handle('config:select-folder', async () => {
  try {
    const dialogOpts: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Seleziona cartella per il database',
    }
    const result = process.platform === 'darwin'
      ? await dialog.showOpenDialog(dialogOpts)
      : await dialog.showOpenDialog(mainWindow!, dialogOpts)
    if (result.canceled || !result.filePaths.length) return { ok: false }

    const folder = result.filePaths[0]
    const dbPath = path.join(folder, 'lcms.db')
    const exists = dbFileExists(dbPath)

    stopSession()
    stopDbWatcher()
    closeDatabase()

    if (exists) {
      openDatabase(dbPath)
    } else {
      createDatabase(dbPath)
    }
    startSession()
    startDbWatcher(dbPath)

    const config = loadConfig()
    config.dbPath = dbPath
    saveConfig(config)

    return { ok: true, dbPath, isNew: !exists }
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    console.error('[config:select-folder] errore:', e)
    return { ok: false, error: msg }
  }
})

ipcMain.handle('config:select-json', async () => {
  const dialogOpts: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Seleziona lcms-data.json da importare',
  }
  const result = process.platform === 'darwin'
    ? await dialog.showOpenDialog(dialogOpts)
    : await dialog.showOpenDialog(mainWindow!, dialogOpts)
  if (result.canceled || !result.filePaths.length) return { ok: false }
  return { ok: true, path: result.filePaths[0] }
})

// ── App lifecycle ──
app.whenReady().then(() => {
  registerStrumentiIpc()
  registerAnagraficheIpc()
  registerMetodiIpc()
  registerCompostiIpc()
  registerPreparazioniIpc()
  registerEluentiIpc()
  registerConsumabiliIpc()
  registerDiarioIpc()
  registerQueryIpc()
  registerMigrationIpc()
  registerWorkIpc()
  registerSchemaCalibrazioneIpc()
  registerMetodoAnalitiIpc()
  registerDashboardIpc()
  registerSessionsIpc()
  createWindow()

  const config = loadConfig()
  if (config.dbPath && dbFileExists(config.dbPath)) {
    try { openDatabase(config.dbPath); startSession(); startDbWatcher(config.dbPath) }
    catch (e) { console.error('Failed to open DB:', e) }
  }
})

app.on('window-all-closed', () => {
  stopSession()
  stopDbWatcher()
  closeDatabase()
  app.quit()
})
