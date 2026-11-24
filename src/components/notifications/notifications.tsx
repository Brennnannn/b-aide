import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EndeavorActivity } from '../../../shared/api-types'
import { useSettings } from '../../lib/settings-context'
import { playNotificationSound } from '../../lib/notification-sound'
import { Endeavor } from '../endeavor/endeavor'

/**
 * A node that has moved to awaiting your action. That's the only reason B-aide notifies:
 * there's no history, only the ones still showing, and a dismissed one is gone.
 */
export type EndeavorNotification = {
  /** The node's ID. Notifying for a node already showing replaces its card. */
  id: string
  title: string
  activity: EndeavorActivity
  /** What it's waiting for, in one sentence ("Claude replied. Your turn in the Dialogue."). */
  summary: string
  /** Where clicking it goes: the node. */
  link: string
}

type NotificationsContextValue = {
  /** Shows a notification, as Settings > Notifications says (in-app, Windows, sound). */
  notify: (notification: EndeavorNotification) => void
  /** Takes a node's notification away, e.g. once you've acted on the node elsewhere. */
  dismiss: (id: string) => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}

/** How long a card stays, while you're not hovering the tray and the window is visible. */
const LIFETIME_MS = 20_000
/** How long a card takes to leave before it's removed. */
const LEAVE_MS = 250
/** Collapsed: how far each card behind the front one peeks out above it. */
const PEEK_PX = 12
/** Expanded (hovered): the gap between cards. */
const GAP_PX = 8
/** Collapsed: how many cards show in the stack; the rest wait, hidden, behind them. */
const VISIBLE = 3

type Toast = EndeavorNotification & {
  /** Unique per card, so a replaced node's new card animates in afresh. */
  key: number
  phase: 'entering' | 'shown' | 'leaving'
}

let nextKey = 0

