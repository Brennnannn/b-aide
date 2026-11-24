import { useRef, useState } from 'react'
import { Download, GitPullRequest, Music, Play, Upload } from 'lucide-react'
import { Button, CheckboxField, FormField } from '@ui'
import { useSettings } from '../../../lib/settings-context'
import { useStatus } from '../../../lib/status-context'
import type { Settings } from '../settings-model'
import { Group, Hint, useSettingsForm } from './shared'

/**
 * The chosen sound for this app session. TEMPORARY: once the API exists, the file is copied into
 * `~/.b-aide/sounds/` and played from there; until then it plays only until the app reloads.
 */
let soundUrl: string | null = null

export function NotificationsSection() {
  const { form, setFormField } = useSettingsForm()
  const fileInput = useRef<HTMLInputElement>(null)
  const [, rerender] = useState(0)

  const chooseFile = (file: File | undefined) => {
    if (!file) return
    if (soundUrl) URL.revokeObjectURL(soundUrl)
    soundUrl = URL.createObjectURL(file)
    setFormField('notify.soundFile', file.name)
    rerender((n) => n + 1)
  }

  const toggleSound = (on: boolean) => {
    setFormField('notify.sound', on)
    if (on && !form.notify.soundFile) fileInput.current?.click()
  }

  return (
    <Group label="When a node is waiting for your input">
      <CheckboxField<Settings> fieldName="notify.inApp" label="Show an in-app notification" />
      <CheckboxField<Settings> fieldName="notify.os" label="Show a Windows notification" />
      <label className="flex flex-row items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" className="accent-primary" checked={form.notify.sound} onChange={(e) => toggleSound(e.target.checked)} />
        Play a sound
      </label>
      <input ref={fileInput} type="file" accept="audio/*" className="hidden" onChange={(e) => chooseFile(e.target.files?.[0])} />
      {form.notify.sound && (
        <div className="flex flex-row items-center gap-2 ml-6">
          <Music className="h-4 w-4 text-text-muted" />
          <span className="text-sm truncate">{form.notify.soundFile || 'No sound chosen'}</span>
          <Button onClick={() => fileInput.current?.click()} className="text-xs">
            {form.notify.soundFile ? 'Change' : 'Choose file'}
          </Button>
          <Button onClick={() => soundUrl && void new Audio(soundUrl).play()} disabled={!soundUrl} className="gap-1.5 text-xs">
            <Play className="h-3.5 w-3.5" />
            Preview
          </Button>
        </div>
      )}
    </Group>
  )
}

/** TEMPORARY: GitHub sign-in (`gh auth login`) and each repo's git identity need the local API. */
export function GitSection() {
  const { status } = useStatus()
  return (
    <div className="flex flex-col gap-4">
      <Group label="Commits">
        <Hint>
          Agents commit through the git CLI as you, using each repo's user.name and user.email. No sign-in is needed. Commits keep
          B-aide's co-author and B-aide-* trailers, so agent work stays traceable.
        </Hint>
        {status?.projects.length ? (
          <ul className="flex flex-col rounded-lg border border-trim divide-y divide-trim">
            {status.projects.map((p) => (
              <li key={p.dir} className="flex flex-row items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="text-text-muted text-xs">Identity from git config</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Group>
      <Group label="GitHub">
        <Hint>Signing in is only needed for pushing and opening pull requests.</Hint>
        <Button disabled className="gap-2 self-start" title="Coming soon">
          <GitPullRequest className="h-4 w-4" />
          Connect GitHub
        </Button>
      </Group>
    </div>
  )
}

export function DataSection() {
  const { form } = useSettingsForm()
  const { replaceSettings } = useSettings()
  const importInput = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const exportSettings = () => {
    // Connections are left out: they hold sign-ins, and are made again after an import
    const { connections: _, ...rest } = form
    const blob = new Blob([JSON.stringify(rest, null, 2)], { type: 'application/json' })
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'b-aide-settings.json' })
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const importSettings = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = JSON.parse(await file.text()) as Partial<Settings>
      replaceSettings({ ...imported, connections: form.connections })
      setImportError(null)
    } catch {
      setImportError("That file isn't a B-aide settings export.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Group label="Where B-aide keeps its files">
        <code className="text-sm px-2 py-1 rounded-md border border-trim bg-surface self-start">~/.b-aide/</code>
      </Group>
      <div className="max-w-xs">
        <FormField<Settings>
          fieldName="data.logRetentionDays"
          type="number"
          min={1}
          label="Keep run logs for (days)"
          info="Run folders and per-call usage logs. The one-line summary of each run is kept for good."
          className="p-2"
        />
      </div>
      <Group label="Export and import">
        <div className="flex flex-row gap-2">
          <Button onClick={exportSettings} className="gap-2">
            <Download className="h-4 w-4" />
            Export settings
          </Button>
          <Button onClick={() => importInput.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />
            Import settings
          </Button>
          <input ref={importInput} type="file" accept="application/json" className="hidden" onChange={(e) => void importSettings(e.target.files?.[0])} />
        </div>
        {importError ? <Hint tone="error">{importError}</Hint> : <Hint>Settings and prompt overrides. Connections are never exported.</Hint>}
      </Group>
    </div>
  )
}
