import { memo } from 'react'
import type { CellValue, Column } from '../../../../shared/ipc'
import { displayValue } from '../../lib/sort'
import { reviewStore } from '../../store'
import { EditableCell } from './EditableCell'

type Props = { rowId: number; column: Column; value: CellValue | undefined }

// One cell. Display only for dropdowns and checkboxes until M4 adds their editors.
// memo: a cell re-renders only when its own value or column changes.
export const Cell = memo(function Cell({ rowId, column, value }: Props): React.JSX.Element {
  switch (column.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="pointer-events-none mt-1"
          checked={value === true}
          readOnly
          tabIndex={-1}
          aria-label={column.label}
        />
      )
    case 'dropdown':
      return <div className="truncate">{displayValue(column, value)}</div>
    default:
      return (
        <EditableCell
          value={value}
          type={column.type}
          onCommit={(v) => reviewStore.getState().updateCell(rowId, column.id, v)}
        />
      )
  }
})
