import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftToLine, ChevronRight, ListChecks, ListStart } from 'lucide-react'
import { Card } from '@ui'
import type { EndeavorActivity, RunStats } from '../../../shared/api-types'
import { Actions, type ActionItem } from '../actions'
import { PROGRESS_COLORS, StatusPill, describeActivity, type Progress, activityProgress, activityStyle } from '../status-pill'

/**
 * How much of an endeavor to show:
 * - `full`: the one being worked on. Header, body, actions, input and run figures.
 * - `card`: one of its children. The header and summary; opens `link` when clicked.
 * - `chip`: a one-line pill for dense views like the tree map. Coloured by its progress, with
 *   the icon of its stage (or node state) beside the title.
 */
export type EndeavorMode = 'full' | 'card' | 'chip'

type EndeavorProps = {
  mode: EndeavorMode
  title: string
  activity: EndeavorActivity
  /**
   * Its progress with its children counted (`rollUpProgress` / `progressWithChildren`), for the
   * outline. Omit to read it from `activity` alone, which is right for a leaf.
   */
  progress?: Progress
  /** How many of its children are complete, out of how many (a chip puts it in its hover text). Omit, or total 0, for a leaf. */
  childCount?: { complete: number; total: number }
  /** Full only: where the parent arrow goes; omit for a root endeavor. */
  parent?: { title: string; link: string }
  /** Full only: what the endeavor is showing now (its file, the Dialogue, the plan, the build...). */
  children?: ReactNode
  /** Full only: the stage's actions, shown as a slash-separated row above the input. */
  actions?: ActionItem[]
  /** Full only: messages sent while the agent was acting, waiting to go once it finishes. */
  queued?: string[]
  /** Full only: called with the trimmed text. Always allowed; while the agent acts, the caller queues it. */
  onSend?: (text: string) => void
  placeholder?: string
  /** Full only: figures for the agent that's running, shown on a muted line under the input. */
  run?: RunStats
  /** Card only: the first sentence of its explanation, as the parent lists it. */
  summary?: string
  /** Card only: where clicking the card goes. (A chip leaves clicking to whatever holds it.) */
  link?: string
  /**
   * Full and card: the endeavor's ID, which names it for the hero animation. Clicking a child
   * card morphs that card into the main one (and the parent arrow morphs it back), because the
   * card and the main view of the same endeavor share a `view-transition-name`.
   */
  heroId?: string
}

/** The hero animation's name for an endeavor: a CSS ident, so the ID's dots become dashes. */
function heroStyle(heroId?: string): CSSProperties {
  return heroId ? ({ viewTransitionName: `endeavor-${heroId.replace(/[^a-zA-Z0-9_-]/g, '-')}` } as CSSProperties) : {}
}

/**
 * An endeavor at any of three sizes (`mode`), so every view of one reads the same colours and
 * icons. Full and card share the header (title, child count, status pill), the gradient fading
 * from the pill's colour at the top right, and the border showing its progress: yellow while an
 * agent works, green once complete, red otherwise. A chip uses that same progress colour for its
 * outline and fill, and the stage's icon in place of the pill. Only `full` has a body (filling
 * the space and scrolling), the stage's actions, the message input and the running agent's
 * figures; the caller decides what goes in them for each stage.
 *
 * @example
 * ```tsx
 * <Endeavor mode="full" title="Refunds" activity={activity} actions={[{ label: 'Finalize', onClick: finalize }]} onSend={send}>
 *   <DialogueTurns turns={turns} />
 * </Endeavor>
 * <Endeavor mode="card" title="Refund emails" activity={childActivity} summary="..." link="/..." />
 * <Endeavor mode="chip" title="Refund emails" activity={childActivity} />
 * ```
 */
