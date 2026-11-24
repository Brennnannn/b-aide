import type { SelectOption } from '@ui'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * B-aide's settings as the Settings page holds them (planning/settings.md). Number fields are
 * kept as the strings their inputs produce; a blank spend cap means "off".
 */
export type Settings = {
  theme: ThemeSetting
  projects: ProjectSettings[]
  escalateAfter: string
  /** API-key connections. The subscription connection comes from the CLI's live sign-in, not from here. */
  connections: Connection[]
  agents: Record<AgentId, AgentSettings>
  limits: { maxConcurrentSessions: string; dailySpendUsd: string; endeavorSpendUsd: string }
  keybinds: Record<KeybindAction, string>
  /** Prompt overrides by prompt name; a prompt with no entry uses its default. */
  prompts: Record<string, string>
  notify: { inApp: boolean; os: boolean; sound: boolean; soundFile: string }
  data: { logRetentionDays: string }
}

export type ThemeSetting = 'system' | 'light' | 'dark'

export const THEME_OPTIONS: SelectOption[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

export type ProjectSettings = {
  path: string
  name: string
  defaultBranch: string
  /** One glob per line. */
  ignoredPaths: string
}

export const emptyProject = (): ProjectSettings => ({
  path: '',
  name: '',
  defaultBranch: 'main',
  ignoredPaths: '',
})

// ---- Accounts ----

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'xai'
export type AuthMethod = 'subscription' | 'apiKey'

/** One connection per provider and sign-in method, so its ID is `<provider>.<method>`. */
export type ConnectionId = `${ProviderId}.${AuthMethod}`

/** `account` is what the UI may show: an email, or `••••` and a key's last four characters. */
export type Connection = { id: ConnectionId; provider: ProviderId; method: AuthMethod; account: string }

export type Provider = {
  id: ProviderId
  label: string
  /** The agent runtime B-aide drives for this provider; `null` while there's none. */
  runtime: string | null
  methods: AuthMethod[]
  /** Whether B-aide can run agents through it yet (planning/settings.md, Accounts). */
  available: boolean
  models: { id: string; label: string }[]
  efforts: SelectOption[]
}

const CLAUDE_EFFORTS: SelectOption[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Extra high', value: 'xhigh' },
  { label: 'Max', value: 'max' },
]

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    runtime: 'Claude Code',
    methods: ['subscription', 'apiKey'],
    available: true,
    models: [
      { id: 'fable', label: 'Fable 5.2' },
      { id: 'opus', label: 'Opus 5.5' },
      { id: 'sonnet', label: 'Sonnet 5.5' },
      { id: 'haiku', label: 'Haiku 5.5' },
    ],
    efforts: CLAUDE_EFFORTS,
  },
  { id: 'openai', label: 'OpenAI', runtime: 'Codex CLI', methods: ['subscription', 'apiKey'], available: false, models: [], efforts: [] },
  { id: 'google', label: 'Google', runtime: 'Gemini CLI', methods: ['subscription', 'apiKey'], available: false, models: [], efforts: [] },
  { id: 'xai', label: 'xAI', runtime: null, methods: ['apiKey'], available: false, models: [], efforts: [] },
]

export const METHOD_LABELS: Record<AuthMethod, string> = { subscription: 'Subscription', apiKey: 'API key' }

export const providerOf = (id: ProviderId) => PROVIDERS.find((p) => p.id === id)!

export const connectionLabel = (id: ConnectionId) => {
  const [provider, method] = id.split('.') as [ProviderId, AuthMethod]
  return `${providerOf(provider).label} ${method === 'apiKey' ? 'API key' : 'subscription'}`
}

/** An agent's model is `<connection>/<model>`: the model says which connection pays for it. */
export const modelRef = (connection: ConnectionId, model: string) => `${connection}/${model}`

export function parseModelRef(ref: string): { connection: ConnectionId; provider: Provider; model: string } | null {
  const [connection, model] = ref.split('/') as [ConnectionId | undefined, string | undefined]
  const providerId = connection?.split('.')[0] as ProviderId | undefined
  const provider = PROVIDERS.find((p) => p.id === providerId)
  if (!connection || !model || !provider) return null
  return { connection, provider, model }
}

export const modelLabel = (ref: string) => {
  const parsed = parseModelRef(ref)
  if (!parsed) return ref
  const name = parsed.provider.models.find((m) => m.id === parsed.model)?.label ?? parsed.model
  return `${name} · ${connectionLabel(parsed.connection)}`
}

// ---- Agents ----

export type AgentId = 'dialogue' | 'scoping' | 'build' | 'review' | 'legislator'

/**
 * `maxTurns` is the per-run formula `base + per × count`, capped at `cap` (planning/agents.md).
 * `tools` holds the optional built-ins switched on; required ones are always on.
 */
export type AgentSettings = {
  model: string
  effort: string
  maxTurns: { base: string; per: string; cap: string }
  tools: string[]
}

export type AgentDefinition = {
  id: AgentId
  label: string
  /** What the turn limit grows with, or `null` for a flat limit. */
  perLabel: string | null
  requiredTools: string[]
  optionalTools: string[]
  defaults: AgentSettings
}

