import { useState, type ReactNode } from 'react'
import type { EndeavorActivity, EndeavorStatus, ProjectRef, RunStats } from '../../../shared/api-types'
import { ENDEAVOR_COLORS, STAGE_STYLES, activityStyle, progressWithChildren, rollUpProgress } from '../../components/status-pill'
import { Endeavor } from '../../components/endeavor/endeavor'
import { EndeavorMapHeader } from '../../components/endeavor/endeavor-map-header'
import { ExplorerNav } from '../../components/nav/explorer-nav'
import type { TreeMapNode } from '../../components/tree-map/tree-map'
import { ancestry, endeavorPath, parentId } from '../../lib/endeavor-path'
import { projectPath } from '../../lib/projects'
import { WorkPane } from './work-pane'

// TEMPORARY: sample data for designing the endeavor card, one entry per situation it has to
// show. Delete once endeavors are read from the project.

type Sample = {
  label: string
  activity: EndeavorActivity
  body: ReactNode
  /** A bare label gets the sample colouring below; an object sets its own CSS colour. */
  actions: (string | { label: string; color: string })[]
  placeholder?: string
  run?: RunStats
}

const run: RunStats = { calls: 14, contextTokens: 48_200, costUsd: 0.41, turns: 14, maxTurns: 30 }

