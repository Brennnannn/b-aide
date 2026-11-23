import { useEffect, useMemo, useRef, useState } from 'react'
import type { TreeMapNode } from './tree-map'

/** A node with its base (undistorted) position in px, relative to the map's top-left. */
type Placed = TreeMapNode & { depth: number; x: number; y: number; isVirtual?: boolean }

// Tuning.
/** Extra angular slots between neighbouring subtrees that aren't both leaves (a leaf = 1 slot). */
const FAMILY_GAP = 0.8
/** Parent-to-child distance, before fitting to the pane: a base step that grows with the family size. */
const STEP_PX = 70
const STEP_PER_CHILD = 0.15
const STEP_MAX_CHILDREN = 10
/** In families this big or bigger, every other child sits further out, so labels interleave. */
const STAGGER_MIN_CHILDREN = 4
const STAGGER = 0.35
/** How much wider than tall (relative to a true half-circle) the fan may stretch to fill the pane. */
const MAX_STRETCH = 1.6
/** Space kept clear around the fan for labels, in px. */
const MARGIN = { left: 56, right: 110, y: 28 }
/** Lens radius as a fraction of the map's smaller side, and its strength (Bostock's `distortion`). */
const LENS_RADIUS = 0.38
const LENS_DISTORTION = 5
/** Chip height at full size, in px; resting chips shrink to fit their neighbours. */
const CHIP_PX = 26
const MIN_REST_SCALE = 0.32
/** How quickly the focus and the lens strength follow the pointer each frame (0..1). */
const FOCUS_EASE = 0.35
const STRENGTH_EASE = 0.15

/** How far a family of `count` children sits from its parent, before fitting: bigger families sit further out. */
function edgeLength(count: number) {
  return STEP_PX * (0.7 + STEP_PER_CHILD * Math.min(count, STEP_MAX_CHILDREN))
}

/**
 * Lays the tree out as a half-circle fanning right from a root at the middle of the left edge.
 *
 * Angle is split by leaf count: every leaf takes one slot of the 180°, so a node gets as much
 * angle as it has leaves under it, and each parent sits at the middle of its children's angle.
 *
 * Distance is per family, not per depth, so there are no shared rings: a family sits
 * `edgeLength(children)` out from its parent, so a single child stays close and a big family
 * spreads further out. In big families every other child is pushed a little further again.
 *
 * Finally the whole fan is scaled down, never up, so the deepest node always fits in the pane:
 * a deeper tree gets more crowded rather than running off screen.
 */
