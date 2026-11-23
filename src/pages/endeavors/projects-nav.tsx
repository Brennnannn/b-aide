import { Folder } from 'lucide-react'
import { Link } from 'react-router-dom'
import { navLink, useHeaderBumpCtx } from '@ui'
import { InnerNav } from '../../components/nav/inner-nav'
import { projectPath } from '../../lib/projects'
import { useStatus } from '../../lib/status-context'

/** Endeavors with no project chosen: a sidebar listing every known project folder. */
export function ProjectsNav() {
  const { status } = useStatus()
  const navItems = (status?.projects ?? []).map((project) =>
    navLink({ link: projectPath(project), label: project.name, icon: <Folder /> }),
  )
  return <InnerNav name="Projects" navItems={navItems} />
}

/** The page beside the project list, before one is picked. */
export function ChooseProjectPage() {
  const { status } = useStatus()
  const headerBump = useHeaderBumpCtx(true)
  if (!status) return null
  const hasProjects = status.projects.length > 0

  return (
    <div className={`p-4 text-text-muted ${headerBump}`}>
      {hasProjects ? (
        'Choose a project to see its endeavors.'
      ) : (
        <>
          No projects yet. Add a project folder in{' '}
          <Link to="/settings" className="text-primary hover:underline">
            settings
          </Link>
          .
        </>
      )}
    </div>
  )
}
