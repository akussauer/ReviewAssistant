import { describe, expect, it } from 'vitest'
import type { Column } from '../../../shared/ipc'
import { choicesForRetype, moveColumn, moveItem } from './columns'

describe('moveColumn', () => {
  it('moves a column before or after the drop target', () => {
    expect(moveColumn([1, 2, 3, 4], 4, 2, 'before')).toEqual([1, 4, 2, 3])
    expect(moveColumn([1, 2, 3, 4], 1, 3, 'after')).toEqual([2, 3, 1, 4])
    expect(moveColumn([1, 2, 3, 4], 2, 4, 'after')).toEqual([1, 3, 4, 2])
  })

  it('leaves the order alone for no-op or unknown drops', () => {
    expect(moveColumn([1, 2, 3], 2, 2, 'before')).toEqual([1, 2, 3])
    expect(moveColumn([1, 2, 3], 9, 2, 'before')).toEqual([1, 2, 3])
    expect(moveColumn([1, 2, 3], 1, 9, 'before')).toEqual([1, 2, 3])
  })
})

describe('moveItem', () => {
  it('moves an item to a new position', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})

describe('choicesForRetype', () => {
  const column = (type: Column['type'], labels: string[] = []): Column => ({
    id: 1,
    label: 'C',
    type,
    options: { choices: labels.map((label, i) => ({ id: `o${i}`, label })) },
    width: 150,
    position: 0
  })
  const labels = (c: ReturnType<typeof choicesForRetype>): string[] | null =>
    c && c.map((x) => x.label)

  it('offers a checklist’s items when it becomes a dropdown, and the other way round', () => {
    const checklist = column('checklist', ['Randomised', 'Blinded'])
    expect(labels(choicesForRetype(checklist, 'dropdown', [['o0', 'o1']]))).toEqual([
      'Randomised',
      'Blinded'
    ])
    expect(labels(choicesForRetype(column('dropdown', ['A', 'B']), 'checklist', ['o0']))).toEqual([
      'A',
      'B'
    ])
  })

  it('offers distinct values for a dropdown and distinct lines for a checklist', () => {
    const text = column('text')
    expect(labels(choicesForRetype(text, 'dropdown', ['a\nb', 'a\nb', 'c']))).toEqual(['a\nb', 'c'])
    expect(labels(choicesForRetype(text, 'checklist', ['a\nb', 'b\nc']))).toEqual(['a', 'b', 'c'])
  })

  it('keeps the column’s own options when changed back, and leaves others alone', () => {
    const own = column('checklist', ['X'])
    expect(choicesForRetype(own, 'checklist', [])).toEqual(own.options.choices)
    expect(choicesForRetype(own, 'list', [])).toBeNull()
  })
})
