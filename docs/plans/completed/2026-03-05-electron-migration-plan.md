# LC-MS/MS Suite — Electron Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the LC-MS/MS laboratory management suite from vanilla HTML/JS to Electron + React + Vite + SQLite, producing a single portable `.exe`.

**Architecture:** Electron app with main process (Node.js + better-sqlite3) handling SQLite DB on a shared network folder, renderer process (React + Vite + Shadcn/ui) communicating via IPC. No global state library — local state per page.

**Tech Stack:** Electron, React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui, better-sqlite3, electron-builder

**Design doc:** `docs/plans/2026-03-05-electron-migration-design.md`

**Existing legacy code:** The `*.html`, `storage.js`, `_shared.css` files in the project root are the old vanilla JS app. Reference them for business logic but do not modify them.

---

## Task 1: Scaffold Electron + Vite + React project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `electron-builder.config.js`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `.gitignore`

**Step 1: Initialize the project**

Run from `C:\Users\39340\Downloads\Suite`:

```bash
mkdir lcms-suite && cd lcms-suite
npm init -y
```

**Step 2: Install core dependencies**

```bash
npm install react react-dom react-router-dom
npm install -D typescript @types/react @types/react-dom
npm install -D vite @vitejs/plugin-react
npm install -D electron electron-builder
npm install -D tailwindcss @tailwindcss/vite
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

**Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "declaration": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create `tsconfig.node.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist/main"
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*"]
}
```

**Step 5: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
```

**Step 6: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato', 'sans-serif'],
        heading: ['Karla', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}

export default config
```

**Step 7: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
  },
}
```

**Step 8: Create `electron-builder.config.js`**

```js
/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.lcms.suite',
  productName: 'LCMS Suite',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'package.json',
  ],
  extraResources: [
    { from: 'src/main/migrations', to: 'migrations' },
  ],
  win: {
    target: 'portable',
    icon: 'build/icon.ico',
  },
  portable: {
    artifactName: 'LCMS-Suite-${version}.exe',
  },
}
```

**Step 9: Create `.gitignore`**

```
node_modules/
dist/
release/
*.db
.env
```

**Step 10: Add scripts to `package.json`**

Update `package.json` with:
```json
{
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\"",
    "dev:renderer": "vite --config vite.config.ts",
    "dev:main": "tsc -p tsconfig.node.json --watch",
    "build": "tsc -p tsconfig.node.json && vite build --config vite.config.ts",
    "start": "electron .",
    "package": "npm run build && electron-builder --config electron-builder.config.js"
  }
}
```

Install concurrently: `npm install -D concurrently`

**Step 11: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Electron + Vite + React + Tailwind project"
```

---

## Task 2: Electron main process + DB layer

**Files:**
- Create: `src/main/index.ts`
- Create: `src/main/db.ts`
- Create: `src/main/config.ts`
- Create: `src/main/migrations/001-initial.sql`
- Create: `src/preload/index.ts`

**Step 1: Create `src/main/config.ts`**

Handles reading/writing `config.json` in `%APPDATA%/lcms-suite/`.

```ts
import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(app.getPath('userData'))
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export interface AppConfig {
  dbPath: string | null
  windowBounds?: { width: number; height: number; x?: number; y?: number }
}

const DEFAULT_CONFIG: AppConfig = {
  dbPath: null,
  windowBounds: { width: 1400, height: 900 },
}

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  }
  return { ...DEFAULT_CONFIG }
}

export function saveConfig(config: AppConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}
```

**Step 2: Create `src/main/migrations/001-initial.sql`**

Copy the full schema SQL from the design doc (all CREATE TABLE statements). This is the complete schema from Section 5 of the design document.

**Step 3: Create `src/main/db.ts`**

```ts
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function openDatabase(dbPath: string): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations()
}

export function closeDatabase(): void {
  if (db) { db.close(); db = null }
}

export function createDatabase(dbPath: string): void {
  // Ensure directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  openDatabase(dbPath)
}

function runMigrations(): void {
  if (!db) return
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  // Load migrations from resources (packaged) or source (dev)
  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(__dirname, '..', '..', 'src', 'main', 'migrations')

  if (!fs.existsSync(migrationsDir)) return

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const version = parseInt(file.split('-')[0], 10)
    if (version > currentVersion) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      db.exec(sql)
      db.pragma(`user_version = ${version}`)
    }
  }
}

