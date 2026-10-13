import { memo, useState } from 'react'
import type { Column, Row } from '../../../../shared/ipc'
import { reviewStore } from '../../store'
import { Cell } from './Cell'
import { ContextMenu, ContextMenuTrigger } from '../ui/context-menu'
import { ROW_HEADER_WIDTH } from './layout'
import { RowMenu } from './RowMenu'

type Props = {
  row: Row
  columns: Column[]
  widths: number[] // current width of each column, live while resizing
  top: number
  live: boolean // false while the table scrolls
}

// One table row, absolutely positioned by the virtualiser (only visible rows exist).
export const TableRow = memo(function TableRow({ row, columns, widths, top, live }: Props) {
  return (
    <div
      className="absolute top-0 left-0 flex border-b"
      style={{ transform: `translateY(${top}px)`, height: row.height }}
    >
      <RowHeader row={row} />
      {columns.map((column, i) => (
        <div
          key={column.id}
          className="shrink-0 overflow-hidden border-r px-2 py-1 text-sm"
          style={{ width: widths[i] }}
        >
          <Cell rowId={row.id} column={column} value={row.data[String(column.id)]} live={live} />
        </div>
      ))}
    </div>
  )
})

// The narrow strip on the left: the row's checkbox, plus a handle along the bottom edge
// to drag the row taller or shorter (like the row header in the reference app).
function RowHeader({ row }: { row: Row }): React.JSX.Element {
  // The menu (spec §5) is only built while open.
  const [menuOpen, setMenuOpen] = useState(false)

  const startDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const handle = e.currentTarget
    const startY = e.clientY
    const startHeight = row.height
    const heightAt = (ev: PointerEvent): number => startHeight + ev.clientY - startY
    // Pointer capture sends every move/up event to the handle, even outside the window.
    handle.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void =>
      reviewStore.getState().previewRowHeight(row.id, heightAt(ev))
    // Also ends on lostpointercapture, e.g. if the row is scrolled away and unmounted
    // mid-drag, so the previewed height is always either saved or undone.
    let done = false
    const end = (ev: PointerEvent): void => {
      if (done) return
      done = true
      handle.removeEventListener('pointermove', move)
      void reviewStore.getState().setRowHeight(row.id, heightAt(ev))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end, { once: true })
    handle.addEventListener('pointercancel', end, { once: true })
    handle.addEventListener('lostpointercapture', end, { once: true })
  }

  return (
    <ContextMenu onOpenChange={setMenuOpen}>
      <ContextMenuTrigger asChild>
        <div
          title="Right-click for row options"
          className="sticky left-0 z-10 flex shrink-0 items-start justify-center border-r bg-muted pt-2"
          style={{ width: ROW_HEADER_WIDTH }}
        >
          <input
            type="checkbox"
            checked={row.checked}
            aria-label="Check row"
            onChange={(e) => void reviewStore.getState().setChecked([row.id], e.target.checked)}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1.5 cursor-row-resize"
            title="Drag to resize the row"
            onPointerDown={startDrag}
          />
        </div>
      </ContextMenuTrigger>
      {menuOpen && <RowMenu rowId={row.id} />}
    </ContextMenu>
  )
}
