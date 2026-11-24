# B-aide settings

Draft, 2026-11-23. The Settings page: what it holds, where each value is stored, and how it behaves. Agent settings build on [agents.md](agents.md#measuring-and-tuning); terms are defined in [language.md](language.md).

## Storage

- **One file, changes only.** Settings are B-aide's, not the project's: one set for every project, in `~/.b-aide/config.json`. As [agents.md](agents.md#measuring-and-tuning) already says, the file holds only what you've changed. Code holds the defaults, and the page shows each effective value and whether it's the default, so a better default in a later version reaches everyone who never changed it.
- **Secrets never go in `config.json`.** API keys are encrypted with Electron's `safeStorage` (DPAPI on Windows, the keychain on macOS) in the main process, and written to `~/.b-aide/secrets.bin`. The renderer only ever sees "connected" and a key's last four characters.
- **Prompt overrides are files**, `~/.b-aide/prompts/<name>.md` (see [Agent prompts](#agent-prompts)).
- **Saving:** each field saves on change. There's no Save button, since Ctrl+S isn't Save here (see [Keybinds](#keybinds)).

## Sections

One long page, top to bottom. The sidebar jumps to each section (`/settings#<id>`). Both are built from one list, `SETTINGS_SECTIONS` in `src/pages/settings/settings-sections.tsx`, so they can't drift apart:

1. [General](#general)
2. [Projects](#projects)
3. [Escalation](#escalation)
4. [Accounts](#accounts)
5. [Agents](#agents)
6. [Limits](#limits)
7. [Keybinds](#keybinds)
8. [Agent prompts](#agent-prompts)
9. [Notifications](#notifications)
10. [Git](#git)
11. [Data](#data)

Advanced (log level, devtools, update channel) is parked; see [Open](#open).

## General

| Setting | Values | Default |
|---|---|---|
| `theme` | `system`, `light`, `dark` | `system` |

`system` follows the OS through Electron's `nativeTheme` and updates live when the OS changes.

**Startup is not a setting.** B-aide always opens on the last pane you were in.

## Projects

A FormArray over `projects` (the list `config.ts` already keeps). Each entry:

| Field | Notes |
|---|---|
| Path | Folder picker; must be a git repo |
| Display name | Defaults to the folder name |
| Default branch | Detected from the repo, editable |
| Ignored paths | Globs the agents should leave alone |

No test or build commands: commands a project runs belong in its rules (review commands, launch checks), not in Settings. Removing an entry only forgets the project. It never touches the folder. **No per-project model or prompt overrides for now.**

## Escalation

| Setting | Default | Notes |
|---|---|---|
| `escalateAfter` | 3 | Failures of one rule before B-aide opens the task's Dialogue (see [rules.md](rules.md#escalation-threshold)) |

**No approval settings.** Approving a plan (Build plan), granting a one-time override and starting the legislator are yours alone by design ([agents.md](agents.md#what-only-you-decide)). None of them can be automated from Settings.

## Accounts

### What a connection is

Every agent today is a headless `claude -p` process ([agents.md](agents.md#launching-any-agent)), signed in through `claude auth login --claudeai`. The design depends on Claude Code features: `--system-prompt-file`, the edit-rule hook, `--resume` with B-aide's session IDs, `stream-json` usage and `rate_limit_event` lines, per-session MCP config, `--max-turns`, `--permission-prompts none`.

So **a connection is an agent runtime plus a sign-in method**, not just a model API. A direct-to-model library (like the Vercel AI SDK) doesn't fit, because it would mean rebuilding the tools, hooks and resume ourselves.

| Provider | Runtime | Sign-in | Status |
|---|---|---|---|
| Anthropic | Claude Code (`claude -p`) | Subscription (`claude auth login --claudeai`) | Built |
| Anthropic | Claude Code (`claude -p`) | API key, passed as `ANTHROPIC_API_KEY` | First: same runtime, different environment |
| OpenAI | Codex CLI | ChatGPT subscription or API key | Needs an adapter |
| Google | Gemini CLI | Google sign-in or API key | Needs an adapter |
| xAI | Unknown: no official headless agent CLI known | API key | Blocked on a runtime |

**An adapter** maps B-aide's launch flags to that runtime's, parses its output into the usage log, handles resume with B-aide's session IDs, scopes its MCP config, and stands in for the edit-rule hook. Hook support in the other runtimes is unverified and may decide whether build sessions can run there (see [Open](#open)).

**Ship order:** the Accounts UI shows all four providers from the start. Anthropic (subscription and API key) works. The others show "coming soon" until their adapter lands, OpenAI first, then Google.

### The panel

- **Connect** pane: pick a provider, then a sign-in method. A subscription starts that runtime's login flow, which opens in its own console window and is polled, as `claude-account-field.tsx` does today. An API key is pasted, test-called, then stored.
- **Connections** list: one row per connection, showing provider, method, account (email or `••••1234`), and status (connected, signed out, key rejected). Each row has Reconnect and Remove.
- **No "active" connection.** Each agent picks its own model, and the model decides which connection is used (see [Agents](#agents)). So you can connect several accounts and mix them across agents.

### Removing a connection

If sessions are running on a connection, Remove asks first:

> **3 active sessions use this connection.** They'll stop and can't be resumed until you reconnect it.

A session keeps the model and connection it started with, and a resume reuses them ([agents.md](agents.md#launching-any-agent)). So removing a connection never changes a session's output. It only stops the session. A session can never resume under a different provider's runtime: switching an agent to another provider takes effect for fresh sessions only.

## Agents

Directly below Accounts. One row per agent: Dialogue, scoping, build, review, legislator.

| Setting | Notes | Default |
|---|---|---|
| `agents.<agent>.model` | Any model from a connected account, grouped by connection | Opus 5.5 |
| `agents.<agent>.effort` | Options come from the chosen model's runtime, so the list changes with the model | Dialogue `medium`, scoping `high`, build `medium`, review `medium`, legislator `high` |
| `agents.<agent>.maxTurns` | The per-agent formula from [agents.md](agents.md#measuring-and-tuning) | As there |
| `agents.<agent>.tools` | Built-in tools and MCP servers | The agent's design |

- **A missing connection is shown on the row.** If an agent's model belongs to a connection that's missing or signed out, the row shows an error at once ("Anthropic API key removed: build can't run"). Anything that would start that agent is blocked with the same message, so you find out on the Settings page, not partway through an endeavor.
- **Required tools are locked.** Each agent's own tools (build's `Edit`, `Write`, `Bash`, the agent's B-aide MCP role) are shown checked and disabled. You can add optional built-ins (`WebFetch`, `WebSearch`) and MCP servers from `.mcp.json`.
- **Changes reach fresh sessions only.** Running sessions and their resumes keep what they started with (changing them would break the cache).

## Limits

Below Agents.

| Setting | Default | Notes |
|---|---|---|
| `limits.maxConcurrentSessions` | 3 (to tune) | Sessions waiting for a slot show as queued |
| `limits.dailySpendUsd` | Off | API-key connections only |
| `limits.endeavorSpendUsd` | Off | API-key connections only |

**Usage display.** The section shows, per connection:
- **API key:** today's spend and this endeavor's spend, from `~/.b-aide/usage.jsonl` ([agents.md](agents.md#measuring-and-tuning)).
- **Subscription:** how close you are to the usage limit and when it resets, from `rate_limit_event`'s `utilization` and `resetsAt`. On a subscription, Claude Code's dollar figure is an API-rate estimate, not what you pay, so dollar caps don't apply there; hitting the limit already pauses runs until it resets ([agents.md](agents.md#when-a-run-fails)).

**Soft caps first.** A cap stops new runs from starting once it's reached; a run already going finishes. A hard cap (killing a run when the stream's per-call usage crosses the line) is possible later, but leaves a half-finished run that needs a Retry.

The per-agent Usage view (turns, cost and cache evidence beside each setting) stays where [agents.md](agents.md#measuring-and-tuning) puts it.

## Keybinds

| Action | Default | Scope |
|---|---|---|
| Toggle map | Ctrl+M | Global |
| Fit whole map in view | Shift+1 | Map focused |
| Rules | Ctrl+R | Global |
| Endeavors | Ctrl+E | Global |
| Settings | Ctrl+, | Global |
| First child | Ctrl+Tab | Endeavors pane focused |
| Parent | Ctrl+Shift+Tab | Endeavors pane focused |

- **Freeing keys from Electron's menu:** `main.ts` already removes Minimize so Ctrl+M reaches the page. Do the same for View > Reload (Ctrl+R). Keep Ctrl+Shift+R (force reload) for development only.
- **Ctrl+S is unbound.** Everyone expects it to mean Save, so it shouldn't jump to a page.
- **Rebinding:** click a binding and press the new keys. A key that's already taken shows a conflict ("Ctrl+E is bound to Endeavors"), and the change isn't saved until the conflict is resolved. Each binding has a reset button. Stored as `keybinds.<action>`, changes only.

## Agent prompts

A warning across the top: *These are the base prompts every agent runs with. Edit them only if you know what you're doing: a broken prompt breaks every session of that agent.*

- **One entry per file in `server/prompts/`:** `shared`, `tools`, and each agent's `<agent>` and `<agent>.first-message`.
- **Overrides are stored separately** in `~/.b-aide/prompts/<name>.md`. The defaults are never edited. If an override exists, it's used.
- **Reset to default** deletes the override. The default is always viewable beside it.
- **No diff view and no stale-override warning.** If an app update changes a default you've overridden, your override still wins.
- **Takes effect for fresh sessions.** A resume reuses its stored system text ([agents.md](agents.md#coming-back)).

## Notifications

When a node is waiting for your input:

| Setting | Default |
|---|---|
| `notify.inApp`: show an in-app notification | On |
| `notify.os`: show a Windows notification (Electron `Notification`) | On |
| `notify.sound`: play a sound | Off |

Turning on `notify.sound` opens a file picker for the audio file. The chosen file is copied into `~/.b-aide/sounds/`, so it still plays if the original is moved; a bundled default is used until one is chosen. The setting has Preview and Change buttons.

## Git

- **Commits are made as you.** Agents commit through the git CLI with the repo's `user.name` / `user.email`. That needs no sign-in, and the page shows the identity in use for each project.
- **Signing in** (`gh auth login`, started like the Claude login) is only for pushing and opening PRs. The section shows the signed-in GitHub account with Connect and Disconnect.
- **Trailers:** the co-author and `B-aide-*` trailers the design already writes stay on, so agent work stays traceable (see [Open](#open)).

## Data

- **Where B-aide stores things:** `~/.b-aide/`. The path is shown with an "Open folder" button.
- **Log retention:** how long run folders (`~/.b-aide/runs/`) and per-call usage logs are kept, default 30 days. The per-run line in `~/.b-aide/usage.jsonl` is kept forever, since it's small and the Usage view needs it.
- **Export / import settings:** `config.json` plus prompt overrides, as one file. Secrets are never exported; connections have to be made again after an import.

## Open

- **Runtimes beyond Claude Code.** Verify Codex CLI and Gemini CLI against the launch table in [agents.md](agents.md#launching-any-agent): headless mode, JSON usage output, resume with our session ID, scoped MCP, permission denial, turn limits, and above all a hook for edit rules. Find a runtime for xAI, or drop it.
- **Two ways to add MCP servers.** Rules can already name MCP servers; per-agent tools adds a second way. Decide whether both stay, or whether Settings only shows what rules add.
- **Co-author trailers** once commits are authored as you: keep them (current lean) or make them a toggle.
- **Concurrency default:** set it from measured usage.
- **Hard spend caps:** only if soft caps prove not enough.
- **Advanced section:** log level, devtools, update channel. Revisit when there's a need.