export function dbFileExists(dbPath: string): boolean {
  return fs.existsSync(dbPath)
}
```

**Step 4: Create `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  // Config / setup
  getConfig: () => ipcRenderer.invoke('config:get'),
  selectFolder: () => ipcRenderer.invoke('config:select-folder'),
  importLegacyJson: (jsonPath: string) => ipcRenderer.invoke('config:import-legacy', jsonPath),
})
```

**Step 5: Create `src/main/index.ts`**

```ts
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

  // Dev or production
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
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

  // Try to open DB from saved config
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
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: Electron main process with DB layer, config, migrations, preload"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/shared/types.ts`

**Step 1: Create shared types**

```ts
// ── Strumenti ──
export interface Strumento {
  id: string
  codice: string
  tipo: string | null
  seriale: string | null
  status: 'on' | 'idle' | 'off'
  created_at: string
  updated_at: string
}

// ── Metodi ──
export interface Metodo {
  id: string
  nome: string
  strumento_id: string | null
  matrice: string | null
  colonna: string | null
  fase_a: string | null
  fase_b: string | null
  gradiente: string | null
  flusso: string | null
  ionizzazione: string | null
  polarita: string | null
  acquisizione: string | null
  srm: string | null
  lims_id: string | null
  oqlab_id: string | null
  note: string | null
  created_at: string
  updated_at: string
}

// ── Composti ──
export interface Composto {
  id: number
  nome: string
  codice_interno: string | null
  formula: string | null
  classe: string | null
  forma: string | null
  forma_commerciale: string | null
  purezza: number | null
  concentrazione: number | null
  solvente: string | null
  fiala: string | null
  produttore: string | null
  lotto: string | null
  operatore_apertura: string | null
  data_apertura: string | null
  scadenza_prodotto: string | null
  data_dismissione: string | null
  destinazione_uso: string | null
  work_standard: string | null
  matrice: string | null
  peso_molecolare: number | null
  ubicazione: string | null
  arpa: string
  mix: string | null
  mix_id: string | null
  created_at: string
  updated_at: string
}

export interface CompostoStoria {
  id: number
  composto_id: number
  tipo: 'Rivalidazione' | 'Dismissione'
  data: string
  note: string | null
  created_at: string
}

export interface Preparazione {
  id: number
  composto_id: number
  flacone: string | null
  concentrazione: string | null
  solvente: string | null
  data_prep: string | null
  scadenza: string | null
  operatore: string | null
  note: string | null
  created_at: string
}

// ── Eluenti ──
export interface Eluente {
  id: string
  strumento_id: string
  nome: string
  data_inizio: string
  data_fine: string | null
  created_at: string
  componenti?: EluenteComponente[]
}

export interface EluenteComponente {
  id: number
  eluente_id: string
  sostanza: string | null
  lotto: string | null
  fornitore: string | null
}

// ── Consumabili ──
export type ConsumabileTipo = 'colonna_hplc' | 'spe' | 'solvente' | 'sale' | 'altro'

export interface Consumabile {
  id: number
  tipo: ConsumabileTipo
  nome: string
  lotto: string | null
  fornitore: string | null
  data_apertura: string | null
  data_chiusura: string | null
  note: string | null
  created_at: string
  updated_at: string
}

// ── Diario ──
export interface DiarioEntry {
  id: number
  strumento_id: string
  metodo_id: string | null
  data: string
  autore: string | null
  testo: string
  created_at: string
}

// ── Anagrafiche ──
export interface Anagrafica {
  id: number
  nome: string
  voci?: AnagraficaVoce[]
}

export interface AnagraficaVoce {
  id: number
  anagrafica_id: number
  valore: string
}

// ── IPC API shape ──
export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  getConfig: () => Promise<{ dbPath: string | null; dbExists: boolean }>
  selectFolder: () => Promise<{ ok: boolean; dbPath?: string; isNew?: boolean }>
  importLegacyJson: (jsonPath: string) => Promise<{ ok: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: shared TypeScript types for all entities"
```

---

## Task 4: IPC handlers — Strumenti & Anagrafiche

**Files:**
- Create: `src/main/ipc/strumenti.ipc.ts`
- Create: `src/main/ipc/anagrafiche.ipc.ts`
- Modify: `src/main/index.ts` — import and register IPC handlers

These are the simplest entities. We build the IPC pattern here and reuse it.

