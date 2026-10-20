import { describe, expect, it } from 'vitest'
import type { Column, ColumnExport, MarkdownSettings, Row, Tab } from './ipc'
import {
  buildNote,
  buildNotes,
  cleanPropertyName,
  hasMarker,
  parseTags,
  planNotes,
  propertyValue,
  safeFileName,
  slugify,
  toTag,
  uniqueFileNames
} from './markdownExport'

const col = (id: number, label: string, type: Column['type'], extra = {}): Column => ({
  id,
  label,
  type,
  options: {},
  width: 150,
  position: id,
  ...extra
})

// The default template's columns.
const columns: Column[] = [
  col(1, 'Title', 'text'),
  col(2, 'Study Type', 'dropdown', {
    options: {
      choices: [
        { id: 'o_rct', label: 'RCT' },
        { id: 'o_coh', label: 'Cohort' }
      ]
    }
  }),
  col(3, 'Author(s)', 'text'),
  col(4, 'Year', 'number'),
  col(5, 'Date Added', 'date'),
  col(6, 'Read', 'checkbox'),
  col(7, 'Notes', 'text')
]

const row = (id: number, data: Row['data'], checked = false): Row => ({
  id,
  data,
  position: id,
  height: 30,
  checked
})

const tab = (id: number, label: string, rowIds: number[]): Tab => ({
  id,
  label,
  type: id === 1 ? 'main' : 'review',
  position: id,
  assistantEnabled: false,
  assistantWidth: null,
  assistantModel: null,
  view: {},
  rowIds
})

const tabs = [tab(1, 'All', []), tab(2, 'Elite athletes', [10]), tab(3, '#Pacing', [10, 11])]

const settings = (change: Partial<MarkdownSettings> = {}): MarkdownSettings => ({
  scope: 'all',
  fileNameColumnId: null,
  ifExists: 'overwrite-ours',
  tagsFromTabs: true,
  extraTags: '',
  source: true,
  header: '',
  ...change
})

const full = row(10, {
  '1': 'Pacing in "age-group" swimmers',
  '2': 'o_coh',
  '3': 'Smith, J.\nJones, K.',
  '4': 2016,
  '5': '2024-03-01',
  '6': true,
  '7': '- first point\r\n- **second**\n\n## Sub heading'
})
const empty = row(11, { '1': '', '2': null, '3': '', '4': null, '5': null, '6': false, '7': '' })

const plan = (
  change: Partial<MarkdownSettings> = {},
  exports: Record<number, ColumnExport> = {}
): ReturnType<typeof planNotes> =>
  planNotes(
    columns,
    new Map(Object.entries(exports).map(([k, v]) => [Number(k), v])),
    settings(change),
    tabs,
    'Swimming.review'
  )

describe('buildNote', () => {
  it('writes the defaults: text as sections, the rest as typed properties', () => {
    expect(buildNote(plan(), full)).toMatchInlineSnapshot(`
      "---
      title: "Pacing in \\"age-group\\" swimmers"
      study-type: "Cohort"
      year: 2016
      date-added: 2024-03-01
      read: true
      tags:
        - "Elite-athletes"
        - "Pacing"
      source: "Swimming.review"
      review-assistant: "Swimming.review#10"
      ---
      ## Title
      Pacing in "age-group" swimmers

      ## Author(s)
      Smith, J.
      Jones, K.

      ## Notes
      - first point
      - **second**

      ## Sub heading
      "
    `)
  })

  it('keeps empty properties, drops empty sections, and writes an empty tag list', () => {
    expect(buildNote(plan({ tagsFromTabs: false, extraTags: ' #to-read, ,review/2026 ' }), empty))
      .toMatchInlineSnapshot(`
        "---
        title:
        study-type:
        year:
        date-added:
        read: false
        tags:
          - "to-read"
          - "review/2026"
        source: "Swimming.review"
        review-assistant: "Swimming.review#11"
        ---
        "
      `)
  })

  it('uses typed property names, a header, and no title when the name column is a property', () => {
    const p = plan(
      { header: '#review\r\nSee [[Swimming MOC]]\n', source: false, tagsFromTabs: false },
      {
        1: { mode: 'property', property: 'Title' },
        3: { mode: 'property', property: 'authors' },
        7: { mode: 'skip' }
      }
    )
    expect(buildNote(p, full)).toMatchInlineSnapshot(`
      "---
      Title: "Pacing in \\"age-group\\" swimmers"
      study-type: "Cohort"
      authors: "Smith, J. Jones, K."
      year: 2016
      date-added: 2024-03-01
      read: true
      review-assistant: "Swimming.review#10"
      ---
      #review
      See [[Swimming MOC]]
      "
    `)
  })

  it('renames properties that clash with the app keys or each other', () => {
    const p = plan(
      {},
      {
        3: { mode: 'property', property: 'tags' },
        4: { mode: 'property', property: 'Source' },
        5: { mode: 'property', property: 'year' }
      }
    )
    expect([...p.properties.values()]).toEqual(['study-type', 'tags-2', 'Source-2', 'year', 'read'])
  })

  it('writes a section for every type that is set to Section', () => {
    const p = plan(
      { tagsFromTabs: false, source: false },
      {
        1: { mode: 'skip' },
        2: { mode: 'section' },
        4: { mode: 'section' },
        6: { mode: 'section' }
      }
    )
    expect(buildNote(p, full)).toMatchInlineSnapshot(`
      "---
      date-added: 2024-03-01
      review-assistant: "Swimming.review#10"
      ---
      ## Study Type
      Cohort

      ## Author(s)
      Smith, J.
      Jones, K.

      ## Year
      2016

      ## Read
      Yes

      ## Notes
      - first point
      - **second**

      ## Sub heading
      "
    `)
  })
})

