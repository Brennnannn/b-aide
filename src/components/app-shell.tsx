import { useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ListTodo, Settings, SlidersHorizontal } from 'lucide-react'
import { navLink } from '@ui'
import { OuterNav } from './nav/outer-nav'
import { NavCenterTargetContext } from './nav/nav-center'
import { NotificationsProvider } from './notifications/notifications'
import { useKeybind } from '../lib/settings-context'
import { useStatus } from '../lib/status-context'

const mainNav = [
  navLink({ link: '/endeavors', label: 'Endeavors', icon: <ListTodo /> }),
  navLink({ link: '/rules', label: 'Rules', icon: <SlidersHorizontal /> }),
  navLink({ link: '/settings', label: 'Settings', icon: <Settings /> }),
]

/**
 * The outermost layout every page renders inside: the nav bar (which is also the window's
 * title bar, see `OuterNav`), then the route. Until setup is complete (Claude CLI signed in,
 * project folder chosen) every route redirects to /setup. Once it is, `/` opens Endeavors.
 * The notification tray floats over every page (`NotificationsProvider`).
 *
 * The nav bar's center slot belongs to the current page: pages fill it with `<NavCenter>`.
 */
export function AppShell() {
  const { status } = useStatus()
  const { pathname } = useLocation()
  const [centerEl, setCenterEl] = useState<HTMLElement | null>(null)

  if (status && !status.ready && pathname !== '/setup') return <Navigate to="/setup" replace />

  return (
    <NavCenterTargetContext.Provider value={centerEl}>
      <NotificationsProvider>
        <PageKeybinds />
        <div className="flex flex-col h-full w-full overflow-hidden bg-background text-text">
          <OuterNav
            navItems={[mainNav]}
            center={<div ref={setCenterEl} className="flex items-center gap-2 min-w-0" />}
            className="border-b border-trim"
          />
          <main className="flex-1 min-h-0 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </NotificationsProvider>
    </NavCenterTargetContext.Provider>
  )
}

/** The keybinds that open a page (Settings > Keybinds). */
function PageKeybinds() {
  const navigate = useNavigate()
  useKeybind('endeavors', () => navigate('/endeavors'))
  useKeybind('rules', () => navigate('/rules'))
  useKeybind('settings', () => navigate('/settings'))
  return null
}
