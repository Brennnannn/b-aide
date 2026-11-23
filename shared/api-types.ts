/** Types shared by the local API (`server/`) and the app (`src/`). Keep this file free of Node or DOM imports. */

export type AuthStatus = {
  loggedIn: boolean
  authMethod?: string
  email?: string
  orgName?: string
  subscriptionType?: string
}

export type Status = {
  cli: { path: string | null; version: string | null }
  auth: AuthStatus | null
  project: { dir: string; exists: boolean; hasEnv: boolean } | null
  /** Recently chosen project folders that still exist, newest first. */
  recentDirs: string[]
  /** Every project folder ever added that still exists, in the order added. `name` is the folder's name. */
  projects: ProjectRef[]
  /** Everything B-aide needs is in place; otherwise the app sends you to /setup. */
  ready: boolean
}

export type ProjectRef = { dir: string; name: string }

/**
 * The three ways root endeavors are grouped in the sidebar. `planned` and `working` are the
 * root's stored lifecycle; `complete` means it has been signed off into the complete branch.
 */
export type EndeavorStatus = 'planned' | 'working' | 'complete'

/** The stage an endeavor is in, when one is under way. See planning/agents.md. */
export type EndeavorStage = 'dialogue' | 'scoping' | 'building' | 'reviewing' | 'publishing'

/** A node's state as worked out from its files and git (planning/language.md, Concepts). */
export type NodeState = 'open' | 'sectioned' | 'discussing' | 'solved' | 'reopened' | 'built' | 'stale'

/**
 * What an endeavor's status pill shows: its stage if one is under way, otherwise its node
 * state. `acting` is true while an agent is running for it.
 */
export type EndeavorActivity = { stage: EndeavorStage | null; state: NodeState; acting: boolean }

/** Live figures for a running agent (planning/agents.md, Measuring and tuning). */
export type RunStats = { calls: number; contextTokens: number; costUsd: number; turns: number; maxTurns: number }
