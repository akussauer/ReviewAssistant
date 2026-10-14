// The UI languages (plan M10d), without the text itself, so ipc.ts and the schemas can use
// them without pulling every translation into the Claude Desktop script.

export const LOCALES = ['en', 'de', 'fr', 'es'] as const
export type Locale = (typeof LOCALES)[number]
// 'pseudo' is the Developer menu's test language: never saved, never in Preferences.
export type ActiveLocale = Locale | 'pseudo'

// The Language setting: 'system' = the first of Windows' languages the app has.
export const UI_LANGUAGES = ['system', ...LOCALES] as const
export type UiLanguage = (typeof UI_LANGUAGES)[number]

// Each language's name in itself, for the Preferences dropdown.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español'
}

// The tag Intl and Chromium's --lang get. British English, like the reference app.
export const INTL_TAGS: Record<ActiveLocale, string> = {
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pseudo: 'en-GB'
}

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale)

// The first of the system's preferred languages (e.g. ["de-AT", "en-GB"]) that the app
// has; otherwise English.
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split(/[-_]/)[0]
    if (isLocale(primary)) return primary
  }
  return 'en'
}
