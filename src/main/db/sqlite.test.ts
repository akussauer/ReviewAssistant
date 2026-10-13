import Database from 'better-sqlite3'
import { expect, it } from 'vitest'

// Smoke test: proves the test runner can load the Electron-built better-sqlite3,
// which the M2 data-layer tests depend on.
it('opens an in-memory SQLite database', () => {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (42)')
  expect(db.prepare('SELECT x FROM t').get()).toEqual({ x: 42 })
  db.close()
})
