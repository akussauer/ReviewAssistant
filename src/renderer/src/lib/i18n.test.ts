import { describe, expect, it } from 'vitest'
import { rowsChipLabel } from '../../../shared/assistant'
import { isRowsChipLabel } from './i18n'

describe('isRowsChipLabel', () => {
  it('knows the chip as main saves it', () => {
    expect(isRowsChipLabel(rowsChipLabel(1))).toBe(true)
    expect(isRowsChipLabel(rowsChipLabel(12))).toBe(true)
    expect(isRowsChipLabel('This tab (2,000 rows)')).toBe(true)
  })

  it("doesn't take a file's name for it", () => {
    expect(isRowsChipLabel('notes.pdf')).toBe(false)
    expect(isRowsChipLabel('This tab (12 rows).md')).toBe(false)
  })
})
