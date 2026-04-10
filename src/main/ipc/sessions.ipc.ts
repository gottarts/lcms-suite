import { ipcMain } from 'electron'
import { getDb } from '../db'
import os from 'os'
import { randomUUID } from 'crypto'

const SESSION_ID = randomUUID()
const HOSTNAME = os.hostname()
const HEARTBEAT_INTERVAL_MS = 30_000
const SESSION_TIMEOUT_S = 90

let heartbeatTimer: NodeJS.Timeout | null = null

export function startSession(): void {
  getDb().prepare(`
    INSERT INTO sessions (id, hostname, last_seen) VALUES (?, ?, unixepoch())
    ON CONFLICT(id) DO UPDATE SET last_seen = unixepoch()
  `).run(SESSION_ID, HOSTNAME)

  heartbeatTimer = setInterval(() => {
    try {
      getDb().prepare(`UPDATE sessions SET last_seen = unixepoch() WHERE id = ?`).run(SESSION_ID)
    } catch (_) { /* DB non aperto o chiuso */ }
  }, HEARTBEAT_INTERVAL_MS)
}

export function stopSession(): void {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  try {
    getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(SESSION_ID)
  } catch (_) { /* DB già chiuso */ }
}

export function registerSessionsIpc(): void {
  ipcMain.handle('sessions:list', () => {
    return getDb()
      .prepare(`SELECT hostname FROM sessions WHERE last_seen >= unixepoch() - ?`)
      .all(SESSION_TIMEOUT_S) as { hostname: string }[]
  })
}
