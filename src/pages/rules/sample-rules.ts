import { useStatus } from '../../lib/status-context'
import type { Rule, RuleStep } from './rule'

const agentic = { kind: 'agentic', model: 'sonnet', effort: 'medium', steps: [] as RuleStep[] } as const
const mechanical = { kind: 'mechanical', model: 'sonnet', effort: 'medium', instructions: '' } as const

/** `PROJECT` stands in for the first known project's folder; `null` is a global rule. */
const PROJECT = '<project>'

const SAMPLE_RULES: Rule[] = [
  {
    type: 'shared',
    name: 'house-style',
    description: 'Naming, file layout and comment conventions every agent should follow.',
    project: PROJECT,
    ...agentic,
    instructions: 'Files are kebab-case. Components are PascalCase. Every exported function gets a doc comment.',
  },
  {
    type: 'dialogue',
    name: 'ui-design',
    description: 'Designing anything with a user interface: settle phone and desktop layouts, name the @ui components used.',
    project: PROJECT,
    ...agentic,
    instructions:
      'When an endeavor has UI, settle the layout at phone width as well as desktop before writing the Answer. Name the existing @ui components it will use.',
  },
  {
    type: 'dialogue',
    name: 'my-style',
    description: 'How I like designs worked out: short questions, one decision at a time.',
    project: null,
    ...agentic,
    instructions: 'Ask one question at a time. Recommend an answer with each question.',
  },
  {
    type: 'scope',
    name: 'ui-reuse',
    description: 'Where existing components live and when to reuse rather than build.',
    project: PROJECT,
    ...agentic,
    instructions: 'Shared components live in src/ui. Reuse one before writing a new one.',
  },
  {
    type: 'build',
    name: 'ui',
    description: 'Building or changing React pages and components, and checking them in a browser.',
    project: PROJECT,
    ...agentic,
    instructions: "The dev server's port is in $PORT. Check each changed page at 375px and 1280px wide.",
  },
  {
    type: 'edit',
    name: 'color-tokens',
    description: 'Colors come from theme tokens, never raw hex or Tailwind palette classes.',
    project: PROJECT,
    ...mechanical,
    steps: [{ type: 'run', text: 'node b-aide/rules/edit/color-tokens/check.mjs' }],
  },
  {
    type: 'review',
    name: 'typecheck',
    description: 'The project typechecks with tsc -b.',
    project: PROJECT,
    ...mechanical,
    steps: [{ type: 'run', text: 'pnpm tsc -b' }],
  },
  {
    type: 'review',
    name: 'ui-check',
    description: 'Changed pages look right at 375px and 1280px wide.',
    project: PROJECT,
    kind: 'agentic',
    model: 'opus',
    effort: 'high',
    instructions: 'Open each changed page at 375px and 1280px wide and check it against the Answer.',
    steps: [],
  },
  {
    type: 'publish',
    name: 'feature',
    description: 'A new feature, shipped through dev to prod.',
    project: PROJECT,
    ...mechanical,
    steps: [
      { type: 'run', text: 'git push origin HEAD:dev' },
      { type: 'run', text: 'gh pr create --base prod --head dev --title "$B_AIDE_TITLE" --body "$B_AIDE_SUMMARY"' },
      { type: 'confirm', text: 'Get the PR approved and merged.' },
      { type: 'run', text: 'git fetch origin && git merge --no-ff origin/prod' },
    ],
  },
]

/**
 * TEMPORARY: placeholder rules until they're read from each project's `b-aide/rules/` and
 * `~/.b-aide/rules/`. Project rules are placed in the first known project, and dropped when
 * there is none.
 */
export function useSampleRules(): Rule[] {
  const { status } = useStatus()
  const first = status?.projects[0]?.dir
  return SAMPLE_RULES.flatMap((rule) =>
    rule.project === PROJECT ? (first ? [{ ...rule, project: first }] : []) : [rule],
  )
}
