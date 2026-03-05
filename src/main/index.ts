import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { loadConfig, saveConfig } from './config'
import { openDatabase, closeDatabase, createDatabase, dbFileExists } from './db'

let mainWindow: BrowserWindow | null = null

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
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Seleziona cartella per il database',
  })
  if (result.canceled || !result.filePaths.length) return { ok: false }

  const folder = result.filePaths[0]
  const dbPath = path.join(folder, 'lcms.db')
  const exists = dbFileExists(dbPath)

  if (exists) {
    openDatabase(dbPath)
  } else {
    createDatabase(dbPath)
  }

  const config = loadConfig()
  config.dbPath = dbPath
  saveConfig(config)

  return { ok: true, dbPath, isNew: !exists }
})

ipcMain.handle('config:select-json', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Seleziona lcms-data.json da importare',
  })
  if (result.canceled || !result.filePaths.length) return { ok: false }
  return { ok: true, path: result.filePaths[0] }
})

// ── App lifecycle ──
app.whenReady().then(() => {
  createWindow()

  const config = loadConfig()
  if (config.dbPath && dbFileExists(config.dbPath)) {
    try { openDatabase(config.dbPath) }
    catch (e) { console.error('Failed to open DB:', e) }
  }
})

app.on('window-all-closed', () => {
  closeDatabase()
  app.quit()
})
