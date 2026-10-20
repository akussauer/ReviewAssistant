import type { Column } from '../../shared/ipc'
import { CHECKLIST_SEPARATOR } from '../../shared/lists'
import { cellPath } from './cells'
import type { DB } from './types'

// The two SQL views that make a .review file readable from other tools (spec §3.1).
// Values are stored as JSON keyed by column id, so `rows_readable` unpacks them into one
// SQL column per user column, named by its label. Regenerate after every column change.

// SQL identifiers go in double quotes and strings in single quotes; a quote inside is doubled.
const ident = (s: string): string => `"${s.replaceAll('"', '""')}"`
const str = (s: string): string => `'${s.replaceAll("'", "''")}'`

function cellExpr(col: Column): string {
  const raw = `json_extract(r.data, ${str(cellPath(col.id))})`
  switch (col.type) {
    case 'checkbox':
      return `CASE WHEN ${raw} THEN 1 ELSE 0 END`
    case 'dropdown': {
      const choices = col.options.choices ?? []
      if (choices.length === 0) return 'NULL'
      const whens = choices.map((c) => `WHEN ${str(c.id)} THEN ${str(c.label)}`).join(' ')
      return `CASE ${raw} ${whens} END`
    }
    case 'checklist': {
      // The ticked labels in item order, "; " between them (the same text as the CSV):
      // each item adds "; Label" if ticked, and the leading "; " is cut off.
      const choices = col.options.choices ?? []
      if (choices.length === 0) return "''"
      const path = str(cellPath(col.id))
      const parts = choices.map(
        (c) =>
          `CASE WHEN EXISTS (SELECT 1 FROM json_each(r.data, ${path}) WHERE value = ${str(c.id)})` +
          ` THEN ${str(CHECKLIST_SEPARATOR + c.label)} ELSE '' END`
      )
      return `substr(${parts.join(' || ')}, ${CHECKLIST_SEPARATOR.length + 1})`
    }
    default:
      return raw
  }
}

// SQL column names are case-insensitive, so "Notes" and "notes" would clash (labels are
// only unique case-sensitively), as would a label like "row_id". Add " (2)", " (3)", …
function uniqueNames(labels: string[], reserved: string[]): string[] {
  const used = new Set(reserved.map((r) => r.toLowerCase()))
  return labels.map((label) => {
    let name = label
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${label} (${n})`
    used.add(name.toLowerCase())
    return name
  })
}

export function readableViewsSql(columns: Column[]): string {
  const sorted = [...columns].sort((a, b) => a.position - b.position)
  const names = uniqueNames(
    sorted.map((c) => c.label),
    ['row_id', 'row_checked']
  )
  const cols = sorted.map((c, i) => `,\n  ${cellExpr(c)} AS ${ident(names[i])}`).join('')
  return `
DROP VIEW IF EXISTS rows_readable;
CREATE VIEW rows_readable AS
SELECT
  r.id AS row_id,
  r.checked AS row_checked${cols}
FROM rows r
ORDER BY r.position;

DROP VIEW IF EXISTS tab_membership;
CREATE VIEW tab_membership AS
SELECT t.label AS tab, t.id AS tab_id, tr.row_id
FROM tab_rows tr JOIN tabs t ON t.id = tr.tab_id
ORDER BY t.position, tr.row_id;
`
}

// Returns whether anything was written. Rewriting views that are already up to date would
// change the file (and its modified time) on every open, which wakes sync tools like
// OneDrive and fails on a read-only file. So skip it when the stored SQL already matches.
export function regenerateViews(db: DB, columns: Column[]): boolean {
  const sql = readableViewsSql(columns)
  const stored = db.prepare("SELECT value FROM meta WHERE key = 'views_sql'").pluck().get()
  const views = db
    .prepare("SELECT COUNT(*) FROM sqlite_master WHERE type = 'view' AND name IN (?, ?)")
    .pluck()
    .get('rows_readable', 'tab_membership')
  if (stored === sql && views === 2) return false
  db.transaction(() => {
    db.exec(sql)
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('views_sql', ?)").run(sql)
  })()
  return true
}
