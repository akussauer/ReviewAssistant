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

// Returns a copy of `items` with the item at `from` moved to position `to`.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items
  const copy = [...items]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}
