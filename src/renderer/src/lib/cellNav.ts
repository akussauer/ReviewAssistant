// Moving between cells with the keyboard (spec §6). A position is a row and a column
// index; column -1 is the row's checkbox in the row header.
export type CellPos = { rowId: number; col: number }

export type Move = 'next' | 'prev' | 'up' | 'down'

// Where a move goes, in the rows as shown (sorted, filtered). Tab ('next') runs along the
// row (checkbox, then each cell) and on into the next row; Ctrl+↑/↓ keep the column.
// null = nowhere to go (the start or end of the table, or the row isn't shown).
export function moveCell(
  from: CellPos,
  move: Move,
  rowIds: number[],
  columnCount: number
): CellPos | null {
  const index = rowIds.indexOf(from.rowId)
  if (index === -1) return null
  const at = (i: number, col: number): CellPos | null =>
    i >= 0 && i < rowIds.length ? { rowId: rowIds[i], col } : null
  const last = columnCount - 1
  switch (move) {
    case 'next':
      return from.col < last ? at(index, from.col + 1) : at(index + 1, -1)
    case 'prev':
      return from.col > -1 ? at(index, from.col - 1) : at(index - 1, last)
    case 'up':
      return at(index - 1, from.col)
    case 'down':
      return at(index + 1, from.col)
  }
}
