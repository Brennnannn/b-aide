import { Bell, Bot, Database, FileText, FolderGit2, Gauge, GitBranch, Keyboard, KeyRound, Palette, TriangleAlert, type LucideIcon } from 'lucide-react'
import { AccountsSection } from './sections/accounts-section'
import { AgentsSection } from './sections/agents-section'
import { EscalationSection, GeneralSection, LimitsSection, ProjectsSection } from './sections/general-sections'
import { KeybindsSection } from './sections/keybinds-section'
import { PromptsSection } from './sections/prompts-section'
import { DataSection, GitSection, NotificationsSection } from './sections/system-sections'

export type SettingsSection = {
  /** The section's anchor: `/settings#<id>`. */
  id: string
  label: string
  icon: LucideIcon
  description?: string
  Component: React.ComponentType
}

/**
 * Every section of the Settings page, in order. The sidebar and the page are both built from
 * this list, so adding, removing or reordering a section here changes both.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', icon: Palette, Component: GeneralSection },
  { id: 'projects', label: 'Projects', icon: FolderGit2, description: 'The projects B-aide works in.', Component: ProjectsSection },
  {
    id: 'escalation',
    label: 'Escalation',
    icon: TriangleAlert,
    description: 'When B-aide stops a task and asks you. Approving plans, overrides and rule changes are always yours.',
    Component: EscalationSection,
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: KeyRound,
    description: 'The accounts agents run on. Connect as many as you like and mix them across agents.',
    Component: AccountsSection,
  },
  { id: 'agents', label: 'Agents', icon: Bot, description: "The model, effort, turn limit and tools each agent runs with. MCP servers from a project's .mcp.json will be listed with each agent's tools.", Component: AgentsSection },
  { id: 'limits', label: 'Limits', icon: Gauge, description: 'How much runs at once, and what it may spend.', Component: LimitsSection },
  { id: 'keybinds', label: 'Keybinds', icon: Keyboard, Component: KeybindsSection },
  { id: 'prompts', label: 'Agent prompts', icon: FileText, Component: PromptsSection },
  { id: 'notifications', label: 'Notifications', icon: Bell, Component: NotificationsSection },
  { id: 'git', label: 'Git', icon: GitBranch, Component: GitSection },
  { id: 'data', label: 'Data', icon: Database, Component: DataSection },
]

/** The DOM id of a section's element on the page. */
export const sectionElementId = (id: string) => `settings-${id}`

/** Scrolls the page to a section and records it in the URL's hash, so a reload lands there too. */
export function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth') {
  document.getElementById(sectionElementId(id))?.scrollIntoView({ behavior, block: 'start' })
  history.replaceState(history.state, '', `#${id}`)
}
