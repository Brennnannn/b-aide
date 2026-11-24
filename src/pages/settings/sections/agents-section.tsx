import { Gavel, RotateCcw, TriangleAlert } from 'lucide-react'
import { Button, FormField, SelectField, type SelectOption } from '@ui'
import { STAGE_STYLES } from '../../../components/status-pill'
import { AGENTS, connectionLabel, modelLabel, modelRef, parseModelRef, providerOf, type AgentDefinition, type AgentId, type Settings } from '../settings-model'
import { useConnections } from './accounts-section'
import { Hint, ToggleChip, useSettingsForm } from './shared'

const AGENT_ICONS: Record<AgentId, React.ComponentType<{ className?: string }>> = {
  dialogue: STAGE_STYLES.dialogue.icon,
  scoping: STAGE_STYLES.scoping.icon,
  build: STAGE_STYLES.building.icon,
  review: STAGE_STYLES.reviewing.icon,
  legislator: Gavel,
}

const turnsValidation = (value: unknown) => (/^\d+$/.test(String(value)) ? undefined : ['A whole number'])

export function AgentsSection() {
  return (
    <div className="flex flex-col gap-4">
      {AGENTS.map((agent) => (
        <AgentRow key={agent.id} agent={agent} />
      ))}
      <Hint>Changes apply to new sessions. Running sessions, and sessions resumed later, keep what they started with.</Hint>
    </div>
  )
}

/** Why `agent` can't run with its chosen model, or `null` if it can. */
function useAgentProblem(agentId: AgentId): string | null {
  const { form } = useSettingsForm()
  const connections = useConnections()
  const parsed = parseModelRef(form.agents[agentId].model)
  if (!parsed) return 'No model chosen.'
  if (!connections.some((c) => c.id === parsed.connection)) return `${connectionLabel(parsed.connection)} isn't connected.`
  return null
}

function AgentRow({ agent }: { agent: AgentDefinition }) {
  const { form, setFormField } = useSettingsForm()
  const connections = useConnections()
  const settings = form.agents[agent.id]
  const problem = useAgentProblem(agent.id)
  const Icon = AGENT_ICONS[agent.id]

  const modelOptions: SelectOption[] = connections.flatMap((c) =>
    providerOf(c.provider).models.map((m) => ({ label: `${m.label} · ${connectionLabel(c.id)}`, value: modelRef(c.id, m.id) })),
  )
  // Keep a disconnected choice visible in the list, so the select shows what's actually set
  if (!modelOptions.some((o) => o.value === settings.model))
    modelOptions.unshift({ label: `${modelLabel(settings.model)} (not connected)`, value: settings.model })

  const efforts = parseModelRef(settings.model)?.provider.efforts ?? []
  const isDefault = JSON.stringify(settings) === JSON.stringify(agent.defaults)
  const base = `agents.${agent.id}` as const

  const setTool = (tool: string, on: boolean) =>
    setFormField(`${base}.tools`, on ? [...settings.tools, tool] : settings.tools.filter((t) => t !== tool))

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${problem ? 'border-error' : 'border-trim'}`}>
      <div className="flex flex-row items-center gap-2">
        <Icon className="h-4 w-4" />
        <h3 className="font-medium">{agent.label}</h3>
        <div className="flex-1" />
        {!isDefault && (
          <Button onClick={() => setFormField(base, agent.defaults)} className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {problem && (
        <p className="flex flex-row items-center gap-2 text-sm text-error">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {problem} {agent.label} can't run until you connect it or choose another model.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:flex-[2] min-w-0 flex">
          <SelectField<Settings> fieldName={`${base}.model`} label="Model" options={modelOptions} className="p-2" />
        </div>
        <div className="sm:flex-1 min-w-0 flex">
          <SelectField<Settings>
            fieldName={`${base}.effort`}
            label="Effort"
            options={efforts}
            placeholder={efforts.length ? undefined : 'Choose a model'}
            className="p-2"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {agent.perLabel ? (
          <>
            <FormField<Settings> fieldName={`${base}.maxTurns.base`} type="number" min={0} label="Base turns" className="p-2" validation={turnsValidation} />
            <FormField<Settings>
              fieldName={`${base}.maxTurns.per`}
              type="number"
              min={0}
              label={`Turns per ${agent.perLabel}`}
              className="p-2"
              validation={turnsValidation}
            />
            <FormField<Settings> fieldName={`${base}.maxTurns.cap`} type="number" min={1} label="Turn cap" className="p-2" validation={turnsValidation} />
          </>
        ) : (
          <div className="sm:max-w-48">
            <FormField<Settings>
              fieldName={`${base}.maxTurns.base`}
              type="number"
              min={1}
              label="Turns per run"
              className="p-2"
              validation={turnsValidation}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Tools</span>
        <div className="flex flex-row flex-wrap gap-2">
          {agent.requiredTools.map((tool) => (
            <ToggleChip key={tool} label={tool} checked locked title={`${agent.label} needs ${tool}`} />
          ))}
          {agent.optionalTools.map((tool) => (
            <ToggleChip key={tool} label={tool} checked={settings.tools.includes(tool)} onChange={(on) => setTool(tool, on)} />
          ))}
        </div>
      </div>
    </div>
  )
}
