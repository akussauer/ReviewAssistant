import postcss, { type Rule } from 'postcss'

// Obsidian theme support (spec §12.1). An Obsidian theme is one CSS file written for
// Obsidian's own page, so most of its rules match nothing here. What carries over is its
// CSS variables: base colours, accent, text colours. We keep only those and map them onto
// our shadcn tokens (main.css), so a theme can recolour the app but never break its layout.

export type ThemeVars = {
  base: Record<string, string> // body / :root / html: both light and dark
  light: Record<string, string> // .theme-light
  dark: Record<string, string> // .theme-dark
}

type Scope = keyof ThemeVars

// Which scope a single selector sets variables for, or null to ignore it. Obsidian puts
// `theme-light`/`theme-dark` on <body>, so `body.theme-dark` counts too; anything more
// specific (e.g. `body.theme-dark.is-mobile`) is for a case we don't have.
function scopeOf(selector: string): Scope | null {
  const s = selector.trim()
  if (s === 'body' || s === ':root' || s === 'html') return 'base'
  if (s === '.theme-light' || s === 'body.theme-light') return 'light'
  if (s === '.theme-dark' || s === 'body.theme-dark') return 'dark'
  return null
}

const NAME = /^--[A-Za-z0-9_-]+$/
// Values go into a stylesheet as-is, so refuse anything that could end the declaration,
// open a rule, load a file, or hide something in an escape or a comment.
const UNSAFE = /url\(|src\(|image-set\(|[\\{};<>]|\/\*|\*\/|@import|expression\(/i

// The variables a theme sets, per scope. Later declarations win, as in CSS. Rules inside
// @media/@supports etc. are skipped (they're for print, mobile and the like).
export function parseThemeVars(css: string): ThemeVars {
  const vars: ThemeVars = { base: {}, light: {}, dark: {} }
  const root = postcss.parse(css)
  for (const node of root.nodes) {
    if (node.type !== 'rule') continue
    const scopes = new Set(
      (node as Rule).selectors.map(scopeOf).filter((s): s is Scope => s !== null)
    )
    if (scopes.size === 0) continue
    node.each((decl) => {
      if (decl.type !== 'decl' || !NAME.test(decl.prop)) return
      const value = decl.value.trim()
      if (!value || UNSAFE.test(value)) return
      for (const scope of scopes) vars[scope][decl.prop] = value
    })
  }
  return vars
}

// Obsidian's own defaults (from its documented CSS variables), for whatever a theme leaves
// out. Themes usually set the base colours and accent and rely on these for the roles.
const OBSIDIAN_BASE: Record<string, string> = {
  '--accent-h': '258',
  '--accent-s': '88%',
  '--accent-l': '66%',
  '--radius-m': '8px',
  '--color-accent': 'hsl(var(--accent-h), var(--accent-s), var(--accent-l))',
  '--background-primary': 'var(--color-base-00)',
  '--background-primary-alt': 'var(--color-base-10)',
  '--background-secondary': 'var(--color-base-20)',
  '--background-modifier-hover': 'rgba(var(--mono-rgb-100), 0.075)',
  '--background-modifier-border': 'var(--color-base-30)',
  '--text-normal': 'var(--color-base-100)',
  '--text-muted': 'var(--color-base-70)',
  '--text-faint': 'var(--color-base-50)',
  '--text-on-accent': 'white',
  '--text-error': 'var(--color-red)',
  '--text-accent': 'var(--color-accent)',
  '--interactive-accent': 'var(--color-accent)'
}

const OBSIDIAN_LIGHT: Record<string, string> = {
  '--mono-rgb-0': '255, 255, 255',
  '--mono-rgb-100': '0, 0, 0',
  '--color-red': '#e93147',
  '--color-base-00': '#ffffff',
  '--color-base-05': '#fcfcfc',
  '--color-base-10': '#fafafa',
  '--color-base-20': '#f6f6f6',
  '--color-base-25': '#e3e3e3',
  '--color-base-30': '#e0e0e0',
  '--color-base-35': '#d4d4d4',
  '--color-base-40': '#bdbdbd',
  '--color-base-50': '#ababab',
  '--color-base-60': '#707070',
  '--color-base-70': '#5c5c5c',
  '--color-base-100': '#222222'
}

const OBSIDIAN_DARK: Record<string, string> = {
  '--mono-rgb-0': '0, 0, 0',
  '--mono-rgb-100': '255, 255, 255',
  '--color-red': '#fb464c',
  '--color-base-00': '#1e1e1e',
  '--color-base-05': '#212121',
  '--color-base-10': '#242424',
  '--color-base-20': '#262626',
  '--color-base-25': '#2a2a2a',
  '--color-base-30': '#363636',
  '--color-base-35': '#3f3f3f',
  '--color-base-40': '#555555',
  '--color-base-50': '#666666',
  '--color-base-60': '#999999',
  '--color-base-70': '#b3b3b3',
  '--color-base-100': '#dadada'
}

// Our tokens (main.css) in terms of Obsidian's roles. A theme may define a role through a
// variable we skipped (e.g. one under `.theme-dark.some-option`); the role is then
// invalid, so each token falls back to a base colour, which is always defined.
// --md-colour is the markdown highlight; the table only sets its own when "Override theme
// colour" is on.
const BG = 'var(--color-base-00)'
const BG2 = 'var(--color-base-20)'
const TEXT = 'var(--color-base-100)'
const ACCENT = 'hsl(var(--accent-h), var(--accent-s), var(--accent-l))'
const LINE = 'var(--color-base-30)'
const role = (name: string, fallback: string): string => `var(${name}, ${fallback})`
const TOKENS: Record<string, string> = {
  '--background': role('--background-primary', BG),
  '--foreground': role('--text-normal', TEXT),
  '--card': role('--background-primary', BG),
  '--card-foreground': role('--text-normal', TEXT),
  '--popover': role('--background-primary', BG),
  '--popover-foreground': role('--text-normal', TEXT),
  '--primary': role('--interactive-accent', ACCENT),
  '--primary-foreground': role('--text-on-accent', 'white'),
  '--secondary': role('--background-secondary', BG2),
  '--secondary-foreground': role('--text-normal', TEXT),
  '--muted': role('--background-secondary', BG2),
  '--muted-foreground': role('--text-muted', 'var(--color-base-70)'),
  '--accent': role('--background-modifier-hover', BG2),
  '--accent-foreground': role('--text-normal', TEXT),
  '--destructive': role('--text-error', 'var(--color-red)'),
  '--border': role('--background-modifier-border', LINE),
  '--input': role('--background-modifier-border', LINE),
  '--ring': role('--interactive-accent', ACCENT),
  '--radius': role('--radius-m', '8px'),
  '--md-colour': role('--text-accent', ACCENT)
}

// A theme can't set our tokens directly, in any scope: only through Obsidian's roles.
const withoutTokens = (vars: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(vars).filter(([k]) => !(k in TOKENS)))

const block = (selector: string, ...sets: Record<string, string>[]): string => {
  const merged = Object.assign({}, ...sets) as Record<string, string>
  const lines = Object.entries(merged).map(([k, v]) => `  ${k}: ${v};`)
  return `${selector} {\n${lines.join('\n')}\n}`
}

// The stylesheet the renderer adds while a theme is active (it also puts the
// `obsidian-theme` class on <html>). `:root.obsidian-theme` outranks main.css's `:root`
// and `.dark`, and the theme's own values outrank Obsidian's defaults.
export function buildThemeCss(themeVars: ThemeVars): string {
  const vars: ThemeVars = {
    base: withoutTokens(themeVars.base),
    light: withoutTokens(themeVars.light),
    dark: withoutTokens(themeVars.dark)
  }
  // The light/dark blocks are more specific than the base one, so a default there would
  // hide a value the theme set on `body`: leave those defaults out. (In Obsidian itself
  // its light/dark defaults would beat `body`; we let the theme's value win, as its
  // author presumably meant.)
  const notInBase = (defaults: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in vars.base)))
  return [
    block(':root.obsidian-theme', OBSIDIAN_BASE, vars.base, TOKENS),
    block(':root.obsidian-theme:not(.dark)', notInBase(OBSIDIAN_LIGHT), vars.light),
    block(':root.obsidian-theme.dark', notInBase(OBSIDIAN_DARK), vars.dark)
  ].join('\n\n')
}