describe('names', () => {
  it('slugifies column labels', () => {
    expect(slugify('Study Type')).toBe('study-type')
    expect(slugify('Author(s)')).toBe('authors')
    expect(slugify('Date_added / Read')).toBe('date-added-read')
    expect(slugify('Ærø Ström')).toBe('ærø-ström')
    expect(slugify('???')).toBe('property')
  })

  it('turns tab names and typed tags into Obsidian tags', () => {
    expect(toTag('Elite athletes')).toBe('Elite-athletes')
    expect(toTag('#Pacing')).toBe('Pacing')
    expect(toTag('a.b, c!')).toBe('ab-c')
    expect(toTag('  ')).toBeNull()
    expect(parseTags('#to-read, review/2026,, x y')).toEqual(['to-read', 'review/2026', 'x-y'])
  })

  it('makes file names safe', () => {
    expect(safeFileName('Pacing: a "review"? <2016> / part 1|2')).toBe(
      'Pacing a review 2016 part 12'
    )
    expect(safeFileName('[[Link]] #tag ^block')).toBe('Link tag block')
    expect(safeFileName('Line one\nline two')).toBe('Line one line two')
    expect(safeFileName('  .hidden. . ')).toBe('hidden')
    expect(safeFileName('')).toBe('Untitled')
    expect(safeFileName('???')).toBe('Untitled')
    expect(safeFileName('con')).toBe('con_')
    expect(safeFileName('x'.repeat(150))).toHaveLength(100)
    expect(safeFileName(`${'a'.repeat(99)}😀b`)).toBe(`${'a'.repeat(99)}😀`)
  })

  it('numbers repeated file names, ignoring case', () => {
    expect(uniqueFileNames(['A', 'a', 'B', 'A', 'A (2)'])).toEqual([
      'A',
      'a (2)',
      'B',
      'A (3)',
      'A (2) (2)'
    ])
  })

  it('names notes after the chosen column, or the first text column', () => {
    const rows = [full, empty, row(12, { '1': 'Untitled' })]
    const notes = buildNotes(plan(), rows, new Set([10, 11, 12]))
    expect(notes.map((n) => n.fileName)).toEqual([
      'Pacing in age-group swimmers.md',
      'Untitled.md',
      'Untitled (2).md'
    ])
    // Numbered over every row, so row 12 keeps " (2)" when exported alone.
    expect(buildNotes(plan(), rows, new Set([12])).map((n) => n.fileName)).toEqual([
      'Untitled (2).md'
    ])
    const byYear = buildNotes(plan({ fileNameColumnId: 4 }), [full], new Set([10]))
    expect(byYear[0].fileName).toBe('2016.md')
    // A deleted column falls back to the first text column.
    expect(buildNotes(plan({ fileNameColumnId: 99 }), [full], new Set([10]))[0].fileName).toBe(
      'Pacing in age-group swimmers.md'
    )
  })

  it('guards Windows device names, also before a dot', () => {
    expect(safeFileName('Con. A study')).toBe('Con_. A study')
    expect(safeFileName('LPT1.notes')).toBe('LPT1_.notes')
    expect(safeFileName('CONOUT$')).toBe('CONOUT$_')
    expect(safeFileName('Console')).toBe('Console')
  })

  it('cleans typed property names that would break the YAML', () => {
    expect(cleanPropertyName('- note')).toBe('note')
    expect(cleanPropertyName('.hidden: key #1')).toBe('hidden key 1')
    expect(cleanPropertyName('Author list')).toBe('Author list')
    const p = plan({}, { 3: { mode: 'property', property: ' -- ' } })
    expect(p.properties.get(3)).toBe('authors')
  })
})

