import { describe, expect, it } from 'vitest'
import reference from './__fixtures__/md-reference.json'
import { highlightLine } from './markdown'

// md-reference.json was produced by running the reference app's own regexes (read out of
// md_highlighter.py) over these lines in Python, recording each character's
// [bold, italic] format or null. The port must give the same result for every character.
// Entries with a `note` were changed or added by hand (M6a): they record where we
// deliberately differ from the reference, which showed once elements got their own colours.
type Fixture = { line: string; format: ([boolean, boolean] | null)[] }

function perChar(line: string): ([boolean, boolean] | null)[] {
  const out: ([boolean, boolean] | null)[] = new Array(line.length).fill(null)
  for (const s of highlightLine(line))
    for (let i = s.from; i < s.to; i++) out[i] = [s.bold, s.italic]
  return out
}

describe('highlightLine matches md_highlighter.py', () => {
  for (const { line, format } of reference as Fixture[]) {
    it(JSON.stringify(line), () => expect(perChar(line)).toEqual(format))
  }
})

describe('highlightLine spans', () => {
  it('merges neighbouring characters with the same style', () => {
    expect(highlightLine('# Title')).toEqual([
      { from: 0, to: 7, kind: 'h1', bold: true, italic: false }
    ])
    expect(highlightLine('plain')).toEqual([])
  })

  it('tells the elements apart, so each can have its own colour', () => {
    const kinds = (line: string): string[] => highlightLine(line).map((s) => s.kind)
    expect(kinds('### Three')).toEqual(['h3'])
    expect(kinds('###### Six')).toEqual(['h6'])
    expect(kinds('**b** and *i* and ~~s~~')).toEqual(['bold', 'italic', 'strike'])
    expect(highlightLine('***both***')).toEqual([
      { from: 0, to: 10, kind: 'bold', bold: true, italic: true }
    ])
    expect(kinds('- item')).toEqual(['list'])
    expect(kinds('1. item')).toEqual(['list'])
    // The task rule runs after the list rule and replaces its "- ".
    expect(kinds('- [ ] todo')).toEqual(['task'])
    expect(kinds('`x` [a](b)')).toEqual(['code', 'link'])
    expect(kinds('> q')).toEqual(['quote'])
    // A link stops at its own "]", so it doesn't swallow the task box before it.
    expect(kinds('- [ ] see `x` and [a](b)')).toEqual(['task', 'code', 'link'])
    expect(kinds('---')).toEqual(['rule'])
    expect(kinds('a<br>b')).toEqual(['rule'])
  })

  it('splits neighbouring matches of different elements', () => {
    expect(highlightLine('**a** *b*').map((s) => [s.from, s.to, s.kind])).toEqual([
      [0, 5, 'bold'],
      [6, 9, 'italic']
    ])
  })
})
