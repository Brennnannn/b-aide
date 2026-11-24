import { FileCheck, Globe, Layers, Plus, Folder } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useMatch, useNavigate } from 'react-router-dom'
import { Button, navLink } from '@ui'
import type { EndeavorStage } from '../../../shared/api-types'
import { InnerNav } from '../../components/nav/inner-nav'
import { STAGE_STYLES } from '../../components/status-pill'
import type { RuleScope } from './rule'

export type RuleTab = 'shared' | 'dialogue' | 'scope' | 'build' | 'edit' | 'review' | 'publish'

/** A tab named after a stage, with that stage's label and icon from `STAGE_STYLES`. */
function stageTab(tab: RuleTab, stage: EndeavorStage) {
  const { name, icon: Icon } = STAGE_STYLES[stage]
  return { tab, label: name, icon: <Icon /> }
}

/**
 * The rule types, in order: rules shared across steps, then one per step. Stage tabs reuse the
 * stage's icon; Shared and Edit aren't stages (Edit rules run inside a build), so they have their own.
 */
export const ruleTabs: { tab: RuleTab; label: string; icon: ReactNode }[] = [
  { tab: 'shared', label: 'Shared', icon: <Layers /> },
  stageTab('dialogue', 'dialogue'),
  stageTab('scope', 'scoping'),
  stageTab('build', 'building'),
  { tab: 'edit', label: 'Edit', icon: <FileCheck /> },
  stageTab('review', 'reviewing'),
  stageTab('publish', 'publishing'),
]

export const RULE_SCOPES: { scope: RuleScope; label: string; icon: typeof Globe }[] = [
  { scope: 'project', label: 'Project', icon: Folder },
  { scope: 'global', label: 'Global', icon: Globe },
]

export const isRuleScope = (value: string | undefined): value is RuleScope => value === 'project' || value === 'global'

/** The scope and tab the URL names (`/rules/:scope/:tab/...`), defaulting to project rules' Shared tab. */
function useRulesLocation(): { scope: RuleScope; tab: RuleTab } {
  const match = useMatch('/rules/:scope/:tab/*')
  const scope = isRuleScope(match?.params.scope) ? match.params.scope : 'project'
  const tab = ruleTabs.find((entry) => entry.tab === match?.params.tab)?.tab ?? 'shared'
  return { scope, tab }
}

/** Project or global rules, as a two-way toggle that keeps the current tab. */
function ScopeToggle({ scope, tab }: { scope: RuleScope; tab: RuleTab }) {
  return (
    <div className="p-3 border-b border-trim">
      <div role="radiogroup" aria-label="Rule scope" className="grid grid-cols-2 p-1 gap-1 rounded-lg border border-trim">
        {RULE_SCOPES.map(({ scope: option, label, icon: Icon }) => {
          const selected = option === scope
          return (
            <Link
              key={option}
              to={`/rules/${option}/${tab}`}
              role="radio"
              aria-checked={selected}
              className={`flex flex-row items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                selected ? 'bg-primary text-background dark:text-text' : 'text-text-muted hover:bg-hover-1'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** Docked at the bottom of the rules sidebar: a new rule, starting on the current scope and type. */
function CreateRuleButton({ scope, tab }: { scope: RuleScope; tab: RuleTab }) {
  const navigate = useNavigate()
  return (
    <Button scheme="primary" onClick={() => navigate(`/rules/new?scope=${scope}&type=${tab}`)} className="w-full justify-center gap-2">
      <Plus className="h-4 w-4" />
      Create New
    </Button>
  )
}

/** The Rules section (`/rules`): a sidebar of rule types, a project/global toggle, and Create New. */
export function RulesNav() {
  const { scope, tab } = useRulesLocation()
  const navItems = ruleTabs.map(({ tab: entry, label, icon }) => navLink({ link: `/rules/${scope}/${entry}`, label, icon }))
  return (
    <InnerNav name="Rules" navItems={navItems} sideActions={[<CreateRuleButton key="create" scope={scope} tab={tab} />]}>
      <ScopeToggle scope={scope} tab={tab} />
    </InnerNav>
  )
}
