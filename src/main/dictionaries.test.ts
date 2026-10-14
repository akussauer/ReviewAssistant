import { readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  BUNDLED_CODES,
  BUNDLED_DICTIONARIES,
  dictionariesToCopy,
  firstRunSpellcheckFor
} from './dictionaries'

describe('dictionariesToCopy', () => {
  it('copies only the .bdic files that are missing', () => {
    expect(
      dictionariesToCopy(
        ['en-GB-10-1.bdic', 'de-DE-3-0.bdic', 'LICENSES.md', 'licenses'],
        ['de-DE-3-0.bdic', 'it-IT-3-0.bdic']
      )
    ).toEqual(['en-GB-10-1.bdic'])
  })

  it('treats file names case-insensitively (Windows)', () => {
    expect(dictionariesToCopy(['en-GB-10-1.bdic'], ['EN-GB-10-1.BDIC'])).toEqual([])
  })
})

describe('the bundled dictionaries', () => {
  it('are all in resources/dictionaries', () => {
    const files = readdirSync(join(__dirname, '../../resources/dictionaries'))
    for (const f of Object.keys(BUNDLED_DICTIONARIES)) expect(files).toContain(f)
  })

  it('cover English, German, French and Spanish', () => {
    for (const code of ['en-GB', 'en-US', 'en-AU', 'en-CA', 'de-DE', 'fr-FR', 'es-ES', 'es-419'])
      expect(BUNDLED_CODES.has(code)).toBe(true)
  })
})

describe('firstRunSpellcheckFor', () => {
  it("adds Windows' language when its dictionary ships with the app", () => {
    expect(firstRunSpellcheckFor(['de-AT', 'en-GB'])).toEqual(['de-DE', 'en-GB'])
    expect(firstRunSpellcheckFor(['fr-CA'])).toEqual(['fr-FR', 'en-GB'])
    expect(firstRunSpellcheckFor(['es-ES'])).toEqual(['es-ES', 'en-GB'])
    expect(firstRunSpellcheckFor(['es-MX'])).toEqual(['es-419', 'en-GB'])
  })

  it('is English only otherwise', () => {
    expect(firstRunSpellcheckFor(['en-US', 'de-DE'])).toEqual(['en-GB'])
    expect(firstRunSpellcheckFor(['ja-JP'])).toEqual(['en-GB'])
    expect(firstRunSpellcheckFor([])).toEqual(['en-GB'])
  })
})
