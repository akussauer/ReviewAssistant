import { z } from 'zod'
import { convertValue } from '../../shared/conversion'
import type {
  CellValue,
  Column,
  ColumnCreateInput,
  ColumnOptions,
  ColumnType
} from '../../shared/ipc'
import { MAIN_TAB_ID } from '../../shared/ipc'
import { createColumn, listColumns } from './columns'
import { ReviewFileError } from './open'
import { ensureOneRow } from './rows'
import { createTab, setActiveTabId, updateTab } from './tabs'
import type { DB } from './types'
import { regenerateViews } from './views'

// Imports a file saved by the PySide6 app (schema v1 or v2, spec §9) into an empty,
// migrated review (openReviewDb with `empty`). The format is written by
// Model.save_json + MainWindow._tabs_payload in the reference app; see
// docs/json-format.md. Nothing is lost silently: every conversion is listed in `notes`.

// Loose schemas: old files may lack any optional key, and unknown keys are ignored.
const PyColumn = z.looseObject({
  name: z.string(),
  type_key: z.string().optional(),
  options: z.array(z.unknown()).optional(),
  min_val: z.number().optional(),
  max_val: z.number().optional(),
  width: z.number().optional()
})
const PyId = z.union([z.string(), z.number()]).transform(String)
const PyTab = z.looseObject({
  name: z.string(),
  type: z.string().optional(),
  row_ids: z.array(PyId).optional(), // v2
  row_idx: z.array(z.number()).optional(), // v1: positions in the row list
  assistant_enabled: z.boolean().optional()
})
const PyFileSchema = z.looseObject({
  schema_version: z.number().optional(),
  columns: z.array(PyColumn),
  rows: z.array(z.record(z.string(), z.unknown())),
  row_heights: z.array(z.number()).optional(),
  row_checked: z.array(z.unknown()).optional(),
  row_ids: z.array(PyId).optional(),
  tabs: z.array(PyTab).optional(),
  active_tab: z.string().nullable().optional()
})
export type PyFile = z.infer<typeof PyFileSchema>

export type ImportSummary = { rows: number; columns: number; tabs: number; notes: string[] }

// Same as Delegates.TYPE_KEY in the reference app.
const TYPE_MAP: Record<string, ColumnType> = {
  textedit: 'text',
  combobox: 'dropdown',
  checkbox: 'checkbox',
  date: 'date',
  spinbox: 'number'
}
const DEFAULT_ROW_HEIGHT = 80 // Delegates.DEFAULT_ROW_HEIGHT
const MIN_ROW_HEIGHT = 16
const MAX_ROW_HEIGHT = 5000

// "Notes", "Notes (2)", "Notes (3)", …
function uniqueLabel(wanted: string, taken: Set<string>, fallback: string): string {
  const base = wanted.trim() || fallback
  let label = base
  for (let n = 2; taken.has(label); n++) label = `${base} (${n})`
  taken.add(label)
  return label
}

// Python values arrive as JSON; anything that isn't a plain cell value becomes text.
function asCell(v: unknown): CellValue | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  return JSON.stringify(v)
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function parsePysideJson(text: string): PyFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ReviewFileError('This file is not valid JSON.')
  }
  const parsed = PyFileSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ReviewFileError(
      'This JSON file was not saved by the old Review Assistant (it needs "columns" and "rows").'
    )
  }
  return parsed.data
}

// Works out a column's type and options from the old definition and its values.
function planColumn(
  py: PyFile['columns'][number],
  label: string,
  values: (CellValue | undefined)[],
  notes: string[]
): ColumnCreateInput {
  const width = Math.max(20, Math.min(5000, Math.round(py.width ?? 100)))
  if (py.width !== undefined && width !== py.width) {
    notes.push(`"${label}": width ${py.width} px changed to ${width} px.`)
  }
  let type = TYPE_MAP[py.type_key ?? 'textedit']
  if (!type) {
    notes.push(`"${label}": unknown type "${py.type_key}", imported as Text.`)
    type = 'text'
  }

  if (type === 'dropdown') {
    const labels: string[] = []
    const add = (v: unknown): void => {
      const t = String(v).trim()
      if (t && !labels.includes(t)) labels.push(t)
    }
    ;(py.options ?? []).forEach(add)
    const known = labels.length
    values.forEach((v) => v !== undefined && typeof v !== 'boolean' && add(v))
    if (labels.length === 0) {
      notes.push(`"${label}": a dropdown with no options, imported as Text.`)
      return { label, type: 'text', options: {}, width }
    }
    if (labels.length > known) {
      const extra = labels.slice(known).map((l) => `"${l}"`)
      notes.push(
        `"${label}": added ${plural(extra.length, 'option')} used in rows: ${extra.join(', ')}.`
      )
    }
    return { label, type, options: { choices: labels.map((l) => ({ label: l })) }, width }
  }

  if (type === 'number') {
    let min = Math.round(py.min_val ?? 0)
    let max = Math.round(py.max_val ?? 9999)
    if (min > max) {
      notes.push(`"${label}": minimum and maximum were the wrong way round, so swapped.`)
      ;[min, max] = [max, min]
    }
    const nums = values.flatMap((v) => {
      const r = convertValue({ type: 'text', options: {} }, { type, options: {} }, v ?? null)
      return typeof r.value === 'number' ? [r.value] : []
    })
    const lo = Math.min(min, ...nums)
    const hi = Math.max(max, ...nums)
    if (lo !== min || hi !== max) {
      notes.push(`"${label}": range widened from ${min}–${max} to ${lo}–${hi} to fit the values.`)
    }
    return { label, type, options: { min: lo, max: hi }, width }
  }

  return { label, type, options: {}, width }
}

