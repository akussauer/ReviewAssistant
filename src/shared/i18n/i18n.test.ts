import { describe, expect, it } from 'vitest'
import { en } from './en'
import {
  CATALOGS,
  flatten,
  formatNumber,
  LOCALES,
  pickLocale,
  pseudo,
  translator
} from './translate'
import type { Catalog } from './types'

const placeholders = (v: string | { one: string; other: string }): string[] => {
  const text = typeof v === 'string' ? v : `${v.one} ${v.other}`
  return [...new Set(text.match(/\{\w+\}/g) ?? [])].sort()
}

describe('the translations', () => {
  const source = flatten(en)

  for (const locale of LOCALES.filter((l) => l !== 'en')) {
    describe(locale, () => {
      const messages = flatten(CATALOGS[locale] as Catalog)

      it('has exactly the English keys', () => {
        expect([...messages.keys()].sort()).toEqual([...source.keys()].sort())
      })

      // A dropped {count} or a misspelt {name} would show as-is, or lose the number.
      it('keeps every {placeholder}', () => {
        for (const [key, text] of source) {
          expect({ key, names: placeholders(messages.get(key)!) }).toEqual({
            key,
            names: placeholders(text)
          })
        }
      })

      it('has a plural wherever English has one', () => {
        for (const [key, text] of source)
          expect({ key, plural: typeof messages.get(key) }).toEqual({ key, plural: typeof text })
      })
    })
  }

  it('has no empty messages', () => {
    for (const locale of LOCALES)
      for (const [key, text] of flatten(CATALOGS[locale] as Catalog)) {
        const parts = typeof text === 'string' ? [text] : [text.one, text.other]
        expect({ locale, key, empty: parts.some((p) => p.trim() === '') }).toEqual({
          locale,
          key,
          empty: false
        })
      }
  })
})

describe('t()', () => {
  const t = translator('en')

  it('looks up a key', () => {
    expect(t('menu.file.openRecent')).toBe('Open Recent')
  })

  it('fills {placeholders}', () => {
    expect(t('tabs.close', { name: 'Pacing' })).toBe('Close Pacing')
  })

  it('picks the plural form by {count}', () => {
    expect(t('status.rows', { count: 1 })).toBe('1 row')
    expect(t('status.rows', { count: 0 })).toBe('0 rows')
    expect(t('status.rows', { count: 2 })).toBe('2 rows')
  })

  it('writes numbers in the UI language, but leaves strings alone', () => {
    expect(t('status.rows', { count: 2000 })).toBe('2,000 rows')
    expect(translator('de')('status.rows', { count: 2000 })).toContain('2.000')
    expect(t('tabs.defaultName', { n: '2000' })).toBe('Tab 2000')
  })

  it('leaves a placeholder it was not given, for rich()', () => {
    expect(t('tabs.deleteBody', { name: '{name}' })).toContain('{name}')
  })

  it('returns the key itself for one it does not know', () => {
    const loose = t as (key: string) => string
    expect(loose('no.such.key')).toBe('no.such.key')
  })

  it('uses French plural rules: 0 is singular', () => {
    // Whatever the draft says, French picks "one" for 0 and 1.
    const fr = translator('fr')
    expect(fr('status.rows', { count: 0 })).toBe(fr('status.rows', { count: 1 }).replace('1', '0'))
  })
})

describe('the pseudo-language', () => {
  it('accents and lengthens the text, keeping {placeholders}', () => {
    const p = pseudo('Close {name}')
    expect(p).toMatch(/^\[Çĺöśé \{name\} ~+\]$/)
    expect(translator('pseudo')('tabs.close', { name: 'Pacing' })).toContain('Pacing')
  })
})

describe('pickLocale', () => {
  it('takes the first preferred language the app has', () => {
    expect(pickLocale(['de-AT', 'en-GB'])).toBe('de')
    expect(pickLocale(['ja-JP', 'fr-CA', 'de-DE'])).toBe('fr')
    expect(pickLocale(['es_419'])).toBe('es')
  })

  it('falls back to English', () => {
    expect(pickLocale(['ja-JP', 'it-IT'])).toBe('en')
    expect(pickLocale([])).toBe('en')
  })
})

describe('formatNumber', () => {
  it('groups digits the way the language does', () => {
    expect(formatNumber('en', 1234567)).toBe('1,234,567')
    expect(formatNumber('de', 1234567)).toBe('1.234.567')
  })
})
