# B-aide

An orchestration tool for Claude.

## Develop

B-aide is an Electron app.

```bash
pnpm install
pnpm dev      # Electron window, renderer served by Vite with HMR
pnpm dev:web  # just the Vite server, for working in a browser tab
pnpm build    # type-check, build the renderer to dist/ and the main process to dist-electron/
pnpm start    # run the built app
```

`src/ui` is a copy of `@bear-behavior/ui` (v2.2.0) and is imported as `@ui`. It's vendored source, so edit it in place.

## How it fits together

- `electron/`: the main process. It opens the window and serves the renderer plus the API on one localhost origin: in dev by running Vite in-process, in production with a small static server (`app-server.ts`) on port 47815. `build.mjs` bundles it with esbuild.
- `src/`: the React app (the renderer). `src/components/app-shell.tsx` is the outer layout (nav bar + route) and redirects to `/settings` until setup is complete. The nav bar is also the window's title bar: the window is frameless at the top with the native min/max/close buttons overlaid on the right, as in VS Code (see `src/components/nav/outer-nav.tsx`).
- `server/`: a small local API under `/api`, running in the main process. The renderer can't run the Claude CLI or read the filesystem, so those calls live here.
- `shared/`: types used by both sides.

## Setup

`/settings` needs two things before the rest of the app opens:

1. **Claude CLI signed in.** B-aide looks for `claude` in `B_AIDE_CLAUDE_BIN`, then on `PATH`, then `~/.local/bin`, then the copy bundled with the Claude desktop app. "Sign in" runs `claude auth login --claudeai` in a new console window. This is the CLI's own global sign-in (`~/.claude`), so it's shared with any other `claude` use on the machine.
2. **A project folder.** Its `.env` is the one B-aide uses. Type a path, pick one of the last 5 from the dropdown, or use "Select Folder" for the system folder dialog (desktop app only; under `pnpm dev:web` type the path). Saved to `~/.b-aide/config.json`.
