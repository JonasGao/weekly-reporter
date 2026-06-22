import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

const dataDir = path.join(os.homedir(), '.local', 'share', 'weekly-reporter')
const dbPath = path.join(dataDir, 'reports.db')

const db = new Database(dbPath)

const templates = db.prepare('SELECT * FROM templates').all()
console.log('Templates:', templates)

db.close()