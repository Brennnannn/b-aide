import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@ui'
import { useSettingsForm } from './shared'

/** The base prompts B-aide ships, by name (`build`, `build.first-message`, ...), read at build time. */
const DEFAULT_PROMPTS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('/server/prompts/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>).map(
    ([file, text]) => [file.split('/').pop()!.replace(/\.md$/, ''), text],
  ),
)

/** Shared prompts first, then each agent's prompt followed by its first message. */
const PROMPT_NAMES = Object.keys(DEFAULT_PROMPTS).sort((a, b) => {
  const rank = (name: string) => (name === 'shared' ? 0 : name === 'tools' ? 1 : 2)
  return rank(a) - rank(b) || a.localeCompare(b)
})

export function PromptsSection() {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-row items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
        <TriangleAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <span>
          <strong>These are the base prompts every agent runs with.</strong> Edit them only if you know what you're doing: a broken
          prompt breaks every session of that agent. Edits apply to new sessions.
        </span>
      </p>
      <ul className="flex flex-col rounded-lg border border-trim divide-y divide-trim">
        {PROMPT_NAMES.map((name) => (
          <PromptRow key={name} name={name} />
        ))}
      </ul>
    </div>
  )
}

function PromptRow({ name }: { name: string }) {
  const { form, setFormField } = useSettingsForm()
  const [open, setOpen] = useState(false)
  const [showDefault, setShowDefault] = useState(false)
  const override = form.prompts[name]
  const overridden = override !== undefined

  const edit = (text: string) => setFormField('prompts', { ...form.prompts, [name]: text })
  const reset = () => {
    const { [name]: _, ...rest } = form.prompts
    setFormField('prompts', rest)
  }

  return (
    <li className="flex flex-col">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex flex-row items-center gap-2 px-3 py-2 text-left hover:bg-hover-1 cursor-pointer">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-mono text-sm flex-1">{name}</span>
        {overridden && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-text">Edited</span>}
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <textarea
            value={override ?? DEFAULT_PROMPTS[name]}
            onChange={(e) => edit(e.target.value)}
            spellCheck={false}
            className="w-full min-h-64 p-2 rounded-md border border-trim bg-background font-mono text-xs"
          />
          <div className="flex flex-row gap-2">
            <Button onClick={() => setShowDefault((v) => !v)} disabled={!overridden} className="text-xs">
              {showDefault ? 'Hide default' : 'View default'}
            </Button>
            <Button onClick={reset} disabled={!overridden} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to default
            </Button>
          </div>
          {overridden && showDefault && (
            <pre className="max-h-64 overflow-auto p-2 rounded-md border border-trim bg-surface font-mono text-xs whitespace-pre-wrap">
              {DEFAULT_PROMPTS[name]}
            </pre>
          )}
        </div>
      )}
    </li>
  )
}
