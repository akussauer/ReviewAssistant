import type { Header } from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import type { Column, Row } from '../../../../shared/ipc'
import type { DropSide } from '../../lib/columns'

type Props = {
  header: Header<Row, unknown>
  column: Column
  sortDir: 'asc' | 'desc' | null
  onSort: () => void
  // Drag-to-reorder. `dragging` is the id of the column being dragged, if any.
  dragging: number | null
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: (side: DropSide) => void
}

// One column header: click the name to sort, drag the name to move the column, and drag
// the right-hand divider to resize it.
export function HeaderCell(props: Props): React.JSX.Element {
  const { header, column, sortDir, dragging } = props
  const [dropSide, setDropSide] = useState<DropSide | null>(null)
  const canDrop = dragging !== null && dragging !== column.id

  const sideOf = (e: React.DragEvent<HTMLDivElement>): DropSide => {
    const box = e.currentTarget.getBoundingClientRect()
    return e.clientX < box.left + box.width / 2 ? 'before' : 'after'
  }

  return (
    <div
      className="relative flex shrink-0 items-center border-r border-b bg-muted text-sm font-medium"
      style={{ width: header.getSize() }}
      onDragOver={(e) => {
        if (!canDrop) return
        e.preventDefault() // allows dropping here
        setDropSide(sideOf(e))
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={(e) => {
        if (!canDrop) return
        e.preventDefault()
        setDropSide(null)
        props.onDrop(sideOf(e))
      }}
    >
      {/* Drop indicator: a bar on the side where the column will land. */}
      {dropSide && (
        <div
          className={`absolute inset-y-0 w-0.5 bg-primary ${dropSide === 'before' ? 'left-0' : 'right-0'}`}
        />
      )}

      <div
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1 px-2 select-none"
        draggable
        title={`${column.label}: click to sort, drag to move`}
        onClick={props.onSort}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', column.label)
          props.onDragStart()
        }}
        onDragEnd={props.onDragEnd}
      >
        <span className="truncate">{column.label}</span>
        {sortDir === 'asc' && <ArrowUp className="size-3.5 shrink-0" />}
        {sortDir === 'desc' && <ArrowDown className="size-3.5 shrink-0" />}
      </div>

      {/* Resize handle on the right edge; TanStack Table tracks the drag. */}
      <div
        className={`absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize touch-none select-none ${
          header.column.getIsResizing() ? 'bg-primary/40' : 'hover:bg-primary/20'
        }`}
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        onDoubleClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
