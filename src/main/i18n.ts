import { translator, type ActiveLocale, type T } from '../shared/i18n/translate'

// Main's current UI language (plan M10d): menus, native dialogs and the messages main sends
// the page. No Electron here, so the db code and its tests can use t() too.

let locale: ActiveLocale = 'en'
let current: T = translator(locale)

export const t: T = ((...args: Parameters<T>) => current(...args)) as T

export const currentLocale = (): ActiveLocale => locale

export function setLocale(next: ActiveLocale): void {
  locale = next
  current = translator(next)
}
