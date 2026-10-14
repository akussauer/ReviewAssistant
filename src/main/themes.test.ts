import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { listPlugins } from './plugins'
import {
  installTheme,
  listThemes,
  planThemeInstall,
  themeCss,
  themeFolder,
  vaultThemesDir
} from './themes'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-addons-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

const write = (path: string, text: string): void => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text, 'utf8')
}
const THEME = '.theme-dark { --color-base-00: #101010; }'

describe('themes', () => {
  it('lists local themes first, then the vault, with names from manifest.json', () => {
    const local = tempDir()
    const vault = tempDir()
    write(join(local, 'b', 'theme.css'), THEME)
    write(join(local, 'a', 'theme.css'), THEME)
    write(join(local, 'a', 'manifest.json'), '{"name":"Zed","version":"1.2.0","author":"X"}')
    write(join(local, 'no-css', 'manifest.json'), '{"name":"Ignored"}')
    write(join(vault, '.obsidian', 'themes', 'Things', 'theme.css'), THEME)
    const themes = listThemes({ local, vault: vaultThemesDir(vault) })
    expect(themes.map((t) => [t.id, t.name])).toEqual([
      ['local:b', 'b'],
      ['local:a', 'Zed'],
      ['vault:Things', 'Things']
    ])
    expect(themes[1]).toMatchObject({ version: '1.2.0', author: 'X', source: 'local' })
  })

  it('accepts the vault folder or its .obsidian folder', () => {
    const vault = tempDir()
    mkdirSync(join(vault, '.obsidian'))
    const expected = join(vault, '.obsidian', 'themes')
    expect(vaultThemesDir(vault)).toBe(expected)
    expect(vaultThemesDir(join(vault, '.obsidian'))).toBe(expected)
    expect(vaultThemesDir(tempDir())).toBeNull()
  })

  it('only resolves ids it lists', () => {
    const local = tempDir()
    write(join(local, 'a', 'theme.css'), THEME)
    const d = { local, vault: null }
    expect(themeFolder(d, 'local:a')).toBe(join(local, 'a'))
    expect(themeFolder(d, 'local:..')).toBeNull()
    expect(themeFolder(d, 'vault:a')).toBeNull()
    expect(themeCss(join(local, 'a'))).toContain('--color-base-00: #101010;')
  })

  it('installs a .css file, named after its folder when it is called theme.css', () => {
    const local = tempDir()
    const src = tempDir()
    const css = join(src, 'My Theme', 'theme.css')
    write(css, THEME)
    const plan = planThemeInstall(local, css)
    expect(plan).toEqual({ name: 'My Theme', folder: 'My Theme', exists: false })
    expect(installTheme(local, css, plan)).toBe('local:My Theme')
    expect(readFileSync(join(local, 'My Theme', 'theme.css'), 'utf8')).toBe(THEME)
    expect(planThemeInstall(local, css).exists).toBe(true)
  })

  it('uses the manifest name, made safe for a folder, and copies the manifest', () => {
    const local = tempDir()
    const src = tempDir()
    write(join(src, 'obsidian.css'), THEME)
    write(join(src, 'manifest.json'), '{"name":"A/B: C?"}')
    const plan = planThemeInstall(local, join(src, 'obsidian.css'))
    expect(plan.folder).toBe('A_B_ C_')
    installTheme(local, join(src, 'obsidian.css'), plan)
    expect(existsSync(join(local, 'A_B_ C_', 'manifest.json'))).toBe(true)
  })

  it('replacing a theme drops its old manifest; picking an installed one copies nothing', () => {
    const local = tempDir()
    write(join(local, 'X', 'theme.css'), THEME)
    write(join(local, 'X', 'manifest.json'), '{"name":"Old"}')
    const src = tempDir()
    write(join(src, 'X.css'), THEME)
    installTheme(local, join(src, 'X.css'), planThemeInstall(local, join(src, 'X.css')))
    expect(existsSync(join(local, 'X', 'manifest.json'))).toBe(false)

    const installed = join(local, 'X', 'theme.css')
    expect(installTheme(local, installed, planThemeInstall(local, installed))).toBe('local:X')
    expect(readFileSync(installed, 'utf8')).toBe(THEME)
  })

  it('refuses a file with no theme variables', () => {
    const src = tempDir()
    write(join(src, 'x.css'), '.markdown-preview-view { color: red; }')
    expect(() => planThemeInstall(tempDir(), join(src, 'x.css'))).toThrow(/no theme colours/)
  })
})

describe('plugins', () => {
  it('lists plugin folders, flagging missing or invalid manifests', () => {
    const dir = tempDir()
    write(
      join(dir, 'good', 'manifest.json'),
      '{"id":"good","name":"Good plugin","version":"0.1.0","author":"Me","description":"Does things"}'
    )
    write(join(dir, 'broken', 'manifest.json'), '{"name":')
    write(join(dir, 'partial', 'manifest.json'), '{"name":"No id"}')
    mkdirSync(join(dir, 'empty'))
    write(join(dir, 'stray.txt'), 'not a folder')
    const list = listPlugins(dir, ['good', 'broken'])
    expect(list).toEqual([
      { folder: 'broken', name: 'broken', enabled: false, error: 'Invalid manifest' },
      { folder: 'empty', name: 'empty', enabled: false, error: 'No manifest.json' },
      {
        folder: 'good',
        name: 'Good plugin',
        version: '0.1.0',
        author: 'Me',
        description: 'Does things',
        enabled: true
      },
      { folder: 'partial', name: 'partial', enabled: false, error: 'Invalid manifest' }
    ])
  })

  it('returns nothing when there is no Plugins folder', () => {
    expect(listPlugins(join(tempDir(), 'missing'), [])).toEqual([])
  })
})