export function importPyside(db: DB, file: PyFile): ImportSummary {
  const notes: string[] = []
  const n = file.rows.length

  return db.transaction(() => {
    // ---- Columns, in the old order
    const takenColumns = new Set<string>()
    const plans = file.columns.map((py, i) => {
      const label = uniqueLabel(py.name, takenColumns, `Column ${i + 1}`)
      if (label !== py.name) notes.push(`Column "${py.name}" renamed to "${label}".`)
      const values = file.rows.map((r) => asCell(r[py.name]))
      return { py, values, input: planColumn(py, label, values, notes) }
    })
    plans.forEach((p) => createColumn(db, p.input))
    // Values under a name that isn't a column (the old app normally removes them).
    const names = new Set(file.columns.map((c) => c.name))
    const strays = [...new Set(file.rows.flatMap((r) => Object.keys(r)))].filter(
      (k) => !names.has(k)
    )
    strays.forEach((k) => notes.push(`Values under "${k}" (not a column) were not imported.`))
    const columns = listColumns(db)

    // ---- Rows. Values are converted as if from text, which is how the old app stored
    // most of them (convertValue handles numbers and booleans as well).
    const cleared = new Map<Column, number>()
    const datas = file.rows.map(() => ({}) as Record<string, CellValue>)
    plans.forEach((p, ci) => {
      const col = columns[ci]
      const to = { type: col.type, options: col.options as ColumnOptions }
      p.values.forEach((v, ri) => {
        const r = convertValue({ type: 'text', options: {} }, to, v ?? null)
        if (r.outcome === 'cleared') cleared.set(col, (cleared.get(col) ?? 0) + 1)
        datas[ri][String(col.id)] = r.value
      })
    })
    for (const [col, count] of cleared) {
      notes.push(
        `"${col.label}": ${plural(count, 'value')} that didn't fit a ${col.type} column left empty.`
      )
    }

    const insert = db.prepare(
      'INSERT INTO rows (data, position, height, checked) VALUES (?, ?, ?, ?)'
    )
    const idByOld = new Map<string, number>()
    const newIds: number[] = []
    let tallRows = 0
    for (let i = 0; i < n; i++) {
      const h = file.row_heights?.[i]
      // At least 16 px, as in the reference app; at most what the app lets you drag to.
      const height =
        typeof h === 'number' && Number.isFinite(h)
          ? Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, Math.round(h)))
          : DEFAULT_ROW_HEIGHT
      if (typeof h === 'number' && h > MAX_ROW_HEIGHT) tallRows++
      const checked = file.row_checked?.[i] ? 1 : 0
      const id = Number(
        insert.run(JSON.stringify(datas[i]), i + 1, height, checked).lastInsertRowid
      )
      newIds.push(id)
      const old = file.row_ids?.[i]
      if (old !== undefined && !idByOld.has(old)) idByOld.set(old, id)
    }

    if (tallRows) {
      notes.push(
        `${plural(tallRows, 'row')} taller than ${MAX_ROW_HEIGHT} px made ${MAX_ROW_HEIGHT} px.`
      )
    }

    // ---- Tabs
    const takenTabs = new Set(['Main'])
    const tabIdByName = new Map<string, number>()
    for (const t of file.tabs ?? []) {
      const label = uniqueLabel(t.name, takenTabs, 'Tab')
      if (label !== t.name) notes.push(`Tab "${t.name}" renamed to "${label}".`)
      let missing = 0
      const rowIds = t.row_ids
        ? t.row_ids.flatMap((old) => {
            const id = idByOld.get(old)
            if (id === undefined) missing++
            return id === undefined ? [] : [id]
          })
        : (t.row_idx ?? []).flatMap((i) => {
            const ok = Number.isInteger(i) && i >= 0 && i < n
            if (!ok) missing++
            return ok ? [newIds[i]] : []
          })
      if (missing)
        notes.push(`Tab "${label}": ${plural(missing, 'row')} no longer in the file skipped.`)
      const type = t.type === 'synthesis' ? 'synthesis' : 'review'
      const tab = createTab(db, { label, type, rowIds })
      if (t.assistant_enabled) updateTab(db, { id: tab.id, assistantEnabled: true })
      if (!tabIdByName.has(t.name)) tabIdByName.set(t.name, tab.id)
    }
    // The old app saves "main" for the main tab, otherwise the tab's name.
    const active =
      file.active_tab && file.active_tab !== 'main' ? tabIdByName.get(file.active_tab) : undefined
    setActiveTabId(db, active ?? MAIN_TAB_ID)

    regenerateViews(db, listColumns(db))
    ensureOneRow(db)
    return { rows: n, columns: columns.length, tabs: file.tabs?.length ?? 0, notes }
  })()
}
