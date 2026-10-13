import { describe, expect, it } from 'vitest'
import { validateCell } from './cells'
import { listColumns } from './columns'
import { randomValue, seedRows } from './dev-seed'
import { listRows } from './rows'
import { freshReview } from './test-utils'

describe('dev seed', () => {
  it('only generates values the column accepts', () => {
    const db = freshReview()
    // A fixed pseudo-random sequence, so the test checks the same values every run.
    let seed = 42
    const rng = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (const column of listColumns(db)) {
      for (let i = 0; i < 200; i++) {
        const value = randomValue(column, rng)
        expect(validateCell(column, value)).toEqual(value)
      }
    }
  })

  it('appends rows after the existing ones', () => {
    const db = freshReview()
    const [first] = listRows(db)
    seedRows(db, 50)
    const rows = listRows(db)
    expect(rows).toHaveLength(51)
    expect(rows[0].id).toBe(first.id)
  })
})