function Turn({ who, children }: { who: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 pb-3">
      <div className="text-sm font-semibold">{who}</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function Line({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <div className={`text-sm py-1 ${muted ? 'text-text-muted' : ''}`}>{children}</div>
}

const dialogue = (
  <>
    <Turn who="Brennan">Refunds should go back to the original card, and partial refunds need to be supported.</Turn>
    <Turn who="Claude">
      Stripe's Refund API handles both. The open question is where the ledger entry is written: in the webhook handler, or
      when we call the API?
    </Turn>
  </>
)

const samples: Sample[] = [
  {
    label: 'Actions demo (3 colours)',
    activity: { stage: 'dialogue', state: 'discussing', acting: false },
    body: dialogue,
    actions: [
      { label: 'Finalize', color: 'mediumseagreen' },
      { label: 'Split into sections', color: 'gold' },
      { label: 'Discard', color: 'tomato' },
    ],
  },
  {
    label: 'Solved, idle',
    activity: { stage: null, state: 'solved', acting: false },
    body: (
      <>
        <Line>Refund a charge in full or in part, back to the card it was paid with.</Line>
        <Line muted>Answer: call Stripe's Refund API from the dashboard; write the ledger entry from the webhook.</Line>
      </>
    ),
    actions: ['Plan build'],
    placeholder: 'Write to reopen the Dialogue',
  },
  {
    label: 'Dialogue, acting',
    activity: { stage: 'dialogue', state: 'discussing', acting: true },
    body: dialogue,
    actions: ['Stop'],
    run,
  },
  {
    label: 'Dialogue, your turn',
    activity: { stage: 'dialogue', state: 'discussing', acting: false },
    body: dialogue,
    actions: ['Finalize'],
  },
  {
    label: 'Scoping, plan submitted',
    activity: { stage: 'scoping', state: 'solved', acting: false },
    body: (
      <>
        <Line>Task 1: Refund API, ledger entries</Line>
        <Line>Task 2: Refund emails</Line>
        <Line>Task 3: Refund dialog</Line>
      </>
    ),
    actions: ['Build plan'],
    placeholder: 'Feedback on the plan',
  },
  {
    label: 'Building, acting',
    activity: { stage: 'building', state: 'solved', acting: true },
    body: (
      <>
        <Line muted>Read src/billing/refunds.ts</Line>
        <Line muted>Edit src/billing/refunds.ts</Line>
        <Line muted>Ran pnpm test billing</Line>
      </>
    ),
    actions: ['Stop'],
    run: { ...run, turns: 52, maxTurns: 100, calls: 52, contextTokens: 91_400, costUsd: 1.87 },
  },
  {
    label: 'Building, escalated',
    activity: { stage: 'building', state: 'solved', acting: false },
    body: <Line>The rule "no-direct-db" failed 3 times on Task 1.</Line>,
    actions: ['Override', 'Change rule'],
  },
  {
    label: 'Reviewing, acting',
    activity: { stage: 'reviewing', state: 'solved', acting: true },
    body: (
      <>
        <Line>✓ typecheck</Line>
        <Line>✓ lint</Line>
        <Line muted>… api-contract</Line>
      </>
    ),
    actions: ['Stop'],
    run: { ...run, turns: 9, maxTurns: 50, calls: 9, contextTokens: 22_000, costUsd: 0.18 },
  },
  {
    label: 'Publishing, confirm step',
    activity: { stage: 'publishing', state: 'built', acting: false },
    body: (
      <>
        <Line>✓ Push complete to origin</Line>
        <Line>Confirm: deploy to production?</Line>
      </>
    ),
    actions: ['Continue', 'Abort'],
  },
]

type SampleNode = { title: string; summary: string; activity: EndeavorActivity }

const idle = (state: EndeavorActivity['state']): EndeavorActivity => ({ stage: null, state, acting: false })

/**
 * A small endeavor tree keyed by ID. Parents, children, child counts and the explorer path are
 * all worked out from the IDs, the same way they will be for real endeavors.
 */
const sampleTree: Record<string, SampleNode> = {
  checkout: { title: 'Checkout', summary: 'Everything between the cart and the receipt.', activity: idle('sectioned') },
  'checkout.4f1a2': { title: 'Stripe backend update', summary: 'Move payments onto the current Stripe API.', activity: idle('sectioned') },
  'checkout.4f1a2.0c93e': { title: 'Webhook router', summary: 'One endpoint that routes each Stripe event to its handler.', activity: idle('sectioned') },
  'checkout.4f1a2.b7d05': { title: 'Refunds', summary: 'Refund a charge in full or in part, back to the card it was paid with.', activity: idle('sectioned') },
  'checkout.4f1a2.b7d05.3e9a1': {
    title: 'Refund API',
    summary: 'Call Stripe to refund a charge in full or in part, and record who asked for it.',
    activity: { stage: 'building', state: 'solved', acting: true },
  },
  'checkout.4f1a2.b7d05.6c2f0': {
    title: 'Refund dialog',
    summary: 'The dashboard dialog where support picks an amount and a reason.',
    activity: { stage: 'dialogue', state: 'discussing', acting: false },
  },
  'checkout.4f1a2.b7d05.6c2f0.1a2b3': { title: 'Amount picker', summary: 'Full or partial, capped at what is left to refund.', activity: idle('built') },
  'checkout.4f1a2.b7d05.6c2f0.4d5e6': { title: 'Reason codes', summary: 'The reasons support can pick from.', activity: idle('open') },
  'checkout.4f1a2.b7d05.6c2f0.7f8a9': { title: 'Confirmation', summary: 'What support sees after the refund is sent.', activity: idle('open') },
  'checkout.4f1a2.b7d05.9d4b8': {
    title: 'Ledger entries',
    summary: 'Write a ledger entry for each refund from the webhook, never from the API call.',
    activity: idle('built'),
  },
  'checkout.4f1a2.b7d05.c1e7a': {
    title: 'Refund emails',
    summary: 'Tell the customer when a refund is issued and when it lands on their card.',
    activity: idle('open'),
  },
  'checkout.e81d4': { title: 'Saved cards', summary: 'Let customers keep a card on file.', activity: idle('open') },
}

/** The endeavor the sample pane opens on when the URL names none (or an unknown one). */
export const SAMPLE_DEFAULT_ID = 'checkout.4f1a2.b7d05'

export function isSampleId(id: string | undefined): id is string {
  return id !== undefined && id in sampleTree
}

/**
 * TEMPORARY: generated filler endeavors, shown only in the tree map (no links), so the map has
 * a tree big enough to scrub. Seeded, so the same filler appears on every load. Like real
 * endeavors, only leaves can be Built (about half are, so whole subtrees finish and go green);
 * a node that gets children is Split (`sectioned`).
 */
const mapFiller: (SampleNode & { id: string; parentId: string })[] = (() => {
  const words = ['Tax', 'Invoices', 'Coupons', 'Receipts', 'Fraud checks', 'Currency', 'Retries', 'Audit log', 'Payouts',
    'Disputes', 'Wallets', 'Tips', 'Limits', 'Exports', 'Alerts', 'Pricing', 'Bundles', 'Trials', 'Dunning', 'Reports']
  const stages = Object.keys(STAGE_STYLES) as (keyof typeof STAGE_STYLES)[]
  const waiting: EndeavorActivity['state'][] = ['open', 'discussing', 'solved', 'reopened', 'stale']
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!
  // A leaf: half built, the rest waiting, some mid-stage (half of those with an agent running)
  const leaf = (): EndeavorActivity => {
    if (rand() < 0.5) return idle('built')
    const stage = rand() < 0.4 ? pick(stages) : null
    return { stage, state: pick(waiting), acting: stage !== null && rand() < 0.5 }
  }
  const out: (SampleNode & { id: string; parentId: string })[] = []
  const grow = (parent: string, depth: number) => {
    const count = depth === 0 ? 6 : Math.floor(rand() * (depth > 2 ? 3 : 6))
    for (let i = 0; i < count; i++) {
      const id = `${parent}.f${depth}${i}`
      const node = { id, parentId: parent, title: pick(words), summary: '', activity: leaf() }
      out.push(node)
      const before = out.length
      if (depth < 4) grow(id, depth + 1)
      if (out.length > before) node.activity = idle('sectioned')
    }
  }
  grow('checkout.e81d4', 0)
  grow('checkout.4f1a2.0c93e', 1)
  return out
})()

/** Every node, sample and filler, flat; the shape real endeavors will be read into. */
const allNodes = [
  ...Object.entries(sampleTree).map(([id, node]) => ({ id, parentId: parentId(id), ...node })),
  ...mapFiller,
]

/** Each node's progress with its subtree counted, so a parent is complete once all its children are. */
const progress = rollUpProgress(allNodes)

/** The sample endeavors directly under `id`, for its child cards. */
const childIds = (id: string) => Object.keys(sampleTree).filter((other) => parentId(other) === id)

/** Complete children out of all children (filler included). */
function childCount(id: string) {
  const children = allNodes.filter((node) => node.parentId === id)
  return { complete: children.filter((child) => progress.get(child.id) === 'complete').length, total: children.length }
}

type SampleWorkPaneProps = { project: ProjectRef; status: EndeavorStatus; id: string }

/**
 * TEMPORARY: the work pane for one endeavor of the sample tree. The main card's stage comes
 * from the floating sample picker, so every situation can be tried on any endeavor.
 */
export function SampleWorkPane({ project, status, id }: SampleWorkPaneProps) {
  const [index, setIndex] = useState(0)
  const [queued, setQueued] = useState<string[]>([])
  const [sent, setSent] = useState<string[]>([])
  const sample = samples[index] ?? samples[0]!
  const node = sampleTree[id]!
  const parent = parentId(id)
  const link = (target: string) => endeavorPath(project, status, target)

  const pick = (next: number) => {
    setIndex(next)
    setQueued([])
    setSent([])
  }

  const onSend = (text: string) => (sample.activity.acting ? setQueued((q) => [...q, text]) : setSent((s) => [...s, text]))

  const levels = [
    { name: project.name, link: projectPath(project) },
    ...ancestry(id).map((target) => ({ name: sampleTree[target]?.title ?? target, link: link(target) })),
  ]

  const mapNodes: TreeMapNode[] = allNodes.map((node) => {
    const nodeProgress = progress.get(node.id)!
    return {
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      link: node.id in sampleTree ? link(node.id) : undefined,
      // Green climbs the tree: a line turns green once everything below it is complete
      lineColor: nodeProgress === 'complete' ? ENDEAVOR_COLORS.complete : undefined,
      content: <Endeavor mode="chip" title={node.title} activity={node.activity} progress={nodeProgress} childCount={childCount(node.id)} />,
    }
  })

  return (
    <>
      <ExplorerNav
        levels={levels}
        map={{
          nodes: mapNodes,
          currentId: id,
          header: (
            <EndeavorMapHeader
              title={sampleTree[ancestry(id)[0]!]?.title ?? ''}
              progress={[...progress.values()]}
            />
          ),
        }}
      />
      <select
        value={index}
        onChange={(e) => pick(Number(e.target.value))}
        className="fixed bottom-4 right-4 z-30 rounded-md border border-trim bg-background px-2 py-1 text-sm shadow"
        title="Sample situation (temporary)"
      >
        {samples.map((s, i) => (
          <option key={s.label} value={i}>
            {s.label}
          </option>
        ))}
      </select>
      <WorkPane
        main={
          <Endeavor
            mode="full"
            heroId={id}
            title={node.title}
            childCount={childCount(id)}
            parent={parent ? { title: sampleTree[parent]?.title ?? parent, link: link(parent) } : undefined}
            activity={sample.activity}
            progress={progressWithChildren(
              sample.activity,
              allNodes.filter((other) => other.parentId === id).map((child) => progress.get(child.id)!),
            )}
            actions={sample.actions.map((action) =>
              typeof action === 'string'
                ? {
                    label: action,
                    // Sample colouring: stopping actions muted, the rest in the stage's colour
                    color: action === 'Stop' || action === 'Abort' ? 'var(--color-text-muted)' : activityStyle(sample.activity).color,
                    onClick: () => {},
                  }
                : { ...action, onClick: () => {} },
            )}
            queued={queued}
            onSend={onSend}
            placeholder={sample.placeholder}
            run={sample.run}
          >
            {sample.body}
            {sent.map((text, i) => (
              <Turn key={i} who="Brennan">
                {text}
              </Turn>
            ))}
          </Endeavor>
        }
      >
        {childIds(id).map((child) => {
          const { title, summary, activity } = sampleTree[child]!
          return (
            <Endeavor
              key={child}
              mode="card"
              heroId={child}
              title={title}
              summary={summary}
              activity={activity}
              progress={progress.get(child)}
              childCount={childCount(child)}
              link={link(child)}
            />
          )
        })}
      </WorkPane>
    </>
  )
}
