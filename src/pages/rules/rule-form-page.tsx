import { Bot, ChevronLeft, Terminal } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Button,
  CheckboxField,
  FormArray,
  FormField,
  FormWrapper,
  Frame,
  SelectField,
  matchesPattern,
  required,
  useArrayFieldPath,
  useFormFull,
  useHeaderBumpCtx,
} from '@ui'
import { useStatus } from '../../lib/status-context'
import {
  EFFORT_OPTIONS,
  MODEL_OPTIONS,
  STEP_TYPE_OPTIONS,
  emptyRule,
  emptyStep,
  formToRule,
  ruleToForm,
  type RuleForm,
  type RuleKind,
  type RuleScope,
  type RuleStepType,
} from './rule'
import { isRuleScope, ruleTabs, type RuleTab } from './rules-nav'
import { useSampleRules } from './sample-rules'

/** A rule's name is its folder name, so it's kebab-case. */
const ruleName = matchesPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes, like color-tokens')

const TYPE_OPTIONS = ruleTabs.map(({ tab, label }) => ({ label, value: tab }))

/**
 * Create a rule (`/rules/new?scope=&type=`): a blank form that starts on the scope and type you
 * came from, with the type picked first. A new project rule starts in the first known project.
 */
export function NewRulePage() {
  const [params] = useSearchParams()
  const { status } = useStatus()
  if (!status) return null

  const scopeParam = params.get('scope') ?? undefined
  const scope: RuleScope = isRuleScope(scopeParam) ? scopeParam : 'project'
  const type = ruleTabs.find((entry) => entry.tab === params.get('type'))?.tab ?? 'shared'
  const project = scope === 'project' ? (status.projects[0]?.dir ?? '') : null

  return <RuleFormView initial={emptyRule(type, project)} back={`/rules/${scope}/${type}`} isNew />
}

/** Edit a rule (`/rules/:scope/:tab/:name`). TEMPORARY: rules come from `useSampleRules`. */
export function EditRulePage() {
  const { scope, tab, name } = useParams()
  const { status } = useStatus()
  const rules = useSampleRules()
  if (!status) return null

  const back = `/rules/${scope}/${tab}`
  const rule = rules.find((r) => r.type === tab && r.name === name && (r.project !== null) === (scope === 'project'))
  if (!rule) return <Navigate to={isRuleScope(scope) ? back : '/rules'} replace />

  return <RuleFormView key={`${scope}/${tab}/${name}`} initial={ruleToForm(rule)} back={back} isNew={false} />
}

type RuleFormViewProps = { initial: RuleForm; back: string; isNew: boolean }

/** The one rule form, for creating and editing. TEMPORARY: Save doesn't write anything yet. */
function RuleFormView({ initial, back, isNew }: RuleFormViewProps) {
  const navigate = useNavigate()
  const headerBump = useHeaderBumpCtx(true)
  // FormWrapper resets whenever `initial` changes identity, so seed it once (edit views are keyed per rule)
  const [seed] = useState<RuleForm>(() => initial)
  const backLabel = `${ruleTabs.find((t) => t.tab === initial.type)?.label} rules`

  const save = (form: RuleForm) => {
    // TEMPORARY: nothing writes rules yet
    console.info('Save rule', formToRule(form))
    navigate(back)
  }

  return (
    <Frame format="cornered-end" className={headerBump}>
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl flex flex-col gap-6">
          <FormWrapper<RuleForm> initial={seed} onSubmit={save} className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <Link to={back} className="flex flex-row items-center gap-1 text-sm text-text-muted hover:text-text w-fit">
                <ChevronLeft className="h-4 w-4" />
                {backLabel}
              </Link>
              <RuleHeading fallback={isNew ? 'New rule' : initial.name} />
            </div>

            <div className="flex flex-row gap-4">
              {isNew && (
                <div className="flex flex-1 min-w-0">
                  <SelectField<RuleForm> fieldName="type" label="Rule type" options={TYPE_OPTIONS} className="p-2" />
                </div>
              )}
              <div className="flex flex-[4] min-w-0">
                <FormField<RuleForm>
                  fieldName="name"
                  label="Name"
                  className="p-2"
                  placeholder="color-tokens"
                  validation={(value) => required(value) ?? ruleName(value)}
                />
              </div>
            </div>
            <FormField<RuleForm>
              fieldName="description"
              label="Description"
              className="p-2"
              info="When the rule applies. Agents read this to decide whether a rule is relevant."
              validation={required}
            />
            <ProjectFields />
            <KindToggle />
            <KindFields />
            <div className="flex flex-row justify-end gap-2">
              <Button onClick={() => navigate(back)}>Cancel</Button>
              <Button type="submit" scheme="primary">
                {isNew ? 'Create rule' : 'Save'}
              </Button>
            </div>
          </FormWrapper>
        </div>
      </div>
    </Frame>
  )
}

