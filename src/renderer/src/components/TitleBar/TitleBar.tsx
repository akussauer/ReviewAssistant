import { ChevronRightIcon } from 'lucide-react'
import { Menubar } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import icon from '../../../../../resources/icon.png'
import type { MenuNode } from '../../../../shared/ipc'
import { matchesHotkey } from '../../lib/hotkeys'

// The window's title bar (plan M10c): app icon, the menu, and the review's name, in the
// app's theme. Windows can't theme its own menu bar, so main hides it and sends us a copy
// of the menu (main/menu.ts menuModel); choosing an item asks main to run it. Windows still
// draws the minimise/maximise/close buttons at the right, in colours we send it, and the
// empty parts of the bar drag the window (-webkit-app-region).

type Item = Extract<MenuNode, { kind: 'item' }>

// A menu's Alt letter: the first of its name, without accents, so Alt+E opens "Édition".
const firstLetter = (label: string): string =>
  (label[0] ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const dialogOpen = (): boolean =>
  document.querySelector('[role=dialog], [role=alertdialog]') !== null

// Menu content: the same look as the app's context menus.
const CONTENT =
  'z-50 min-w-[14rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md'
const ITEM =
  'flex cursor-default items-center gap-4 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=open]:bg-accent'

// ---- Focus: menu items act where the user was (e.g. Copy in a text cell), so the focus
// they had before the menu took it is remembered and put back before an item runs.

let lastFocus: HTMLElement | null = null
const inMenu = (el: Element): boolean => el.closest('[data-title-bar], [role=menu]') !== null

function restoreFocus(): void {
  if (lastFocus?.isConnected) lastFocus.focus()
  else (document.activeElement as HTMLElement | null)?.blur()
}

// Every item (submenus included) that has a page-run shortcut.
const withShortcuts = (nodes: MenuNode[]): Item[] =>
  nodes.flatMap((n) =>
    n.kind !== 'item' ? [] : [...(n.shortcut ? [n] : []), ...withShortcuts(n.submenu ?? [])]
  )

// ---- Window-button colours: CSS colours (often oklch) as #rrggbb, which Windows needs.

let canvas: CanvasRenderingContext2D | null = null
function toHex(css: string): string | null {
  canvas ??= document
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  canvas.clearRect(0, 0, 1, 1)
  canvas.fillStyle = '#000'
  canvas.fillStyle = css
  canvas.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data
  if (a < 255) return null // see-through: Windows can't match it, so keep the last colours
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

// Sends the bar's colours to Windows whenever the theme may have changed: the dark class
// and colour variables on <html>, or the Obsidian theme's stylesheet in <head>.
function useWindowButtonColours(bar: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    let sent = ''
    let frame = 0
    const sync = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!bar.current) return
        const style = getComputedStyle(bar.current)
        const color = toHex(style.backgroundColor)
        const symbolColor = toHex(style.color)
        if (!color || !symbolColor) return
        const colours = { color, symbolColor }
        const key = JSON.stringify(colours)
        if (key === sent) return
        sent = key
        window.api.menu
          .setTitleBarColours(colours)
          .catch((err) => console.error('Could not colour the window buttons', err))
      })
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    })
    observer.observe(document.head, { childList: true, characterData: true, subtree: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [bar])
}

