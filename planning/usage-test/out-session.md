# B-aide /setup flow

The `/api` routes are Vite middleware (`server/api.ts`), mounted on both the dev and preview servers. The client for them is `src/lib/api.ts`.

## Endpoints the setup page calls

- **GET /api/status** (via `useStatus().refresh`): finds the CLI, then runs `claude --version` and `claude auth status --json`. It reads the saved config and returns the CLI path and version, the auth state, the project (`exists`, `hasEnv`), the recent folders that still exist, and `ready`. `ready` means signed in and the project folder exists.
- **POST /api/auth/login**: starts sign-in and returns 202 (404 if there's no CLI).
- **POST /api/project/pick**: opens the Windows folder dialog (PowerShell running a COM `IFileOpenDialog`, starting in the current project folder). It returns the path, or `null` if cancelled. It doesn't save anything.
- **PUT /api/project** `{dir}`: returns 400 if the folder doesn't exist. Otherwise it saves the folder and returns a fresh status. If `ready`, the page goes to `/`.

## Finding the CLI and signing in

`findClaudeCli` checks, in order: `B_AIDE_CLAUDE_BIN`, then `where`/`which claude`, then `~/.local/bin`, then the newest copy bundled with the Claude desktop app under `%LOCALAPPDATA%\Claude-Data`. Sign-in runs `claude auth login --claudeai` in its own detached console window. The CLI's environment has host `CLAUDE_CODE_*` variables removed. The page polls status every 2 seconds, for up to 5 minutes.

## Where the choices are saved

`~/.b-aide/config.json` holds `projectDir` and `recentDirs`. `recentDirs` keeps the newest 5, with the chosen folder moved to the front.
