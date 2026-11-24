import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraphStar } from 'lucide-react'
import { ExplorerHeader, type PathItem } from '@ui'
import { TreeMapOverlay, type TreeMapNode } from '../tree-map/tree-map'
import { NavCenter } from './nav-center'
import { useKeybind } from '../../lib/settings-context'

/** One level of the explorer path: what it's called and where clicking it goes. */
export type ExplorerLevel = { name: string; link: string }

/** The whole tree the explorer path sits in, for the map toggle beside it. */
export type ExplorerMap = { nodes: TreeMapNode[]; currentId?: string; header?: ReactNode }

/**
 * Chains `levels` (root first) into the `PathItem` linked list `ExplorerHeader` walks, and
 * returns the last one. Every level is built the same way; only the first has no parent.
 *
 * @example
 * ```ts
 * toPathItem([{ name: 'test', link: '/endeavors/test' }, { name: 'Checkout', link: '...' }]).name // 'Checkout'
 * ```
 */
export function toPathItem(levels: ExplorerLevel[]): PathItem<ExplorerLevel> | null {
  return levels.reduce<PathItem<ExplorerLevel> | null>(
    (parent, level) => ({ name: level.name, meta: level, parent: parent ?? undefined }),
    null,
  )
}

/**
 * The Windows-Explorer-style path in the middle of the nav bar: the first level is the Home
 * icon, then each level down to the current one, each linking to its own page. Render it from
 * any page; it portals into the nav bar's center slot. Given a `map`, a toggle to its left (or
 * Ctrl+M) opens and closes the whole tree as an overlay; Escape or the overlay's own X closes it
 * too. The toggle keeps its map icon while open, so the overlay's X is the only one on screen. The overlay renders where
 * `ExplorerNav` is rendered, not in the nav bar, so it covers the page's pane: put
 * `ExplorerNav` inside the pane, and give that pane `relative`.
 *
 * @param {ExplorerLevel[]} levels - Root first, current page last
 * @param {ExplorerMap} [map] - Every node of the tree, for the map overlay
 *
 * @example
 * ```tsx
 * <ExplorerNav levels={[{ name: project.name, link: projectPath(project) }, ...endeavorLevels]} map={{ nodes, currentId }} />
 * ```
 */
export function ExplorerNav({ levels, map }: { levels: ExplorerLevel[]; map?: ExplorerMap }) {
  const navigate = useNavigate()
  const [mapOpen, setMapOpen] = useState(false)
  const path = toPathItem(levels)
  const hasMap = map !== undefined

  // Ctrl+M by default (Settings > Keybinds). Electron's default menu binds it to Minimize, so
  // `electron/main.ts` sets a menu without that accelerator.
  useKeybind('toggleMap', () => setMapOpen((open) => !open), hasMap)

  if (!path) return null

  return (
    <>
      <NavCenter>
        <div className="hidden md:flex items-center gap-3 min-w-0">
          {map && (
            <button
              type="button"
              onClick={() => setMapOpen((open) => !open)}
              title={mapOpen ? 'Close map (Ctrl+M)' : 'Map of the tree (Ctrl+M)'}
              className={`shrink-0 cursor-pointer hover:text-primary transition-colors ${mapOpen ? 'text-primary' : 'text-text-muted'}`}
            >
              <GraphStar className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <ExplorerHeader path={path} setPath={(item) => item.meta && navigate(item.meta.link)} />
          </div>
        </div>
      </NavCenter>
      {map && mapOpen && (
        <TreeMapOverlay {...map} onClose={() => setMapOpen(false)} onNavigate={navigate} />
      )}
    </>
  )
}
