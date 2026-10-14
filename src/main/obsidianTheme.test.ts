import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { buildThemeCss, parseThemeVars } from './obsidianTheme'

describe('parseThemeVars', () => {
  it('keeps variables from body, :root, .theme-light and .theme-dark only', () => {
    const vars = parseThemeVars(`
      body { --accent-h: 215; color: red; }
      :root { --radius-m: 6px; }
      .theme-light, body.theme-light.is-mobile { --color-base-00: #fff; }
      body.theme-dark { --color-base-00: #111; }
      .markdown-preview-view { --text-normal: pink; }
      body.theme-dark.is-mobile { --color-base-00: #000; }
    `)
    expect(vars).toEqual({
      base: { '--accent-h': '215', '--radius-m': '6px' },
      light: { '--color-base-00': '#fff' },
      dark: { '--color-base-00': '#111' }
    })
  })

  it('lets later declarations win and drops !important', () => {
    const vars = parseThemeVars(`
      body { --a: 1; }
      body { --a: 2 !important; }
    `)
    expect(vars.base).toEqual({ '--a': '2' })
  })

  it('skips rules inside @media and other at-rules', () => {
    const vars = parseThemeVars(
      `@media print { body { --a: 1; } } @supports (x: y) { body { --b: 2; } }`
    )
    expect(vars.base).toEqual({})
  })

  it('drops values that could load files or escape the declaration', () => {
    const vars = parseThemeVars(`
      body {
        --img: url(https://example.com/x.png);
        --esc: \\7d;
        --set: image-set("a.png" 1x);
        --src: src("a.png");
        --ok: hsl(var(--accent-h), 50%, 50%);
      }
    `)
    expect(vars.base).toEqual({ '--ok': 'hsl(var(--accent-h), 50%, 50%)' })
  })

  it('reads the example Obsidian theme', () => {
    const css = readFileSync(join(__dirname, '../../docs/obsidian_theme.css'), 'utf8')
    const vars = parseThemeVars(css)
    expect(vars.base['--accent-h']).toBe('215')
    expect(vars.light['--color-base-00']).toBe('#ffffff')
    expect(vars.dark['--color-base-00']).toBeDefined()
    expect(vars.dark['--color-base-00']).not.toBe('#ffffff')
  })
})

describe('buildThemeCss', () => {
  it('maps our tokens onto Obsidian roles and fills in defaults', () => {
    const css = buildThemeCss({ base: {}, light: {}, dark: {} })
    expect(css).toContain('--background: var(--background-primary, var(--color-base-00));')
    expect(css).toContain('--md-colour: var(--text-accent, hsl(')
    expect(css).toMatch(/:root\.obsidian-theme\.dark \{[^}]*--color-base-00: #1e1e1e;/)
  })

  it("puts the theme's values after the defaults", () => {
    const css = buildThemeCss({ base: {}, light: { '--color-base-00': '#fafafa' }, dark: {} })
    const light = css.match(/:root\.obsidian-theme:not\(\.dark\) \{([^}]*)\}/)![1]
    expect(light).toContain('--color-base-00: #fafafa;')
    expect(light).not.toContain('#ffffff')
  })

  it("ignores a theme's own values for our tokens, in every scope", () => {
    const css = buildThemeCss({
      base: { '--border': 'hotpink' },
      light: { '--background': 'hotpink' },
      dark: { '--md-colour': 'hotpink' }
    })
    expect(css).not.toContain('hotpink')
  })

  it('gives every token a fallback for an undefined role', () => {
    const css = buildThemeCss({ base: {}, light: {}, dark: {} })
    expect(css).toContain('--background: var(--background-primary, var(--color-base-00));')
  })

  it('does not hide a base value with a light/dark default', () => {
    const css = buildThemeCss({ base: { '--color-base-00': '#123456' }, light: {}, dark: {} })
    expect(css.match(/--color-base-00:/g)).toHaveLength(1)
  })
})
