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
  db.pragma('busy_timeout = 5000')
  try { db.pragma('wal_checkpoint(TRUNCATE)') } catch (e) {
    console.warn('[db] wal_checkpoint skipped:', (e as Error)?.message)
  }
  const mode = db.pragma('journal_mode = DELETE', { simple: true })
  if (mode !== 'delete') {
    console.warn(`[db] journal_mode è "${mode}" (atteso "delete"): altro processo tiene lock WAL?`)
  }
  db.pragma('synchronous = FULL')
  db.pragma('foreign_keys = ON')
  runMigrations()
}

export function closeDatabase(): void {
  if (db) { db.close(); db = null }
}

export function createDatabase(dbPath: string): void {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  openDatabase(dbPath)
}

function runMigrations(): void {
  if (!db) return
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  console.log('[migrations] user_version corrente:', currentVersion)

  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(__dirname, '..', '..', 'src', 'main', 'migrations')

  if (!fs.existsSync(migrationsDir)) return

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const version = parseInt(file.split('-')[0], 10)
    console.log(`[migrations] file: ${file}, version: ${version}, applica: ${version > currentVersion}`)
    if (version > currentVersion) {
      console.log(`[migrations] applico ${file}...`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      db.pragma('foreign_keys = OFF')
      try {
        db.exec(sql)
        db.pragma('foreign_keys = ON')
        db.pragma(`user_version = ${version}`)
        console.log(`[migrations] ${file} applicata OK, user_version = ${version}`)
      } catch (e) {
        db.pragma('foreign_keys = ON')
        console.error(`[migrations] ERRORE in ${file}:`, e)
        throw e
      }
    }
  }
}

export function dbFileExists(dbPath: string): boolean {
  return fs.existsSync(dbPath)
}