**Step 1: Create `src/main/ipc/strumenti.ipc.ts`**

```ts
import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerStrumentiIpc(): void {
  ipcMain.handle('strumenti:list', () => {
    return getDb().prepare('SELECT * FROM strumenti ORDER BY codice').all()
  })

  ipcMain.handle('strumenti:get', (_, id: string) => {
    return getDb().prepare('SELECT * FROM strumenti WHERE id = ?').get(id)
  })

  ipcMain.handle('strumenti:create', (_, data: Record<string, unknown>) => {
    const stmt = getDb().prepare(
      `INSERT INTO strumenti (id, codice, tipo, seriale, status)
       VALUES (@id, @codice, @tipo, @seriale, @status)`
    )
    stmt.run(data)
    return getDb().prepare('SELECT * FROM strumenti WHERE id = ?').get(data.id)
  })

  ipcMain.handle('strumenti:update', (_, id: string, data: Record<string, unknown>) => {
    getDb().prepare(
      `UPDATE strumenti SET codice=@codice, tipo=@tipo, seriale=@seriale, status=@status,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...data, id })
    return getDb().prepare('SELECT * FROM strumenti WHERE id = ?').get(id)
  })

  ipcMain.handle('strumenti:delete', (_, id: string) => {
    getDb().prepare('DELETE FROM strumenti WHERE id = ?').run(id)
    return { ok: true }
  })
}
```

**Step 2: Create `src/main/ipc/anagrafiche.ipc.ts`**

```ts
import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerAnagraficheIpc(): void {
  ipcMain.handle('anagrafiche:list', () => {
    const anags = getDb().prepare('SELECT * FROM anagrafiche ORDER BY nome').all() as any[]
    for (const a of anags) {
      a.voci = getDb().prepare(
        'SELECT * FROM anagrafiche_voci WHERE anagrafica_id = ? ORDER BY valore'
      ).all(a.id)
    }
    return anags
  })

  ipcMain.handle('anagrafiche:create', (_, nome: string) => {
    const result = getDb().prepare('INSERT INTO anagrafiche (nome) VALUES (?)').run(nome)
    return { id: result.lastInsertRowid, nome, voci: [] }
  })

  ipcMain.handle('anagrafiche:rename', (_, id: number, nome: string) => {
    getDb().prepare('UPDATE anagrafiche SET nome = ? WHERE id = ?').run(nome, id)
    return { ok: true }
  })

  ipcMain.handle('anagrafiche:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM anagrafiche WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('anagrafiche:add-voce', (_, anagId: number, valore: string) => {
    const result = getDb().prepare(
      'INSERT INTO anagrafiche_voci (anagrafica_id, valore) VALUES (?, ?)'
    ).run(anagId, valore)
    return { id: result.lastInsertRowid, anagrafica_id: anagId, valore }
  })

  ipcMain.handle('anagrafiche:update-voce', (_, id: number, valore: string) => {
    getDb().prepare('UPDATE anagrafiche_voci SET valore = ? WHERE id = ?').run(valore, id)
    return { ok: true }
  })

  ipcMain.handle('anagrafiche:delete-voce', (_, id: number) => {
    getDb().prepare('DELETE FROM anagrafiche_voci WHERE id = ?').run(id)
    return { ok: true }
  })
}
```

**Step 3: Register in `src/main/index.ts`**

Add at the top:
```ts
import { registerStrumentiIpc } from './ipc/strumenti.ipc'
import { registerAnagraficheIpc } from './ipc/anagrafiche.ipc'
```

Call in `app.whenReady().then(...)`:
```ts
registerStrumentiIpc()
registerAnagraficheIpc()
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: IPC handlers for strumenti and anagrafiche"
```

---

## Task 5: IPC handlers — Metodi, Composti, Preparazioni

**Files:**
- Create: `src/main/ipc/metodi.ipc.ts`
- Create: `src/main/ipc/composti.ipc.ts`
- Create: `src/main/ipc/preparazioni.ipc.ts`
- Modify: `src/main/index.ts` — register new handlers

**Step 1: Create `src/main/ipc/metodi.ipc.ts`**

CRUD for `metodi` table + management of `composti_metodi` join table. The `list` handler joins strumento codice. The `get` handler also returns associated composti IDs.

Key queries:
- `metodi:list` — `SELECT m.*, s.codice as strumento_codice FROM metodi m LEFT JOIN strumenti s ON s.id = m.strumento_id`
- `metodi:get` — single metodo + `SELECT composto_id FROM composti_metodi WHERE metodo_id = ?`
- `metodi:create` / `metodi:update` — upsert metodo + sync `composti_metodi` (delete all for metodo, re-insert)
- `metodi:delete` — cascades via FK

**Step 2: Create `src/main/ipc/composti.ipc.ts`**

CRUD for `composti` table. The `list` handler supports filters (search text, classe, forma, solvente, metodo_id). The `get` handler returns the composto + its `metodiIds`, `storia`, and `preparazioni`.

Key queries:
- `composti:list` — dynamic WHERE clause built from filters; JOIN `composti_metodi` when filtering by metodo
- `composti:get` — single composto + sub-queries for storia, preparazioni, metodi
- `composti:create` / `composti:update` — upsert composto + sync `composti_metodi`
- `composti:delete` — cascades via FK
- `composti:bulk-import` — transaction wrapping multiple inserts (for Excel/JSON import)
- `composti:storia-add` — insert into `composti_storia`
- `composti:compute-status` — helper (not IPC, used internally): logic from `computeStato()` in legacy `composti.html` (active/expiring/expired/revalidated/dismissed)

**Step 3: Create `src/main/ipc/preparazioni.ipc.ts`**

Simple CRUD scoped to a `composto_id`:
- `preparazioni:list` — `WHERE composto_id = ?`
- `preparazioni:create` / `preparazioni:update` / `preparazioni:delete`

**Step 4: Register all in `src/main/index.ts`**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: IPC handlers for metodi, composti, preparazioni"
```

