import { expect, it } from 'vitest'
import { clampNumber, parseNumberDraft } from './numbers'

it('clamps to the column range', () => {
  const year = { options: { min: 1950, max: 2030 } }
  expect(clampNumber(1900, year)).toBe(1950)
  expect(clampNumber(2100, year)).toBe(2030)
  expect(clampNumber(2016, year)).toBe(2016)
  expect(clampNumber(-5, { options: {} })).toBe(-5)
})

it('turns typed text into the value to save', () => {
  const year = { options: { min: 1950, max: 2030 } }
  expect(parseNumberDraft('', year)).toBeNull()
  expect(parseNumberDraft(' 1800 ', year)).toBe(1950)
  expect(parseNumberDraft('2016', year)).toBe(2016)
  expect(parseNumberDraft('20x6', year)).toBeUndefined()
})
