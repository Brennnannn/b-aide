import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ScreenSizeProvider, useScreenSize } from '@ui'
import { AppShell } from './components/app-shell'
import { StatusProvider } from './lib/status-context'
import { ChooseProjectPage, ProjectsNav } from './pages/endeavors/projects-nav'
import { EndeavorListPage, EndeavorNav } from './pages/endeavors/endeavor-nav'
import { RulesPage } from './pages/rules/rules-page'
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
      { path: '/rules', element: <RulesPage /> },
      { path: '/settings', element: <SetupPage /> },
    ],
  },
])

export function App() {
  const size = useScreenSize()

  return (
    <ScreenSizeProvider size={size}>
      <StatusProvider>
        <RouterProvider router={router} />
      </StatusProvider>
    </ScreenSizeProvider>
  )
}