---

## Task 6: IPC handlers — Eluenti, Consumabili, Diario, Query

**Files:**
- Create: `src/main/ipc/eluenti.ipc.ts`
- Create: `src/main/ipc/consumabili.ipc.ts`
- Create: `src/main/ipc/diario.ipc.ts`
- Create: `src/main/ipc/query.ipc.ts`
- Modify: `src/main/index.ts` — register

**Step 1: Create `src/main/ipc/eluenti.ipc.ts`**

CRUD for `eluenti` + `eluenti_componenti`. Scoped to `strumento_id`.
- `eluenti:list` — `WHERE strumento_id = ?` + JOIN componenti
- `eluenti:create` — insert eluente + N componenti in transaction
- `eluenti:update` — update eluente, delete old componenti, re-insert new
- `eluenti:close` — set `data_fine` to today
- `eluenti:delete`

**Step 2: Create `src/main/ipc/consumabili.ipc.ts`**

CRUD for `consumabili` + `consumabili_metodi`. Filterable by `tipo`.
- `consumabili:list` — optional filter by `tipo`, include associated metodi names
- `consumabili:create` / `consumabili:update` — upsert + sync `consumabili_metodi`
- `consumabili:close` — set `data_chiusura` to today
- `consumabili:delete`

**Step 3: Create `src/main/ipc/diario.ipc.ts`**

CRUD for `diario`. Scoped to `strumento_id`.
- `diario:list` — `WHERE strumento_id = ?` ORDER BY data DESC, optional metodo_id filter

**Step 4: Create `src/main/ipc/query.ipc.ts`**

Traceability query handler — the core analytical query.
- `query:snapshot` — accepts `{ strumentoId, metodoId?, data }`, returns:
  - Active eluenti on strumento at date (with componenti)
  - Active consumabili for metodo at date
  - Associated composti with active preparazione at date

Uses the three SQL queries from Section 10 of the design doc.

**Step 5: Register all, commit**

```bash
git add -A
git commit -m "feat: IPC handlers for eluenti, consumabili, diario, traceability query"
```

---

## Task 7: Legacy JSON migration handler

**Files:**
- Create: `src/main/ipc/migration.ipc.ts`
- Modify: `src/main/index.ts` — register

**Step 1: Create migration handler**

`config:import-legacy` handler:
1. Read the JSON file path provided by renderer
2. Parse the JSON (same format as `lcms-data.json`)
3. In a single transaction:
   - Insert `strumenti` from `json.strumenti[]`
   - Insert `metodi` — deduplicate by `id`, merge fields from both legacy structures
   - Insert `composti` — map old field names (`Name`→`nome`, `Classe`→`classe`, `Conc`→`concentrazione`, etc.)
   - Reconstruct `composti_metodi` from `composto.metodiIds[]`
   - Insert `preparazioni` from `json.preps{}`
   - Insert `composti_storia` from `composto._storia[]`
   - Insert `eluenti` + `eluenti_componenti` from `json.eluenti[]`
   - Insert `diario` from `json.diario[]`
   - Insert `anagrafiche` + voci from `json.anagrafiche[]`
