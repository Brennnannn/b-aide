import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** The DOM node of the nav bar's center slot, or `null` before it mounts. */
export const NavCenterTargetContext = createContext<HTMLElement | null>(null)

/**
 * Renders its children into the middle of the nav bar. Pages own whatever they put there:
 * it's a portal, so the content keeps the page's state, props and context and re-renders with
 * the page, and it disappears when the page unmounts. Render at most one per route.
 *
 * @param {React.ReactNode} children - What the page wants shown in the nav bar's center
 *
 * @example
 * ```tsx
 * function RulesPage() {
 *   const [query, setQuery] = useState('')
 *   return (
 *     <>
 *       <NavCenter><input value={query} onChange={(e) => setQuery(e.target.value)} /></NavCenter>
 *       <RuleList query={query} />
 *     </>
 *   )
 * }
 * ```
 */
export function NavCenter({ children }: { children: ReactNode }) {
  const target = useContext(NavCenterTargetContext)
  return target ? createPortal(children, target) : null
}
