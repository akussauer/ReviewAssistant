import type { ColumnCreateInput } from '../../shared/ipc'
import { createColumn } from './columns'
import { createRow } from './rows'
import type { DB } from './types'

// The columns every new review starts with (spec §4.3, MainWindow.default_columns).
export const DEFAULT_TEMPLATE: ColumnCreateInput[] = [
  { label: 'Title', type: 'text', options: {} },
  {
    label: 'Study Type',
    type: 'dropdown',
    options: {
      choices: ['RCT', 'Cohort', 'Case Study', 'Systematic Review', 'Meta-Analysis', 'Other'].map(
        (label) => ({ label })
      )
    }
  },
  { label: 'Author(s)', type: 'text', options: {} },
  { label: 'Year', type: 'number', options: { min: 1950, max: 2030 } },
  { label: 'Date Added', type: 'date', options: {} },
  { label: 'Read', type: 'checkbox', options: {} },
  { label: 'Spin', type: 'number', options: { min: 0, max: 100 } },
  { label: 'Notes', type: 'text', options: {} }
]

// Fills a freshly migrated (empty) file with the template and one blank row.
export function seedTemplate(db: DB): void {
  db.transaction(() => {
    DEFAULT_TEMPLATE.forEach((c) => createColumn(db, c))
    createRow(db)
  })()
}
