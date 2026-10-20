import type { DB } from './types'

// A step that rebuilds a table (SQLite can't change a CHECK in place) runs with foreign
// keys off: otherwise dropping the old table would cascade-delete the rows that point
// at it (e.g. synthesis → columns). The foreign keys are checked again before it commits.
type Migration = string | { sql: string; foreignKeysOff: true }

// Each entry upgrades the file by one version; `PRAGMA user_version` records how many
// have run. Never edit an entry once it has shipped: add a new one instead.
export const migrations: Migration[] = [
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
  `,
  // 2: assistant panel width and model per tab; what each reply cost (M7)
  `
  ALTER TABLE tabs ADD COLUMN assistant_width INTEGER;     -- px; NULL = default
  ALTER TABLE tabs ADD COLUMN assistant_model TEXT;        -- model id; NULL = default
  ALTER TABLE messages ADD COLUMN model TEXT;
  ALTER TABLE messages ADD COLUMN tokens_in INTEGER;       -- as reported by the provider
  ALTER TABLE messages ADD COLUMN tokens_out INTEGER;
  ALTER TABLE messages ADD COLUMN cost REAL;               -- USD
  ALTER TABLE messages ADD COLUMN cost_estimated INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX messages_tab ON messages(tab_id, id);
  `,
  // 3: List and Checklist column types (M10e)
  {
    foreignKeysOff: true,
    sql: `
  CREATE TABLE columns_new (
    id       INTEGER PRIMARY KEY,
    label    TEXT NOT NULL UNIQUE,
    type     TEXT NOT NULL CHECK (type IN ('text','list','dropdown','checklist','checkbox','date','number')),
    options  TEXT NOT NULL DEFAULT '{}',  -- dropdown, checklist: {"choices":[{"id","label"}]}; number: {"min","max"}; list: {"style"}
    width    INTEGER NOT NULL DEFAULT 150,
    position INTEGER NOT NULL
  );
  INSERT INTO columns_new (id, label, type, options, width, position)
    SELECT id, label, type, options, width, position FROM columns;
  DROP TABLE columns;
  ALTER TABLE columns_new RENAME TO columns;
  `
  }
]

export const SCHEMA_VERSION = migrations.length

export function schemaVersion(db: DB): number {
  return db.pragma('user_version', { simple: true }) as number
}

// How many rows point at a row that doesn't exist (SQLite's own check).
const brokenReferences = (db: DB): number => (db.pragma('foreign_key_check') as unknown[]).length

export function runMigrations(db: DB): void {
  for (let v = schemaVersion(db); v < migrations.length; v++) {
    const step = migrations[v]
    const sql = typeof step === 'string' ? step : step.sql
    // The pragma is ignored inside a transaction, so it's switched around it.
    const fkOff = typeof step !== 'string' && db.pragma('foreign_keys', { simple: true }) === 1
    if (fkOff) db.pragma('foreign_keys = OFF')
    const brokenBefore = fkOff ? brokenReferences(db) : 0
    try {
      // One transaction per step: a failed migration leaves the file at the previous version.
      db.transaction(() => {
        db.exec(sql)
        // Only references this step broke count: a file may already have some (e.g. edited
        // in another tool with foreign keys off), and that mustn't stop it opening.
        if (fkOff && brokenReferences(db) > brokenBefore)
          throw new Error(`Migration ${v + 1} broke a foreign key`)
        db.pragma(`user_version = ${v + 1}`)
      })()
    } finally {
      if (fkOff) db.pragma('foreign_keys = ON')
    }
  }
}
