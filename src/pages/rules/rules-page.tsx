import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Card, Frame, useHeaderBumpCtx } from '@ui'
import { useStatus } from '../../lib/status-context'
import type { Rule, RuleScope } from './rule'
import { isRuleScope, ruleTabs } from './rules-nav'
import { useSampleRules } from './sample-rules'

/**
 * One scope and type's rules (`/rules/:scope/:tab`): a search bar above a grid of rule cards.
 * Search matches name and description. TEMPORARY: rules come from `useSampleRules`.
 */
export function RulesPage() {
  const { scope, tab } = useParams()
  const current = ruleTabs.find((entry) => entry.tab === tab)
  if (!isRuleScope(scope) || !current) return <Navigate to="/rules/project/shared" replace />
  // Keyed so each tab starts with an empty search
  return <RuleTabPage key={`${scope}/${current.tab}`} scope={scope} current={current} />
}

function RuleTabPage({ scope, current }: { scope: RuleScope; current: (typeof ruleTabs)[number] }) {
  const headerBump = useHeaderBumpCtx(true)
  const allRules = useSampleRules()
  const [query, setQuery] = useState('')
  const label = current.label.toLowerCase()

  const needle = query.trim().toLowerCase()
  const rules = allRules.filter(
    (rule) =>
      rule.type === current.tab &&
      (rule.project !== null) === (scope === 'project') &&
      (!needle || rule.name.toLowerCase().includes(needle) || rule.description.toLowerCase().includes(needle)),
  )

  const empty =
    scope === 'global' && current.tab === 'publish'
      ? 'Publish rules are project only: everyone who signs off uses the project’s procedures.'
      : needle
        ? `No ${label} rules match “${query.trim()}”.`
        : `No ${scope} ${label} rules yet.`

  return (
    <Frame format="cornered-end" className={`gap-4 ${headerBump}`}>
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted h-4 w-4" />
        <input
          type="search"
          placeholder={`Search ${scope} ${label} rules...`}
          className="w-full pl-9 pr-3 py-2 border border-trim rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-background text-text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rules.length > 0 ? (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
            {rules.map((rule) => (
              <Link key={`${rule.project}:${rule.name}`} to={`/rules/${scope}/${current.tab}/${rule.name}`}>
                <RuleCard rule={rule} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-text-muted">{empty}</div>
        )}
      </div>
    </Frame>
  )
}

/** A rule in the grid: its name, where it lives (its project, or Global), and its description. */
function RuleCard({ rule }: { rule: Rule }) {
  const { status } = useStatus()
  const where = rule.project === null ? 'Global' : (status?.projects.find((p) => p.dir === rule.project)?.name ?? 'Project')
  return (
    <Card className="flex flex-col gap-2 p-4 h-full border border-trim hover:bg-hover-1 cursor-pointer">
      <div className="flex flex-row justify-between items-center gap-2">
        <span className="font-medium truncate" title={rule.name}>
          {rule.name}
        </span>
        <span className="text-xs text-text-muted uppercase tracking-wider shrink-0 truncate max-w-1/2" title={where}>
          {where}
        </span>
      </div>
      <p className="text-sm text-text-muted line-clamp-3">{rule.description}</p>
    </Card>
  )
}
