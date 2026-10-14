import { createStore, useStore } from 'zustand'
import {
  formatNumber,
  INTL_TAGS,
  translator,
  type ActiveLocale,
  type T
} from '../../../shared/i18n/translate'

// The page's UI language (plan M10d). Main decides it (the setting, or Windows' language);
// the page follows, live: components read t() through useT(), so a change re-renders them.

type LocaleState = { locale: ActiveLocale; t: T }

export const localeStore = createStore<LocaleState>(() => ({ locale: 'en', t: translator('en') }))

const setLocale = (locale: ActiveLocale): void => {
  document.documentElement.lang = INTL_TAGS[locale]
  localeStore.setState({ locale, t: translator(locale) })
}

// Before the first render, so the page never flashes English; then follows main's changes.
export async function initLocale(): Promise<void> {
  window.api.i18n.onChange(setLocale)
  try {
    setLocale(await window.api.i18n.locale())
  } catch (err) {
    console.error('Could not read the UI language', err)
  }
}

export const useT = (): T => useStore(localeStore, (s) => s.t)
export const useLocale = (): ActiveLocale => useStore(localeStore, (s) => s.locale)

// For code outside components (stores, helpers): the language right now.
export const tNow = (): T => localeStore.getState().t

// The assistant's "This tab (12 rows)" chip as saved with a message: always in English
// (main/llm/chat.ts), so it's told apart from attached files' names whatever the UI language.
export const isRowsChipLabel = (label: string): boolean => /^This tab \([\d,]+ rows?\)$/.test(label)

// Numbers in the UI language, e.g. a row count.
export const useFormatNumber = (): ((n: number) => string) => {
  const locale = useLocale()
  return (n) => formatNumber(locale, n)
}
