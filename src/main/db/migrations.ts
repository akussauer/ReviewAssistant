export const migrations: string[] = [
  // version 1
  `
  CREATE TABLE columns (
    id          INTEGER PRIMARY KEY,
    key         TEXT UNIQUE NOT NULL,
    label       TEXT NOT NULL,
    widget_type TEXT NOT NULL,
    options     TEXT NOT NULL DEFAULT '{}',
    width       INTEGER NOT NULL DEFAULT 150,
    position    INTEGER NOT NULL
  );

  CREATE TABLE articles (
    id         INTEGER PRIMARY KEY,
    data       TEXT NOT NULL DEFAULT '{}',
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  `
]