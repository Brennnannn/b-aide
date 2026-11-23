import { useParams } from 'react-router-dom'
import type { ProjectRef } from '../../shared/api-types'
import { useStatus } from './status-context'

/** The URL segment for a project: its folder name. */
export function projectPath(project: ProjectRef) {
  return `/endeavors/${encodeURIComponent(project.name)}`
}

/**
 * The project named by the route's `:project` segment, matched on folder name. `undefined`
 * while status is still loading, `null` when no known project has that name. Two known
 * projects with the same folder name resolve to the first one added.
 */
export function useRouteProject(): ProjectRef | null | undefined {
  const { status } = useStatus()
  const { project } = useParams()
  if (!status) return undefined
  return status.projects.find((known) => known.name === project) ?? null
}
