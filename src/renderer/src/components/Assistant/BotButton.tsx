import botIcon from '../../../../../resources/ai_bot.png'
import type { Tab } from '../../../../shared/ipc'
import { toggleAssistant } from '../../lib/assistant'
import { describeHotkey } from '../../lib/hotkeys'
import { useT } from '../../lib/i18n'
import { useAssistant, useReview } from '../../store'

const isMac = navigator.platform.startsWith('Mac')

// The bot icon (resources/ai_bot.png) is solid black, so it's used as a mask filled with
// the text colour: it then follows Light/Dark and Obsidian themes like the text does.
export function BotIcon({ className = '' }: { className?: string }): React.JSX.Element {
  const mask = `url(${botIcon}) center / contain no-repeat`
  return (
    <span
      aria-hidden
      className={`inline-block size-4 bg-current ${className}`}
      style={{ mask, WebkitMask: mask }}
    />
  )
}

// At the far right of the status bar (plan M7). Pressed while this tab's panel is on.
export function BotButton({ tab }: { tab: Tab }): React.JSX.Element {
  const status = useAssistant((s) => s.status)
  const hotkey = useReview((s) => s.settings?.hotkeys.toggleAssistant ?? 'CmdOrCtrl+Shift+A')
  const t = useT()
  const on = tab.assistantEnabled
  const disabled = !on && status?.state !== 'ok'
  const key = describeHotkey(hotkey, isMac)
  const title = disabled
    ? status === null || status.state === 'checking'
      ? t('assistant.checking')
      : (status.reason ?? t('assistantMain.unavailable'))
    : t(on ? 'assistant.hide' : 'assistant.show', { key })
  return (
    // A disabled button gets no mouse events, so the tooltip sits on this wrapper.
    <span className="ml-auto flex" title={title}>
      <button
        type="button"
        aria-label={t('assistant.label')}
        aria-pressed={on}
        disabled={disabled}
        onClick={toggleAssistant}
        className={`flex size-6 items-center justify-center rounded-md border transition-colors disabled:pointer-events-none disabled:opacity-40 ${
          on
            ? 'border-primary/40 bg-accent text-primary'
            : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <BotIcon />
      </button>
    </span>
  )
}
