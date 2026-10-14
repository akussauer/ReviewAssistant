import { de } from './de'
import { en, type En } from './en'
import { es } from './es'
import { fr } from './fr'
import { INTL_TAGS, type ActiveLocale, type Locale } from './locales'
import {
  isPlural,
  type At,
  type Catalog,
  type Keys,
  type Messages,
  type ParamsOf,
  type Value
} from './types'

// The app's own text in four languages (plan M10d). English is the source and the fallback.
// Used by main (menus, native dialogs, messages it sends) and the page (useT()).

export * from './locales'
export type { En }
export type MessageKey = Keys<En>
export type Params<K extends MessageKey> = ParamsOf<At<En, K>>

// t('menu.file.open') or t('status.saved', { count: 3 }). TypeScript checks the key and
// that every {placeholder} is given.
export type T = <K extends MessageKey>(
  key: K,
  ...args: [Params<K>] extends [never] ? [] : [Record<Params<K>, Value>]
) => string

export const CATALOGS: Record<Locale, Messages<En>> = { en, de, fr, es }

function lookup(
  catalog: Catalog,
  key: string
): string | { one: string; other: string } | undefined {
  let node: unknown = catalog
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined
}

// ---- The pseudo-language: [Ŕéṽíéŵ Àśśíśţàñţ ~~~] ------------------------------------
// Accented and about 30% longer, so text that isn't translated (plain English) or that
// gets clipped stands out. {placeholders} are kept as they are.

// prettier-ignore
const ACCENTS: Record<string, string> = {
  a: 'à', b: 'ƀ', c: 'ç', d: 'ď', e: 'é', f: 'ƒ', g: 'ğ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ',
  l: 'ĺ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'ś', t: 'ţ', u: 'û', v: 'ṽ',
  w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž', A: 'À', B: 'Ɓ', C: 'Ç', D: 'Ď', E: 'É', F: 'Ƒ', G: 'Ğ',
  H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ĺ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ',
  S: 'Ś', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž'
}

export function pseudo(text: string): string {
  const accented = text
    .split(/(\{\w+\})/)
    .map((part) =>
      /^\{\w+\}$/.test(part) ? part : part.replace(/[a-z]/gi, (c) => ACCENTS[c] ?? c)
    )
    .join('')
  // In groups of up to 8, so it can wrap like real words.
  const pad = ('~'.repeat(Math.max(1, Math.round(text.length * 0.3))).match(/~{1,8}/g) ?? []).join(
    ' '
  )
  return `[${accented} ${pad}]`
}

// ---- t() -------------------------------------------------------------------------------

const numberFormats = new Map<string, Intl.NumberFormat>()
const pluralRules = new Map<string, Intl.PluralRules>()

function cached<V>(map: Map<string, V>, tag: string, make: () => V): V {
  let v = map.get(tag)
  if (!v) map.set(tag, (v = make()))
  return v
}

// Numbers in the UI language: 1,234.5 · 1.234,5 · 1 234,5.
export function formatNumber(locale: ActiveLocale, n: number): string {
  const tag = INTL_TAGS[locale]
  return cached(numberFormats, tag, () => new Intl.NumberFormat(tag)).format(n)
}

// Fills {name} from vars. Numbers are written in the UI language; a missing name is left
// as it is, so the mistake shows.
function fill(text: string, vars: Record<string, Value> | undefined, locale: ActiveLocale): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name]
    return v === undefined ? whole : typeof v === 'number' ? formatNumber(locale, v) : v
  })
}

export function translator(locale: ActiveLocale): T {
  const catalog: Catalog = CATALOGS[locale === 'pseudo' ? 'en' : locale]
  const tag = INTL_TAGS[locale]
  const plurals = cached(pluralRules, tag, () => new Intl.PluralRules(tag))
  return ((key: string, vars?: Record<string, Value>) => {
    const found = lookup(catalog, key) ?? lookup(en, key)
    if (found === undefined) return key
    let text =
      typeof found === 'string'
        ? found
        : plurals.select(Number(vars?.count ?? 0)) === 'one'
          ? found.one
          : found.other
    if (locale === 'pseudo') text = pseudo(text)
    return fill(text, vars, locale)
  }) as T
}

// For the key check in the tests: every message's path and text.
export function flatten(
  catalog: Catalog,
  prefix = ''
): Map<string, string | { one: string; other: string }> {
  const out = new Map<string, string | { one: string; other: string }>()
  for (const [k, v] of Object.entries(catalog)) {
    const path = prefix + k
    if (typeof v === 'string' || isPlural(v)) out.set(path, v)
    else for (const [p, inner] of flatten(v, `${path}.`)) out.set(p, inner)
  }
  return out
}