/**
 * Holds the current notifications and renders the tray. Inside the router, so a notification
 * (in-app or Windows) can open its node.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((all) => all.map((t) => (t.id === id && t.phase !== 'leaving' ? { ...t, phase: 'leaving' } : t)))
    setTimeout(() => setToasts((all) => all.filter((t) => !(t.id === id && t.phase === 'leaving'))), LEAVE_MS)
  }, [])

  // Settings and navigate change identity; keep `notify` stable for callers' effects
  const latest = useRef({ settings, navigate, dismiss })
  latest.current = { settings, navigate, dismiss }

  const notify = useCallback((notification: EndeavorNotification) => {
    const { settings, navigate, dismiss } = latest.current
    const { inApp, os, sound } = settings.notify

    if (inApp) {
      const toast: Toast = { ...notification, key: nextKey++, phase: 'entering' }
      setToasts((all) => [...all.filter((t) => t.id !== notification.id), toast])
    }

    // Only when B-aide isn't in front: otherwise the in-app card already shows it
    if (os && typeof Notification !== 'undefined' && !document.hasFocus()) {
      const show = () => {
        const native = new Notification(notification.title, { body: notification.summary, silent: sound })
        native.onclick = () => {
          window.focus()
          navigate(notification.link)
          dismiss(notification.id)
        }
      }
      if (Notification.permission === 'granted') show()
      else if (Notification.permission === 'default') void Notification.requestPermission().then((p) => p === 'granted' && show())
    }

    if (sound) playNotificationSound()
  }, [])

  return (
    <NotificationsContext.Provider value={{ notify, dismiss }}>
      {children}
      <NotificationTray
        toasts={toasts}
        onShown={(key) => setToasts((all) => all.map((t) => (t.key === key && t.phase === 'entering' ? { ...t, phase: 'shown' } : t)))}
        onDismiss={dismiss}
      />
    </NotificationsContext.Provider>
  )
}

/** True while the window is hidden (minimised, or another app's in front of all of it). */
function useDocumentHidden() {
  const [hidden, setHidden] = useState(document.hidden)
  useEffect(() => {
    const onChange = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return hidden
}

/**
 * The tray, bottom right. Cards stack newest in front, each one behind peeking out above it and
 * a little smaller, up to three deep. Hovering spreads them into a column and pauses every
 * card's 20 seconds (so does the window being hidden). New cards slide up from below;
 * dismissed and expired ones slide out to the right.
 */
function NotificationTray({ toasts, onShown, onDismiss }: { toasts: Toast[]; onShown: (key: number) => void; onDismiss: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const hidden = useDocumentHidden()
  const [heights, setHeights] = useState<Record<number, number>>({})

  const setHeight = useCallback((key: number, height: number) => setHeights((all) => (all[key] === height ? all : { ...all, [key]: height })), [])

  // Newest first; leaving cards keep their last spot while they slide out
  const ordered = [...toasts].reverse()
  const staying = ordered.filter((t) => t.phase !== 'leaving')
  if (staying.length === 0 && hovered) setHovered(false)

  const frontHeight = staying[0] ? (heights[staying[0].key] ?? 0) : 0
  const expanded = hovered && staying.length > 1

  // Each staying card's offset up from the bottom when expanded
  const offsets = new Map<number, number>()
  let y = 0
  for (const t of staying) {
    offsets.set(t.key, y)
    y += (heights[t.key] ?? 0) + GAP_PX
  }
  const trayHeight = staying.length === 0 ? 0 : expanded ? y - GAP_PX : frontHeight + Math.min(staying.length - 1, VISIBLE - 1) * PEEK_PX

  return (
    <div
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] transition-[height] duration-300"
      style={{ height: trayHeight, pointerEvents: staying.length ? 'auto' : 'none' }}
    >
      {ordered.map((toast) => {
        const index = staying.indexOf(toast)
        return (
          <TrayCard
            key={toast.key}
            toast={toast}
            index={index}
            paused={hovered || hidden}
            expanded={expanded}
            expandedOffset={offsets.get(toast.key) ?? 0}
            height={heights[toast.key] ?? 0}
            frontHeight={frontHeight}
            depth={staying.length}
            onHeight={setHeight}
            onShown={onShown}
            onDismiss={onDismiss}
          />
        )
      })}
    </div>
  )
}

type TrayCardProps = {
  toast: Toast
  /** 0 for the front card; -1 while leaving. */
  index: number
  paused: boolean
  expanded: boolean
  expandedOffset: number
  /** Its own measured height. */
  height: number
  frontHeight: number
  depth: number
  onHeight: (key: number, height: number) => void
  onShown: (key: number) => void
  onDismiss: (id: string) => void
}

function TrayCard({ toast, index, paused, expanded, expandedOffset, height, frontHeight, depth, onHeight, onShown, onDismiss }: TrayCardProps) {
  const inner = useRef<HTMLDivElement>(null)

  // Measure the card's natural height (the inner box, which collapsing never clips)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const observer = new ResizeObserver(() => onHeight(toast.key, el.offsetHeight))
    observer.observe(el)
    onHeight(toast.key, el.offsetHeight)
    return () => observer.disconnect()
  }, [toast.key, onHeight])

  // Enter on the next frame, so the browser paints the start position first
  useEffect(() => {
    if (toast.phase !== 'entering') return
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => onShown(toast.key)))
    return () => cancelAnimationFrame(frame)
  }, [toast.phase, toast.key, onShown])

  // Its 20 seconds, counting only while not paused
  const remaining = useRef(LIFETIME_MS)
  const leaving = toast.phase === 'leaving'
  useEffect(() => {
    if (paused || leaving) return
    const start = Date.now()
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - start
    }
  }, [paused, leaving, toast.id, onDismiss])

  let style: CSSProperties = { height: height || undefined }
  if (leaving) {
    style = { ...style, transform: 'translateX(calc(100% + 2rem))', opacity: 0, zIndex: 0 }
  } else if (toast.phase === 'entering') {
    style = { ...style, transform: 'translateY(calc(100% + 1rem))', opacity: 0, zIndex: depth + 1 }
  } else if (expanded) {
    style = { ...style, transform: `translateY(-${expandedOffset}px)`, opacity: 1, zIndex: depth - index }
  } else {
    // Behind the front card: its height, shrunk and nudged up so just its top edge shows
    const behind = index > 0
    style = {
      transform: `translateY(-${Math.min(index, VISIBLE - 1) * PEEK_PX}px) scale(${1 - Math.min(index, VISIBLE) * 0.05})`,
      opacity: index < VISIBLE ? 1 : 0,
      zIndex: depth - index,
      height: (behind ? frontHeight : height) || undefined,
      pointerEvents: behind ? 'none' : undefined,
    }
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 origin-bottom overflow-hidden rounded-md transition-[transform,opacity,height] duration-[400ms] ease-[cubic-bezier(0.21,1.02,0.73,1)]"
      style={style}
    >
      {/* Absolute, so it keeps its natural height (and is measured by it) while a collapsed wrapper clips it to the front card's; its header is what peeks out */}
      <div ref={inner} className="absolute inset-x-0 top-0">
        <Endeavor
          mode="notification"
          title={toast.title}
          activity={toast.activity}
          summary={toast.summary}
          link={toast.link}
          onOpen={() => onDismiss(toast.id)}
          onDismiss={() => onDismiss(toast.id)}
        />
      </div>
    </div>
  )
}
