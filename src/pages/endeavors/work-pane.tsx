import type { ReactNode } from 'react'

/**
 * The work area beside the endeavor sidebar: the current endeavor across two thirds, its
 * immediate children in a column across the last third. Stacks below `lg`.
 *
 * @param {React.ReactNode} main - The current endeavor (`Endeavor mode="full"`)
 * @param {React.ReactNode} [children] - The child endeavor cards
 */
export function WorkPane({ main, children }: { main: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0 p-4">
      <div className="lg:basis-2/3 min-w-0 min-h-[24rem] lg:min-h-0 flex-1 lg:flex-none">{main}</div>
      <div className="lg:basis-1/3 min-w-0 flex flex-col gap-3 lg:overflow-y-auto">{children}</div>
    </div>
  )
}
