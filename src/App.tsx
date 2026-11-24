import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ScreenSizeProvider, useScreenSize } from '@ui'
import { AppShell } from './components/app-shell'
import { SettingsProvider } from './lib/settings-context'
import { StatusProvider } from './lib/status-context'
import { ChooseProjectPage, ProjectsNav } from './pages/endeavors/projects-nav'
import { EndeavorListPage, EndeavorNav } from './pages/endeavors/endeavor-nav'
import { EditRulePage, NewRulePage } from './pages/rules/rule-form-page'
import { RulesNav } from './pages/rules/rules-nav'
import { RulesPage } from './pages/rules/rules-page'
import { SettingsNav, SettingsPage } from './pages/settings/settings-page'
import { SetupPage } from './pages/setup/setup-page'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/endeavors" replace /> },
      { path: '/endeavors', element: <ProjectsNav />, children: [{ index: true, element: <ChooseProjectPage /> }] },
      {
        path: '/endeavors/:project',
        element: <EndeavorNav />,
        children: [
          { index: true, element: <Navigate to="working" replace /> },
          { path: ':status', element: <EndeavorListPage /> },
          { path: ':status/:endeavorId', element: <EndeavorListPage /> },
        ],
      },
      {
        path: '/rules',
        element: <RulesNav />,
        children: [
          { index: true, element: <Navigate to="project/shared" replace /> },
          { path: 'new', element: <NewRulePage /> },
          { path: ':scope/:tab', element: <RulesPage /> },
          { path: ':scope/:tab/:name', element: <EditRulePage /> },
        ],
      },
      { path: '/settings', element: <SettingsNav />, children: [{ index: true, element: <SettingsPage /> }] },
      { path: '/setup', element: <SetupPage /> },
    ],
  },
])

export function App() {
  const size = useScreenSize()

  return (
    <ScreenSizeProvider size={size}>
      <StatusProvider>
        <SettingsProvider>
          <RouterProvider router={router} />
        </SettingsProvider>
      </StatusProvider>
    </ScreenSizeProvider>
  )
}
