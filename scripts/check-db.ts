import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

const dataDir = path.join(os.homedir(), '.local', 'share', 'weekly-reporter')
const dbPath = path.join(dataDir, 'reports.db')

const db = new Database(dbPath)

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
console.log('Tables:', tables)

const templatesSchema = db.prepare("PRAGMA table_info(templates)").all()
console.log('Templates schema:', templatesSchema)

db.close()