import path from 'path'
import os from 'os'
import { mkdirSync, existsSync } from 'fs'

const XDG_DATA_HOME = process.env.XDG_DATA_HOME || 
  path.join(os.homedir(), '.local', 'share')
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || 
  path.join(os.homedir(), '.config')

export const DATA_DIR = path.join(XDG_DATA_HOME, 'weekly-reporter')
export const CONFIG_DIR = path.join(XDG_CONFIG_HOME, 'weekly-reporter')
export const DB_PATH = path.join(DATA_DIR, 'reports.db')

export function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}