function layoutHalfCircle(nodes: TreeMapNode[], w: number, h: number) {
  const children = new Map<string | null, TreeMapNode[]>()
  for (const node of nodes) {
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node)
    children.set(node.parentId, siblings)
  }
  const ids = new Set(nodes.map((node) => node.id))
  const roots = nodes.filter((node) => node.parentId === null || !ids.has(node.parentId))
  // Several roots hang off one hidden root, so the fan always starts from a single point.
  const virtual: TreeMapNode | null = roots.length === 1 ? null : { id: '\0root', parentId: null, title: '' }
  const kidsOf = (node: TreeMapNode) => (node === virtual ? roots : (children.get(node.id) ?? []))
  const root = virtual ?? roots[0]
  if (!root) return { placed: [] as Placed[], restScale: 1, center: { x: 0, y: 0 } }

  // Depth-first: give leaves consecutive angular slots, then centre each parent on its children.
  // Radii are worked out on the way down, since a child's distance depends on its family size.
  const slots: { node: TreeMapNode; depth: number; at: number; r: number }[] = []
  let cursor = 0
  const visit = (node: TreeMapNode, depth: number, r: number): number => {
    const kids = kidsOf(node)
    const entry = { node, depth, at: 0, r }
    slots.push(entry)
    if (kids.length === 0) {
      entry.at = cursor + 0.5
      cursor += 1
    } else {
      const step = edgeLength(kids.length)
      const stagger = kids.length >= STAGGER_MIN_CHILDREN
      const ats = kids.map((kid, i) => {
        const prev = kids[i - 1]
        if (prev && (kidsOf(prev).length > 0 || kidsOf(kid).length > 0)) cursor += FAMILY_GAP
        const out = stagger && i % 2 === 1 ? step * (1 + STAGGER) : step
        return visit(kid, depth + 1, r + out)
      })
      entry.at = (ats[0]! + ats[ats.length - 1]!) / 2
    }
    return entry.at
  }
  visit(root, 0, 0)

  const span = Math.max(cursor, 1)
  const polar = slots.map((slot) => ({ ...slot, angle: -Math.PI / 2 + (slot.at / span) * Math.PI }))

  // Fit: shrink until every node is inside the pane (the fan's height is 2x its reach).
  let reachX = 1
  let reachY = 1
  for (const { r, angle } of polar) {
    reachX = Math.max(reachX, r * Math.cos(angle))
    reachY = Math.max(reachY, Math.abs(r * Math.sin(angle)))
  }
  // Panes are usually wider than the fan's 1:2 shape, so it may stretch sideways a little to
  // use the width, but never by more than MAX_STRETCH.
  const fitY = Math.min(1, (h / 2 - MARGIN.y) / reachY)
  const fitX = Math.min((w - MARGIN.left - MARGIN.right) / reachX, fitY * MAX_STRETCH)

  const center = { x: MARGIN.left, y: h / 2 }
  const placed: Placed[] = polar.map(({ node, depth, r, angle }) => ({
    ...node,
    depth,
    isVirtual: node === virtual,
    x: center.x + r * fitX * Math.cos(angle),
    y: center.y + r * fitY * Math.sin(angle),
  }))

  // At rest, chips shrink so neighbouring leaves near the edge of the fan don't overlap.
  const reach = Math.max(...polar.map((p) => p.r)) * Math.min(fitX, fitY)
  const restScale = Math.min(Math.max((reach * Math.PI) / span / CHIP_PX, MIN_REST_SCALE), 1)
  return { placed, restScale, center }
}

/**
 * Bostock's circular fisheye: points within `radius` of the focus are pushed outward, nearest
 * the most; points outside don't move, and the edge of the lens joins up smoothly. The focus
 * maps to itself, so whatever is under the cursor stays under it. Returns the new position and
 * `k`, how much the neighbourhood is magnified (1 at the lens edge, highest at the focus).
 *
 * @example
 * ```ts
 * const lens = makeLens(200, 3)
 * lens(100, 100, 100, 100) // { x: 100, y: 100, k: ~3.3 } (the focus stays put)
 * lens(400, 100, 100, 100) // { x: 400, y: 100, k: 1 } (outside the lens)
 * ```
 */
export function makeLens(radius: number, distortion: number) {
  const e = Math.exp(distortion)
  const k0 = (e / (e - 1)) * radius
  const k1 = distortion / radius
  const kMax = k0 * k1 * 0.75 + 0.25
  const lens = (x: number, y: number, fx: number, fy: number) => {
    const dx = x - fx
    const dy = y - fy
    const dd = Math.hypot(dx, dy)
    if (dd >= radius) return { x, y, k: 1 }
    const k = dd ? ((k0 * (1 - Math.exp(-dd * k1))) / dd) * 0.75 + 0.25 : kMax
    return { x: fx + dx * k, y: fy + dy * k, k }
  }
  return Object.assign(lens, { kMax })
}

/**
 * The curve from a parent to a child: leaves the parent heading outward from the root and
 * arrives at the child the same way (like `d3.linkRadial`), so links fan out instead of cutting
 * straight across.
 */
