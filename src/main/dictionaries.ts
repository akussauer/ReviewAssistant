// The spellcheck dictionaries that ship with the app (plan M10d), in resources/dictionaries.
// No Electron here, so the tests can use it.

// The bundled files and the spellcheck codes each serves (es-419 uses the Spanish file).
export const BUNDLED_DICTIONARIES: Record<string, string> = {
  'en-US-10-1.bdic': 'en-US',
  'en-GB-10-1.bdic': 'en-GB',
  'en-AU-10-1.bdic': 'en-AU',
  'en-CA-10-1.bdic': 'en-CA',
  'de-DE-3-0.bdic': 'de-DE',
  'fr-FR-3-0.bdic': 'fr-FR',
  'es-ES-3-0.bdic': 'es-ES es-419'
}
export const BUNDLED_CODES = new Set(
  Object.values(BUNDLED_DICTIONARIES).flatMap((c) => c.split(' '))
)

// A fresh install's spellcheck languages, from Windows' preferred languages: English, plus
// the first preferred language whose dictionary ships with the app.
export function firstRunSpellcheckFor(preferred: readonly string[]): string[] {
  for (const tag of preferred) {
    const [lang, region = ''] = tag.split(/[-_]/)
    const code =
      lang === 'de'
        ? 'de-DE'
        : lang === 'fr'
          ? 'fr-FR'
          : lang === 'es'
            ? // Latin American Spanish has its own spellcheck code (same dictionary).
              region.toUpperCase() === 'ES' || region === ''
              ? 'es-ES'
              : 'es-419'
            : null
    if (code) return [code, 'en-GB']
    if (lang === 'en') return ['en-GB']
  }
  return ['en-GB']
}

// Which bundled files to copy: those not already there (a newer download is kept).
export const dictionariesToCopy = (bundled: string[], existing: string[]): string[] => {
  const have = new Set(existing.map((f) => f.toLowerCase()))
  return bundled.filter((f) => f.endsWith('.bdic') && !have.has(f.toLowerCase()))
}