/** The page heading: the Name field as you type it, or `fallback` while it's blank. */
function RuleHeading({ fallback }: { fallback: string }) {
  const { form } = useFormFull<RuleForm>()
  return <h1 className="text-2xl font-semibold truncate">{form.name.trim() || fallback}</h1>
}

/** The Project rule checkbox, and the project picker while it's checked; unchecked is a global rule. */
function ProjectFields() {
  const { form } = useFormFull<RuleForm>()
  const { status } = useStatus()
  const options = (status?.projects ?? []).map((p) => ({ label: p.name, value: p.dir }))
  return (
    <div className="flex flex-col gap-3">
      <CheckboxField<RuleForm>
        fieldName="projectRule"
        label="Project rule"
        info="Lives in the project's b-aide/rules/. Unchecked, it's a global rule in ~/.b-aide/rules/, for every project."
      />
      {form.projectRule && (
        <SelectField<RuleForm>
          fieldName="project"
          label="Project"
          options={options}
          placeholder={options.length ? 'Choose a project' : 'No projects yet'}
          className="p-2"
          validation={required}
        />
      )}
    </div>
  )
}

const KINDS: { kind: RuleKind; label: string; hint: string; icon: typeof Bot }[] = [
  { kind: 'mechanical', label: 'Mechanical', hint: 'Steps code runs', icon: Terminal },
  { kind: 'agentic', label: 'Agentic', hint: 'An agent reads or judges', icon: Bot },
]

/** Mechanical or agentic, as a two-way segmented toggle bound to `kind`. */
function KindToggle() {
  const { form, setFormField } = useFormFull<RuleForm>()
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text">Kind</span>
      <div role="radiogroup" aria-label="Kind" className="grid grid-cols-2 p-1 gap-1 rounded-lg border border-trim bg-background">
        {KINDS.map(({ kind, label, hint, icon: Icon }) => {
          const selected = form.kind === kind
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFormField('kind', kind)}
              className={`flex flex-row items-center gap-2 px-3 py-2 rounded-md text-left cursor-pointer ${
                selected ? 'bg-primary text-background dark:text-text' : 'text-text-muted hover:bg-hover-1'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs opacity-80 truncate">{hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** An agentic rule's model, effort and instructions, or a mechanical rule's steps. */
function KindFields() {
  const { form } = useFormFull<RuleForm>()
  if (form.kind === 'mechanical')
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">Steps</span>
        <FormArray<RuleForm['steps'][number]> fieldName="steps" createItem={emptyStep} itemHeader={(i) => `Step ${i + 1}`} addLabel="Add step">
          <StepFields type={form.type} />
        </FormArray>
      </div>
    )

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4">
        <SelectField<RuleForm> fieldName="model" label="Model" options={MODEL_OPTIONS} className="p-2" />
        <SelectField<RuleForm> fieldName="effort" label="Effort" options={EFFORT_OPTIONS} className="p-2" />
      </div>
      <FormField<RuleForm>
        fieldName="instructions"
        type="textarea"
        label="Instructions"
        info="Injected into the agent’s instructions as written."
        placeholder="When an endeavor has UI, settle the layout at phone width…"
        className="p-2 min-h-48"
        validation={required}
      />
    </>
  )
}

/**
 * One step: a command to run, or (Publish only) a pause that waits for you to confirm. A step
 * already set to confirm keeps the option, so switching type away from Publish doesn't hide it.
 */
function StepFields({ type }: { type: RuleTab }) {
  const path = useArrayFieldPath()
  const { getFormField } = useFormFull<Record<string, unknown>>()
  const stepType = getFormField(path('type')) as RuleStepType
  const options =
    type === 'publish' || stepType === 'confirm' ? [STEP_TYPE_OPTIONS.run, STEP_TYPE_OPTIONS.confirm] : [STEP_TYPE_OPTIONS.run]
  const run = stepType === 'run'

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="sm:w-48 sm:flex-none">
        <SelectField fieldName={path('type')} label="Type" options={options} className="p-2" />
      </div>
      <FormField
        fieldName={path('text')}
        label={run ? 'Command' : 'Message'}
        info={run ? 'Run with sh -c from the worktree; exit 0 passes, anything else fails.' : 'Shown until you press Continue.'}
        placeholder={run ? 'pnpm tsc -b' : 'Get the PR approved and merged.'}
        className={`p-2 ${run ? 'font-mono text-sm' : ''}`}
        validation={required}
      />
    </div>
  )
}
