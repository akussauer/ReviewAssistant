import { memo } from 'react'
import type { CellValue, Column } from '../../../../shared/ipc'
import type { Highlighter } from '../../../../shared/search'
import { CheckboxCell, ChecklistCell, DateCell, DropdownCell, NumberCell } from './cells/FieldCells'
import { TextCell } from './cells/TextCell'

type Props = {
  rowId: number
  column: Column
  value: CellValue | undefined
  live: boolean // false while the table scrolls (see TextCell)
  // Search matches to mark (text, list and checklist cells; others are tinted by the row)
  highlight?: Highlighter
}

// One always-editable cell, picked by column type (spec §4.1).
// memo: a cell re-renders only when its own value or column changes.
export const Cell = memo(function Cell({
  rowId,
  column,
  value,
  live,
  highlight
}: Props): React.JSX.Element {
  switch (column.type) {
    case 'text':
    case 'list':
      return (
        <TextCell
          // A new list style needs a new editor (its keys and numbering depend on it).
          key={column.options.style}
          rowId={rowId}
          columnId={column.id}
          label={column.label}
          value={value}
          live={live}
          highlight={highlight}
          listStyle={column.type === 'list' ? (column.options.style ?? 'bullets') : undefined}
        />
      )
    case 'dropdown':
      return <DropdownCell rowId={rowId} column={column} value={value} />
    case 'checklist':
      return <ChecklistCell rowId={rowId} column={column} value={value} highlight={highlight} />
    case 'checkbox':
      return <CheckboxCell rowId={rowId} column={column} value={value} />
    case 'date':
      return <DateCell rowId={rowId} column={column} value={value} />
    case 'number':
      return <NumberCell rowId={rowId} column={column} value={value} />
  }
})
