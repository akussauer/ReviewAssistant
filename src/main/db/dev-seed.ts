import type { CellValue, Column } from '../../shared/ipc'
import { listColumns } from './columns'
import type { DB } from './types'

// Development helper: fills the open review with `count` rows of random but valid data,
// to check the table stays smooth with thousands of rows (plan M3). Never used in a
// packaged build: main only registers the IPC channel in development.

const WORDS = (
  'pacing swimming juniors cohort elite training load performance fatigue sprint ' +
  'endurance adolescent coaching race strategy velocity stroke rate analysis outcome'
).split(' ')

type Rng = () => number

const pick = <T>(rng: Rng, items: T[]): T => items[Math.floor(rng() * items.length)]
const int = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1))

function sentence(rng: Rng, words: number): string {
  const s = Array.from({ length: words }, () => pick(rng, WORDS)).join(' ')
  return s[0].toUpperCase() + s.slice(1)
}

export function randomValue(column: Column, rng: Rng = Math.random): CellValue {
  switch (column.type) {
    case 'text':
      return rng() < 0.1 ? '' : sentence(rng, int(rng, 2, 25))
    case 'checkbox':
      return rng() < 0.5
    case 'number':
      return int(rng, column.options.min ?? 0, column.options.max ?? 9999)
    case 'dropdown':
      return column.options.choices?.length ? pick(rng, column.options.choices).id : null
    case 'date': {
      const d = new Date(Date.UTC(int(rng, 2000, 2025), int(rng, 0, 11), int(rng, 1, 28)))
      return d.toISOString().slice(0, 10)
    }
  }
}

export function seedRows(db: DB, count: number, rng: Rng = Math.random): void {
  const columns = listColumns(db)
  const start = (db.prepare('SELECT MAX(position) FROM rows').pluck().get() as number | null) ?? 0
  const insert = db.prepare('INSERT INTO rows (data, position, checked) VALUES (?, ?, ?)')
  db.transaction(() => {
    for (let i = 1; i <= count; i++) {
      const data = Object.fromEntries(columns.map((c) => [String(c.id), randomValue(c, rng)]))
      insert.run(JSON.stringify(data), start + i, rng() < 0.1 ? 1 : 0)
    }
  })()
}
