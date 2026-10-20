import { describe, expect, it } from 'vitest'
import { displayText, convertValue, distinctLines, previewConversion } from './conversion'
import type { Column } from './ipc'
import { itemNumbers, listItems, normaliseList, parseListLine, tickedLabels } from './lists'

describe('parseListLine', () => {
  it('splits indent, marker and text', () => {
    expect(parseListLine('  - item')).toMatchObject({ indent: '  ', marker: '-', text: 'item' })
    expect(parseListLine('12. item')).toMatchObject({ marker: '12.', text: 'item', textStart: 4 })
    expect(parseListLine('3) item').marker).toBe('3)')
    expect(parseListLine('-').marker).toBe('-')
  })

  it('reads "-5 mg", "1.5 mg", "2015 study" and "2020. Smith" as text, not markers', () => {
    for (const line of ['-5 mg', '1.5 mg', '2015 study', '2020. Smith et al.'])
      expect(parseListLine(line)).toMatchObject({ marker: null, text: line })
  })
})

describe('itemNumbers', () => {
  it('restarts after a blank line and counts each level on its own', () => {
    const lines = ['1. a', '1. b', '    1. b1', '    1. b2', '1. c', '', '1. d', '1. e']
    expect(itemNumbers(lines)).toEqual([1, 2, 1, 2, 3, 0, 1, 2])
  })
})

describe('normaliseList', () => {
  it('gives every non-blank line the style’s marker', () => {
    expect(normaliseList('a\n- b\n* c\n3. d', 'bullets')).toBe('- a\n- b\n- c\n- d')
    expect(normaliseList('a\n- b\n7. c', 'numbered')).toBe('1. a\n2. b\n3. c')
  })

  it('starts numbering again after a blank line (several lists in one cell)', () => {
    expect(normaliseList('1. a\n2. b\n3. c\n\n\n9. d\n9. e', 'numbered')).toBe(
      '1. a\n2. b\n3. c\n\n1. d\n2. e'
    )
  })

  it('numbers nested items per level', () => {
    expect(normaliseList('1. a\n    1. a1\n    5. a2\n2. b', 'numbered')).toBe(
      '1. a\n    1. a1\n    2. a2\n2. b'
    )
  })

  it('drops empty items and blank lines at the ends, and trims trailing spaces', () => {
    expect(normaliseList('\n- \n- a  \n-\n\n', 'bullets')).toBe('- a')
    expect(normaliseList('', 'numbered')).toBe('')
  })

  it('is stable: normalising twice changes nothing', () => {
    const once = normaliseList('x\n  y\n\nz', 'numbered')
    expect(normaliseList(once, 'numbered')).toBe(once)
  })
})

describe('listItems', () => {
  it('returns the items’ text without indents, markers or blank lines', () => {
    expect(listItems('1. a\n    1. b\n\n- c')).toEqual(['a', 'b', 'c'])
  })
})

const checklist: Column = {
  id: 9,
  label: 'Design',
  type: 'checklist',
  options: {
    choices: [
      { id: 'o_r', label: 'Randomised' },
      { id: 'o_b', label: 'Blinded' },
      { id: 'o_c', label: 'Allocation concealed' }
    ]
  },
  width: 150,
  position: 0
}
const text = { type: 'text' as const, options: {} }
const bullets = { type: 'list' as const, options: { style: 'bullets' as const } }

describe('checklist text form', () => {
  it('is the ticked labels in item order, joined with "; "', () => {
    expect(tickedLabels(checklist.options, ['o_c', 'o_r'])).toEqual([
      'Randomised',
      'Allocation concealed'
    ])
    expect(displayText(checklist, ['o_b', 'o_r'])).toBe('Randomised; Blinded')
    expect(displayText(checklist, [])).toBe('')
  })
})

describe('conversions to and from lists and checklists (spec §4.2)', () => {
  it('text → list: one item per non-blank line; list → text: unchanged', () => {
    expect(convertValue(text, bullets, 'a\n\nb')).toEqual({
      value: '- a\n\n- b',
      outcome: 'converted'
    })
    expect(convertValue(bullets, text, '- a\n- b')).toEqual({
      value: '- a\n- b',
      outcome: 'converted'
    })
  })

  it('checklist → text or list: the ticked labels, one per line', () => {
    expect(convertValue(checklist, text, ['o_r', 'o_b']).value).toBe('Randomised\nBlinded')
    expect(convertValue(checklist, bullets, ['o_r', 'o_b']).value).toBe('- Randomised\n- Blinded')
  })

  it('text and list → checklist: each line ticks the item with that label', () => {
    expect(convertValue(text, checklist, 'Blinded\nRandomised').value).toEqual(['o_r', 'o_b'])
    expect(convertValue(bullets, checklist, '- Blinded').value).toEqual(['o_b'])
    expect(convertValue(text, checklist, 'Unknown').outcome).toBe('cleared')
    expect(convertValue(text, checklist, '')).toEqual({ value: [], outcome: 'empty' })
  })

  it('dropdown → checklist ticks the value; checklist → dropdown keeps the first ticked', () => {
    const dropdown = {
      type: 'dropdown' as const,
      options: { choices: [{ id: 'd_b', label: 'Blinded' }] }
    }
    expect(convertValue(dropdown, checklist, 'd_b').value).toEqual(['o_b'])
    const to = {
      type: 'dropdown' as const,
      options: { choices: [{ id: 'd_r', label: 'Randomised' }] }
    }
    expect(convertValue(checklist, to, ['o_r'])).toEqual({ value: 'd_r', outcome: 'converted' })
    // A row with more ticked loses the others, so the preview counts it as cleared.
    expect(convertValue(checklist, to, ['o_r', 'o_b'])).toEqual({
      value: 'd_r',
      outcome: 'cleared'
    })
    expect(previewConversion(checklist, to, [['o_r'], ['o_r', 'o_b'], []])).toEqual({
      converted: 1,
      cleared: 1,
      empty: 1
    })
  })

  it('offers the distinct lines as checklist items, in row order', () => {
    expect(distinctLines(text, ['b\na', 'a\n\nc', null])).toEqual(['b', 'a', 'c'])
    expect(distinctLines(bullets, ['- x\n    - y'])).toEqual(['x', 'y'])
  })
})
