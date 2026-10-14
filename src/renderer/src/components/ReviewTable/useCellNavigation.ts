import type { Virtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useRef } from 'react'
import { moveCell, type CellPos, type Move } from '../../lib/cellNav'

// Keyboard movement between cells (spec §6):
// - Tab / Shift+Tab go along the row (checkbox, then each cell) and on into the next row,
//   in the order shown. Inside a text cell, Tab indents instead (CodeMirror handles it
//   first); Esc leaves the cell, and the next Tab moves on from it.
// - Ctrl+↑ / Ctrl+↓ go to the same column in the row above / below, from any cell.
// - Esc leaves any cell.
// A row that isn't rendered (virtualised away) is scrolled to first.

const dialogOpen = (): boolean =>
  document.querySelector('[role=dialog], [role=alertdialog]') !== null

const FOCUSABLE =
  'input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

export type RevealCell = (to: CellPos, how: { focus?: boolean; flash?: boolean }) => void

export function useCellNavigation(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  rowIds: number[],
  columnCount: number,
  virtualizer: Virtualizer<HTMLDivElement, Element>
): RevealCell {
  // Read from the key handlers, which are set up once.
  const latest = useRef({ rowIds, columnCount, virtualizer })
  useEffect(() => {
    latest.current = { rowIds, columnCount, virtualizer }
  })

  // The cell Esc left (or the last one clicked or focused), for the next Tab. A click
  // anywhere else forgets it.
  const lastCell = useRef<CellPos | null>(null)

  // The cell (or row-header strip) that `node` is in, if it's in this table.
  const cellOf = useCallback(
    (node: EventTarget | null): CellPos | null => {
      if (!(node instanceof Element) || !scrollRef.current?.contains(node)) return null
      const cell = node.closest<HTMLElement>('[data-col]')
      const row = cell?.closest<HTMLElement>('[data-row-id]')
      if (!cell || !row) return null
      return { rowId: Number(row.dataset.rowId), col: Number(cell.dataset.col) }
    },
    [scrollRef]
  )

  const reveal = useCallback<RevealCell>(
    (to, { focus = false, flash = false }) => {
      const find = (): HTMLElement | null =>
        scrollRef.current?.querySelector<HTMLElement>(
          `[data-row-id="${to.rowId}"] [data-col="${to.col}"]`
        ) ?? null
      const finish = (el: HTMLElement): void => {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        if (focus) el.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
        if (flash) {
          // Restart the animation if it's still running from a previous undo.
          el.classList.remove('cell-flash')
          void el.offsetWidth
          el.classList.add('cell-flash')
          el.addEventListener('animationend', () => el.classList.remove('cell-flash'), {
            once: true
          })
        }
      }
      const el = find()
      if (el) return finish(el)
      const index = latest.current.rowIds.indexOf(to.rowId)
      if (index === -1) return
      latest.current.virtualizer.scrollToIndex(index, { align: 'auto' })
      // The row is drawn once the virtualiser has caught up with the scroll.
      let frames = 0
      const wait = (): void => {
        const found = find()
        if (found) finish(found)
        else if (++frames < 30) requestAnimationFrame(wait)
      }
      requestAnimationFrame(wait)
    },
    [scrollRef]
  )

  useEffect(() => {
    const go = (e: KeyboardEvent, move: Move): void => {
      // From the focused cell, or, with nothing focused (after Esc), the cell left last.
      const active = document.activeElement
      const from =
        cellOf(active) ?? (active === document.body || active === null ? lastCell.current : null)
      if (!from) return
      const { rowIds, columnCount } = latest.current
      if (!rowIds.includes(from.rowId)) return
      e.preventDefault()
      e.stopPropagation()
      const to = moveCell(from, move, rowIds, columnCount)
      if (to) reveal(to, { focus: true }) // else: the start or end of the table, stay put
    }

    // Capture phase: runs before CodeMirror and the number box see the arrow keys.
    const onKeyCapture = (e: KeyboardEvent): void => {
      if (dialogOpen() || !e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      if (e.key === 'ArrowUp') go(e, 'up')
      else if (e.key === 'ArrowDown') go(e, 'down')
    }

    // Bubble phase: a text cell has had the chance to use Tab (indent) or Esc already.
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || dialogOpen()) return
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        go(e, e.shiftKey ? 'prev' : 'next')
      } else if (e.key === 'Escape') {
        const active = document.activeElement
        if (active instanceof HTMLElement && cellOf(active)) active.blur()
      }
    }

    const onFocusIn = (e: FocusEvent): void => {
      const cell = cellOf(e.target)
      if (cell) lastCell.current = cell
    }
    const onPointerDown = (e: PointerEvent): void => {
      lastCell.current = cellOf(e.target)
    }

    window.addEventListener('keydown', onKeyCapture, true)
    window.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyCapture, true)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [cellOf, reveal])

  return reveal
}
