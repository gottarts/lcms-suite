import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const getConfigDir = () => path.join(app.getPath('userData'))
const getConfigFile = () => path.join(getConfigDir(), 'config.json')

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
    const configFile = getConfigFile()
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  }
  return { ...DEFAULT_CONFIG }
}

export function saveConfig(config: AppConfig): void {
  try {
    const configDir = getConfigDir()
    const configFile = getConfigFile()
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}
