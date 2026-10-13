import { describe, expect, it } from 'vitest'
import { TabUpdateSchema } from './schemas'

describe('TabUpdateSchema view', () => {
  it('keeps unknown view keys, so newer settings survive', () => {
    const parsed = TabUpdateSchema.parse({ id: 2, view: { sort: null, search: 'x' } })
    expect(parsed.view).toEqual({ sort: null, search: 'x' })
  })

  it('rejects a malformed sort', () => {
    expect(() => TabUpdateSchema.parse({ id: 2, view: { sort: { columnId: 'a' } } })).toThrow()
  })
})
