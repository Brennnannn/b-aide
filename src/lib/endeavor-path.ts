import type { EndeavorStatus, ProjectRef } from '../../shared/api-types'
import { projectPath } from './projects'

/**
 * An endeavor's ID is its parent's ID plus one segment (`checkout.4f1a2.b7d05`, see
 * planning/language.md), so its ancestry is just the ID's prefixes, root first, itself last.
 *
 * @example
 * ```ts
 * ancestry('checkout.4f1a2.b7d05') // ['checkout', 'checkout.4f1a2', 'checkout.4f1a2.b7d05']
 * ```
 */
export function ancestry(id: string): string[] {
  const segments = id.split('.')
  return segments.map((_, idx) => segments.slice(0, idx + 1).join('.'))
}

/** The parent's ID, or `null` for a root endeavor. */
export function parentId(id: string): string | null {
  const cut = id.lastIndexOf('.')
  return cut === -1 ? null : id.slice(0, cut)
}

/** The URL of an endeavor, inside the status group it's listed under. */
export function endeavorPath(project: ProjectRef, status: EndeavorStatus, id: string) {
  return `${projectPath(project)}/${status}/${encodeURIComponent(id)}`
}
