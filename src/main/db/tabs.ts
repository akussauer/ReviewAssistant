import { MAIN_TAB_ID, type Tab, type TabCreateInput, type TabUpdateInput } from '../../shared/ipc'
import type { DB } from './types'
import { t } from '../i18n'

type TabRecord = {
  id: number
  label: string
  type: Tab['type']
  position: number
  assistant_enabled: number
  assistant_width: number | null
  assistant_model: string | null
  view: string
}

function rowIdsOf(db: DB, tabId: number): number[] {
  // Main-table order (spec §8).
  return db
    .prepare(
      `SELECT tr.row_id FROM tab_rows tr JOIN rows r ON r.id = tr.row_id
       WHERE tr.tab_id = ? ORDER BY r.position`
    )
    .pluck()
    .all(tabId) as number[]
}

const toTab = (db: DB, r: TabRecord): Tab => ({
  id: r.id,
  label: r.label,
  type: r.type,
  position: r.position,
  assistantEnabled: r.assistant_enabled === 1,
  assistantWidth: r.assistant_width,
  assistantModel: r.assistant_model,
  view: JSON.parse(r.view),
  rowIds: rowIdsOf(db, r.id)
})

export function listTabs(db: DB): Tab[] {
  const rows = db.prepare('SELECT * FROM tabs ORDER BY position').all() as TabRecord[]
  return rows.map((r) => toTab(db, r))
}

export function getTab(db: DB, id: number): Tab {
  const r = db.prepare('SELECT * FROM tabs WHERE id = ?').get(id) as TabRecord | undefined
  if (!r) throw new Error(`Tab ${id} not found`)
  return toTab(db, r)
}

function assertLabelFree(db: DB, label: string, exceptId = 0): void {
  if (db.prepare('SELECT 1 FROM tabs WHERE label = ? AND id != ?').get(label, exceptId)) {
    throw new Error(t('errors.tabExists', { name: label }))
  }
}

function assertUserTab(id: number): void {
  if (id === MAIN_TAB_ID) throw new Error('The main tab cannot be changed this way')
}

function insertRows(db: DB, tabId: number, rowIds: number[]): void {
  // OR IGNORE: adding a row that's already in the tab is a no-op, not an error.
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO tab_rows (tab_id, row_id) SELECT ?, id FROM rows WHERE id = ?'
  )
  rowIds.forEach((rowId) => stmt.run(tabId, rowId))
}

export function createTab(db: DB, input: TabCreateInput): Tab {
  return db.transaction(() => {
    const label = input.label.trim()
    assertLabelFree(db, label)
    const next = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 FROM tabs').pluck().get()
    const { lastInsertRowid } = db
      .prepare('INSERT INTO tabs (label, type, position) VALUES (?, ?, ?)')
      .run(label, input.type, next)
    const id = Number(lastInsertRowid)
    insertRows(db, id, input.rowIds ?? [])
    return getTab(db, id)
  })()
}

export function updateTab(db: DB, input: TabUpdateInput): Tab {
  return db.transaction(() => {
    const tab = getTab(db, input.id)
    if (input.label !== undefined || input.type !== undefined) assertUserTab(tab.id)
    if (input.label !== undefined) {
      const label = input.label.trim()
      assertLabelFree(db, label, tab.id)
      db.prepare('UPDATE tabs SET label = ? WHERE id = ?').run(label, tab.id)
    }
    if (input.type !== undefined) {
      db.prepare('UPDATE tabs SET type = ? WHERE id = ?').run(input.type, tab.id)
    }
    if (input.assistantEnabled !== undefined) {
      db.prepare('UPDATE tabs SET assistant_enabled = ? WHERE id = ?').run(
        input.assistantEnabled ? 1 : 0,
        tab.id
      )
    }
    if (input.assistantWidth !== undefined) {
      db.prepare('UPDATE tabs SET assistant_width = ? WHERE id = ?').run(
        input.assistantWidth,
        tab.id
      )
    }
    if (input.assistantModel !== undefined) {
      db.prepare('UPDATE tabs SET assistant_model = ? WHERE id = ?').run(
        input.assistantModel,
        tab.id
      )
    }
    if (input.view !== undefined) {
      db.prepare('UPDATE tabs SET view = ? WHERE id = ?').run(JSON.stringify(input.view), tab.id)
    }
    return getTab(db, tab.id)
  })()
}

// Removes the tab, not its rows (spec §8).
export function deleteTab(db: DB, id: number): void {
  assertUserTab(id)
  db.transaction(() => {
    if (db.prepare('DELETE FROM tabs WHERE id = ?').run(id).changes === 0) {
      throw new Error(`Tab ${id} not found`)
    }
    if (getActiveTabId(db) === id) setActiveTabId(db, MAIN_TAB_ID)
  })()
}

// `ids` is every user tab id in the new order; the main tab always stays first.
export function reorderTabs(db: DB, ids: number[]): Tab[] {
  db.transaction(() => {
    const current = listTabs(db)
      .filter((t) => t.id !== MAIN_TAB_ID)
      .map((t) => t.id)
    const same =
      ids.length === current.length && [...ids].sort().join() === [...current].sort().join()
    if (!same) throw new Error('Reorder must list every user tab exactly once')
    const stmt = db.prepare('UPDATE tabs SET position = ? WHERE id = ?')
    ids.forEach((id, i) => stmt.run(i + 1, id))
  })()
  return listTabs(db)
}

export function addRowsToTab(db: DB, tabId: number, rowIds: number[]): Tab {
  assertUserTab(tabId)
  db.transaction(() => {
    getTab(db, tabId)
    insertRows(db, tabId, rowIds)
  })()
  return getTab(db, tabId)
}

// Removes rows from this tab only; they stay in the main table (spec §5).
export function removeRowsFromTab(db: DB, tabId: number, rowIds: number[]): Tab {
  assertUserTab(tabId)
  const stmt = db.prepare('DELETE FROM tab_rows WHERE tab_id = ? AND row_id = ?')
  db.transaction(() => rowIds.forEach((rowId) => stmt.run(tabId, rowId)))()
  return getTab(db, tabId)
}

// ---- Active tab, kept in the `meta` table ----

export function getActiveTabId(db: DB): number {
  const value = db.prepare("SELECT value FROM meta WHERE key = 'active_tab'").pluck().get() as
    string | undefined
  const id = Number(value)
  // Fall back to the main tab if the stored tab no longer exists.
  return id && db.prepare('SELECT 1 FROM tabs WHERE id = ?').get(id) ? id : MAIN_TAB_ID
}

export function setActiveTabId(db: DB, tabId: number): void {
  getTab(db, tabId)
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_tab', ?)").run(String(tabId))
}