4. On error → rollback, return `{ ok: false, error: message }`
5. On success → return `{ ok: true, counts: { composti: N, metodi: N, ... } }`

**Field mapping reference** (old → new):
```
Name → nome
CodiceInterno → codice_interno
Formula → formula
Classe → classe
Forma → forma
FormaCommer → forma_commerciale
Purezza → purezza
Conc → concentrazione
Solvente → solvente
Fiala → fiala
Azienda → produttore
Lotto → lotto
OperatoreApertura → operatore_apertura
DataApertura → data_apertura
ScadenzaProdotto → scadenza_prodotto
DataDismissione → data_dismissione
DestinazioneUso → destinazione_uso
WorkStandard → work_standard
Matrice → matrice
MW → peso_molecolare
Ubicazione → ubicazione
ARPA → arpa
Mix → mix
mix_id → mix_id
_id → (used as temp key for preps mapping, new id is AUTOINCREMENT)
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: legacy JSON to SQLite migration handler"
```

---

## Task 8: Renderer scaffold — Layout, Router, Theme

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles/globals.css`
- Create: `src/renderer/components/layout/AppLayout.tsx`
- Create: `src/renderer/components/layout/Sidebar.tsx`
- Create: `src/renderer/components/layout/Topbar.tsx`
- Create: `src/renderer/lib/api.ts`
- Create: `src/renderer/lib/utils.ts`

**Step 1: Create `src/renderer/index.html`**

Standard Vite HTML entry. Include Google Fonts link for Karla + Lato.

**Step 2: Create `src/renderer/styles/globals.css`**

Tailwind directives + CSS custom properties for the soft-tech pastels theme:
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 210 20% 98%;
    --foreground: 220 15% 15%;
    --card: 0 0% 100%;
    --card-foreground: 220 15% 15%;
    --primary: 168 45% 35%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 20% 96%;
    --secondary-foreground: 220 15% 25%;
    --muted: 210 15% 93%;
    --muted-foreground: 220 10% 45%;
    --accent: 168 30% 93%;
    --accent-foreground: 168 45% 25%;
    --destructive: 0 60% 50%;
    --destructive-foreground: 0 0% 100%;
    --border: 210 15% 88%;
    --input: 210 15% 88%;
    --ring: 168 45% 35%;
    --radius: 0.375rem;
  }
}
```

Theming note: all colors are HSL variables via Tailwind. To switch theme later, swap the `:root` block.

**Step 3: Create `src/renderer/lib/api.ts`**

Typed wrapper around `window.electronAPI.invoke`:
```ts
const api = window.electronAPI

export const strumentiApi = {
  list: () => api.invoke('strumenti:list'),
  get: (id: string) => api.invoke('strumenti:get', id),
  create: (data: Record<string, unknown>) => api.invoke('strumenti:create', data),
  // ... etc for each entity
}
// Repeat for metodiApi, compostiApi, etc.
```

**Step 4: Create `src/renderer/lib/utils.ts`**

`cn()` helper (Tailwind class merge — standard Shadcn pattern), date formatters, status computation.

**Step 5: Create `AppLayout.tsx`**

Layout component: fixed Sidebar on the left, Topbar on top, `<Outlet />` for page content. Uses React Router `<Outlet />`.

**Step 6: Create `Sidebar.tsx`**

Navigation links to `/composti`, `/metodi`, `/strumenti`, `/consumabili`, `/anagrafiche`. Active state highlighting. App title "LC-MS/MS Suite". Clock at bottom. Font: Karla for titles, Lato for labels.

**Step 7: Create `Topbar.tsx`**

Shows current page title + breadcrumb. DB connection indicator (path shown).

**Step 8: Create `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
// import page placeholders

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/composti" element={<div>Composti — TODO</div>} />
          <Route path="/metodi" element={<div>Metodi — TODO</div>} />
          <Route path="/strumenti" element={<div>Strumenti — TODO</div>} />
          <Route path="/consumabili" element={<div>Consumabili — TODO</div>} />
          <Route path="/anagrafiche" element={<div>Anagrafiche — TODO</div>} />
          <Route path="*" element={<Navigate to="/composti" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

**Step 9: Verify dev mode works**

```bash
npm run dev
# In another terminal:
npm run start
```

Should show Electron window with sidebar + placeholder pages.

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: renderer scaffold with layout, sidebar, router, theme"
```

