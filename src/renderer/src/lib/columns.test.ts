import { describe, expect, it } from 'vitest'
import { moveColumn } from './columns'

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
