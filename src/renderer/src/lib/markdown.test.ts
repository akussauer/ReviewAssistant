import { describe, expect, it } from 'vitest'
import reference from './__fixtures__/md-reference.json'
import { highlightLine } from './markdown'

// md-reference.json was produced by running the reference app's own regexes (read out of
// md_highlighter.py) over these lines in Python, recording each character's
// [bold, italic] format or null. The port must give the same result for every character.
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
    expect(highlightLine('# Title')).toEqual([{ from: 0, to: 7, bold: true, italic: false }])
    expect(highlightLine('plain')).toEqual([])
  })
})
