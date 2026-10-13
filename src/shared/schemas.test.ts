import { describe, expect, it } from 'vitest'
import { TabUpdateSchema } from './schemas'

describe('TabUpdateSchema view', () => {
  it('keeps unknown view keys, so newer settings survive', () => {
    const parsed = TabUpdateSchema.parse({ id: 2, view: { sort: null, search: 'x' } })
    expect(parsed.view).toEqual({ sort: null, search: 'x' })
  })

  it('accepts search and filters, and rejects malformed ones', () => {
    const view = { search: 'pacing', filters: { '3': '>2015' } }
    expect(TabUpdateSchema.parse({ id: 2, view }).view).toEqual(view)
    expect(() => TabUpdateSchema.parse({ id: 2, view: { filters: { '3': 2015 } } })).toThrow()
    expect(() => TabUpdateSchema.parse({ id: 2, view: { search: 'x'.repeat(2001) } })).toThrow()
  })

  it('rejects a malformed sort', () => {
    expect(() => TabUpdateSchema.parse({ id: 2, view: { sort: { columnId: 'a' } } })).toThrow()
  })
})
