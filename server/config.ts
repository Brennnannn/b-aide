import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const RECENT_LIMIT = 5

export type BAideConfig = {
  /** The project folder B-aide works in; its `.env` is the one that's read. */
  projectDir?: string
  /** Last few project folders chosen, newest first (includes `projectDir`). */
  recentDirs?: string[]
  /** Every project folder ever added, in the order they were added. Never trimmed. */
  projects?: string[]
}

const configDir = path.join(homedir(), '.b-aide')
const configFile = path.join(configDir, 'config.json')

// The app was called Monteverdi; carry its settings folder over the first time B-aide runs.
const legacyConfigDir = path.join(homedir(), '.monteverdi')
if (!existsSync(configDir) && existsSync(legacyConfigDir)) {
  try {
    renameSync(legacyConfigDir, configDir)
  } catch {
    // Left in place (e.g. locked); setup will just ask for the project folder again
  }
}

export function readConfig(): BAideConfig {
  let config: BAideConfig
  try {
    config = JSON.parse(readFileSync(configFile, 'utf8')) as BAideConfig
  } catch {
    return {}
  }
  // Configs written before `projects` existed: seed it from the folders already chosen
  config.projects ??= [...new Set([...(config.recentDirs ?? []).slice().reverse(), ...(config.projectDir ? [config.projectDir] : [])])]
  return config
}

export function writeConfig(config: BAideConfig) {
  mkdirSync(configDir, { recursive: true })
  writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n')
}

/** Points B-aide at `dir`, moves it to the front of the recent list, and adds it to the known projects. */
export function setProjectDir(dir: string) {
  const config = readConfig()
  const recentDirs = [dir, ...(config.recentDirs ?? []).filter((recent) => recent !== dir)].slice(0, RECENT_LIMIT)
  const projects = (config.projects ?? []).includes(dir) ? config.projects : [...(config.projects ?? []), dir]
  writeConfig({ ...config, projectDir: dir, recentDirs, projects })
}

export function isDirectory(dir: string) {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}

export function hasEnvFile(dir: string) {
  return existsSync(path.join(dir, '.env'))
}
