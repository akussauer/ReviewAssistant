import type { DB } from './types'

// Each entry upgrades the file by one version; `PRAGMA user_version` records how many
// have run. Never edit an entry once it has shipped: add a new one instead.
export const migrations: string[] = [
  // 1: initial schema (docs/plan.md, M2)
  `
  CREATE TABLE columns (
    id       INTEGER PRIMARY KEY,
    label    TEXT NOT NULL UNIQUE,
    type     TEXT NOT NULL CHECK (type IN ('text','dropdown','checkbox','date','number')),
    options  TEXT NOT NULL DEFAULT '{}',  -- dropdown: {"choices":[{"id","label"}]}; number: {"min","max"}
    width    INTEGER NOT NULL DEFAULT 150,
    position INTEGER NOT NULL
  );
  CREATE TABLE rows (
    id         INTEGER PRIMARY KEY,
    data       TEXT NOT NULL DEFAULT '{}',  -- {"<columnId>": value}
    position   REAL NOT NULL,               -- manual order (REAL allows inserting between)
    height     INTEGER NOT NULL DEFAULT 80,
    checked    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE tabs (
    id                INTEGER PRIMARY KEY,  -- id 1 = Main (seeded below, protected)
    label             TEXT NOT NULL UNIQUE,
    type              TEXT NOT NULL DEFAULT 'review' CHECK (type IN ('main','review','synthesis')),
    position          INTEGER NOT NULL,
    assistant_enabled INTEGER NOT NULL DEFAULT 0,
    view              TEXT NOT NULL DEFAULT '{}'  -- sort, column filters, search
  );
  CREATE TABLE tab_rows (               -- the main tab shows all rows, so it has no entries
    tab_id INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
    row_id INTEGER NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
    PRIMARY KEY (tab_id, row_id)
  );
  CREATE INDEX tab_rows_row ON tab_rows(row_id);
  CREATE TABLE messages (               -- one conversation per tab (M7)
    id         INTEGER PRIMARY KEY,
    tab_id     INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content    TEXT NOT NULL,
    context    TEXT NOT NULL DEFAULT '[]',  -- labels of attached chips
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE synthesis (              -- M8
    tab_id    INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
    column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    included  INTEGER NOT NULL DEFAULT 0,
    text      TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (tab_id, column_id)
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- active_tab, ...

  INSERT INTO tabs (id, label, type, position) VALUES (1, 'Main', 'main', 0);
  `
]

export const SCHEMA_VERSION = migrations.length

export function schemaVersion(db: DB): number {
  return db.pragma('user_version', { simple: true }) as number
}

export function runMigrations(db: DB): void {
  for (let v = schemaVersion(db); v < migrations.length; v++) {
    // One transaction per step: a failed migration leaves the file at the previous version.
    db.transaction(() => {
      db.exec(migrations[v])
      db.pragma(`user_version = ${v + 1}`)
    })()
  }
}
