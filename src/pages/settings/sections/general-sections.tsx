import { useState } from 'react'
import { Folder, Loader2 } from 'lucide-react'
import { Button, FormArray, FormField, SelectField, useArrayFieldPath } from '@ui'
import { api } from '../../../lib/api'
import { THEME_OPTIONS, emptyProject, type ProjectSettings, type Settings } from '../settings-model'
import { Hint, useSettingsForm } from './shared'

const positiveWhole = (value: unknown) => (value === '' || /^[1-9]\d*$/.test(String(value)) ? undefined : ['A whole number, 1 or more'])

export function GeneralSection() {
  return (
    <div className="max-w-xs">
      <SelectField<Settings>
        fieldName="theme"
        label="Theme"
        options={THEME_OPTIONS}
        info="System follows Windows' light or dark setting, and changes when it does."
        className="p-2"
      />
    </div>
  )
}

export function ProjectsSection() {
  const { form } = useSettingsForm()
  return (
    <div className="flex flex-col gap-2">
      <FormArray<ProjectSettings>
        fieldName="projects"
        createItem={emptyProject}
        minimumItems={0}
        addLabel="Add project"
        itemHeader={(i) => form.projects[i]?.name || form.projects[i]?.path || 'New project'}
      >
        <ProjectFields />
      </FormArray>
      <Hint>Removing a project only makes B-aide forget it. The folder isn't touched.</Hint>
    </div>
  )
}

/** One project's fields, inside its FormArray item. */
function ProjectFields() {
  const path = useArrayFieldPath()
  const { setFormField } = useSettingsForm()
  const [picking, setPicking] = useState(false)

  const pick = async () => {
    setPicking(true)
    try {
      const { dir } = await api.pickFolder()
      if (!dir) return
      const set = setFormField as (field: string, value: string) => void
      set(path('path'), dir)
      set(path('name'), dir.split(/[\\/]/).filter(Boolean).pop() ?? dir)
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <FormField fieldName={path('path')} label="Folder" placeholder="D:\projects\my-app" className="p-2 font-mono text-sm" />
        <Button onClick={pick} disabled={picking} className="gap-2 shrink-0">
          {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Folder className="h-4 w-4" />}
          Select Folder
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <FormField fieldName={path('name')} label="Display name" placeholder="Defaults to the folder name" className="p-2" />
        <FormField fieldName={path('defaultBranch')} label="Default branch" placeholder="main" className="p-2 font-mono text-sm" />
      </div>
      <FormField
        fieldName={path('ignoredPaths')}
        type="textarea"
        label="Ignored paths"
        info="One glob per line. Agents leave these alone."
        placeholder={'dist/**\nvendor/**'}
        className="p-2 font-mono text-sm min-h-20"
      />
    </div>
  )
}

export function EscalationSection() {
  return (
    <div className="max-w-xs">
      <FormField<Settings>
        fieldName="escalateAfter"
        type="number"
        min={1}
        label="Escalate after"
        info="Failures of one rule before B-aide stops and opens the task's Dialogue with you."
        className="p-2"
        validation={positiveWhole}
      />
    </div>
  )
}

export function LimitsSection() {
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <FormField<Settings>
          fieldName="limits.maxConcurrentSessions"
          type="number"
          min={1}
          label="Sessions at once"
          info="Sessions over this wait in a queue until one finishes."
          className="p-2"
          validation={positiveWhole}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <FormField<Settings>
          fieldName="limits.dailySpendUsd"
          type="number"
          min={0}
          step="0.01"
          label="Daily spend cap (USD)"
          placeholder="Off"
          className="p-2"
        />
        <FormField<Settings>
          fieldName="limits.endeavorSpendUsd"
          type="number"
          min={0}
          step="0.01"
          label="Per-endeavor spend cap (USD)"
          placeholder="Off"
          className="p-2"
        />
      </div>
      <Hint>
        Caps apply to API-key connections only, and stop new runs from starting; a run already going finishes. On a subscription,
        the dollar figure is an estimate at API prices, not what you pay. Hitting the subscription's usage limit pauses runs until it
        resets.
      </Hint>
      <UsageSummary />
    </div>
  )
}

/** TEMPORARY: placeholder figures until the usage log (`~/.b-aide/usage.jsonl`) is read by the API. */
function UsageSummary() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-trim p-3 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">Subscription usage</span>
        <span className="text-sm">No usage recorded yet</span>
        <Hint>How close you are to the limit, and when it resets.</Hint>
      </div>
      <div className="rounded-lg border border-trim p-3 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">API-key spend today</span>
        <span className="text-sm">$0.00</span>
        <Hint>From each run's logged cost.</Hint>
      </div>
    </div>
  )
}
