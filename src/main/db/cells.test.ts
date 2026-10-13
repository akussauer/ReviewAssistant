import { describe, expect, it } from 'vitest'
import type { Column } from '../../shared/ipc'
import { defaultValue, isValidDate, todayLocal, validateCell } from './cells'

const col = (type: Column['type'], options: Column['options'] = {}): Column => ({
  id: 1,
  label: 'C',
  type,
  options,
  width: 150,
  position: 0
})
const dropdown = col('dropdown', {
  choices: [
    { id: 'o_a', label: 'A' },
    { id: 'o_b', label: 'B' }
  ]
})

describe('defaultValue (spec §4.1)', () => {
  it('gives each type its new-row default', () => {
    expect(defaultValue(col('text'))).toBe('')
    expect(defaultValue(col('checkbox'))).toBe(false)
    expect(defaultValue(col('number', { min: 1950, max: 2030 }))).toBe(1950)
    expect(defaultValue(dropdown)).toBe('o_a')
    expect(defaultValue(col('date'), '2026-10-13')).toBe('2026-10-13')
  })

  it('uses the local date for today', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('isValidDate', () => {
  it('accepts real dates only', () => {
    expect(isValidDate('2024-02-29')).toBe(true)
    expect(isValidDate('2023-02-29')).toBe(false)
    expect(isValidDate('2023-2-1')).toBe(false)
    expect(isValidDate('yesterday')).toBe(false)
  })
})

describe('validateCell', () => {
  it('accepts valid values', () => {
    expect(validateCell(col('text'), 'hi')).toBe('hi')
    expect(validateCell(col('checkbox'), true)).toBe(true)
    expect(validateCell(col('number', { min: 0, max: 10 }), 10)).toBe(10)
    expect(validateCell(col('number', { min: 0, max: 10 }), null)).toBeNull()
    expect(validateCell(col('date'), '2020-01-31')).toBe('2020-01-31')
    expect(validateCell(dropdown, 'o_b')).toBe('o_b')
    expect(validateCell(dropdown, null)).toBeNull()
  })

  it('rejects values of the wrong type or out of range', () => {
    expect(() => validateCell(col('text'), 5)).toThrow(/expected text/)
    expect(() => validateCell(col('text'), null)).toThrow()
    expect(() => validateCell(col('checkbox'), 'yes')).toThrow()
    expect(() => validateCell(col('number', { min: 0, max: 10 }), 11)).toThrow(/between 0 and 10/)
    expect(() => validateCell(col('number', { min: 0, max: 10 }), 1.5)).toThrow(/whole number/)
    expect(() => validateCell(col('date'), '2020-13-01')).toThrow()
    expect(() => validateCell(dropdown, 'B')).toThrow(/unknown option/) // label, not id
  })
})
