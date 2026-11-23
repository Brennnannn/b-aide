# /setup flow, end to end

The API is a Vite plugin (`server/api.ts`) mounted under `/api` on the dev/preview server. The client is `src/lib/api.ts`. The shared `Status` type lives in `shared/api-types.ts`.

## Endpoints

- **GET /api/status**: `StatusProvider` calls this on load and on each `refresh()`. It finds the CLI, runs `--version` and `auth status --json`, then reads the config. It returns the CLI info, the auth state, the project (whether it exists, whether it has a `.env`), the recent folders that still exist, and `ready`, which is true when you're logged in and the project exists.
- **POST /api/auth/login**: starts the sign-in and returns 202 (or 404 if there's no CLI).
- **POST /api/auth/logout**: runs `claude auth logout` and returns the new status. The client defines it, but the setup page never calls it.
- **POST /api/project/pick**: opens the Windows folder dialog through PowerShell and returns `{dir}` or null. It doesn't save the choice.
- **PUT /api/project**: checks that `dir` is a directory, saves it, and returns the status. If the status is `ready`, the page goes to `/`.

## Claude CLI and sign-in

`findClaudeCli` (`server/claude-cli.ts`) checks, in order: `B_AIDE_CLAUDE_BIN`, then `where`/`which claude`, then `~/.local/bin`, then the newest copy bundled with the desktop app under `%LOCALAPPDATA%\Claude-Data`. It strips the host session's `CLAUDE_CODE_*` variables from the CLI's environment. `startLogin` runs `claude auth login --claudeai` detached, in its own console window (`cmd /c start` on Windows). The page polls `/api/status` until you're logged in.

## Where folders are saved

`server/config.ts` writes `projectDir` and `recentDirs` to `~/.b-aide/config.json`. The most recent folder goes first, and the list keeps 5 at most.
