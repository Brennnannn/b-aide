import type { Progress } from '../status-pill'

const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0 })

/**
 * The heading over an endeavor's tree map: the root endeavor's name, then a muted line of how
 * many nodes the tree has, how many have an agent or script running right now, and how many
 * are complete. Pass it as the map's `header`.
 *
 * @example
 * ```tsx
 * <EndeavorMapHeader title="Checkout" progress={[...rollUpProgress(nodes).values()]} />
 * ```
 */
export function EndeavorMapHeader({ title, progress }: { title: string; progress: Progress[] }) {
  const total = progress.length
  const share = (which: Progress) => percent.format(total ? progress.filter((p) => p === which).length / total : 0)

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="text-sm text-text-muted">
        {total} nodes / {share('working')} working / {share('complete')} complete
      </div>
    </div>
  )
}
