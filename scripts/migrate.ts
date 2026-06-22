import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

const dataDir = path.join(os.homedir(), '.local', 'share', 'weekly-reporter')
const dbPath = path.join(dataDir, 'reports.db')

const db = new Database(dbPath)

db.exec(`
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  work_types TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`)

console.log('Migration completed successfully')
db.close()