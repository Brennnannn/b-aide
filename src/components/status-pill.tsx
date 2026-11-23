import { Check, Hammer, LoaderCircle, MessageCircle, PenLine, Send, Summary, type LucideIcon } from 'lucide-react'
import { TagFull } from '@ui'
import type { EndeavorActivity, EndeavorStage, NodeState } from '../../shared/api-types'

/**
 * The endeavor palette, locked to Tailwind 500/600 shades. The stages walk backwards round the
 * colour wheel in the order an endeavor goes through them (pink, purple, blue, sky, teal) and
 * land on green when it's complete. Hex, because `TagFull` tints its background from the hex.
 */
export const ENDEAVOR_COLORS = {
  dialogue: '#ec4899', // pink-500
  scoping: '#a855f7', // purple-500
  building: '#2563eb', // blue-600
  reviewing: '#38bdf8', // sky-400
  publishing: '#14b8a6', // teal-500
  complete: '#22c55e', // green-500
  idle: '#6b7280', // gray-500
} as const

/** `label` is what the pill says ("Building"); `name` is the stage or state as a noun ("Build"), for sentences. */
type ActivityStyle = { label: string; name: string; color: string; icon: LucideIcon }

/** Every stage's label, colour and icon, in one place: anything that shows a stage reads it from here. */
export const STAGE_STYLES: Record<EndeavorStage, ActivityStyle> = {
  dialogue: { label: 'Dialoguing', name: 'Dialogue', color: ENDEAVOR_COLORS.dialogue, icon: MessageCircle },
  scoping: { label: 'Scoping', name: 'Scope', color: ENDEAVOR_COLORS.scoping, icon: Summary },
  building: { label: 'Building', name: 'Build', color: ENDEAVOR_COLORS.building, icon: Hammer },
  reviewing: { label: 'Reviewing', name: 'Review', color: ENDEAVOR_COLORS.reviewing, icon: PenLine },
  publishing: { label: 'Publishing', name: 'Publish', color: ENDEAVOR_COLORS.publishing, icon: Send },
}

/**
 * Node states, shown when no stage is under way. Grey, except Built, which is complete and so
 * green with a check. The rest borrow the icon of the stage they're waiting on: Solved is ready
 * to scope; every other state still has Dialogue to do (a leaf or a splitting branch alike).
 */
export const STATE_STYLES: Record<NodeState, ActivityStyle> = {
  open: { label: 'Open', name: 'Open', color: ENDEAVOR_COLORS.idle, icon: MessageCircle },
  sectioned: { label: 'Sectioned', name: 'Sectioned', color: ENDEAVOR_COLORS.idle, icon: MessageCircle },
  discussing: { label: 'Discussing', name: 'Discussing', color: ENDEAVOR_COLORS.idle, icon: MessageCircle },
  solved: { label: 'Solved', name: 'Solved', color: ENDEAVOR_COLORS.idle, icon: Summary },
  reopened: { label: 'Reopened', name: 'Reopened', color: ENDEAVOR_COLORS.idle, icon: MessageCircle },
  built: { label: 'Built', name: 'Built', color: ENDEAVOR_COLORS.complete, icon: Check },
  stale: { label: 'Stale', name: 'Stale', color: ENDEAVOR_COLORS.idle, icon: MessageCircle },
}

/**
 * How far along the endeavor is, for the outline around it. Only three colours ever outline an
 * endeavor: `working` (yellow) while an agent runs, `complete` (green) once it's built and no
 * stage is under way, and `needs-work` (red) for everything else, so a freshly opened node
 * starts red.
 */
export type Progress = 'complete' | 'working' | 'needs-work'

export const PROGRESS_COLORS: Record<Progress, string> = {
  complete: ENDEAVOR_COLORS.complete,
  working: '#eab308', // Tailwind yellow-500
  'needs-work': '#dc2626', // Tailwind red-600
}

/** How a progress reads in a sentence: "Build is working". */
export const PROGRESS_LABELS: Record<Progress, string> = {
  complete: 'complete',
  working: 'working',
  'needs-work': 'awaiting input',
}

export function activityProgress({ stage, state, acting }: EndeavorActivity): Progress {
  if (acting) return 'working'
  return !stage && state === 'built' ? 'complete' : 'needs-work'
}

/**
 * A node's progress once its children are counted. Only a leaf can be Built, so a parent is
 * never complete by its own state: it's complete exactly when every child is. Until then it
 * reads its own activity (working while an agent runs on it, otherwise needing work). A leaf
 * (no children) is just its own activity.
 *
 * @example
 * ```ts
 * progressWithChildren(idle('sectioned'), ['complete', 'complete']) // 'complete'
 * progressWithChildren(idle('sectioned'), ['complete', 'working']) // 'needs-work'
 * ```
 */
export function progressWithChildren(activity: EndeavorActivity, children: Progress[]): Progress {
  if (children.length > 0 && children.every((child) => child === 'complete')) return 'complete'
  return children.length > 0 && !activity.acting ? 'needs-work' : activityProgress(activity)
}

/**
 * Every node's progress in a flat tree, worked out from the leaves up with
 * `progressWithChildren`, so green climbs towards the root as subtrees finish.
 *
 * @example
 * ```ts
 * const progress = rollUpProgress(nodes) // Map of id -> Progress
 * ```
 */
export function rollUpProgress(nodes: { id: string; parentId: string | null; activity: EndeavorActivity }[]) {
  const children = new Map<string, string[]>()
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id])
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const progress = new Map<string, Progress>()
  const visit = (id: string): Progress => {
    const known = progress.get(id)
    if (known) return known
    const result = progressWithChildren(byId.get(id)!.activity, (children.get(id) ?? []).map(visit))
    progress.set(id, result)
    return result
  }
  for (const node of nodes) visit(node.id)
  return progress
}

/** The label, colour and icon shown for an endeavor's activity: its stage if one is under way, else its node state. */
export function activityStyle({ stage, state }: Pick<EndeavorActivity, 'stage' | 'state'>): ActivityStyle {
  return stage ? STAGE_STYLES[stage] : STATE_STYLES[state]
}

/**
 * An endeavor's status pill: its stage if one is under way, otherwise its node state, with a
 * spinning loader while an agent is acting.
 *
 * @param {EndeavorActivity} activity - The stage, node state, and whether an agent is running
 *
 * @example
 * ```tsx
 * <StatusPill activity={{ stage: 'building', state: 'solved', acting: true }} />
 * ```
 */
export function StatusPill({ activity }: { activity: EndeavorActivity }) {
  const { label, color } = activityStyle(activity)
  return (
    <TagFull text={label} color={color}>
      {activity.acting && <LoaderCircle className="ml-1.5 h-3.5 w-3.5 animate-spin" aria-label="Working" />}
    </TagFull>
  )
}
