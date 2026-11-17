# Monteverdi agents

Draft, 2026-11-10. These are first sketches of each agent Monteverdi runs. Each one gets a detailed design later, where we'll tighten the vocabulary and write its rules together. Terms (endeavor, Solution, Answer, Dialogue, Sections, test station, ...) are defined in [language.md](language.md).

## Configuring any agent

Whether an agent runs as a separate `claude` process or as a subagent, the same settings decide what it costs. Token use climbs when an agent starts with more context than it needs, or explores to fill gaps in a vague brief, and every tool call re-sends its whole context. For every agent we design:

- **A precise brief.** The exact node IDs, the files it touches, what done means, and what's out of scope. An agent that has to explore to work out its task pays for every exploring call.
- **Only the tools it needs.** An allowlist of built-in tools, and only Monteverdi's MCP server plus any the task needs. By default an agent inherits every MCP server, skill and plugin the user has set up, and their listings cost tokens on every call. Monteverdi starts sessions itself, so it controls this per session with CLI flags (`--strict-mcp-config`, `--tools`, `--disable-slash-commands`, `--plugin-dir`, ...); see [token_usage.md](token_usage.md#controlling-startup-for-sessions-monteverdi-starts).
- **Only the startup context it needs.** Skip the project's CLAUDE.md where it doesn't help.
- **A deliberately chosen model.** Not every role needs the most capable model.
- **A turn limit.** So a small job can't grow into a large one.
- **A short report back.** Details go into files; the report is a line or two.
- **Measured, not assumed.** Log each agent's token use from its transcript so we can see what each role actually costs. The [first measurement](usage-test/README.md) found a subagent and a new session cost the same for the same task, with 50–70k tokens of startup context dominating both. Trimming startup context is the biggest lever.

Monteverdi starts every agent itself. No agent starts another agent to do Monteverdi's work, so results land in files and git instead of piling up in a parent's context.

## Dialogue session