function linkPath(center: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }) {
  const rFrom = Math.hypot(from.x - center.x, from.y - center.y)
  const rTo = Math.hypot(to.x - center.x, to.y - center.y)
  const aTo = Math.atan2(to.y - center.y, to.x - center.x)
  const aFrom = rFrom < 1 ? aTo : Math.atan2(from.y - center.y, from.x - center.x)
  const mid = (rFrom + rTo) / 2
  const c1x = center.x + mid * Math.cos(aFrom)
  const c1y = center.y + mid * Math.sin(aFrom)
  const c2x = center.x + mid * Math.cos(aTo)
  const c2y = center.y + mid * Math.sin(aTo)
  return `M${from.x},${from.y}C${c1x},${c1y} ${c2x},${c2y} ${to.x},${to.y}`
}

type RadialMapProps = {
  nodes: TreeMapNode[]
  /** The node you're on; it and its ancestors are emphasised. */
  currentId?: string
  /** Called after a node with a link is clicked. */
  onNavigate: (link: string) => void
}

/**
 * The whole tree as a half-circle fanning right from the root, with an always-on fisheye that
 * follows the cursor: nodes near it spread apart and grow, the rest stay small. Each child is
 * joined to its parent by a curved line, grey unless the node gives a `lineColor`. Hovering a node brightens it, its ancestors and its
 * children, and their lines.
 *
 * The layout is computed only when the nodes or the size change. The lens runs in its own
 * animation loop and writes each chip's `transform` and each line's path directly, so moving
 * the cursor never re-renders React.
 *
 * @example
 * ```tsx
 * <RadialMap nodes={nodes} currentId={id} onNavigate={(link) => navigate(link)} />
 * ```
 */