export function Endeavor(props: EndeavorProps) {
  const { mode, title, activity, progress: givenProgress, childCount, parent, children, actions, queued, onSend, placeholder, run, summary, link, heroId } = props
  const pillColor = activityStyle(activity).color
  const progress = givenProgress ?? activityProgress(activity)
  const progressColor = PROGRESS_COLORS[progress]

  if (mode === 'chip') return <EndeavorChip title={title} activity={activity} progress={progress} childCount={childCount} />

  const isActive = mode === 'full'

  const header = (
    <div
      // A child card sits in a narrow column, so its count and pill wrap under the title when the title needs the room
      className={`flex flex-row items-center justify-between px-4 py-3 ${isActive ? 'gap-4 border-b border-trim' : 'flex-wrap gap-x-4 gap-y-1'}`}
      style={{ background: `linear-gradient(to bottom left, ${pillColor}55, var(--color-surface) 70%)` }}
    >
      <div className={`flex flex-row items-center gap-2 ${isActive ? 'min-w-0' : 'max-w-full'}`}>
        {isActive &&
          (parent ? (
            <Link to={parent.link} viewTransition title={`Parent: ${parent.title}`} className="shrink-0 rounded-md p-1 hover:bg-hover-1 transition-colors">
              <ArrowLeftToLine className="h-5 w-5" />
            </Link>
          ) : (
            <span title="Root Endeavor" className="shrink-0 p-1">
              <ListStart className="h-5 w-5" />
            </span>
          ))}
        <h2 className={`font-semibold ${isActive ? 'text-lg truncate' : 'text-base break-words'}`}>{title}</h2>
      </div>
      <div className="shrink-0 flex flex-row items-center gap-3">
        <ChildCount count={childCount} />
        <StatusPill activity={activity} />
      </div>
    </div>
  )

  const cardStyle = { borderColor: progressColor, ...heroStyle(heroId) }

  if (!isActive) {
    const card = (
      <Card className="endeavor-hero flex flex-col shrink-0 overflow-hidden border-2 border-transparent transition-colors hover:brightness-110" style={cardStyle}>
        {header}
        {/* Padding on the wrapper: line-clamp clips at the padding edge, so padding on the <p> would show the next line */}
        {summary && (
          <div className="px-4 pb-3">
            <p className="text-sm text-text-muted line-clamp-2">{summary}</p>
          </div>
        )}
      </Card>
    )
    return link ? (
      <Link to={link} viewTransition className="block shrink-0">
        {card}
      </Link>
    ) : (
      card
    )
  }

  return (
    <Card className="endeavor-hero flex flex-col h-full min-h-0 overflow-hidden border-2 border-transparent transition-colors" style={cardStyle}>
      {header}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">{children}</div>

      <div className="flex flex-col gap-2 px-4 pt-3 pb-2 border-t border-trim">
        {queued && queued.length > 0 && (
          <ul className="flex flex-col gap-1">
            {queued.map((text, idx) => (
              <li key={idx} className="text-sm text-text-muted truncate">
                <span className="font-medium">Queued:</span> {text}
              </li>
            ))}
          </ul>
        )}
        {actions && <Actions actions={actions} className="px-1" />}
        <MessageInput onSend={onSend ?? (() => {})} placeholder={placeholder} />
        <RunLine run={run} />
      </div>
    </Card>
  )
}

/**
 * The chip: outline and a light fill in the progress colour, then the stage's icon in the stage's colour (or the node state's, between stages) and the title. Fills the
 * height of whatever holds it, so a container like the tree map can size it.
 */
function EndeavorChip({ title, activity, progress, childCount }: { title: string; activity: EndeavorActivity; progress: Progress; childCount?: { complete: number; total: number } }) {
  const { color: iconColor, icon: Icon } = activityStyle(activity)
  const color = PROGRESS_COLORS[progress]
  return (
    <span
      title={describeActivity(activity, progress, childCount)}
      className="inline-flex h-full min-h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[13px] transition-colors"
      style={{
        borderColor: color,
        background: `color-mix(in srgb, ${color} 18%, var(--color-background))`,
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} aria-hidden />
      {title}
    </span>
  )
}

/** "2/5" with a checklist icon: complete children out of all children. Nothing for a leaf. */
function ChildCount({ count }: { count?: { complete: number; total: number } }) {
  if (!count || count.total === 0) return null
  return (
    <span className="flex flex-row items-center gap-1 text-sm text-text-muted" title={`${count.complete} of ${count.total} children complete`}>
      <ListChecks className="h-4 w-4" />
      {count.complete}/{count.total}
    </span>
  )
}

/**
 * Full-width message box with the send chevron inset at its right edge. Enter sends,
 * Shift+Enter starts a new line, and the box grows with its text up to a few lines.
 */
function MessageInput({ onSend, placeholder = 'Message' }: { onSend: (text: string) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const canSend = text.trim().length > 0

  const send = () => {
    if (!canSend) return
    onSend(text.trim())
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="relative">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className="block w-full resize-none field-sizing-content max-h-40 rounded-lg border border-trim bg-background py-2 pl-3 pr-11 text-text placeholder-text-muted focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        title="Send"
        className="absolute right-1.5 bottom-1.5 flex h-7 w-7 items-center justify-center rounded-md text-text hover:bg-hover-1 disabled:text-text-muted disabled:hover:bg-transparent transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

const tokens = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const dollars = new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

/** The running agent's figures, or nothing between runs. Keeps its height so the card doesn't jump. */
function RunLine({ run }: { run?: RunStats }) {
  return (
    <div className="h-4 text-xs text-text-muted">
      {run && (
        <>
          {tokens.format(run.contextTokens)} context · {dollars.format(run.costUsd)} · {run.turns}/{run.maxTurns} turns · {run.calls} calls
        </>
      )}
    </div>
  )
}