- **Purpose:** works toward a Solution with you, inside the node's dialogue file.
- **Starts:** when a Dialogue opens on a node: by you, by a build session or revision session calling `reopen`, or when Sections are created with a seeded Dialogue.
- **Runs in:** the endeavor worktree.
- **Lifetime:** one session per Solution, resumed while its prompt cache is warm; a fresh session from the file once it's cold (below).
- **Reads:** the node's breadcrumb, its dialogue file, and whatever code it needs to explore to answer well.
- **Writes:** its turns into the dialogue file. On "finalize": the Answer, or, if the Dialogue showed the endeavor has several parts, the endeavor's revised explanation plus new child endeavors (each with its own seeded Dialogue where needed).
- **Never:** commits (Monteverdi makes the pre-writeup and writeup commits), or edits nodes other than its own and its new children.
- **Cold start = fresh session from the file.** Build sessions run continuously, so their caches stay warm; Dialogues are what sit idle. When a Dialogue is reactivated after its prompt cache has expired (one hour on a subscription), Monteverdi doesn't resume or compact the old session. It starts a fresh one that reads the node's breadcrumb and the dialogue file, then answers your reply. The conversation is already in the file, so a summary of the old session would only repeat it. What the old session held beyond the file was mostly code it had read and its thinking; the fresh session re-reads only the code it needs. Monteverdi never compacts.
- **Writes down what it learns.** Because a cold start keeps only the files, a Dialogue session puts anything it found exploring that matters to the decision (file paths, constraints, an approach it ruled out and why) into the collapsed **Findings** block of its turn (see [language.md](language.md#solutions)), not just into its own context. You read the message; a fresh session reads the findings too.
- **Instructions:** every [Dialogue rule](rules.md#dialogue-rules), injected in full.
- **Starts lean:** planning needs no build tools. Monteverdi's MCP server and read-only code tools are usually enough.

## Scoping session

*In detailed design (2026-11-11). Decided items below; open ones under [Scoping session: open](#scoping-session-open).*

- **Purpose:** turns a fully designed endeavor into a **build plan**, `<id>.build.md`. Each task's entry in it is that build session's brief, so it has to be precise enough that the build session doesn't need to explore.
- **Starts:** when you press Begin build.
- **Runs in:** the endeavor worktree. It has no file-writing tools, so it can't change anything there (see `submit_plan` below).
- **Ends:** when `submit_plan` succeeds. Monteverdi's code then starts the build sessions; the scoping session doesn't wait on them.

**What code does and what the scoping session judges:**

| Code computes | The scoping session judges |
|---|---|
| The nodes to build: every unbuilt or stale node in the subtree | How to group nodes into tasks, including splitting the work into several tasks |
| Whether the scoping session's order respects every `Depends on:` line | The build order, so pieces that need other pieces come after them |
| Which tasks can run in parallel: order satisfied and no overlapping `touches` | Each task's `touches` |
| Build rules whose `paths` match a task's `touches`, added automatically | Further build rules, chosen by their descriptions |
| Tools that chosen rules declare | Further tools, named from the tool catalog |
| Validating and rendering the plan file | Each task's prose: goal, code to reuse, done, out of scope |

**`submit_plan`, not a file tool.** The scoping session hands its plan to Monteverdi's MCP tool `submit_plan` as structured data. Code validates it: every node to build is in exactly one task, every ID exists, every rule and tool exists, the order has no cycles and respects `Depends on:`. Errors come back in the tool result and the scoping session fixes them. On success, code renders `<id>.build.md` and the session ends. Read-only is therefore enforced by the tool list, not asked for.

**A task entry** (one per task in the plan):

| Field | Holds |
|---|---|
| `id` | `<id>.build.<n>`, e.g. `checkout.4f1a2.build.1` |
| `nodes` | The node IDs it builds |
| `after` | Tasks it must come after for reasons only the code shows (task 2 calls a helper task 1 creates). `Depends on:` lines order the design; `after` adds the rest. Code checks it never contradicts a `Depends on:` line |
| `touches` | The files and globs it expects to create or edit (name provisional) |
| `rules` | Build rules (edit rules attach to every build session automatically, so they aren't listed) |
| `tools` | Tool catalog entries |
| Goal | What the task achieves |
| **Reuse** | Existing code to use, with paths: components, helpers, types. Finding these is the scoping session's job, so the build session doesn't build what already exists |
| Done | What finished means |
| Out of scope | Including other tasks' nodes |

Answers are linked, not copied; the build session reads them with `breadcrumb`.

**The plan file you approve.** Code renders a readable header from what the scoping session submitted: the goal (the endeavor's summary), a table of tasks (nodes, `after`, `touches`, rules, tools), and which tasks run in parallel. The scoping session adds one field of its own, **Approach**: one to three sentences on how it split the work. Start build is a separate click after you've read it. Feedback on the plan resumes the scoping session (still warm) to revise it.

**Runs as its own `claude` process**, started headless by Monteverdi, with its own transcript and session ID, so it shows in the UI and can be stopped or resumed. Not a subagent: Monteverdi isn't a Claude session, so there's no parent to host one. The Agent tool is left out of its tools, as for every agent (no agent starts agents).

**Dependencies found while scoping.** Inside the subtree, the scoping session puts them in the plan's order and doesn't edit nodes. One outside the subtree that isn't declared means the design is incomplete: the scoping session calls `reopen` on that node with what it found, and the build doesn't start.

**Tool catalog.** The project names its tool sets (e.g. `browser`, `db`), each with the MCP servers, skills or plugins it loads. A build rule can declare `tools:` in its frontmatter, so choosing the rule brings them along; the scoping session can also name catalog entries directly. Monteverdi starts each build session with exactly the tools in its entry and nothing else.

**Configuration:**

| | |
|---|---|
| Built-in tools | `Read`, `Grep`, `Glob` |
| MCP | Monteverdi's server with `breadcrumb`, `submit_plan`, `reopen` only; `--strict-mcp-config` |
| Skills, commands | None (`--disable-slash-commands`) |
| Model | Opus 5.5, effort `high`. A plan runs once per build and a weak one costs every task after it; build sessions, whose choices are local and guided by build rules, run at `medium` |
| Instructions | Every [scoping rule](rules.md#scoping-rules), injected in full |
| Turn limit | 10 + 3 × nodes to build, computed |

**Failure:**

| What happens | Then |
|---|---|
| Turn limit reached without a valid plan | The run fails; the UI shows its last output and a Retry button |
| It calls `reopen` | The build is cancelled; that node is reopened |
| Process crash or API error | One automatic retry, then it fails as above |

No partial plan is ever kept.

### Scoping session: open

- **Its brief:** exactly what code assembles for it at start.
## Build session

- **Purpose:** builds one task from the build plan.
- **Starts:** when Monteverdi reaches its task in the plan and its dependencies are built.
- **Runs in:** its own task worktree and branch. Always a fresh session.
- **Reads:** its entry in `<id>.build.md`, the design nodes it links to, and the build rules Monteverdi injected into its instructions.
- **Writes:** code, committed on its task branch, with a `Monteverdi-Node: <id>` trailer per node it builds.
- **Tools:** `check` while working, `submit` when done, `reopen` when an Answer turns out to be wrong.
- **On conflicts:** rebases onto the endeavor branch and resolves them itself, since it knows what its changes are for.
- **During the build:** gets feedback from [edit rules](rules.md#edit-rules) after each matching edit, and keeps working.
- **On escalation:** joins a task Dialogue with you when its fix loop doesn't converge (see [rules.md](rules.md#when-revision-fails)).
- **Ends:** when its task merges, or when it calls `reopen` and pauses.

## Revision session

- **Purpose:** carries out the selected agent revision rules at the test station (see [rules.md](rules.md#revision-rules)).
- **Starts:** on each `submit` and at sign-off, once every edit rule and revision command passes.
- **Runs in:** the test station. Always a fresh session, with no memory of the build.
- **Reads:** the change, the Answers of the nodes it builds, and the selected agent rules, injected into its instructions with their embedded commands already run.
- **Checks:** whatever its rules say; typically whether the change does what the Answer says, code quality, and the UI in a browser against the station's dev server.
- **Writes:** a `verdict` per rule, by name: pass, or notes for the build session, plus an optional `suggest_rule`. A rule without a verdict counts as failed. If it concludes the Answer is wrong rather than the code, it calls `reopen`.

## Vocabulary

Decided:

- **Scoping session**, not "build planner" or "build orchestrator". Like a general contractor writing each trade's scope of work, it splits the endeavor into tasks, orders them and writes each one's brief; Monteverdi's code does the orchestrating. It produces the **build plan**, `<id>.build.md`, one entry per task.
- **Plan** means only the build plan, `<id>.build.md`. When a build finds a design decision wrong, that's "the Answer is wrong".
- **Task ID:** `<id>.build.<n>`. "build" contains non-hex letters, so it can never clash with a node segment.
- **Brief:** a briefing, not "short": everything an agent starts with. Code assembles the scoping session's; a build session's is its task entry in the plan plus the rules Monteverdi injects.
- **One name per step**, shared by the step, its rules and its agent: **Dialogue** (Dialogue session), **scoping** (scoping session), **build** (build session), **edit** (no agent: checks after each edit, and again at revision), **revision** (the test station and revision session). See [rules.md](rules.md#five-types-of-rule).
- **Process:** a separate `claude` run Monteverdi starts itself, with its own transcript and session ID. Build sessions are separate processes started by Monteverdi's code, never by the scoping session: each needs its own worktree and must be resumable on its own for the fix loop, which a subagent (living inside its parent) can't do.

Pending:

- "Code areas", "parts of the code" and "touches" name the same thing: the files a task expects to create or edit. A phrase is to come; `touches` stands in until then.

## Open

- **Vocabulary pass** across all agents, together (in progress; see [Vocabulary](#vocabulary)).
- **Rules for each agent:** what each brief must contain, its tool allowlist, model and turn limit.
- **Process or subagent:** decided for the scoping session and build sessions (own processes). Still to confirm for the revision session and Dialogue sessions.