---

## Task 9: Setup page (first-run flow)

**Files:**
- Create: `src/renderer/pages/setup/SetupPage.tsx`
- Modify: `src/renderer/App.tsx` — add setup route and redirect logic

**Step 1: Create `SetupPage.tsx`**

Full-screen centered card (no sidebar). Steps:
1. "Seleziona cartella per il database" → calls `window.electronAPI.selectFolder()`
2. If `isNew` → offer "Importa dati da lcms-data.json" or "Inizia da zero"
3. If import chosen → file dialog for JSON → calls `importLegacyJson` → shows progress/result
4. On completion → redirect to `/composti`

**Step 2: Modify `App.tsx`**

On mount, call `window.electronAPI.getConfig()`. If `dbPath` is null or `dbExists` is false → render `<SetupPage />` instead of the main layout.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: first-run setup page with folder selection and JSON import"
```

---

## Task 10: Install Shadcn/ui components

**Step 1: Initialize Shadcn**

```bash
npx shadcn@latest init
```

Configure for the project's paths (`src/renderer/components/ui`).

**Step 2: Add needed components**

```bash
npx shadcn@latest add button input select table dialog sheet badge \
  card separator tooltip textarea tabs command dropdown-menu label \
  alert-dialog toast sonner
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: install Shadcn/ui components"
```

---

## Task 11: Shared components — DataTable, SlidePanel, StatusBadge, ConfirmDialog

**Files:**
- Create: `src/renderer/components/shared/DataTable.tsx`
- Create: `src/renderer/components/shared/SlidePanel.tsx`
- Create: `src/renderer/components/shared/StatusBadge.tsx`
- Create: `src/renderer/components/shared/ConfirmDialog.tsx`

**Step 1: Create `DataTable.tsx`**

Generic table component. Props: `columns` definition array, `data`, `onSort`, `sortCol`, `sortDir`, `onRowClick`. Uses Shadcn `<Table>`. Renders headers with sort icons, rows with cell renderers. Supports custom cell rendering per column via render function.

**Step 2: Create `SlidePanel.tsx`**

Right-side sliding panel (like the existing side-panel in composti.html). Uses Shadcn `<Sheet>` configured as `side="right"`. Props: `open`, `onClose`, `title`, `subtitle`, `children`.

**Step 3: Create `StatusBadge.tsx`**

Renders the computed status of a composto (Attivo/In scadenza/Scaduto/Rivalidato/Dismesso) with appropriate Tailwind colors. Mirrors the logic from `computeStato()` in legacy code.

**Step 4: Create `ConfirmDialog.tsx`**

Wrapper around Shadcn `<AlertDialog>`. Props: `open`, `title`, `message`, `confirmLabel`, `variant` (danger/default), `onConfirm`, `onCancel`.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: shared components — DataTable, SlidePanel, StatusBadge, ConfirmDialog"
```

---

## Task 12: Page — Anagrafiche

**Files:**
- Create: `src/renderer/pages/anagrafiche/AnagrafichePage.tsx`
- Create: `src/renderer/pages/anagrafiche/AnagraficaCard.tsx`
- Modify: `src/renderer/App.tsx` — wire route

The simplest page. Build it first to validate the full IPC pipeline end-to-end.

**Step 1: Create `AnagraficaCard.tsx`**

Card component for a single anagrafica: title (editable inline), list of voci (editable inline), add new voce input, delete voce button. Mirrors the existing `anagrafiche.html` card behavior.

**Step 2: Create `AnagrafichePage.tsx`**

Grid of `AnagraficaCard` + "Nuova anagrafica" dashed card. On mount, fetches `anagrafiche:list`. All mutations call the appropriate IPC handler and refetch.

**Step 3: Wire route in `App.tsx`**

**Step 4: Test end-to-end**