export function TitleBar({ title }: { title: string }): React.JSX.Element {
  const [menu, setMenu] = useState<MenuNode[]>([])
  const [open, setOpen] = useState('') // the open menu's id; '' = none
  const [mnemonics, setMnemonics] = useState(false) // underline the Alt letters
  const bar = useRef<HTMLDivElement>(null)
  useWindowButtonColours(bar)

  useEffect(() => {
    window.api.menu
      .get()
      .then(setMenu)
      .catch((err) => console.error('Could not read the menu', err))
    return window.api.menu.onChanged(setMenu)
  }, [])

  // Remember where the focus was before it moved into the menu.
  useEffect(() => {
    const onFocus = (e: FocusEvent): void => {
      if (e.target instanceof HTMLElement && !inMenu(e.target)) lastFocus = e.target
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])

  const top = menu.filter((m): m is Item => m.kind === 'item')
  // The key handlers below are added once; they read the latest menu and state from here.
  const latest = useRef({ top, open })
  useEffect(() => {
    latest.current = { top, open }
  })

  // Alt on its own focuses the menu bar (and leaves it again); Alt+letter opens the menu
  // whose name starts with that letter, as in native Windows menus.
  useEffect(() => {
    let altAlone = false
    const triggers = (): HTMLElement[] =>
      Array.from(bar.current?.querySelectorAll<HTMLElement>('[data-menu-trigger]') ?? [])
    const onDown = (e: KeyboardEvent): void => {
      if (dialogOpen()) return
      if (e.key === 'Alt') {
        if (!e.repeat) altAlone = !e.ctrlKey && !e.shiftKey && !e.metaKey
        setMnemonics(true)
        return
      }
      altAlone = false
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      // By the physical key ("KeyF"), so it works on non-Latin keyboard layouts too.
      const letter = /^Key([A-Z])$/.exec(e.code)?.[1].toLowerCase()
      const target = latest.current.top.find(
        (m) => letter !== undefined && firstLetter(m.label) === letter
      )
      if (!target?.enabled) return
      e.preventDefault()
      setOpen(target.id)
    }
    const onUp = (e: KeyboardEvent): void => {
      if (e.key !== 'Alt') return
      const inBar = document.activeElement !== null && inMenu(document.activeElement)
      if (!altAlone || dialogOpen()) {
        if (!inBar) setMnemonics(false)
        return
      }
      altAlone = false
      e.preventDefault()
      if (inBar || latest.current.open) {
        setOpen('')
        setMnemonics(false)
        restoreFocus()
      } else triggers()[0]?.focus()
    }
    // Alt+Tab away (Windows takes the Tab) or Alt+click: that Alt wasn't on its own, so
    // releasing it mustn't focus the menu. Leaving the window also hides the underlines.
    const cancel = (): void => {
      altAlone = false
      setMnemonics(false)
    }
    window.addEventListener('keydown', onDown, true)
    window.addEventListener('keyup', onUp, true)
    window.addEventListener('blur', cancel)
    window.addEventListener('pointerdown', cancel, true)
    return () => {
      window.removeEventListener('keydown', onDown, true)
      window.removeEventListener('keyup', onUp, true)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('pointerdown', cancel, true)
    }
  }, [])

  // The menu's own shortcuts (Ctrl+O, Ctrl+, and the Save As hotkey; see main/menu.ts
  // PAGE_SHORTCUTS). Keys something else on the page has handled are left alone, and so is
  // everything while a dialog is open (e.g. Preferences, recording a new hotkey).
  useEffect(() => {
    const isMac = navigator.platform.startsWith('Mac')
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.repeat || dialogOpen()) return
      const item = withShortcuts(latest.current.top).find((n) =>
        matchesHotkey(e, n.shortcut!, isMac)
      )
      if (!item) return
      e.preventDefault()
      if (item.enabled)
        window.api.menu.click(item.id, item.label).catch((err) => console.error(err))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = (id: string, label: string): void => {
    restoreFocus()
    setMnemonics(false)
    window.api.menu.click(id, label).catch((err) => console.error('Menu item failed', err))
  }

  return (
    // Full width with the border and colour; the inner row stops where Windows' buttons
    // start (the titlebar-area env variables come with titleBarOverlay).
    <div
      ref={bar}
      data-title-bar
      className="relative h-8 shrink-0 border-b bg-background text-foreground select-none [-webkit-app-region:drag]"
    >
      <div className="flex h-full items-center" style={{ width: 'env(titlebar-area-width, 100%)' }}>
        <img src={icon} alt="" className="mx-2 size-4 shrink-0" draggable={false} />
        <Menubar.Root
          value={open}
          onValueChange={(v) => {
            setOpen(v)
            if (!v && !(document.activeElement && inMenu(document.activeElement)))
              setMnemonics(false)
          }}
          className="flex h-full items-center [-webkit-app-region:no-drag]"
          onKeyDown={(e) => {
            // Esc on a focused (closed) menu name leaves the bar.
            if (e.key === 'Escape' && !open) {
              setMnemonics(false)
              restoreFocus()
            }
          }}
          onBlur={(e) => {
            if (!open && !(e.relatedTarget instanceof Element && inMenu(e.relatedTarget)))
              setMnemonics(false)
          }}
        >
          {top.map((m) => (
            <Menubar.Menu key={m.id} value={m.id}>
              <Menubar.Trigger
                data-menu-trigger
                disabled={!m.enabled}
                className="h-6 rounded-sm px-2 text-[13px] outline-hidden hover:bg-accent focus:bg-accent data-[state=open]:bg-accent"
              >
                <span className={mnemonics ? 'underline' : undefined}>{m.label[0]}</span>
                {m.label.slice(1)}
              </Menubar.Trigger>
              <Menubar.Portal>
                <Menubar.Content
                  align="start"
                  sideOffset={4}
                  className={CONTENT}
                  // Focus goes back where it was (run() has done so already), not to the
                  // menu name; unless a click elsewhere has just put it somewhere.
                  onCloseAutoFocus={(e) => {
                    e.preventDefault()
                    const at = document.activeElement
                    if (!at || at === document.body || inMenu(at)) restoreFocus()
                  }}
                >
                  <Entries nodes={m.submenu ?? []} run={run} />
                </Menubar.Content>
              </Menubar.Portal>
            </Menubar.Menu>
          ))}
        </Menubar.Root>
        <span className="pointer-events-none absolute left-1/2 max-w-[40%] -translate-x-1/2 truncate text-xs text-muted-foreground">
          {title}
        </span>
      </div>
    </div>
  )
}

function Entries({
  nodes,
  run
}: {
  nodes: MenuNode[]
  run: (id: string, label: string) => void
}): React.JSX.Element {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.kind === 'separator')
          return <Menubar.Separator key={i} className="-mx-1 my-1 h-px bg-border" />
        if (n.submenu)
          return (
            <Menubar.Sub key={n.id}>
              <Menubar.SubTrigger disabled={!n.enabled} className={ITEM}>
                {n.label}
                <ChevronRightIcon className="ml-auto size-4" />
              </Menubar.SubTrigger>
              <Menubar.Portal>
                <Menubar.SubContent className={`${CONTENT} max-w-[32rem]`} alignOffset={-5}>
                  <Entries nodes={n.submenu} run={run} />
                </Menubar.SubContent>
              </Menubar.Portal>
            </Menubar.Sub>
          )
        return (
          <Menubar.Item
            key={n.id}
            disabled={!n.enabled}
            className={ITEM}
            title={n.sublabel}
            onSelect={() => run(n.id, n.label)}
          >
            <span className="min-w-0 flex-1">
              {n.checked && '✓ '}
              {n.label}
              {n.sublabel && (
                <span className="block truncate text-xs text-muted-foreground">{n.sublabel}</span>
              )}
            </span>
            {n.accelerator && (
              <span className="ml-auto text-xs tracking-wide text-muted-foreground">
                {n.accelerator}
              </span>
            )}
          </Menubar.Item>
        )
      })}
    </>
  )
}
