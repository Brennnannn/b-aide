import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { KEYBINDS, keysFromEvent, type KeybindDefinition } from '../settings-model'
import { Hint, useSettingsForm } from './shared'

export function KeybindsSection() {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col rounded-lg border border-trim divide-y divide-trim">
        {KEYBINDS.map((bind) => (
          <KeybindRow key={bind.action} bind={bind} />
        ))}
      </ul>
      <Hint>Click a binding, then press the new keys. Escape cancels.</Hint>
    </div>
  )
}

function KeybindRow({ bind }: { bind: KeybindDefinition }) {
  const { form, setFormField } = useSettingsForm()
  const [capturing, setCapturing] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const keys = form.keybinds[bind.action]

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!capturing) return
    // Keep the press away from the window's own keybinds and the browser
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      setCapturing(false)
      setConflict(null)
      return
    }
    const pressed = keysFromEvent(e)
    if (!pressed) return
    const taken = KEYBINDS.find((other) => other.action !== bind.action && form.keybinds[other.action] === pressed)
    if (taken) return setConflict(`${pressed} is already bound to ${taken.label}.`)
    setFormField(`keybinds.${bind.action}`, pressed)
    setConflict(null)
    setCapturing(false)
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex flex-row items-center gap-3">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm">{bind.label}</span>
          <span className="text-xs text-text-muted">{bind.scope}</span>
        </div>
        <button
          type="button"
          onClick={() => setCapturing(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setCapturing(false)
            setConflict(null)
          }}
          className={`min-w-36 px-3 py-1.5 rounded-md border font-mono text-sm cursor-pointer ${
            capturing ? 'border-primary bg-primary/10' : 'border-trim hover:bg-hover-1'
          }`}
        >
          {capturing ? 'Press keys…' : <Keys keys={keys} />}
        </button>
        <button
          type="button"
          title={`Reset to ${bind.defaultKeys}`}
          onClick={() => setFormField(`keybinds.${bind.action}`, bind.defaultKeys)}
          className={`p-1.5 rounded-md hover:bg-hover-1 cursor-pointer ${keys === bind.defaultKeys ? 'invisible' : ''}`}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      {conflict && <Hint tone="error">{conflict}</Hint>}
    </li>
  )
}

function Keys({ keys }: { keys: string }) {
  // `Ctrl++` can't be split on "+", so split before each modifier instead
  const parts = keys.match(/(Ctrl|Alt|Shift)(?=\+)|[^+]+$|\+$/g) ?? [keys]
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, i) => (
        <kbd key={i} className="px-1.5 py-0.5 rounded border border-trim bg-surface text-xs">
          {part}
        </kbd>
      ))}
    </span>
  )
}
