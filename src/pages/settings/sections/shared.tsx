import { Lock } from 'lucide-react'
import { useFormFull } from '@ui'
import type { Settings } from '../settings-model'

/** Small explanatory text under a field or group. */
export function Hint({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' | 'warning' }) {
  const color = tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-text-muted'
  return <p className={`text-xs ${color}`}>{children}</p>
}

/** A labeled group of controls inside a section. */
export function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text">{label}</span>
      {children}
    </div>
  )
}

type ToggleChipProps = { label: string; checked: boolean; onChange?: (checked: boolean) => void; locked?: boolean; title?: string }

/** A checkbox styled as a chip, for picking items from a short list. `locked` is checked and fixed. */
export function ToggleChip({ label, checked, onChange, locked, title }: ToggleChipProps) {
  return (
    <label
      title={title}
      className={`flex flex-row items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm select-none ${
        checked ? 'border-primary bg-primary/10' : 'border-trim'
      } ${locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-hover-1'}`}
    >
      <input
        type="checkbox"
        className="accent-primary"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label}
      {locked && <Lock className="h-3 w-3 text-text-muted" />}
    </label>
  )
}

/** The settings form, typed. Every section edits the one form the Settings page holds. */
export const useSettingsForm = () => useFormFull<Settings>()
