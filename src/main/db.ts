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
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  openDatabase(dbPath)
}

function runMigrations(): void {
  if (!db) return
  const currentVersion = db.pragma('user_version', { simple: true }) as number

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
