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
