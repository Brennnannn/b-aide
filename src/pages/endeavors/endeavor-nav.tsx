import { ChevronLeft, HardHat, Lightbulb, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, navLink, useHeaderBumpCtx } from '@ui'
import type { EndeavorStatus } from '../../../shared/api-types'
import { InnerNav } from '../../components/nav/inner-nav'
import { projectPath, useRouteProject } from '../../lib/projects'
import { endeavorPath } from '../../lib/endeavor-path'
import { SAMPLE_DEFAULT_ID, SampleWorkPane, isSampleId } from './sample-endeavor'

/** The sidebar's status groups, in order. */
export const endeavorStatuses: { status: EndeavorStatus; label: string; icon: ReactNode }[] = [
  { status: 'planned', label: 'Planned', icon: <Lightbulb /> },
  { status: 'working', label: 'Working', icon: <HardHat /> },
  { status: 'complete', label: 'Complete', icon: <Star /> },
]

/** Docked at the bottom of the endeavor sidebar: back to the project list. */
function AllProjectsButton() {
  const navigate = useNavigate()
  return (
    <Button onClick={() => navigate('/endeavors')} className="w-full justify-center gap-2">
      <ChevronLeft className="h-4 w-4" />
      All Projects
    </Button>
  )
}

/**
 * Endeavors inside one project (`/endeavors/:project`): a sidebar of the status groups, with a
 * way back to the project list at the bottom. An unknown project name sends you back to the list.
 */
export function EndeavorNav() {
  const project = useRouteProject()

  if (project === undefined) return null
  if (project === null) return <Navigate to="/endeavors" replace />

  const base = projectPath(project)
  const navItems = endeavorStatuses.map(({ status, label, icon }) => navLink({ link: `${base}/${status}`, label, icon }))

  return <InnerNav name={project.name} navItems={navItems} sideActions={[<AllProjectsButton key="all-projects" />]} />
}

/**
 * One status group, showing an endeavor in the work pane. TEMPORARY: endeavors aren't read
 * from the project yet, so it shows the sample tree, opening on its default endeavor when the
 * URL names none or one it doesn't have. Once they're read from
 * `<project>/b-aide/endeavors/`, each root's group comes from its `lifecycle` frontmatter
 * and whether it's been signed off.
 */
export function EndeavorListPage() {
  const { status, endeavorId } = useParams()
  const project = useRouteProject()
  const headerBump = useHeaderBumpCtx(true)
  const group = endeavorStatuses.find((entry) => entry.status === status)

  if (!project) return null
  if (!group) return <Navigate to={`${projectPath(project)}/working`} replace />
  if (!isSampleId(endeavorId)) return <Navigate to={endeavorPath(project, group.status, SAMPLE_DEFAULT_ID)} replace />

  return (
    <div className={`relative h-full ${headerBump}`}>
      <SampleWorkPane key={endeavorId} project={project} status={group.status} id={endeavorId} />
    </div>
  )
}
