import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { migrations } from './migrations'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised')
  return db
}

export function initDb(): void {
  const path = join(app.getPath('userData'), 'articles.db')
  console.log('DB at', path)
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
}

function runMigrations(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let v = current; v < migrations.length; v++) {
    db.transaction(() => {
      db.exec(migrations[v])
      db.pragma(`user_version = ${v + 1}`)
    })()
  }
}