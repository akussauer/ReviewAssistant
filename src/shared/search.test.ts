import { describe, expect, it } from 'vitest'
import { compileHighlighter, compileQuery, joinCells, tokenize } from './search'

const matches = (query: string, text: string): boolean => compileQuery(query)(text)

describe('tokenize', () => {
  it('splits words, phrases, brackets and CAPITAL operators', () => {
    expect(tokenize('(a OR "b c") and NOT d').map((t) => t.type)).toEqual([
      '(',
      'word',
      'or',
      'phrase',
      ')',
      'word', // lower-case "and" is a word
      'not',
      'word'
    ])
  })
})

describe('compileQuery', () => {
  const text = 'Pacing strategies in elite junior SWIMMING races'

  it('matches everything when empty', () => {
    expect(matches('', text)).toBe(true)
    expect(matches('   ', text)).toBe(true)
  })

  it('matches words anywhere, case-insensitively (like the PySide app)', () => {
    expect(matches('swim', text)).toBe(true)
    expect(matches('PACING', text)).toBe(true)
    expect(matches('cycling', text)).toBe(false)
  })

  it('needs every word (implicit AND)', () => {
    expect(matches('pacing swimming', text)).toBe(true)
    expect(matches('pacing cycling', text)).toBe(false)
    expect(matches('pacing AND elite', text)).toBe(true)
  })

  it('matches exact phrases', () => {
    expect(matches('"elite junior"', text)).toBe(true)
    expect(matches('"junior elite"', text)).toBe(false)
    expect(matches('"elite   junior"', text)).toBe(true) // spacing doesn't matter
    expect(matches('"elite junior', text)).toBe(true) // unclosed quote: rest is the phrase
  })

  it('understands OR and NOT only in capitals', () => {
    expect(matches('cycling OR pacing', text)).toBe(true)
    expect(matches('cycling or pacing', text)).toBe(false) // three words, "cycling" missing
    expect(matches('pacing NOT junior', text)).toBe(false)
    expect(matches('pacing NOT cycling', text)).toBe(true)
    expect(matches('pacing not junior', text)).toBe(false) // "not" is a word here
  })

  it('groups with brackets; OR binds looser than AND', () => {
    expect(matches('(cycling OR running) AND pacing', text)).toBe(false)
    expect(matches('(cycling OR swimming) AND pacing', text)).toBe(true)
    expect(matches('cycling OR swimming pacing', text)).toBe(true) // cycling OR (swimming AND pacing)
    expect(matches('NOT (cycling OR running)', text)).toBe(true)
  })

  it('truncates with * at word starts', () => {
    expect(matches('swim*', text)).toBe(true)
    expect(matches('strateg*', text)).toBe(true)
    expect(matches('ing*', text)).toBe(false) // "ing" never starts a word here
    expect(matches('jun*r', text)).toBe(true) // * inside a word: any letters
  })

  it('matches wildcards like the old regex did', () => {
    expect(matches('*', 'anything')).toBe(true)
    expect(matches('*ming', 'swimming')).toBe(true) // * at the start also starts at a word
    expect(matches('s*m*g', 'swimming')).toBe(true)
    expect(matches('s*m*x', 'swimming')).toBe(false)
    expect(matches('covid*19', 'post-covid-19 cohort')).toBe(true) // "-" counts as a letter
    expect(matches('pre*post', 'pre post')).toBe(false) // * never crosses a space
    expect(matches('u.s.*', 'the u.s.a. data')).toBe(true) // other characters match literally
    expect(matches('ab*', 'xab ab')).toBe(true) // the second "ab" starts a word
    expect(matches('ab*', 'xab_ab')).toBe(false)
    expect(matches('a*b*a', 'aaab')).toBe(false)
    expect(matches('a*b*a', 'aaaba')).toBe(true)
  })

  it('stays fast on queries that make a regex backtrack (they can come from Claude)', () => {
    const long = 'a'.repeat(5_000)
    const started = performance.now()
    expect(matches('a*a*a*a*a*a*a*a*c', long)).toBe(false)
    expect(matches('a*a*a*a*a*a*a*a*c', `${long} ${long}`)).toBe(false)
    expect(performance.now() - started).toBeLessThan(1_000)
  })

  it('never throws on malformed queries', () => {
    for (const q of [
      '(',
      ')',
      'OR',
      'pacing AND',
      'NOT',
      '((pacing',
      'pacing ) swimming',
      '"',
      '*'
    ]) {
      expect(() => compileQuery(q)(text)).not.toThrow()
    }
    expect(matches('pacing AND', text)).toBe(true)
    expect(matches('((pacing', text)).toBe(true)
    expect(matches('pacing ) cycling', text)).toBe(false)
  })

  it('searches several cells: words may be in different cells, phrases may not span them', () => {
    const row = joinCells(['Pacing study', 'Smith, J.'])
    expect(matches('pacing smith', row)).toBe(true)
    expect(matches('"study smith"', row)).toBe(false)
  })
})

describe('leading-star wildcards', () => {
  it("don't hang when nothing matches", () => {
    expect(matches('*ing', 'abc')).toBe(false)
    expect(matches('*ing', 'abc swimming')).toBe(true)
  })
})

describe('compileHighlighter', () => {
  // The marked parts of a text, for readable expectations.
  const marked = (query: string, text: string): string[] =>
    (compileHighlighter(query)?.(text) ?? []).map(([a, b]) => text.slice(a, b))

  it('marks nothing for an empty query', () => {
    expect(compileHighlighter('  ')).toBeNull()
  })

  it('marks just the matching characters of a word, everywhere, ignoring case', () => {
    expect(marked('swim', 'Swimmers swim')).toEqual(['Swim', 'swim'])
  })

  it('marks the whole span a wildcard matched', () => {
    expect(marked('swim*', 'elite swimming, swims')).toEqual(['swimming', 'swims'])
    expect(marked('sw*ng', 'swimming swing')).toEqual(['swimming', 'swing'])
    expect(marked('swim*', 'freeswimming')).toEqual([]) // not at a word start
  })

  it('marks a whole phrase, but not across a line break', () => {
    expect(marked('"elite  athletes"', 'Elite athletes and elite\nathletes')).toEqual([
      'Elite athletes'
    ])
  })

  it('marks every positive term, but never NOT terms', () => {
    expect(marked('(pacing OR junior) NOT elite', 'elite junior pacing')).toEqual([
      'junior',
      'pacing'
    ])
    expect(marked('NOT NOT pacing', 'pacing')).toEqual(['pacing'])
    expect(compileHighlighter('NOT elite')).toBeNull()
  })

  it('merges overlapping marks', () => {
    expect(marked('swim swimming', 'swimming')).toEqual(['swimming'])
    expect(compileHighlighter('ab bc')!('abc')).toEqual([[0, 3]])
  })

  it('keeps marks in place when lower-casing makes a character longer', () => {
    expect(marked('abc', 'İİ abc')).toEqual(['abc'])
    expect(marked('stan', 'İstanbul')).toEqual(['stan'])
  })

  it('handles wildcards that start with a star, without hanging', () => {
    expect(marked('*ming', 'swimming')).toEqual(['swimming'])
    expect(marked('*ing', 'abc')).toEqual([])
    expect(marked('*', 'ab cd')).toEqual(['ab', 'cd'])
  })

  it('handles long wildcard words quickly', () => {
    const word = 'a'.repeat(20_000)
    const start = Date.now()
    expect(marked('a*a*a*a*b', word)).toEqual([])
    expect(Date.now() - start).toBeLessThan(1000)
  })
})