export function RadialMap({ nodes, currentId, onNavigate }: RadialMapProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const chips = useRef(new Map<string, HTMLDivElement>())
  const links = useRef(new Map<string, SVGPathElement>())

  useEffect(() => {
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])

  const { placed, restScale, center } = useMemo(() => layoutHalfCircle(nodes, size.w, size.h), [nodes, size.w, size.h])
  // Lines go to every node whose parent is drawn (not to the roots under a hidden root).
  const edges = useMemo(() => {
    const drawn = new Set(placed.filter((node) => !node.isVirtual).map((node) => node.id))
    return placed.filter((node) => node.parentId && drawn.has(node.parentId))
  }, [placed])

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const ancestorsOf = (id: string | null | undefined) => {
    const path = new Set<string>()
    for (let at = id; at && byId.has(at); at = byId.get(at)!.parentId ?? undefined) path.add(at)
    return path
  }
  const onPath = useMemo(() => ancestorsOf(currentId), [byId, currentId])
  const lit = useMemo(() => {
    if (!hoveredId) return null
    const set = ancestorsOf(hoveredId)
    for (const node of nodes) if (node.parentId === hoveredId) set.add(node.id)
    return set
  }, [byId, nodes, hoveredId])

  // The lens loop. Restarts only when the layout changes.
  useEffect(() => {
    if (!el || !size.w) return
    const lens = makeLens(Math.min(size.w, size.h) * LENS_RADIUS, LENS_DISTORTION)
    const at = new Map<string, { x: number; y: number }>()
    let frame = 0
    let inside = false
    const target = { x: 0, y: 0 }
    const focus = { x: 0, y: 0 }
    let strength = 0 // 0 = lens off, 1 = full; eased so it fades in and out

    const draw = () => {
      for (const node of placed) {
        const moved = lens(node.x, node.y, focus.x, focus.y)
        const x = node.x + (moved.x - node.x) * strength
        const y = node.y + (moved.y - node.y) * strength
        at.set(node.id, { x, y })
        const chip = chips.current.get(node.id)
        if (!chip) continue
        // Grow by exactly as much as the lens spreads this neighbourhood (`k`), so chips that
        // didn't overlap at rest don't overlap magnified either. Capped at full size.
        const k = 1 + (moved.k - 1) * strength
        const base = node.depth === 0 ? Math.max(restScale, 0.8) : restScale
        const scale = Math.min(base * k, Math.max(base, 1))
        chip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`
        chip.style.zIndex = String(Math.round(scale * 100))
      }
      for (const node of edges) {
        const path = links.current.get(node.id)
        const from = at.get(node.parentId!)
        const to = at.get(node.id)
        if (path && from && to) path.setAttribute('d', linkPath(center, from, to))
      }
    }
    const tick = () => {
      focus.x += (target.x - focus.x) * FOCUS_EASE
      focus.y += (target.y - focus.y) * FOCUS_EASE
      strength += ((inside ? 1 : 0) - strength) * STRENGTH_EASE
      draw()
      const settled = Math.abs(target.x - focus.x) < 0.1 && Math.abs(target.y - focus.y) < 0.1 && (inside ? strength > 0.999 : strength < 0.001)
      frame = settled ? 0 : requestAnimationFrame(tick)
    }
    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      target.x = e.clientX - rect.left
      target.y = e.clientY - rect.top
      // Entering: jump the focus to the pointer so the lens doesn't sweep in from elsewhere.
      if (!inside && strength < 0.01) {
        focus.x = target.x
        focus.y = target.y
      }
      inside = true
      start()
    }
    const onLeave = () => {
      inside = false
      start()
    }

    draw()
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [el, placed, edges, center, restScale, size.w, size.h])

  return (
    <div ref={setEl} className="relative h-full w-full overflow-hidden select-none">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" fill="none">
        {edges.map((node) => {
          const strong = lit ? lit.has(node.id) && lit.has(node.parentId!) : onPath.has(node.id)
          const dim = lit ? !strong : false
          return (
            <path
              key={node.id}
              ref={(path) => {
                if (path) links.current.set(node.id, path)
                else links.current.delete(node.id)
              }}
              stroke={node.lineColor ?? (strong ? 'var(--color-text-muted)' : 'var(--color-trim)')}
              strokeWidth={strong ? 2 : 1}
              strokeOpacity={dim ? 0.15 : strong ? 0.9 : 0.5}
              className="transition-[stroke-opacity] duration-150"
            />
          )
        })}
      </svg>
      {placed.map((node) => {
        if (node.isVirtual) return null
        const color = node.color ?? 'var(--color-text-muted)'
        const isCurrent = node.id === currentId
        const isHovered = node.id === hoveredId
        const dim = lit ? !lit.has(node.id) : false
        const strong = (lit ?? onPath).has(node.id)
        // The map owns placement and emphasis (fade, weight, hover, the ring on the current node);
        // what's inside is the node's own `content`, or a plain chip.
        return (
          <div
            key={node.id}
            ref={(chip) => {
              if (chip) chips.current.set(node.id, chip)
              else chips.current.delete(node.id)
            }}
            onPointerEnter={() => setHoveredId(node.id)}
            onPointerLeave={() => setHoveredId((id) => (id === node.id ? null : id))}
            onClick={node.link ? () => onNavigate(node.link!) : undefined}
            className={`absolute left-0 top-0 flex rounded-full transition-[opacity,filter] duration-150 ${node.link ? 'cursor-pointer' : ''}`}
            style={{
              height: CHIP_PX,
              fontWeight: strong ? 600 : 400,
              opacity: dim ? 0.2 : 1,
              filter: isHovered ? 'brightness(1.25)' : undefined,
              outline: isCurrent ? '2px solid var(--color-primary)' : undefined,
              outlineOffset: 1,
              transform: `translate(${node.x}px, ${node.y}px) translate(-50%, -50%) scale(${restScale})`,
              willChange: 'transform',
            }}
          >
            {node.content ?? (
              <span
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5"
                style={{
                  fontSize: 13,
                  borderColor: `color-mix(in srgb, ${color} 45%, var(--color-trim))`,
                  background: `color-mix(in srgb, ${color} ${strong ? 20 : 10}%, var(--color-background))`,
                }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                {node.title}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
