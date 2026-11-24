import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { keysFromEvent, withDefaults, type KeybindAction, type Settings } from '../pages/settings/settings-model'

/**
 * TEMPORARY: settings live in localStorage until the local API stores them in
 * `~/.b-aide/config.json` (planning/settings.md, Storage). Never holds secrets: API keys aren't
 * kept by the front end at all, only their last four characters.
 */
const STORAGE_KEY = 'b-aide.settings'

function loadSettings(): Settings {
  try {
    return withDefaults(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>)
  } catch {
    return withDefaults({})
  }
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

/** Sets `data-theme` on <html>, which `index.css` keys its colors (and the `dark:` variant) off. */
function applyTheme(theme: Settings['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

// Before the first render, so the page never flashes the wrong theme
applyTheme(loadSettings().theme)

type SettingsContextValue = {
  settings: Settings
  /** Saves new settings. The Settings page calls this as you edit. */
  saveSettings: (next: Settings) => void
  /** Replaces settings from outside the page's form (an import), and bumps `revision` so the form reseeds. */
  replaceSettings: (next: Partial<Settings>) => void
  revision: number
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [revision, setRevision] = useState(0)

  const saveSettings = (next: Settings) => {
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const replaceSettings = (next: Partial<Settings>) => {
    saveSettings(withDefaults(next))
    setRevision((r) => r + 1)
  }

  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    const onChange = () => applyTheme('system')
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [settings.theme])

  return <SettingsContext.Provider value={{ settings, saveSettings, replaceSettings, revision }}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within a SettingsProvider')
  return context
}

/**
 * Runs `handler` when the keys bound to `action` (Settings > Keybinds) are pressed anywhere in
 * the window. The key's default (Ctrl+R's reload) is prevented.
 */
export function useKeybind(action: KeybindAction, handler: () => void, enabled = true) {
  const keys = useSettings().settings.keybinds[action]
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled || !keys) return
    const onKey = (e: KeyboardEvent) => {
      if (keysFromEvent(e) !== keys) return
      e.preventDefault()
      handlerRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keys, enabled])
}
