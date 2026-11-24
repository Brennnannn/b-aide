import type { SelectOption } from '@ui'
import type { RuleTab } from './rules-nav'

/** Project rules live in a project's `b-aide/rules/`; global rules in `~/.b-aide/rules/`, for every project. */
export type RuleScope = 'project' | 'global'

/** Mechanical rules are steps code runs; agentic rules are instructions an agent reads or carries out. */
export type RuleKind = 'mechanical' | 'agentic'

export type RuleModel = 'fable' | 'opus' | 'sonnet' | 'haiku'
export type RuleEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/**
 * One step of a mechanical rule. `run` is a command under the command contract (exit 0 passes);
 * `confirm` pauses with its text until you press Continue, and only a Publish procedure has those.
 */
export type RuleStepType = 'run' | 'confirm'
export type RuleStep = { type: RuleStepType; text: string }

/**
 * A rule as the UI holds it. `project` is the project's folder, or `null` for a global rule.
 * `instructions`, `model` and `effort` apply to agentic rules; `steps` to mechanical ones.
 */
export type Rule = {
  type: RuleTab
  name: string
  description: string
  project: string | null
  kind: RuleKind
  model: RuleModel
  effort: RuleEffort
  instructions: string
  steps: RuleStep[]
}

/** The rule form's fields: `projectRule` is the checkbox, and `project` is blank for a global rule. */
export type RuleForm = Omit<Rule, 'project'> & { projectRule: boolean; project: string }

export const MODEL_OPTIONS: SelectOption[] = [
  { label: 'Fable', value: 'fable' },
  { label: 'Opus', value: 'opus' },
  { label: 'Sonnet', value: 'sonnet' },
  { label: 'Haiku', value: 'haiku' },
]

export const EFFORT_OPTIONS: SelectOption[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Extra high', value: 'xhigh' },
  { label: 'Max', value: 'max' },
]

export const STEP_TYPE_OPTIONS: Record<RuleStepType, SelectOption> = {
  run: { label: 'Run command', value: 'run' },
  confirm: { label: 'Wait for confirm', value: 'confirm' },
}

export const emptyStep = (): RuleStep => ({ type: 'run', text: '' })

/** Edit and Publish rules are steps code runs, so they start mechanical; the rest start agentic. */
export function defaultKind(type: RuleTab): RuleKind {
  return type === 'edit' || type === 'publish' ? 'mechanical' : 'agentic'
}

/** A blank rule of `type`, in `project` (a folder) or global (`null`). */
export function emptyRule(type: RuleTab, project: string | null): RuleForm {
  return {
    type,
    name: '',
    description: '',
    projectRule: project !== null,
    project: project ?? '',
    kind: defaultKind(type),
    model: 'sonnet',
    effort: 'medium',
    instructions: '',
    steps: [],
  }
}

export function ruleToForm(rule: Rule): RuleForm {
  return { ...rule, projectRule: rule.project !== null, project: rule.project ?? '' }
}

export function formToRule({ projectRule, project, ...rest }: RuleForm): Rule {
  return { ...rest, project: projectRule ? project : null }
}