const DEFAULT_MODEL = modelRef('anthropic.subscription', 'opus')
const agent = (effort: string, base: number, per: number, cap: number): AgentSettings => ({
  model: DEFAULT_MODEL,
  effort,
  maxTurns: { base: String(base), per: String(per), cap: String(cap) },
  tools: [],
})

/** Every agent B-aide runs, with the defaults from each one's design in planning/agents.md. */
export const AGENTS: AgentDefinition[] = [
  {
    id: 'dialogue',
    label: 'Dialogue',
    perLabel: null,
    requiredTools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
    optionalTools: [],
    defaults: agent('medium', 30, 0, 30),
  },
  {
    id: 'scoping',
    label: 'Scoping',
    perLabel: 'node to build',
    requiredTools: ['Read', 'Grep', 'Glob'],
    optionalTools: ['WebSearch', 'WebFetch'],
    defaults: agent('high', 10, 3, 60),
  },
  {
    id: 'build',
    label: 'Build',
    perLabel: 'node',
    requiredTools: ['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Glob'],
    optionalTools: ['WebSearch', 'WebFetch'],
    defaults: agent('medium', 40, 20, 150),
  },
  {
    id: 'review',
    label: 'Review',
    perLabel: 'agent rule',
    requiredTools: ['Read', 'Grep', 'Glob', 'Bash'],
    optionalTools: ['WebSearch', 'WebFetch'],
    defaults: agent('medium', 20, 15, 80),
  },
  {
    id: 'legislator',
    label: 'Legislator',
    perLabel: null,
    requiredTools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'],
    optionalTools: [],
    defaults: agent('high', 40, 0, 40),
  },
]

// ---- Keybinds ----

export type KeybindAction = 'toggleMap' | 'fitMap' | 'rules' | 'endeavors' | 'settings' | 'firstChild' | 'parent'

export type KeybindDefinition = { action: KeybindAction; label: string; scope: string; defaultKeys: string }

export const KEYBINDS: KeybindDefinition[] = [
  { action: 'toggleMap', label: 'Toggle map', scope: 'Global', defaultKeys: 'Ctrl+M' },
  { action: 'fitMap', label: 'Fit whole map in view', scope: 'Map focused', defaultKeys: 'Shift+1' },
  { action: 'rules', label: 'Rules', scope: 'Global', defaultKeys: 'Ctrl+R' },
  { action: 'endeavors', label: 'Endeavors', scope: 'Global', defaultKeys: 'Ctrl+E' },
  { action: 'settings', label: 'Settings', scope: 'Global', defaultKeys: 'Ctrl+,' },
  { action: 'firstChild', label: 'First child', scope: 'Endeavors pane focused', defaultKeys: 'Ctrl+Tab' },
  { action: 'parent', label: 'Parent', scope: 'Endeavors pane focused', defaultKeys: 'Ctrl+Shift+Tab' },
]

const CODE_KEYS: Record<string, string> = {
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', Space: 'Space',
}

/**
 * A key press as a binding string (`Ctrl+Shift+Tab`), or `null` for a lone modifier. Letters,
 * digits and punctuation are named by physical key, so Shift+1 is `Shift+1`, not `Shift+!`.
 * Ctrl and Cmd both count as `Ctrl`.
 */
export function keysFromEvent(e: KeyboardEvent | ReactKeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const key = /^Key[A-Z]$/.test(e.code)
    ? e.code.slice(3)
    : /^Digit\d$/.test(e.code)
      ? e.code.slice(5)
      : (CODE_KEYS[e.code] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key))
  return [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', key].filter(Boolean).join('+')
}

// ---- Defaults ----

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  projects: [],
  escalateAfter: '3',
  connections: [],
  agents: Object.fromEntries(AGENTS.map((a) => [a.id, a.defaults])) as Record<AgentId, AgentSettings>,
  limits: { maxConcurrentSessions: '3', dailySpendUsd: '', endeavorSpendUsd: '' },
  keybinds: Object.fromEntries(KEYBINDS.map((k) => [k.action, k.defaultKeys])) as Record<KeybindAction, string>,
  prompts: {},
  notify: { inApp: true, os: true, sound: false, soundFile: '' },
  data: { logRetentionDays: '30' },
}

/** Saved settings laid over the defaults, so a setting added later gets its default. */
export function withDefaults(saved: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    agents: Object.fromEntries(
      AGENTS.map((a) => [a.id, { ...a.defaults, ...saved.agents?.[a.id], maxTurns: { ...a.defaults.maxTurns, ...saved.agents?.[a.id]?.maxTurns } }]),
    ) as Record<AgentId, AgentSettings>,
    limits: { ...DEFAULT_SETTINGS.limits, ...saved.limits },
    keybinds: { ...DEFAULT_SETTINGS.keybinds, ...saved.keybinds },
    notify: { ...DEFAULT_SETTINGS.notify, ...saved.notify },
    data: { ...DEFAULT_SETTINGS.data, ...saved.data },
  }
}
