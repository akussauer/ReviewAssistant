// Where a dragged column lands: before or after the column it was dropped on.
export type DropSide = 'before' | 'after'

// Returns the column ids with `dragged` moved next to `target`.
export function moveColumn(
  ids: number[],
  dragged: number,
  target: number,
  side: DropSide
): number[] {
  if (dragged === target) return ids
  const rest = ids.filter((id) => id !== dragged)
  const at = rest.indexOf(target)
  if (at === -1 || rest.length === ids.length) return ids
  rest.splice(side === 'before' ? at : at + 1, 0, dragged)
  return rest
}
