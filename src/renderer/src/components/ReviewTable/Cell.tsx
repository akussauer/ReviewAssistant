import { memo } from 'react'
import type { CellValue, Column } from '../../../../shared/ipc'
import { CheckboxCell, DateCell, DropdownCell, NumberCell } from './cells/FieldCells'
import { TextCell } from './cells/TextCell'

type Props = {
  rowId: number
  column: Column
  value: CellValue | undefined
  live: boolean // false while the table scrolls (see TextCell)
}

// One always-editable cell, picked by column type (spec §4.1).
// memo: a cell re-renders only when its own value or column changes.
export const Cell = memo(function Cell({ rowId, column, value, live }: Props): React.JSX.Element {
  switch (column.type) {
    case 'text':
      return (
        <TextCell
          rowId={rowId}
          columnId={column.id}
          label={column.label}
          value={value}
          live={live}
        />
      )
    case 'dropdown':
      return <DropdownCell rowId={rowId} column={column} value={value} />
    case 'checkbox':
      return <CheckboxCell rowId={rowId} column={column} value={value} />
    case 'date':
      return <DateCell rowId={rowId} column={column} value={value} />
    case 'number':
      return <NumberCell rowId={rowId} column={column} value={value} />
  }
})