describe('values', () => {
  const date = col(5, 'Date Added', 'date')
  const text = col(1, 'Title', 'text')

  it('writes only real dates unquoted', () => {
    expect(propertyValue(date, '2024-02-29')).toBe(' 2024-02-29')
    expect(propertyValue(date, '2023-02-29')).toBe(' "2023-02-29"')
    expect(propertyValue(date, '2024-13-45')).toBe(' "2024-13-45"')
    expect(propertyValue(date, null)).toBe('')
  })

  it('writes numbers, including negative ones, unquoted', () => {
    expect(propertyValue(col(4, 'Year', 'number'), -12)).toBe(' -12')
    expect(propertyValue(col(4, 'Year', 'number'), 0)).toBe(' 0')
  })

  it('keeps text on one line, whatever the line breaks', () => {
    const value = `a\rb\r\nc${String.fromCharCode(0x2028)}d`
    expect(propertyValue(text, value)).toBe(' "a b c d"')
    expect(propertyValue(text, 'say "hi" \\ #1: ok')).toBe(' "say \\"hi\\" \\\\ #1: ok"')
  })

  it('drops tags YAML or Obsidian would misread, and quotes the rest', () => {
    expect(toTag('2026')).toBeNull()
    expect(toTag(' - ')).toBeNull()
    expect(toTag('/nested/')).toBe('nested')
    const p = planNotes(
      columns,
      new Map(),
      settings({ source: false }),
      [tab(1, 'All', []), tab(2, '2026', [10]), tab(3, 'true', [10])],
      'S.review'
    )
    expect(buildNote(p, full)).toContain('tags:\n  - "true"\n')
  })
})

describe('hasMarker', () => {
  it('finds the marker only in the frontmatter', () => {
    expect(hasMarker(buildNote(plan(), full))).toBe(true)
    expect(hasMarker('---\r\ntitle: x\r\nreview-assistant: "a#1"\r\n---\r\nbody')).toBe(true)
    expect(hasMarker('---\ntitle: x\n---\nreview-assistant: in the body')).toBe(false)
    expect(hasMarker('# A note I wrote myself\n')).toBe(false)
    expect(hasMarker('---\nreview-assistants: x\n---\n')).toBe(false)
    // A byte order mark and trailing spaces on the "---" lines.
    expect(hasMarker(`${String.fromCharCode(0xfeff)}---  \nreview-assistant: x\n--- \n`)).toBe(true)
  })
})

describe('list and checklist columns (M10e)', () => {
  const list = col(20, 'Steps', 'list', { options: { style: 'numbered' } })
  const design = col(21, 'Design', 'checklist', {
    options: {
      choices: [
        { id: 'o_r', label: 'Randomised' },
        { id: 'o_b', label: 'Blinded' }
      ]
    }
  })
  const steps = '1. warm up\n    1. "easy"\n2. race\n\n1. cool down'

  it('default to Section (list) and Property (checklist)', () => {
    const p = planNotes([list, design], new Map(), settings(), [], 'S.review')
    expect(p.exports.get(20)?.mode).toBe('section')
    expect(p.exports.get(21)?.mode).toBe('property')
  })

  it('write a block YAML list as a Property: list flattened, checklist ticked labels', () => {
    expect(propertyValue(list, steps)).toBe(
      '\n  - "warm up"\n  - "\\"easy\\""\n  - "race"\n  - "cool down"'
    )
    expect(propertyValue(design, ['o_b'])).toBe('\n  - "Blinded"')
    expect(propertyValue(list, '')).toBe('')
    expect(propertyValue(design, [])).toBe('')
  })

  it('write the list as-is, and the checklist as a task list, as a Section', () => {
    const p = planNotes(
      [list, design],
      new Map([[21, { mode: 'section' as const }]]),
      settings({ tagsFromTabs: false, extraTags: '', source: false }),
      [],
      'S.review'
    )
    const note = buildNote(p, row(1, { '20': steps, '21': ['o_r'] }))
    expect(note).toContain(`## Steps\n${steps}\n`)
    expect(note).toContain('## Design\n- [x] Randomised\n- [ ] Blinded\n')
  })
})
