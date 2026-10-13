import { describe, expect, it } from 'vitest'
import { compileQuery, joinCells, tokenize } from './search'

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