Launch app, navigate to Anagrafiche, create an anagrafica, add voci, rename, delete. Verify DB file on disk contains the data.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: Anagrafiche page — full CRUD end-to-end"
```

---

## Task 13: Page — Metodi

**Files:**
- Create: `src/renderer/pages/metodi/MetodiPage.tsx`
- Create: `src/renderer/pages/metodi/MetodoCard.tsx`
- Create: `src/renderer/pages/metodi/MetodoDrawer.tsx`
- Create: `src/renderer/pages/metodi/MetodoForm.tsx`
- Modify: `src/renderer/App.tsx` — wire route

**Step 1: Create `MetodoCard.tsx`**

Card showing: nome, strumento badge, matrice, colonna, gradiente, flusso, composti count. Click opens drawer.

**Step 2: Create `MetodoForm.tsx`**

Modal form with all unified metodo fields: nome, strumento (select), matrice (select), colonna, fase_a, fase_b, gradiente, flusso, ionizzazione, polarita, acquisizione, srm, lims_id, oqlab_id, note. Used for both create and edit.

**Step 3: Create `MetodoDrawer.tsx`**

Slide-over panel using `SlidePanel`. Shows all metodo fields organized in sections (Identificazione, Cromatografia LC, MS, Integrazione, Note). Shows associated composti list. Edit and delete buttons.

**Step 4: Create `MetodiPage.tsx`**

Search bar + filter by strumento + filter by matrice. Stats bar (totals). Responsive card grid. "Nuovo metodo" button. Fetches `metodi:list` and `strumenti:list` on mount.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: Metodi page — card grid, drawer, form, filters"
```

---

## Task 14: Page — Strumenti

**Files:**
- Create: `src/renderer/pages/strumenti/StrumentiPage.tsx`
- Create: `src/renderer/pages/strumenti/StrumentoTabs.tsx`
- Create: `src/renderer/pages/strumenti/EluentiTab.tsx`
- Create: `src/renderer/pages/strumenti/MetodiReadonlyTab.tsx`
- Create: `src/renderer/pages/strumenti/DiarioTab.tsx`
- Create: `src/renderer/pages/strumenti/QueryTab.tsx`
- Modify: `src/renderer/App.tsx` — wire route

**Step 1: Create `StrumentiPage.tsx`**

Instrument selector strip at top (tab per strumento). Anagrafica bar below. Inner tabs container. Add/edit strumento modal.

**Step 2: Create `EluentiTab.tsx`**

Table of eluenti for selected strumento. CRUD modal with dynamic componenti rows. "Esaurisci" button to close an eluente.

**Step 3: Create `MetodiReadonlyTab.tsx`**

Read-only list of metodi associated to this strumento. Each card shows basic info + snapshot date picker + snapshot result. "Modifica" link navigates to `/metodi` (or opens the metodo form). No create/delete here.

**Step 4: Create `DiarioTab.tsx`**

List of diary entries for strumento, sorted by date desc. Add/edit modal with date, autore, metodo (optional select), testo.

**Step 5: Create `QueryTab.tsx`**

Date picker + metodo filter. "Interroga" button calls `query:snapshot` IPC. Renders structured result: eluenti attivi, consumabili attivi, composti con preparazioni.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: Strumenti page — tabs, eluenti, metodi readonly, diario, query"
```

---

## Task 15: Page — Composti (Standard DB)

**Files:**
- Create: `src/renderer/pages/composti/CompostiPage.tsx`
- Create: `src/renderer/pages/composti/CompostiTable.tsx`
- Create: `src/renderer/pages/composti/CompostoPanel.tsx`
- Create: `src/renderer/pages/composti/CompostoForm.tsx`
- Create: `src/renderer/pages/composti/PreparazioniTab.tsx`
- Create: `src/renderer/pages/composti/ImportDialog.tsx`
- Modify: `src/renderer/App.tsx` — wire route

This is the most complex page. Reference `composti.html` heavily for business logic.

**Step 1: Create `CompostiTable.tsx`**

Uses `DataTable` shared component. Columns: #, Nome, Codice Interno, Classe (pill), Forma (dot), Purezza/Conc (conditional), Solvente, Produttore, Lotto, Scadenza, Stato (StatusBadge), Prep count, Actions. Sortable, row click opens panel.

**Step 2: Create `CompostoForm.tsx`**

Modal form for create/edit. All composto fields. Multi-select for metodi association. Conditional fields: purezza shown only if forma=Neat, concentrazione/solvente shown only if forma=Solution|Stock.

**Step 3: Create `PreparazioniTab.tsx`**

Tab inside the panel. Lists preparazioni for the composto. Add/edit/delete preparazione. Fields: flacone, concentrazione, solvente, data_prep, scadenza, operatore, note.

**Step 4: Create `CompostoPanel.tsx`**

Uses `SlidePanel`. Tabs: Preparazioni, Dettaglio (all fields readonly), Storico (rivalidazioni/dismissioni). Rivalidazione and Dismissione action buttons with dedicated forms.

**Step 5: Create `ImportDialog.tsx`**

File picker (accepts .xlsx, .csv, .json). For Excel/CSV: client-side parsing (use `xlsx` library — `npm install xlsx`), column mapping UI, preview table, import button. For JSON: direct import via `importLegacyJson`.

**Step 6: Create `CompostiPage.tsx`**

Controls bar: search input, filter dropdowns (classe, forma, solvente, stato, metodo). Stats bar. Table. "Nuovo composto" and "Importa" buttons.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: Composti page — table, panel, form, preparazioni, import"
```

