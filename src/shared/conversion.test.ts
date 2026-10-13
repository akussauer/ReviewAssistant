import { describe, expect, it } from 'vitest'
import type { CellValue, ColumnOptions, ColumnType } from './ipc'
import {
  convertValue,
  displayText,
  distinctLabels,
  parseDate,
  parseInteger,
  previewConversion
} from './conversion'

const col = (
  type: ColumnType,
  options: ColumnOptions = {}
): { type: ColumnType; options: ColumnOptions } => ({
  type,
  options
})
const study = col('dropdown', {
  choices: [
    { id: 'o_rct', label: 'RCT' },
    { id: 'o_coh', label: 'Cohort' }
  ]
})
const conv = (
  from: ReturnType<typeof col>,
  to: ReturnType<typeof col>,
  v: CellValue
): [CellValue, string] => {
  const r = convertValue(from, to, v)
  return [r.value, r.outcome]
}

describe('parsing', () => {
  it('parses whole numbers', () => {
    expect(parseInteger(' 2016 ')).toBe(2016)
    expect(parseInteger('2016.0')).toBe(2016)
    expect(parseInteger('-3')).toBe(-3)
    expect(parseInteger('2016.5')).toBeNull()
    expect(parseInteger('about 2016')).toBeNull()
  })

  it('parses ISO-like dates and rejects impossible ones', () => {
    expect(parseDate('2021-5-3')).toBe('2021-05-03')
    expect(parseDate('2021/05/03')).toBe('2021-05-03')
    expect(parseDate('2021-02-30')).toBeNull()
    expect(parseDate('03/05/2021')).toBeNull() // ambiguous day/month order: not guessed
  })
})

describe('displayText', () => {
  it('shows labels, TRUE/FALSE and empty', () => {
    expect(displayText(study, 'o_coh')).toBe('Cohort')
    expect(displayText(col('checkbox'), true)).toBe('TRUE')
    expect(displayText(col('number'), 7)).toBe('7')
    expect(displayText(col('text'), null)).toBe('')
  })
})

describe('convertValue', () => {
  it('anything -> text uses the displayed text', () => {
    expect(conv(study, col('text'), 'o_rct')).toEqual(['RCT', 'converted'])
    expect(conv(col('checkbox'), col('text'), false)).toEqual(['FALSE', 'converted'])
    expect(conv(col('date'), col('text'), '2020-01-02')).toEqual(['2020-01-02', 'converted'])
  })

  it('text -> number parses, or clears when unparseable or out of range', () => {
    const year = col('number', { min: 1950, max: 2030 })
    expect(conv(col('text'), year, '2016')).toEqual([2016, 'converted'])
    expect(conv(col('text'), year, 'n/a')).toEqual([null, 'cleared'])
    expect(conv(col('text'), year, '1900')).toEqual([null, 'cleared'])
    expect(conv(col('text'), year, '')).toEqual([null, 'empty'])
  })

  it('text -> date parses, or clears', () => {
    expect(conv(col('text'), col('date'), '2021-5-3')).toEqual(['2021-05-03', 'converted'])
    expect(conv(col('text'), col('date'), 'last week')).toEqual([null, 'cleared'])
  })

  it('checkbox <-> number is 1/0', () => {
    expect(conv(col('checkbox'), col('number', { min: 0, max: 1 }), true)).toEqual([1, 'converted'])
    expect(conv(col('checkbox'), col('number', { min: 0, max: 1 }), false)).toEqual([
      0,
      'converted'
    ])
    expect(conv(col('number'), col('checkbox'), 5)).toEqual([true, 'converted'])
    expect(conv(col('number'), col('checkbox'), 0)).toEqual([false, 'converted'])
  })

  it('text -> checkbox understands yes/no words, otherwise unchecks', () => {
    expect(conv(col('text'), col('checkbox'), 'Yes')).toEqual([true, 'converted'])
    expect(conv(col('text'), col('checkbox'), 'x')).toEqual([true, 'converted'])
    expect(conv(col('text'), col('checkbox'), 'no')).toEqual([false, 'converted'])
    expect(conv(col('text'), col('checkbox'), 'maybe')).toEqual([false, 'cleared'])
    expect(conv(col('text'), col('checkbox'), '')).toEqual([false, 'empty'])
  })

  it('number <-> date clears', () => {
    expect(conv(col('number'), col('date'), 2020)).toEqual([null, 'cleared'])
    expect(conv(col('date'), col('number'), '2020-01-01')).toEqual([null, 'cleared'])
  })

  it('-> dropdown matches option labels', () => {
    const to = col('dropdown', {
      choices: [
        { id: 'a', label: 'Cohort' },
        { id: 'b', label: '2016' }
      ]
    })
    expect(conv(col('text'), to, ' Cohort ')).toEqual(['a', 'converted'])
    expect(conv(col('number'), to, 2016)).toEqual(['b', 'converted'])
    expect(conv(col('text'), to, 'RCT')).toEqual([null, 'cleared'])
  })
})

describe('preview and dropdown options', () => {
  it('counts outcomes', () => {
    expect(previewConversion(col('text'), col('number'), ['1', '2', 'x', '', null])).toEqual({
      converted: 2,
      cleared: 1,
      empty: 2
    })
  })

  it('offers distinct values as options, in row order', () => {
    expect(distinctLabels(col('text'), ['RCT', 'Cohort', ' RCT', '', null, 'Other'])).toEqual([
      'RCT',
      'Cohort',
      'Other'
    ])
    expect(distinctLabels(col('number'), [3, 1, 3])).toEqual(['3', '1'])
  })
})