---

## Task 16: Page — Consumabili

**Files:**
- Create: `src/renderer/pages/consumabili/ConsumabiliPage.tsx`
- Create: `src/renderer/pages/consumabili/ConsumabileTable.tsx`
- Create: `src/renderer/pages/consumabili/ConsumabileForm.tsx`
- Modify: `src/renderer/App.tsx` — wire route

**Step 1: Create `ConsumabileForm.tsx`**

Modal form: tipo (select: colonna_hplc, spe, solvente, sale, altro), nome, lotto, fornitore, data_apertura, data_chiusura, note, metodi multi-select.

**Step 2: Create `ConsumabileTable.tsx`**

Table with columns: Tipo (badge), Nome, Lotto, Fornitore, Data Apertura, Data Chiusura, Stato (aperto/chiuso), Metodi (pills). Sortable.

**Step 3: Create `ConsumabiliPage.tsx`**

Filter by tipo tabs (Tutti, Colonne HPLC, SPE, Solventi, Sali). Search. "Nuovo consumabile" button. "Chiudi lotto" action on open items.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: Consumabili page — table, form, filters by type"
```

---

## Task 17: Polish, testing, final wiring

**Step 1: End-to-end smoke test**

Launch app. Run through the full flow:
1. First-run setup → select folder → import legacy JSON
2. Navigate all pages, verify data shows correctly
3. CRUD operations on each entity
4. Traceability query with real data

**Step 2: Error handling**

Add error toasts (Shadcn `sonner`) for IPC failures across all pages.

**Step 3: Loading states**

Add loading skeletons/spinners for IPC calls.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: error handling, loading states, polish"
```

---

## Task 18: Package as portable .exe

**Step 1: Install electron-rebuild**

```bash
npm install -D electron-rebuild
npx electron-rebuild -f -w better-sqlite3
```

**Step 2: Build and package**

```bash
npm run package
```

**Step 3: Verify**

Run `release/LCMS-Suite-1.0.0.exe` on a clean machine (or different folder). Verify first-run flow, DB creation, all features.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: packaging as portable exe"
```

---

## Summary

| Task | Description | Dependencies |
|---|---|---|
| 1 | Scaffold project | — |
| 2 | Main process + DB layer | 1 |
| 3 | Shared types | 1 |
| 4 | IPC: Strumenti + Anagrafiche | 2, 3 |
| 5 | IPC: Metodi + Composti + Preparazioni | 2, 3 |
| 6 | IPC: Eluenti + Consumabili + Diario + Query | 2, 3 |
| 7 | Legacy JSON migration | 2, 3 |
| 8 | Renderer scaffold + layout | 1 |
| 9 | Setup page (first-run) | 8, 2 |
| 10 | Shadcn/ui components | 8 |
| 11 | Shared components | 10 |
| 12 | Page: Anagrafiche | 4, 11 |
| 13 | Page: Metodi | 5, 11 |
| 14 | Page: Strumenti | 5, 6, 11 |
| 15 | Page: Composti | 5, 11 |
| 16 | Page: Consumabili | 6, 11 |
| 17 | Polish + smoke test | 12-16 |
| 18 | Package .exe | 17 |

**Parallel tracks possible:**
- Tasks 4, 5, 6, 7 can be done in parallel (all IPC, no dependencies between them)
- Tasks 8, 9, 10 can be done in parallel with IPC tasks
- Tasks 12-16 can be done in any order once their IPC + shared components are ready
