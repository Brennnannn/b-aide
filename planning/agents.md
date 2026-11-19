# Monteverdi agents

Draft, 2026-11-10. These are first sketches of each agent Monteverdi runs. Each one gets a detailed design later, where we'll tighten the vocabulary and write its rules together. Terms (endeavor, Solution, Answer, Dialogue, Sections, revision, ...) are defined in [language.md](language.md).

## Configuring any agent

Whether an agent runs as a separate `claude` process or as a subagent, the same settings decide what it costs. Token use climbs when an agent starts with more context than it needs, or explores to fill gaps in a vague brief, and every tool call re-sends its whole context. For every agent we design:

- **A precise brief.** The exact node IDs, the files it touches, what done means, and what's out of scope. An agent that has to explore to work out its task pays for every exploring call.
- **Only the tools it needs.** An allowlist of built-in tools, and only Monteverdi's MCP server plus any the task needs. By default an agent inherits every MCP server, skill and plugin the user has set up, and their listings cost tokens on every call. Monteverdi starts sessions itself, so it controls this per session with CLI flags (`--strict-mcp-config`, `--tools`, `--disable-slash-commands`, `--plugin-dir`, ...); see [token_usage.md](token_usage.md#controlling-startup-for-sessions-monteverdi-starts).
- **Only the startup context it needs.** Skip the project's CLAUDE.md where it doesn't help.
- **Our system text, not Claude Code's** (decided 2026-11-18). `--system-prompt-file` replaces Claude Code's built-in prompt (an interactive coding assistant's tone, task habits, Bash/Edit/git guidance, environment details) with Monteverdi's, assembled into one file by code in this order: the shared block (`server/prompts/shared.md`), the agent's fixed text (`server/prompts/<agent>.md`, ending with the precedence line), then its rules sorted by name. Our agents don't need that framing and their fixed text would otherwise spend lines overriding it; this way the whole system text is ours, readable end to end. Tool definitions are separate and still load, each with its own description. `--exclude-dynamic-system-prompt-sections` belonged to Claude Code's prompt and is likely moot; confirm from the first real request. Anything the built-in prompt supplied that an agent does need (the working directory, say, since `Read` takes absolute paths) goes in its first message.
- **A shared block first** (decided 2026-11-18). What every agent needs to know about Monteverdi lives once, in `shared.md`, at the top of every agent's system text: nodes, IDs and Answers; `breadcrumb`; that only tool calls reach anyone; that Monteverdi's own files change only through its tools, which check the input and return errors to fix; and `reopen`. It describes the system, so the first lines orient the agent; each agent's file then opens with `## Your job: <step>`, and the case file and trigger come last, in the first message. Plain concatenation, no placeholders. It doesn't help caching across agent types (each has different tools, which come before the system text), only consistency. A small command will write out each agent's assembled system text, so every agent's full text can still be read in one place. Facts that only some agents need (Sections, how Dialogues work) stay in those agents' files.
- **When and why in the system text, what in the tool.** The fixed text says when and why to use each tool; each tool's schema descriptions say what it takes and what each field holds. Each fact lives in one place.
- **A deliberately chosen model.** Not every role needs the most capable model.
- **A turn limit.** So a small job can't grow into a large one.
- **A short report back.** Details go into files; the report is a line or two.
- **Measured, not assumed.** Log each agent's token use from its transcript so we can see what each role actually costs. The [first measurement](usage-test/README.md) found a subagent and a new session cost the same for the same task, with 50–70k tokens of startup context dominating both. Trimming startup context is the biggest lever.

Monteverdi starts every agent itself. No agent starts another agent to do Monteverdi's work, so results land in files and git instead of piling up in a parent's context.

### Launching any agent

Consolidated 2026-11-19 from the scoping, build and legislator designs. Every agent is a headless `claude -p` process started by Monteverdi's code with the flags below; each agent's own table lists only what differs (working folder, built-in tools, CLAUDE.md, its MCP role, model, turn limit, and anything extra).

| | Every agent |
|---|---|
| System text | `--system-prompt-file <run folder>/system.md`: the shared block, the agent's fixed text, then its rules sorted by name, with their embedded commands already run by code. Byte-identical for every run of that agent with the same rules |
| Working folder | Its worktree, as the process's working directory, so `Read`, `Grep` and `Glob` reach the repo without prompting. The first message names the path, since `Read` takes absolute paths |
| Built-in tools | `--tools "<list>"` per agent, plus any built-in (`WebFetch`, `WebSearch`) its rules name. Never Agent: no agent starts agents |
| MCP | `--mcp-config <run folder>/mcp.json` with `--strict-mcp-config`: Monteverdi's server, started with the agent's role so it lists only that role's tools (and words results for that role), plus the servers its rules name, copied from `.mcp.json` |
| Permissions | `--allowedTools`: its built-in tools, `mcp__monteverdi__*`, and `mcp__<server>__*` for each rule server. A headless run can't answer a prompt, so anything not allowed would just fail |
| Settings | `--settings <run folder>/settings.json` with `--setting-sources` limited so your own hooks and settings stay out (to verify). Only build sessions' settings hold a hook (the edit-rule hook) |
| Skills, commands | None (`--disable-slash-commands`); skills reach build sessions only as injected rules |
| Session ID | `--session-id <uuid>` chosen by code, so any run can be resumed (see [Coming back](#coming-back)) |
| Output | `--output-format stream-json`: code logs token use per call, reads the context size for the warm-or-small test, and the UI shows progress |
| Model, effort | `--model`, `--effort` per agent, never changed within a session (it would break the cache) |
| Turn limit | `--max-turns` per agent, per run. A backstop the session isn't told about, tuned from logged usage (see [When a run fails](#when-a-run-fails)) |
| Cache lifetime | One hour (decided 2026-11-19): code sets `ENABLE_PROMPT_CACHING_1H=1` for every agent but revision, which is never resumed. On a subscription the hour is already Claude Code's default; on an API key it costs 2× instead of 1.25× per cache write, and pays for itself whenever a session is resumed after more than 5 minutes idle (a 40k Dialogue resumed after 20 minutes: ~4k to read back instead of ~50k to rewrite). The warm threshold follows the lifetime that applies |
| Compaction | Off. Monteverdi never compacts; an agent that comes back cold starts fresh from files instead (see [token_usage.md](token_usage.md#compaction)) |
| Run folder | `~/.monteverdi/runs/<session-id>/`, outside the repo, `--add-dir`ed so `Read` can open it: the assembled system text, MCP config, settings, and any long output a tool result points to |

### Coming back

Consolidated 2026-11-19 from the Dialogue, scoping, build and legislator designs: **one mechanism, used by every agent that is brought back.** For each session code keeps its ID, the time of its last API call and the size of its context at that call (from `stream-json`'s usage figures). When the agent is needed again:

- **Resume** (`claude -p --resume <id>` with the same flags and the same system-text file from its run folder) if the session is **warm** (its last call was under ~55 minutes ago, inside the one-hour cache) or **small** (its context is under ~30k tokens, where re-sending it uncached costs about what a fresh start does). The message holds only what's new, then the instruction.
- **Otherwise start fresh**: the agent's first-message template with the optional parts that apply (the dialogue or conversation so far, the earlier plan, the work already in the worktree), then what's new, then the instruction. The record a fresh session starts from is always a file or Monteverdi's state, never a summary.
- **Always fresh:** after the context filled up, and when something the session saw was changed by hand (a Dialogue's earlier turns).

**Rules that change while a session can be resumed: no machinery** (decided 2026-11-19). A resume always reuses the session's stored system-text file, so its cache holds; it keeps the rules it started with, and fresh sessions get the current ones. Checks never lag: revision reads edit and revision rules from the commit under test, and every task's next `submit` lands on an endeavor branch that already has an accepted change. Only guidance lags, only in sessions resumed within the cache's lifetime, and a check failing at `submit` teaches what the new rule wants. The task whose escalation prompted the change comes back with the rule's diff anyway.

The fixed text describes the situation ("when you're asked to revise an earlier plan", "you may be brought back to this task") and never how it arrives, so one line covers warm and fresh alike. The thresholds are the same for every agent to start with; code logs which path each return took and what it cost, so they can be tuned per agent.

| Agent | Brought back by |
|---|---|
| Dialogue | Your next message, Finalize, turns another session added (a `reopen`) |
| Scoping | Your feedback on the plan, or a revision after the build was cancelled |
| Build | Review notes, your turns in its task's Dialogue, an override, Answers settled after its `reopen`, an accepted rule change, a Retry |
| Legislator | Your reply, a refused Accept |
| Revision | Never after a wait: always a fresh session, resumed at once only to collect missing verdicts (see [Revision session](#revision-session)) |

### When a run fails

Consolidated 2026-11-19. A session never sees its own turn count or token count, so it can't wind down before a limit; the run just ends, and code decides what follows. One pattern for every agent:

| What happens | Then |
|---|---|
| Turn limit reached | The run fails to the UI, which shows its last output and a **Retry** button. Retry comes back through [the one path](#coming-back) with a "carry on" instruction and a fresh count |
| Process crash or API error (after Claude Code's own retries) | One automatic retry through the one path, then it fails as above |
| Context full (the API refuses the next call) | One automatic fresh session; if that one fills too, it fails as above |
| Usage limit reached (decided 2026-11-19) | Not a failure: retrying at once would fail again. The UI shows the run as waiting until the limit resets, and code brings it back through the one path then |

What a failed run leaves behind differs by agent: a Dialogue's file has your message and no reply; a scoping session keeps no partial plan; a build session's edits are in its worktree, committed or not; the legislator's changes are on its branch, where the review shows them. Turn limits per agent:

| Agent | `--max-turns` per run |
|---|---|
| Dialogue | 30 |
| Scoping | `10 + 3 × nodes to build`, capped at 60 |
| Build | `40 + 20 × nodes`, capped at 150; 40 when it comes back |
| Legislator | 40 |
| Revision | `20 + 15 × agent rules`, capped at 80 |

## What only you decide

Consolidated 2026-11-19. What only the user may decide is a control in the UI, never an agent's tool: an agent can suggest it in a `reply`, but code only acts on your press. In one place:

| Control | Where | Code records | Then starts |
|---|---|---|---|
| **Plan build** | A fully designed node (see [Before it starts](#scoping-session)) | Nothing until the plan is submitted | A scoping session |
| Feedback on a plan | The plan, before Build plan | Your words, in the plan's Versions block | The scoping session again, to revise |
| **Build plan** | A submitted plan | One commit of the plan file | The build sessions, as the plan's order allows |
| **One-time override** | A task's Dialogue: you name the rule and a reason | The override in the task's state; `Monteverdi-Override: <rule> (<reason>)` on the task's commit | The build session again, told the rule now counts as passed |
| **Change rule** | A task's Dialogue: you name the rule (the failing one by default) and say what's wrong | Your words; the task stays escalated | The legislator (escalation) |
| **Accept** on a `suggest_rule` | The suggestion, in the review log | The suggestion as accepted | The legislator (suggestion) |
| **Dismiss** on a `suggest_rule` (decided 2026-11-19) | The suggestion | The suggestion as declined, so the per-rule log shows it | Nothing |
| **New rule** | The rules view: you give the scope (project or personal), optionally the rule to change, and what you want | Your request | The legislator (your request) |
| **Accept** on a rule change | The legislator's review, between its runs | The commit; `complete` moves; cherry-picks onto every endeavor branch, each under its merge lock | The escalated task again, or marks the suggestion done |
| Reply on a rule change | The legislator's review | Your words, in its conversation | The legislator again |
| **Discard** on a rule change | The legislator's review, between its runs | The change as discarded; a line in an escalated task's Dialogue | Nothing |
| **Stop** on a `try_rule` run | The legislator's review, while a run is going | The run as stopped | The legislator carries on, told how long it ran |
| **Stop** on a running check | A task's checks, while a revision command runs | That rule as failed, with its output so far | The build session gets the failure as usual |
| **Retry** | A failed run | Nothing | That agent again, through the one path |
| **Publish kind** (decided 2026-11-19) | Creating a root endeavor: one of the project's publish rules | `publish: <rule>` in the root's frontmatter | Nothing |
| **Sign off** | [The sign-off review](#publish-the-sign-off-review) | The `--no-ff` merge into `complete` | Its publish procedure, straight away (decided 2026-11-19) |
| **Fix instead** (decided 2026-11-19) | An overridden failure, in the sign-off review | Nothing | A fix task for that rule |
| **Request fix** (decided 2026-11-19) | The sign-off review: you describe what's wrong | Your words | A fix task briefed with them |
| **Continue** (decided 2026-11-19) | A publish procedure paused at a `confirm` step | Nothing | The next step |
| **Retry step**, **Skip step**, **Abort** (decided 2026-11-19) | A publish procedure stopped at a failing step | The choice | That step again, the next step, or nothing |

Writing in a Dialogue and pressing Finalize also start sessions, but aren't yours alone: a Dialogue session finalizes on its own once you've agreed.

## Dialogue session

- **Purpose:** works toward a Solution with you, inside the node's dialogue file.
- **Starts:** when you write in a Dialogue. A Dialogue can be opened by you, by another session calling `reopen`, or seeded by `finalize_sections`; code writes the opening turn (the reopen reason, the seed), and no session starts until you reply, so nothing is spent on a Dialogue nobody comes back to, possibly for a long time.
- **Runs in:** the endeavor worktree.
- **Lifetime:** one session per Solution, resumed while its prompt cache is warm; a fresh session from the file once it's cold (below).
- **Reads:** the node's breadcrumb, its dialogue file, and whatever code it needs to explore to answer well.
- **Writes:** nothing directly; it has no file-writing tools. Each turn goes through `reply`, and code writes it into the dialogue file. On finalize (once you've agreed to the decisions, or when you say so): `finalize_answer` with the Answer, or, if the Dialogue showed the endeavor has several parts, the child tools (`create_child`, `update_child`, `delete_child`) and then `finalize_sections` with the endeavor's revised explanation. Code assigns IDs and writes the files (see [language.md](language.md#solutions)).
- **Warm or fresh:** [Coming back](#coming-back). Resumed, it gets only what's new: any turns added to the file since the session last saw it (another agent's `reopen`, say), then your message or "Finalize now". Fresh, its first message is the template's breadcrumb (always), the dialogue so far (if the file has turns), and the trigger. A brand-new Dialogue is just that template with no dialogue yet; reopening and finalizing need no variants of their own. A hand edit to earlier turns forces a fresh session.
- **Never:** commits (Monteverdi makes the pre-writeup and writeup commits), or edits nodes other than its own and its new children.
- **Cold start = fresh session from the file.** Build sessions run continuously, so their caches stay warm; Dialogues are what sit idle. When a Dialogue is reactivated after its prompt cache has expired (one hour on a subscription), Monteverdi doesn't resume or compact the old session. It starts a fresh one that reads the node's breadcrumb and the dialogue file, then answers your reply. The conversation is already in the file, so a summary of the old session would only repeat it. What the old session held beyond the file was mostly code it had read and its thinking; the fresh session re-reads only the code it needs. Monteverdi never compacts.
- **Writes down what it learns.** Because a cold start keeps only the files, a Dialogue session puts anything it found exploring that matters to the decision (file paths, constraints, an approach it ruled out and why) into the collapsed **Findings** block of its turn (see [language.md](language.md#solutions)), not just into its own context. You read the message; a fresh session reads the findings too.
- **Instructions:** every [Dialogue rule](rules.md#dialogue-rules), injected in full.
- **Starts lean:** planning needs no build tools. Monteverdi's MCP server and read-only code tools are usually enough.

**Configuration** (what differs from [Launching any agent](#launching-any-agent)):

| | |
|---|---|
| Working folder | The endeavor worktree |
| Built-in tools | `Read`, `Grep`, `Glob`, plus `WebSearch` and `WebFetch` for questions about external APIs (their definitions are small and cached, and adding tools mid-session would break the cache, so they're loaded from the start) |
| CLAUDE.md | Loaded, since project context helps design |
| MCP role | `dialogue`: `breadcrumb`, `reopen`, `reply`, `history`, `finalize_answer`, `create_child`, `update_child`, `delete_child`, `finalize_sections`. Drafted in `server/prompts/tools.md` (decided 2026-11-19): `history` takes `back` to pick among several condensed Dialogues; `finalize_answer` can also replace the explanation; `seed` is only on `create_child` (an existing child gets `reopen`); a second `reply` in one turn is an error; `delete_child` refuses a child that's being scoped or built |
| Model | Opus 5.5, effort `medium` (decided 2026-11-19): you take part in every turn and correct its course, so the deeper thinking `high` buys matters less than it does for a scoping session that runs unwatched |
| Turn limit | 30 per run, i.e. up to 30 model calls to produce one reply; it resets with each message. Common practice puts 20–30 at the top end, for complex tasks |

## Scoping session

*Detailed design 2026-11-11 to 2026-11-18. Drafts: fixed text `server/prompts/scoping.md` (after the shared block `shared.md`), first message `scoping.first-message.md`, tools `tools.md`. Later ideas under [future considerations](#scoping-session-future-considerations).*

- **Purpose:** turns a fully designed endeavor into a **build plan**, `<id>.build.md`. Each task's entry in it is that build session's brief, so it has to be precise enough that the build session doesn't need to explore.
- **Starts:** when you press Plan build.
- **Runs in:** the endeavor worktree. It has no file-writing tools, so it can't change anything there (see `submit_plan` below).
- **Ends:** when `submit_plan` succeeds. Monteverdi's code then starts the build sessions; the scoping session doesn't wait on them.

**What code does and what the scoping session judges:**

| Code computes | The scoping session judges |
|---|---|
| The nodes to build: every unbuilt or stale node in the subtree | How to group nodes into tasks, including splitting the work into several tasks |
| Whether the scoping session's order respects every `Depends on:` line | The build order, so pieces that need other pieces come after them |
| Which tasks can run in parallel: order satisfied and no overlapping `files` | Each task's `files` |
| Build rules whose `paths` match a task's `files`, added automatically | Further build rules and skills, chosen by their descriptions |
| Tools: those its rules declare, from the project's `.mcp.json` | (Nothing: tools come only with rules) |
| Validating and rendering the plan file, including each task's "Other tasks build" line | Each task's prose: goal, code to reuse, done |

**`submit_plan`, not a file tool.** The scoping session hands its plan to Monteverdi's MCP tool `submit_plan` as structured data. Code validates it: every node to build is in exactly one task, every ID exists, every rule exists, the order has no cycles and respects `Depends on:`. Errors come back in the tool result and the scoping session fixes them. On success, code renders `<id>.build.md` and the session ends. Read-only is therefore enforced by the tool list, not asked for.

**A task entry** (one per task in the plan):

| Field | Holds |
|---|---|
| `id` | `<id>.build.<n>`, e.g. `checkout.4f1a2.build.1` |
| `nodes` | The node IDs it builds |
| `after` | Tasks it must come after for reasons only the code shows (task 2 calls a helper task 1 creates). `Depends on:` lines order the design; `after` adds the rest. Code checks it never contradicts a `Depends on:` line |
| `files` | The files and globs it expects to create or edit |
| `rules` | Build rules (edit rules attach to every build session automatically, so they aren't listed) |
| Tools | Not chosen: code lists the tools its rules declare (see [Tools](rules.md#tools)) |
| Goal | How the task fits the plan: what it takes from earlier tasks and what later tasks will use from it (a function name, a data shape). The Answers say what to build, so the goal doesn't restate them. The rare note on nearby code to leave alone goes here too |
| **Reuse** | Existing code to use, as `{path, use}` entries: components, helpers, types. Finding these is the scoping session's job, so the build session doesn't build what already exists |
| Done | What to check before `submit`: observable results, including what later tasks rely on |

Answers are linked, not copied; code pastes them into the build session's first message (see [Build session: first message](#build-session-first-message)). Each prose field holds only what the scoping session knows and the Answers don't, so there's no second, paraphrased source of truth to drift. **No out-of-scope field** (decided 2026-11-18): other tasks' nodes are known to code, which renders "Other tasks build: …" under each task, and `files` already says where a task works.

Two fields belong to the plan rather than a task: **Approach** (one to three sentences for you on how the work was split) and, on a revision, an optional **response**: what changed in reply to your feedback and, above all, what the session declined and why. Your feedback goes in through the session's message; `response` comes out through `submit_plan`, and code writes it under your feedback in the Versions block, so each round reads as feedback, then reply. Code shows what changed between plan versions alongside it.

**The plan file you approve.** Code renders a readable header from what the scoping session submitted: the goal (the endeavor's summary), a table of tasks, and which tasks run in parallel. The scoping session adds one field of its own, **Approach**: one to three sentences on how it split the work. Layout and example under [the plan file](#scoping-session-the-plan-file). **Build plan** is a separate click after you've read it. The two buttons are **Plan build** (starts the scoping session) and **Build plan** (approves the plan and starts the build sessions); the swap of verb and noun is deliberate (decided 2026-11-17).

**One plan per Plan build.** The scoping session covers the pressed node and its whole subtree in one session; children don't get sessions of their own. It submits one plan holding however many tasks it judges right, and code checks the whole plan: each task, and how the tasks fit together.

**Revising a plan, one mechanism** (decided 2026-11-17). Whenever an earlier plan for the node never finished building (it's waiting for approval, or its build was cancelled by `reopen`), the scoping session revises it rather than starting over. Your feedback and a design change are the same case: an earlier plan plus what's new. Code computes what's new: your feedback, the Answer diffs in the subtree since the plan's brief was assembled, and the code changed on the endeavor branch since then. Tasks whose nodes have since been built drop out on their own, because those nodes are no longer to build. The fixed text has one general line for this ("if your first message includes an earlier plan, revise it"), and the first-message template has one optional part for it. The warm/fresh rule decides how it arrives: a warm session is resumed with only what's new; a cold one gets a fresh session with the brief, the earlier plan and what's new.

- **Code changed since the plan:** when code assembles a brief it stores the endeavor branch's commit in the plan file's frontmatter (`base:`). On a revision it lists the files changed since then (`git diff --name-only`, leaving out `monteverdi/`, which the Answer diffs cover), marks each one that falls in a task's `files`, and names the task or node that changed it, from the commit trailers. All of that is mechanical; whether a change matters to the plan is the session's judgment after re-reading those files.
- **Rounds live in the plan file** (named 2026-11-18): code appends each round to a collapsed **Versions** block at the end of `<id>.build.md`, so a fresh session sees earlier rounds and doesn't undo them, and you can see them too. Each round opens with what prompted it: your feedback, or, for a revision without feedback, a line code writes ("Answers changed: Refund API"). Then the session's `response`, then what changed. Not "Feedback", since some rounds have none; not "Revisions", since revision is the step after build.
- **No hand edits** (decided 2026-11-18). Code regenerates `<id>.build.md` on every version; your feedback is the only way to change a plan.
- **No status in the file** (decided 2026-11-18). Waiting for approval, building, a task merged: that's runtime state, which the UI shows from Monteverdi's task state (see [language.md](language.md#concepts)).
- **Committed on Build plan:** one commit of the approved plan, Versions block included. Drafts before approval stay uncommitted on disk, like a dialogue file between condensings. A revision works either way: a plan waiting for approval is on disk, and one whose build was cancelled is in git.
- **No repo map from code.** A project that wants one gives the scoping session a scoping rule with an embedded command (a trimmed `git ls-files`, say), so each project tunes its own.

**Runs as its own `claude` process**, started headless by Monteverdi, with its own transcript and session ID, so it shows in the UI and can be stopped or resumed. Not a subagent: Monteverdi isn't a Claude session, so there's no parent to host one. The Agent tool is left out of its tools, as for every agent (no agent starts agents).

**One node, one task** (decided 2026-11-18). Every node to build goes in exactly one task, so a node is built when that task merges and the `Monteverdi-Node:` trailer and stale check stay simple. The scoping session doesn't judge whether a node is too large for one build session: it has nothing to measure that against, and naming the condition in its prompt would make it find it everywhere, while a false alarm cancels the whole build. Sizing is your call: how finely a design is split, and where you press Plan build. Ordering between tasks that the code shows (one task creates a helper or table another uses) goes in `after`.

**Dependencies found while scoping.** Inside the subtree, the scoping session puts them in the plan's order and doesn't edit nodes. One outside the subtree that isn't declared means the design is incomplete: the scoping session calls `reopen` on that node with what it found, and the build doesn't start.

**Tools come with rules** (decided 2026-11-18; replaces the tool catalog). There's no catalog of Monteverdi's own: the project's MCP servers are the ones in its `.mcp.json`, and a rule's `tools:` names the ones it needs (see [rules.md](rules.md#tools)). The scoping session chooses rules, never tools: a server has no description to choose it by, while a rule's description says when it applies and its body how to use the tool in this project. Each build session starts with exactly the tools its task's rules declare.

**Configuration** (decided 2026-11-18; only what differs from [Launching any agent](#launching-any-agent)):

| | |
|---|---|
| Working folder | The endeavor worktree |
| Built-in tools | `Read`, `Grep`, `Glob`: read-only by construction; no Bash |
| Web tools | None. Outside APIs are settled in Dialogue and written into the Answers; a gap that needs the web is a design gap, so `reopen` |
| CLAUDE.md, auto memory | Left out. CLAUDE.md is written for interactive coding and re-sent on every call; scoping rules are the channel for what exists and where. A project that wants it adds a scoping rule embedding it (`` !`cat CLAUDE.md` ``) |
| MCP role | `scoping`: `breadcrumb`, `submit_plan`, `reopen` |
| Run folder holds | Also the full changed-files list on a revision |
| Model | Opus 5.5, effort `high` to start. A plan runs once per build and a weak one costs every task after it; effort mostly buys thinking, billed as output, small next to the builds it shapes. Build sessions, whose choices are local and guided by build rules, run at `medium` |
| Turn limit | `10 + 3 × nodes to build`, capped at 60 (reached at 17 nodes): the base covers orienting, `submit_plan`, one fix and the final call; 3 per node covers reading for its Reuse and files. The cap stops a runaway run long before the context gets unworkable |

**Failure:** as for [any run](#when-a-run-fails); no partial plan is ever kept. Besides, if it calls `reopen`, the build is cancelled and that node is reopened.

**Before it starts** (decided 2026-11-17). Plan build is available only when code finds all of these, so no session is spent discovering them:

- the subtree is fully designed, and every `Depends on:` outside it is solved;
- nothing in the subtree is being scoped or built. A parent can't be built while a child's build is running; the button says why, and you press it again once the child is done. Nothing starts automatically on unblock (waiting on another *build* would be new machinery; `Depends on:` waiting only works between tasks inside one build);
- there's at least one unbuilt or stale node in it;
- every scoping and build rule's `tools:` names a server or built-in tool that exists (see [rules.md](rules.md#tools)). The scoping session couldn't fix a missing one, so the button names the rule and the tool.

**The brief's case file: the subtree as one tree** (decided 2026-11-17). Grouping nodes into tasks is the scoping session's job, so it gets the whole subtree. Code pastes it as a single tree, with everything known about each node under that node's heading, so the session never cross-references separate lists:

- **status:** to build (new), to build (stale), or built and current;
- **to build:** explanation and Answer in full; for a stale node, the Answer's diff since its build commit;
- **built and current:** summary only (it's context for Reuse, not work). Its heading carries its `{#id}`, and the fixed text says to call `breadcrumb` with that ID for the full node, so no per-node pointer is needed;
- **`Depends on:`** each one, with whether it's inside or outside the subtree and, outside, whether it's built;
- **files from earlier builds:** for built and stale nodes and for outside dependencies, the files their build commits changed (found with `git log --grep "Monteverdi-Node: <id>"`), the best leads for Reuse.

Alongside the tree: the target's ID, title and breadcrumb; the **build-rule catalog** as frontmatter only (name, description, `paths`, `tools`; a chosen rule's full text is injected, and its servers load, only in the build sessions that list it), with the repo's and your skills as name and description (see [rules.md](rules.md#build-rules)). Scoping rules, which guide the scoping session itself, are injected in full after its fixed text.

### Scoping session: the plan file

Decided 2026-11-18. **`<id>.build.md` is the only record of a plan.** Code renders it from what `submit_plan` passes, and parses it back whenever it needs that data again: on Build plan, to start the build sessions with their files, rules and tools, and on a revision, as the earlier plan. There's no separate data file: every plan is read back at least once anyway, and revisions should be rare (and tuned to stay so). Nobody hand-edits the file, so code is its only writer and reader; the renderer and parser change together.

Two readers. **You**, before Build plan: the header gives the shape at a glance. **Each build session**: code passes it **only its own task's entry**, verbatim, in its first message, so what it starts from is exactly what you approved. Other tasks' entries would be re-sent on every call and are similar-but-wrong material; "Other tasks build" gives it the boundary.

Layout, top to bottom:

- **Frontmatter:** `base:`, the endeavor branch's commit when the brief was assembled (for a revision's code changes).
- **Header:** parent link; `# Build plan: <title> {#<id>.build}`; the goal (the endeavor's summary, linked to its node, copied by code); **Approach**.
- **Task table:** Task, Builds, Files, Rules, Tools. Rules and tools are bare names, the ones code added included; where each came from doesn't matter to the build session, which just gets them.
- **Order:** rendered, never parsed. Which tasks start at once, and for each task that waits, what it waits for and why: a dependency, the session's `after`, shared files (the later task in plan order waits), or an outside node not yet built.
- **One entry per task:** heading `## Task <n>: <its nodes' titles> {#<task-id>}` (no title field; the `{#id}` makes a grep find it); then **Builds** (node links), **Files**, **Rules**, **Tools**, **After** (only when the session set it), **Goal**, **Reuse** (one bullet per `{path, use}`), **Done**, and **Other tasks build**.
- **Versions:** collapsed, one round per revision (see [Revising a plan](#scoping-session)): what prompted it, the session's `response`, and a list of what changed, computed by code field by field (tasks added or removed, nodes moved, files, rules or tools changed; prose fields only named as "reworded"). The list is for you; a revising session gets the feedback and responses, not the list, and re-reads what it needs. Committed plans can also be compared in git.

Parsing back into `submit_plan`'s shape drops the rules a task's files bring (the same slip `submit_plan` fixes silently) and the Tools line, which code derives from the rules, so the session sees what it chose.

Example: Refunds, four nodes to build in three tasks, depending on the built Ledger outside the subtree.

```markdown
---
base: 3f9c2a1
---
↑ [Refunds](checkout.4f1a2.b7d05.md)

# Build plan: Refunds {#checkout.4f1a2.b7d05.build}
[Refunds](checkout.4f1a2.b7d05): Partial and full refunds against captured payments.

**Approach:** The API and its ledger entries share one database transaction, so they're
one task. Emails are sent from the existing Stripe webhook rather than the API, so they
build alongside it; the dialog waits for the endpoint.

| Task | Builds | Files | Rules | Tools |
|---|---|---|---|---|
| [1](#checkout.4f1a2.b7d05.build.1) | Refund API, Ledger entries | `server/refunds/**`, `server/db/migrations/*_refunds.sql`, `server/routes.ts` | api, db | postgres |
| [2](#checkout.4f1a2.b7d05.build.2) | Refund emails | `server/emails/refund-issued.tsx`, `server/webhooks/stripe.ts` | api, email, stripe-webhooks | |
| [3](#checkout.4f1a2.b7d05.build.3) | Refund dialog | `src/components/RefundDialog.tsx`, `src/pages/orders/OrderDetail.tsx`, `src/api/refunds.ts` | ui | playwright |

**Order**
- Tasks 1 and 2 start at once: no dependencies between them and no shared files.
- Task 3 waits for task 1: Refund dialog depends on Refund API.

## Task 1: Refund API, Ledger entries {#checkout.4f1a2.b7d05.build.1}
**Builds:** [Refund API](checkout.4f1a2.b7d05.1c2e3), [Ledger entries](checkout.4f1a2.b7d05.7a9f0)
**Files:** `server/refunds/**`, `server/db/migrations/*_refunds.sql`, `server/routes.ts`
**Rules:** api, db · **Tools:** postgres

**Goal:** Adds `createRefund(orderId, amountCents)` in `server/refunds/create.ts` and the
route `POST /api/orders/:id/refunds`. Task 3's dialog calls that route and shows
`RefundError.code` on failure, so export `RefundError` from `server/refunds/errors.ts`.
Leave `server/payments/capture.ts` alone.

**Reuse:**
- `server/ledger/post.ts`: `postEntry(tx, entry)` for both ledger lines, inside the
  refund's transaction.
- `server/stripe/client.ts`: the configured `stripe` instance; don't construct another.

**Done:** A partial refund on a captured test payment returns 201 and writes two ledger
lines that sum to zero; refunding more than the remaining amount returns 422 with
`RefundError.code = "amount_exceeds_captured"`.

**Other tasks build:** Refund emails (task 2), Refund dialog (task 3).

## Task 2: Refund emails {#checkout.4f1a2.b7d05.build.2}
…

## Task 3: Refund dialog {#checkout.4f1a2.b7d05.build.3}
…

<details><summary>Versions (2)</summary>

**Version 1 → 2**

**Brennan:** Put emails in the API task, and the migration should be with the API.

**Claude:** Moved the migration into task 1. Kept emails separate: they're sent from the
webhook in `server/webhooks/stripe.ts`, not from the API, and the two tasks share no
files, so running them at once can't conflict.

Changes: task 1 files + `server/db/migrations/*_refunds.sql`; task 2 files
− `server/db/**`; task 2 rules − db; task 1 done reworded.

</details>
```

Task numbers in headings are the task IDs' `<n>`. After a cancelled build they continue from the highest used (tasks 4–6), while `submit_plan` refers to tasks by position; code translates, so the session sees positions and you see IDs.

### Scoping session: first message

Decided 2026-11-18. One template with optional parts (`server/prompts/scoping.first-message.md`): a header with the target and the **worktree path** (Claude Code's prompt used to supply the working folder, and `Read` takes absolute paths; Dialogue's template got the same line); the target's breadcrumb; the subtree as one tree, with **outside dependencies inline** under each node that depends on them (status and files from their build); the build-rule catalog; optionally the earlier plan and what's new; and the instruction last, after the long case file. A fresh session gets the case file; a fresh revision adds the earlier plan; a warm resume gets only what's new. **The earlier plan is in the shape `submit_plan` takes**, parsed back by code from the plan file (see [the plan file](#scoping-session-the-plan-file)), so revising is editing the exact shape it resubmits; and a separate "built since" part names tasks whose nodes have been built since and drop out. What's new has optional sub-parts: feedback (earlier rounds with their responses, then this round), Answer diffs, and code changes, each present only when non-empty. **Code changes** are the plain `git diff --name-only <recorded commit>..HEAD` (leaving out `monteverdi/`), annotated mechanically: a path matching a task's `files` is "in task N's files", one at or under a task's `reuse` path is "in task N's reuse", anything else "no task", plus "changed by <task> (<node>)" from the commit trailer. Marked files are listed first and always in full; unmarked ones are listed up to 25, beyond which the message gives a count and the path of a file in the run's folder (outside the repo) holding the full list, which the session can `Read`. It has no Bash, so code runs git and writes the file. The fixed text describes the situation ("when you're asked to revise an earlier plan"), not how it arrives, so one line covers every case.

### Scoping session: tools

Decided 2026-11-18. Full descriptions, checks and error wording in `server/prompts/tools.md`.

- **`breadcrumb(id)`:** the node in full plus its ancestors' explanations, with a status line under the node's heading (to build, stale, built). An unknown ID's error names its nearest existing ancestor.
- **`reopen(id, reason)`:** `reason` becomes the Dialogue's opening turn (or a new turn if one is open). For scoping it cancels the build; its result says to reopen any other nodes found and end the turn, and `submit_plan` is refused for the rest of the run.
- **`submit_plan`:** the plan as structured data. Tasks are referred to by position (`after: [1]`); code assigns the `<id>.build.<n>` IDs, numbering after the highest used before so a new plan never reuses a cancelled task's branch. **Reuse is `{path, use}` entries**: code checks each path (file or folder) exists, and a revision can flag Reuse paths changed since the earlier plan; symbols are named in `use`. Code returns **every problem at once**, each naming the task and field and saying what to do, and the session resubmits the whole plan: one resubmit usually, and no second mechanism for patching. Shape errors come from the MCP schema check; meaning errors (a node in no task or two, a built node as work, unknown IDs or rules, `after` out of range, cycles across dependencies and `after`, `files` outside the repo or covering all of it, missing Reuse paths, empty fields, a second submit) come from our code, in our wording. **Slips with one possible meaning are fixed silently** rather than costing a resubmit: a rule the task's `files` would bring anyway, a leading `./`, a duplicate entry. Anything with more than one reading (an unknown rule name, say) stays an error.

### Scoping session: future considerations

Not planned; noted in case it's ever wanted.

- **Very large builds.** One scoping session covers the whole pressed subtree, so Plan build on an endeavor with hundreds of unbuilt nodes gives one session more than it can plan well, however many build sessions its plan splits into. For now that's avoided on the human side: Plan build works on any fully designed subtree, so build in parts and don't let unbuilt work pile up. If it's ever needed:
  - **Code partitions:** above a threshold of nodes to build, code starts one scoping session per child subtree, chained by their `Depends on:` lines. No new agent, but grouping across children is lost.
  - **A dispatching agent:** a small session that splits the subtree into scoping batches by judgment. Better batches, but a new agent type.
- **Node size.** Whether a node is too large for one build session isn't judged by any agent today. Once build sessions log their context size and outcome, a measured threshold could become a project setting passed to the scoping session, or a warning in the UI before Plan build.
## Build session

*Detailed design 2026-11-18 to 2026-11-19. Drafts: fixed text `server/prompts/build.md` (after the shared block `shared.md`), first message `build.first-message.md`, tools `tools.md`.*

- **Purpose:** builds one task from the build plan.
- **Starts:** when Monteverdi reaches its task in the plan and its dependencies are built.
- **Runs in:** its own task worktree and branch. Always a fresh session.
- **Reads:** its entry in `<id>.build.md` and its nodes with their ancestors, both pasted by code into its first message (below), and the build rules Monteverdi injected into its instructions.
- **Writes:** code, in its worktree. Monteverdi does the git: checkpoints, one commit per task with a `Monteverdi-Node: <id>` trailer per node, and the rebase (see [git and tools](#build-session-git-and-tools)).
- **Tools:** `submit` when done (it runs the mechanical checks first), `reopen` when an Answer turns out to be wrong or the build is stuck, `reply` in an escalation Dialogue.
- **On conflicts:** resolves the conflict markers code leaves when its task doesn't apply cleanly to the endeavor branch, since it knows what its changes are for.
- **During the build:** gets feedback from [edit rules](rules.md#edit-rules) after each matching edit, and keeps working.
- **On escalation:** joins a task Dialogue with you when its fix loop doesn't converge (see [rules.md](rules.md#when-revision-fails)).
- **Ends:** when its task merges, or when it calls `reopen` and pauses.

### Build session: first message

Decided 2026-11-19. Code knows the session will always need its nodes, so it pastes them rather than leaving the session to call `breadcrumb`: the cost difference is small (a few thousand token-equivalents per task), but a pasted Answer can't be skipped, while a session handed a task entry whose Goal reads like a complete brief might start coding without reading one. Same pattern as scoping's subtree and Dialogue's breadcrumb. In order:

1. **Header:** the task ID, the worktree path (`Read` takes absolute paths and our system text replaces the prompt that used to give the working folder), the task branch, the endeavor branch and the commit the task branched from.
2. **The task entry**, verbatim from `<id>.build.md`.
3. **Its nodes as one tree:** each node it builds in full (explanation, Answer, status line); each ancestor once, explanation only, since ancestors are sectioned and their explanations hold what was decided for the whole. Siblings other tasks build are left out; "Other tasks build" marks that boundary. A **stale** node adds its Answer's diff since its build commit and the files that build changed, so the session changes existing code rather than building from scratch. **Dependencies are inline**, under the node that depends on them, as in scoping's subtree: each `Depends on:` target outside the task (always built by the time the task starts, whether an outside node or an earlier task of this build) with its summary and the files its build changed. One place per fact; `breadcrumb` gives a dependency's full Answer.
4. **The instruction**, last.

**No list of checks** (decided 2026-11-19). The edit and revision rules a task will meet aren't listed up front. Their guidance already reaches the session through build rules, and the session should build with its mind on the outcome; edit-rule feedback after each edit and the mechanical checks `submit` runs bring the checks in as it goes. The fix loop adds optional parts to this template (see the fixed text's design).

### Build session: configuration

Decided 2026-11-19; only what differs from [Launching any agent](#launching-any-agent):

| | |
|---|---|
| Working folder | The task worktree |
| Built-in tools | `Bash`, `Read`, `Edit`, `Write`, `Grep`, `Glob`: it writes code and runs commands. No web tools (a rule can declare `WebFetch`), no to-do tool (the task entry is its plan) |
| Permissions | All of Bash allowed. Patterns can't list every command a build needs. No deny list or sandbox: a session told to build just builds. **Backstop in code:** before and after each run, code records the endeavor branch and every other task branch, and fails the run if any of them moved (worktrees share the main repo's `.git`, so a session could move one) |
| CLAUDE.md | Loaded. It's written for exactly this kind of work, and leaving it out would need a new mechanism to bring it back. The fixed text's closing line says Monteverdi's instructions win where it conflicts |
| MCP role | `build`: `breadcrumb`, `submit`, `reopen`, `reply`, plus its rules' servers |
| Settings | The edit-rule hook (below) |
| Run folder holds | Also long check output for the session to `Read` |
| Model | Opus 5.5, effort `medium`. Building is where most tokens go, so it's the first place to measure whether a smaller model does as well |
| Turn limit | `40 + 20 × nodes`, capped at 150, per run; 40 when it comes back |
| Compaction | Off, as everywhere, and here it matters most: summaries are weakest at what a build session leans on, which files it touched and how. The worktree is an exact record instead |
| Closing line | "Build this task, then submit it." `submit` succeeding is the end |

**Running out** follows [When a run fails](#when-a-run-fails). Its edits are on disk in the worktree either way, committed or not, so the fresh session after a full context gets an optional part saying a previous session ran out, with the changes since the base commit: it loses the old session's reasoning and what it had verified, not its work. Retry after the turn limit resumes the same session, since its context is still usable.

**Edit rules attach through one hook** (decided 2026-11-19). Claude Code runs hooks itself, outside the model, so they cost no context; the model sees only what a failing one prints. Code writes a `settings.json` into the run folder (passed with `--settings`; your own hooks are kept out with `--setting-sources`, to verify) holding one PostToolUse hook on `Edit|Write` that calls Monteverdi. Monteverdi reads which file was edited, picks the edit rules whose `paths` match (hook matchers can filter only by tool name, not by file), runs them with the [command contract](rules.md#command-contract)'s environment, and on any failure prints their combined output and exits 2, which Claude Code shows to the model. Rule scripts stay identical at both places they run, and path matching lives in code. The same hook re-runs the setup command when the edited file is the manifest or lockfile. Edits made through Bash don't trigger it; `submit` re-runs every edit rule anyway, and code logs which files Bash calls change so we can see whether that's enough. No time limit and no trimming on Monteverdi's side; see [Edit rules](rules.md#edit-rules).

### Build session: git and tools

Decided 2026-11-19. Full descriptions, checks and error wording in `server/prompts/tools.md`.

**Code does a task's git.** The build session edits files and leaves git to Monteverdi; it may still run `git diff` or `git log` to look. Every step of a task's git is mechanical, so code does it and no trailer can be forgotten. On `submit`, code commits the worktree on the task branch and puts the task's changes onto the endeavor branch's tip as **one commit per task**, with a `Monteverdi-Node:` trailer per node and the co-author trailers. One commit per task keeps the node history clean and makes a task easy to revert or cherry-pick. If that conflicts (rare, since tasks with overlapping `files` run one after another), code leaves the conflict markers in the worktree and `submit`'s result names the files and the task that changed them; the session resolves them and submits again. Git that needs judgment about how a project ships (release cuts, hotfixes, pushing) belongs to the [publish](#publish) step, which runs the project's own procedure.

**The session writes the commit message**, as `submit`'s `message`: a subject and an optional body, following whatever conventions CLAUDE.md or its build rules set, since code can't know them and publishing may read history. Code appends the trailers.

**Its tools:** `submit`, `reopen`, `reply`, `breadcrumb`. No `check` (dropped 2026-11-19): `submit` runs the mechanical checks itself, and mid-build the session runs quick commands (a typecheck, one test file) in Bash, since its worktree has the project's environment (see [Running the app](#build-session-running-the-app)).

**`submit` runs the mechanical checks first**, so the second wave (build toward the outcome, then fix what the checks find) happens without the fixed text asking for it. Code commits, applies the task onto the endeavor branch's tip in the worktree, and runs the edit rules and revision commands selected by the changed files there while the call waits (see [where a task is checked](#revision-where-a-task-is-checked)). Failures come back as the tool's result: the passing rules named in one line, each failure's rule, kind and trimmed output, with the full output in the run folder and its path. The session keeps working in the same run and submits again. Once they pass, the task goes on to review and the session ends its turn. Errors: nothing changed since the base commit; files under `monteverdi/` changed (revert them, and `reopen` if the design is wrong); conflict markers left in a file; a conflict; a `reopen` earlier in the run; already handed to review.

**One way back in.** A build session is brought back later in several situations: the revision session's notes after `submit`, your turns in an escalation Dialogue, Answers settled after its `reopen`, a Retry after the turn limit. All of them go through [the one path](#coming-back): resumed with a message if warm or small, otherwise a fresh session from the worktree, with the first message plus an optional part for what's new. So `submit` doesn't wait for the agent revision rules: that wait can be long (a whole revision session), and blocking through it would need a raised MCP timeout, a live process per waiting task, and recovery when Monteverdi restarts mid-wait, which would use the resume path anyway. The mechanical checks are quick enough to wait for.

**`reopen` on a node pauses the task.** Its work stays in the worktree, tasks waiting on it wait too, and `submit` is refused for the rest of the run. Code records the commit the task's Answers came from. Once every node it reopened is solved again, code compares, mechanically:

- **Only Answers changed** (its nodes' or their dependencies'): the task comes back with each changed Answer's diff and the files changed so far, and reworks what they affect.
- **The structure changed** (a node of the task was deleted or gained children): the task no longer matches its plan, so code cancels it and the subtree goes back to Plan build, which revises a plan whose build was cancelled.

The session needn't anticipate rework while building; it's told exactly what changed when it comes back.

**Asking for help is `reopen` with the task's ID.** `reopen("checkout.4f1a2.b7d05.build.1", reason)` opens the task's Dialogue (`<task-id>.dialogue.md`), just as a node's ID opens the node's: one tool for "this needs the user", where a node ID means the design is wrong and the task's ID means the build is stuck (a rule that seems wrong for this case, a revision note it disagrees with, a check failing for reasons outside its code, a conflict it can't resolve). Code also escalates on its own when the same rule fails 3 times (see [rules.md](rules.md#when-revision-fails)).

**`reply` is listed from the start**, refused unless the task's Dialogue is open: tools can't be added mid-session without breaking the cache. In the escalation Dialogue the session posts its turns with `reply`, and each of your turns comes back through the one path. Once you've given guidance, it builds and submits again.

### Build session: escalation

Decided 2026-11-19. A task's Dialogue (`<task-id>.dialogue.md`, next to the plan file) opens when the build session calls `reopen` with its task's ID, whose `reason` is the opening turn, or when code escalates on its own because the same rule failed 3 times (see [rules.md](rules.md#when-revision-fails)).

- **The opening turn, when code escalates:** the build session has just submitted, so it's warm. Code resumes it once to write the opening turn with `reply` (what keeps failing, what it tried, what it thinks the cause is, what it needs from you), and appends each attempt's output below it in a collapsed block. You read its explanation first, with the raw output underneath, the same shape as when it asks for help itself.
- **A one-time override is a control in the task's Dialogue**, never a tool: only you can grant one. You name the rule and a reason; code records it in the task's state, revision counts that rule as passed on the next `submit`, and code adds `Monteverdi-Override: <rule> (<reason>)` to the task's commit. The build session hears of it in its next message, and may suggest an override in a `reply` but can't grant one. At sign-off the rule runs again on the merged result and fails again; sign-off should show it as overridden, with the task and reason, rather than block (for the publishing design).
- **An environment fix needs no mechanism of its own.** Once the environment or a flaky test is fixed, you say so in the Dialogue ("fixed the test, try again"); the session comes back through the one path and submits its work unchanged.
- **After the task merges**, code commits the task's Dialogue once and then deletes the file, like a node's Dialogue at writeup: the conversation stays in git history, and nothing needs condensing, since the outcome is in the code and, for an override, in the trailer.

A rule change goes to the [legislator](#legislator), which only you can start; a design change is `reopen` on the node, which the build session can call from inside the Dialogue.

### Build session: running the app

Decided 2026-11-19. **Task worktrees get the project's environment**, as the test station did (it has since been retired; see [where a task is checked](#revision-where-a-task-is-checked)): a copy of the project folder's `.env` (re-copied when it changes) and a port of their own in `$PORT`. A build session can then run the project's commands and start the dev server itself (a build rule says how), and look at its page with a browser its rules bring, while it builds. Otherwise it would build UI blind and every visual mistake would cost a trip through revision: a whole revision session and a resume. Resources the worktrees share, such as one dev database that a migration in one task and tests in another both touch, are the project's to handle (a build rule, or a setup command that creates a database per worktree); Monteverdi can't know how a project's data works.

## Revision

*Detailed design 2026-11-19. Drafts: fixed text `server/prompts/revision.md` (after the shared block `shared.md`), first message `revision.first-message.md`, `verdict` in `tools.md`.*

### Revision: where a task is checked

Decided 2026-11-19; **replaces the test station.** The station was a separate worktree per endeavor, with its own `.env`, port and dependencies, that every submitted task queued for. Task worktrees now have all three (see [Running the app](#build-session-running-the-app)), so a task is checked where it was built, and nothing leaves its worktree until every check has passed:

1. **`submit`:** code commits the worktree and applies the task onto the endeavor branch's tip as one commit, in the worktree. Conflicts are left there for the build session.
2. **Mechanical checks** in that worktree, at that commit, while the build session waits: the selected edit rules, then revision commands. Every task has its own worktree, so tasks check in parallel; there's no queue. Failures are `submit`'s result.
3. **Review:** the build session ends its turn, and if any agent revision rules are selected, a fresh revision session runs in the same worktree, at the same commit, on the same `$PORT`.
4. **A failure anywhere** leaves the task in its worktree; the build session comes back there with it (see [Coming back](#coming-back)).
5. **Merge, under a lock.** Each endeavor has one merge lock. Code takes it; if the endeavor branch's tip is still the commit the task was checked on, it fast-forwards and releases, which is the usual case and instant. If the tip moved (another task merged meanwhile), code re-applies the task onto the new tip, re-runs the mechanical checks, then fast-forwards and releases. The review isn't repeated: tasks that ran in parallel have separate `files`, so what it judged hasn't changed. A conflict on re-applying goes back to the build session like any conflict, and its next submit is reviewed again.

Worked example: tasks 1 and 2 run in parallel. Task 1 is applied on tip T0 at 10:00 and checked in 2 minutes; task 2 is applied on T0 at 10:03 and checked by 10:05. Both are reviewed at once. At 10:12 task 1 passes review, takes the lock and fast-forwards to C1. At 10:15 task 2 passes review; the tip is now C1, not T0, so code re-applies task 2 onto C1 and re-runs its mechanical checks under the lock, then fast-forwards. Nobody waited on anyone else's review.

- **Rule changes take the same lock.** The legislator's cherry-pick onto an endeavor branch is just another move of its tip; a task checked against the old rules re-runs its mechanical checks, under the new ones, when it merges.
- **Ignored files are trusted** (accepted 2026-11-19). The station was a checkout used for nothing else; a task worktree also holds what the build session left in gitignored places (a build cache, generated code), so a check could pass on something not committed. Cleaning them would mean reinstalling dependencies on every submit. The risk is small, and sign-off runs on a clean checkout.
- **Load.** Several tasks' test suites can run at once on your machine; that's the cost of having no queue. Shared resources such as one dev database stay the project's to handle.
- **The port is freed** before the review starts, in case the build session left its dev server running.
- **"Test station" is retired** as a word: the step and its checks are **revision**, matching the rule type.

### Revision: sign-off

Decided 2026-11-19. Before you sign off, the endeavor branch merges in `complete` (a conflict becomes a fix task, as for any [failure at sign-off](rules.md#when-revision-fails)). Code then creates a **clean worktree** at the merged commit, sets it up with the `.env` and a port, runs **every edit rule and revision command** there, and removes it. **Agent revision rules don't run at sign-off:** the change would be the whole endeavor, already reviewed task by task, and your sign-off is the judgment step. How sign-off shows failures and overrides is in [the sign-off review](#publish-the-sign-off-review).

### Revision: edits outside a task's files

Decided 2026-11-19. Tasks run in parallel on the promise that their `files` don't overlap, but the build prompt lets a task change a file outside them when the work truly needs it, so it isn't an error. `submit`'s result notes each changed file outside the task's `files`, naming any task still in flight whose `files` cover it, and the UI shows them. Nothing enforces it: a textual clash with another task shows up as a conflict when the task is applied, and a broken combination as a failed mechanical check when it merges under the lock. The review doesn't judge these edits (see below).

### Revision session

- **Purpose:** carries out the selected agent revision rules on one task's change (see [rules.md](rules.md#revision-rules)) and gives a verdict on each.
- **Starts:** after a task's `submit` passes its mechanical checks, when any agent revision rule is selected. Not at sign-off.
- **Runs in:** the task's worktree, at the commit `submit` made.
- **Always fresh**, with no memory of the build and no earlier review session. It's resumed only once, straight away, if it ended without a verdict for every rule.
- **Ends:** when every selected rule has a verdict, or when it calls `reopen`.
- **Only rules are enforced** (decided 2026-11-19). The revision session judges the change against its selected agent revision rules and nothing else; something no rule covers isn't a failure, though it can suggest a rule. With no agent rules selected there's no review, and with no rules selected at all the task passes revision and merges.
- **Its own process,** like every agent: Monteverdi isn't a Claude session, so there's no parent to host a subagent.

### Revision session: first message

Decided 2026-11-19. One template (`server/prompts/revision.first-message.md`), in order:

1. **Header:** the task, the worktree path, the commit under review and the base it was applied on, and `$PORT`.
2. **The task entry**, verbatim from the plan: Done and Goal say what later tasks rely on.
3. **Its nodes as one tree**, as the build session gets them: the Answers are what the code is judged against.
4. **The change:** `git diff <base>..<commit>` in full up to about 1,500 lines; beyond that, the `--stat` summary and the path of the full diff in the run folder.
5. **Earlier review rounds on this task**, if any: each rule's verdict and problems. A fresh reviewer every round would otherwise find new small things each time and the task would never converge; with them, it checks first that the earlier problems were fixed.
6. **The instruction**, last.

**Not the builder's words.** The commit message and the task's Dialogue stay out: the reviewer judges the code against the design, not the builder's account of it.

### Revision session: `verdict`

Decided 2026-11-19; wording in `server/prompts/tools.md`. One call per rule: `verdict(rule, pass, problems?, suggest_rule?)`.

- **`problems`** is required when failing: a list of `{file, line?, what, fix}`. Code checks each file is in the change and renders the list for the build session, so each problem reaches it the way a check's output does: where, what's wrong, what to do.
- **`suggest_rule`** is optional, on a pass or a fail: `{type, name?, proposal}`, where `type` is build, edit or revision, `name` an existing rule to change (left out for a new one), and `proposal` what the rule should say or check. Code attaches the commit and the verdict, so the suggestion doesn't repeat the evidence. The reviewer can't know whether a problem recurs across tasks; code's per-rule log shows you that.
- **A second verdict for the same rule replaces the first**, silently: a correction is its only meaning.
- **Missing verdicts:** code resumes the session once, while it's warm, and asks for the rules it skipped. Any still missing count as failed.
- **Failures and review rounds count toward escalation** like any other failure of the rule (3 by default).
- **`reopen` on a node** (the Answer is wrong, not the code) pauses the task as a build session's `reopen` does; the verdicts already given are kept and come back with the Answer changes. It can't open the task's Dialogue: a disagreement between builder and reviewer reaches you through the build session asking for help.

### Revision session: configuration

Decided 2026-11-19; only what differs from [Launching any agent](#launching-any-agent):

| | |
|---|---|
| Working folder | The task worktree |
| Built-in tools | `Read`, `Grep`, `Glob`, `Bash`: to start the dev server the way the build session did and run what a rule asks for. Plus its rules' tools, such as a browser |
| Backstop in code | Code records the worktree's state before the run; any change to it afterwards is reverted and reported, so review never edits the code it judges |
| CLAUDE.md | Loaded: judging code means knowing the project's conventions |
| MCP role | `revision`: `breadcrumb`, `reopen`, `verdict` |
| System text | The shared block, `revision.md`, then the selected agent revision rules, with their embedded commands already run |
| Cache | Five minutes: it's never resumed after a wait |
| Model | Opus 5.5, effort `medium` |
| Turn limit | `20 + 15 × agent rules`, capped at 80: browser checks take many calls |

## Legislator

*Detailed design in progress, 2026-11-19. Drafts: fixed text `server/prompts/legislator.md` (after the shared block `shared.md`), first message `legislator.first-message.md`, tools `tools.md`. Named the legislator (decided 2026-11-19): rule editing isn't one of the five steps, so it doesn't follow the "<step> session" pattern, and a distinct name reads clearly.*

- **Purpose:** writes and changes the project's rules with you, any of the six types (decided 2026-11-19; publish added the sixth): `suggest_rule` mostly targets build rules, escalations mostly revision commands, and you may ask for any kind.
- **Reuses what the project has.** Where the project's linter, type checker or test runner can check something, a rule's command calls it; the legislator writes a script only where the stack has nothing that fits.
- **Shows a command works** (decided 2026-11-19): before proposing one, it runs it on the current code, on a small sample it writes that the command should catch, and, when the request came from one, on the commit that prompted it (the task's last `submit` for an escalation, the reviewed commit for a suggestion). Code checks that commit out into a scratch worktree, runs setup, and removes it afterwards; nothing else is reproduced.
- **Its own tools, no Bash** (decided 2026-11-19). Monteverdi's server lists tools per role, so these exist only for the legislator. `write_rule` takes the frontmatter as structured fields plus the body, and code validates it all at once before writing `SKILL.md`; `write_rule_file` writes a script in that rule's folder and nowhere else; `try_rule` runs a rule's command under the [command contract](rules.md#command-contract), on the current code, on sample files, or on the prompting commit, exactly as the hook or `submit` would. It also gets `breadcrumb` and `reopen` (decided 2026-11-19), so `shared.md` stays true for every agent; they cost little and a rule can touch the design. With `Read`, `Grep` and `Glob` for looking, it can't change anything outside the rules or touch git, so `shared.md`'s "Monteverdi's files change only through its tools" holds for rules too.
- **What code checks** (decided 2026-11-19; wording in `server/prompts/tools.md`). `write_rule` returns every problem at once: the name is a slug, unique in its type and scope; the description isn't empty; fields fit the type (`run` for edit rules and revision commands, `kind` only on revision rules, `paths` not on Dialogue or scoping rules, no `tools` on a command, a body where an agent reads it); `paths` are valid, relative globs inside the repo; `tools` names exist; a file in the rule's folder that `run` names exists; and each embedded `` !`command` `` runs. Fixed silently: a leading `./`, duplicates, a full MCP tool name in `tools` reduced to its server. **Notes**, returned without stopping the write and shown to you: a glob that matches no file today, a project rule shadowing a personal one (or the reverse), and what an agent rule's embedded commands print. Whether a command really runs and fails usefully is left to `try_rule`, which adds a note when a failing run prints nothing. `write_rule_file` stays inside the rule's folder and never writes `SKILL.md`. `delete_rule(type, name, file?)` removes a rule or one of its files. No renaming, since build plans name rules: a rename is a delete and a new rule.
- **Review** (decided 2026-11-19). The UI shows the diff of the rule's folder, the legislator's latest reply, every `try_rule` run as code recorded it (where it ran, exit code, output), and an "untried since last change" marker when the rule's folder changed after its last run. Its controls are **Accept**, a reply box (the legislator comes back with your message, warm or fresh by the usual rule) and **Discard**. Accept is a control, not a tool: only you make a rule change take effect, so the legislator has no submit tool; it replies and ends its turn. If a check fails on the current code, the UI says next to Accept that tasks touching those files will have to fix existing code; it informs, it doesn't block.
- **Rules belong to the project, so changes go through `complete`** (decided 2026-11-19). The legislator works on a short branch off `complete` (`monteverdi/rules/<n>`) in a worktree of its own, set up once; nothing is live until you accept, and `try_rule`'s "current code" is `complete`'s. On **Accept**, code re-runs `write_rule`'s checks on every changed rule, commits, and moves `complete` forward to the commit (rebasing first if `complete` moved; if another accepted change touched the same rule meanwhile, the legislator is brought back to redo its change on the new version). Then it **cherry-picks the commit onto every endeavor branch** (`git cherry-pick -x`, so each copy names the original), each under that endeavor's merge lock (see [where a task is checked](#revision-where-a-task-is-checked)); tasks in flight pick it up when they're applied at their next submit, or when they re-run their mechanical checks at merge. Cherry-picking, not merging `complete` in: a merge would bring every endeavor signed off since, with conflicts nobody chose to take on. Because every rule change reaches every branch, `monteverdi/rules/` is identical on all of them, so the copies never conflict, and when an endeavor later merges into `complete` (or takes it in) git sees the same change on both sides and merges it cleanly; the only trace is the copy in history. Code checks that invariant before sign-off (`git diff complete <endeavor> -- monteverdi/rules/` is empty). Accept is your review of that one commit, in place of an endeavor sign-off. Personal rules have no git: Accept copies them into `~/.monteverdi/rules/`.
- **The commit:** a subject code computes (`Rules: change typecheck (revision)`), the legislator's last reply as the body, the co-author trailers, and `Monteverdi-Task: <id>` when it came from a task. After Accept the worktree and branch are removed. An escalated task's Dialogue gets a line naming the commit, and the task comes back through its one path with the rule's diff and submits again; an accepted suggestion is marked done. **Discard** removes the worktree; an escalated task's Dialogue gets a line saying so, and it stays escalated.
- **The conversation is kept in Monteverdi's state** (decided 2026-11-19), outside the repo: it's short and operational, and a fresh session gets it in its first message. The commit is the lasting record.
- **The case goes in the first message** (decided 2026-11-19), not the system text: it's partly other agents' words (a build session's turns, a revision session's notes), which belong in the material the legislator weighs rather than in its instructions.
- **One mechanism, three starters** (decided 2026-11-19): accepting a revision session's `suggest_rule`, the "rule is wrong" outcome of a task's escalation Dialogue, and you asking for a new rule or a change. Each is a request to change rules plus the material that says why; code writes that material into the session's first message, and the same session handles all three.
- **Only you start one.** Agents only propose (the revision session through `suggest_rule`, a build session in its `reply`), the same line as the one-time override: a check is never loosened by the session it checks. So in an escalation the build session doesn't fix the rule itself.
- **A conversation** (decided 2026-11-19): it proposes a change, explaining what it does, and you design it further with it or accept it. A dedicated agent with its own job, lighter than the build process.

### Legislator: configuration

Decided 2026-11-19; only what differs from [Launching any agent](#launching-any-agent):

| | |
|---|---|
| Working folder | Its worktree, on `monteverdi/rules/<n>` off `complete` |
| Built-in tools | `Read`, `Grep`, `Glob`; `WebSearch` and `WebFetch`, to find an existing linter plugin or config option before writing a script. It can't install one: where a plugin would beat a script, it says so in its reply, and adding the dependency is a build like any other |
| CLAUDE.md | Left out, as for scoping: the rule catalog in its first message is its channel, and it can `Read` CLAUDE.md like any file when it looks for the project's commands |
| MCP role | `legislator`: `breadcrumb`, `reopen`, `reply`, `write_rule`, `write_rule_file`, `delete_rule`, `try_rule` |
| Extra folders | The draft copy of your personal rules, `--add-dir`ed so it can read them |
| Model | Opus 5.5, effort `high`: it runs rarely, and a wrong check costs every task it gates |
| Turn limit | 40 per run: reading the configs and rules (~10), writing (~3), three `try_rule` runs, a round of fixes and re-runs, the reply |

### Legislator: running and failing

Decided 2026-11-19.

- **Several at once, but one per rule.** Each runs on its own branch, and Accept already handles another change landing first. But two sessions changing the same rule would redo each other's work, so a starter naming a rule that an open legislator session is already changing joins that session instead: its material arrives as what's new ("another request about this rule"), and Accept settles both. Requests that name no rule start their own session.
- **Accept, Reply and Discard only between runs.** Accepting mid-run would take a half-written change. A run is bounded by its turn limit, and a hung `try_rule` has Stop (below), so waiting for the run to end is never open-ended.
- **Failures** follow [When a run fails](#when-a-run-fails). Its changes stay on its branch, and the review offers only **Retry**, not Accept: Accept means the legislator has finished and replied, and its last reply is the commit's body. A failed run may have left a change untried or half-fixed, which Retry finishes, tries and explains.
- **A `try_rule` that doesn't finish.** Checks have no time limit, so neither does `try_rule`. The review shows the running command with its elapsed time and a **Stop** control; stopping kills it and returns `Stopped by the user after 4m12s.` as the tool's result, so the legislator can say what that means for the rule. Claude Code's MCP timeout has to be raised for this role (see [Launch: to verify](#launch-to-verify)).
- **Discard** removes its worktree and any scratch worktree, and writes the usual line into an escalated task's Dialogue.

## Publish

*Design in progress, 2026-11-19. Replaces the "publish agent": publishing needs no agent.*

- **A step with no agent** (decided 2026-11-19). How a project ships (merging dev into prod, opening a pull request, waiting for a deploy to propagate, tagging) is a fixed procedure, even if writing it down takes judgment. So publish is a mechanical step, like edit: code runs [publish rules](rules.md#publish-rules), which are commands, and the judgment (what kind of change this is, and when it ships) is yours.
- **The kind is chosen when the root endeavor is created** (decided 2026-11-19). The picker lists the project's publish rules by description: Feature, Hotfix, Patch, or whatever the project defines, so Monteverdi keeps no fixed list. No agent reads the Dialogue for "this is a hotfix". The choice is stored in the root's frontmatter (`publish: <rule>`). Scaffolding gives a project one default rule, `feature`: sign off, then push `complete`.
- **One rule is one whole procedure** (decided 2026-11-19), not one step: rules are unordered folders, and a procedure is an ordered list. Its steps let the UI show progress, wait for you, and retry from where it stopped.
- **Two kinds of step** (decided 2026-11-19): `run`, a command code runs under the [command contract](rules.md#command-contract), with no time limit and a Stop control like a revision command (a step that waits, such as `gh pr checks --watch` or a script polling a deploy, is just a slow `run`); and `confirm`, which pauses with its text and a **Continue** control, for what a person does elsewhere (approving and merging a pull request).
- **The procedures themselves are the project's** (decided 2026-11-19). What each step does, and what a kind such as "bundled into the next push" means (perhaps no steps at all, so the next procedure that pushes carries it), is written in the project's rules, not designed here.
- **Credentials:** every step runs as your own process, so `git push` and `gh` use your credential helper and your login. No agent runs a step, and none ever sees a credential.
- **A failing step stops the procedure** (decided 2026-11-19) and shows its output, with **Retry step**, **Skip step** and **Abort**. It doesn't become a fix task: a step works outside the endeavor branch, where no build session can help, so it goes to you.
- **The legislator writes publish rules but can't try them** (decided 2026-11-19): `try_rule` on a step would push or deploy. The review shows the steps for you to read, with no runs.
- **One press** (decided 2026-11-19). Sign off merges the endeavor into `complete` (Monteverdi's own step; nothing leaves your machine) and then runs its kind's procedure straight away. There's no separate Publish control: a project that wants to approve now and ship later starts its procedure with a `confirm` step ("Ship now?"), so the pause is the project's choice, written in its rule.
- **One procedure at a time per project** (decided 2026-11-19): they push the same branches, so code runs them under a lock, like the merge lock. A procedure that stops at a failing step leaves the endeavor shown as signed off, with publishing stopped at that step.

- **Every endeavor starts from `complete`, whatever its kind** (decided 2026-11-19; no `base` field). A procedure that ends by syncing its branches (dev and prod, say) keeps them equal at rest, but a hotfix carries whatever else is in `complete` and not yet shipped: a bundled patch, or a feature whose procedure is paused. That's approved work, and usually what you want. So the sign-off review **warns** instead: "Also ships: Patch X; Feature Y, paused at step 3", computed from the endeavors signed off whose procedure hasn't finished. A `base:` field on publish rules (a hotfix branched off prod) stays a future consideration. It would change decided mechanics: sign-off would merge the base in rather than `complete`, the rules-identical check compares against `complete`, and rule cherry-picks onto a branch off prod could conflict with its older code.
- **The sign-off merge is always `git merge --no-ff`** (decided 2026-11-19), not a project choice. The endeavor has just merged `complete` in, so a plain merge would only fast-forward and leave no trace; `--no-ff` makes one merge commit per sign-off, so `git log --first-parent complete` reads as a timeline of sign-offs and rule changes. Squashing would drop the per-task commits from `complete` once the endeavor branch is deleted, and with them the `Monteverdi-Node:` trailers (the stale check, scoping's files from earlier builds), the pre-writeup commits `history` reads, and the committed task Dialogues. Code writes the message: `Sign off: <title>`, the root's summary, and a `Monteverdi-Endeavor: <root id>` trailer; authored by you. What the procedure does afterwards (squash-merging a pull request on GitHub, say) is the project's.

### Publish: the sign-off review

Decided 2026-11-19. The one place you judge a whole endeavor: each task was checked and reviewed alone, and no agent looks at the whole. Since Sign off also runs the procedure, the page answers "can I press, and what happens if I do?" before "is this right?". Everything on it is computed by code; there's no agent-written summary, which would only paraphrase the Answers and the commits.

**Prepared on its own.** Once every node in the endeavor is built and current and nothing in it is being designed, scoped or built, code prepares sign-off without being asked (no tokens): merges `complete` into the endeavor branch, checks that `monteverdi/rules/` matches `complete`'s, and runs every edit rule and revision command in a clean worktree (see [Revision: sign-off](#revision-sign-off)). If `complete` moves before you press (another sign-off, an accepted rule change), code prepares again.

**Top to bottom:**

1. **What pressing does:** title, summary, the kind with its rule's steps listed, and the **also ships** warning when it applies. If Sign off isn't available, why, in one line ("Fix task running for typecheck", "Preparing: running checks (3 of 7)").
2. **Checks:** each edit rule and revision command from the clean run, collapsed to one line when all passed. A failure without an override has already become a fix task; the page shows its status and links to it. A failure with an override shows *overridden in task 2: "flaky on Windows"* with its output and doesn't block: code can't tell whether it fails for the overridden reason or a new one, so the output lets you judge.
3. **What was built:** the endeavor's design tree, each node with its summary and a link to its Answer; design changes (`monteverdi/`) listed apart from code.
4. **Tasks:** one row per task, since each is one commit: subject, files, diff. Flagged on the row: edits outside its files, and any escalation with its outcome (guidance, override, rule change), linking the committed task Dialogue. Fix tasks from preparing are listed too.
5. **The whole change:** the full diff against `complete`.
6. **What came in:** the sign-offs and rule changes the merge-in brought from `complete`, so a surprising change in the diff has an explanation.

**Controls:**

- **Sign off:** merges and runs the procedure.
- **Fix instead,** on an overridden failure: starts a fix task anyway.
- **Request fix:** you describe something wrong that the checks missed; code makes it a fix task briefed with your words, the same mechanism as a failing check at sign-off.
- **Opening a Dialogue on a node** from the tree, as anywhere, when the design is wrong rather than the code.

**Left out:** revision notes from earlier rounds (they were about intermediate states, settled in the code), and token cost per task (it belongs on the endeavor's stats, not the go/no-go page). **Not yet:** keeping the clean worktree running so you can try the app before pressing. It would need a "start the app" command Monteverdi doesn't have; for now, check out the endeavor branch yourself.

## Vocabulary

Decided:

- **Scoping session**, not "build planner" or "build orchestrator". Like a general contractor writing each trade's scope of work, it splits the endeavor into tasks, orders them and writes each one's brief; Monteverdi's code does the orchestrating. It produces the **build plan**, `<id>.build.md`, one entry per task.
- **Plan** means only the build plan, `<id>.build.md`. When a build finds a design decision wrong, that's "the Answer is wrong".
- **Task ID:** `<id>.build.<n>`. "build" contains non-hex letters, so it can never clash with a node segment.
- **Brief:** a briefing, not "short": everything an agent starts with. Code assembles the scoping session's; a build session's is its task entry in the plan plus the rules Monteverdi injects.
- **One name per step**, shared by the step, its rules and its agent: **Dialogue** (Dialogue session), **scoping** (scoping session), **build** (build session), **edit** (no agent: checks after each edit, and again at revision), **revision** (the checks at `submit` and the revision session), **publish** (no agent: the project's procedure after sign-off). See [rules.md](rules.md#six-types-of-rule).
- **Process:** a separate `claude` run Monteverdi starts itself, with its own transcript and session ID. Build sessions are separate processes started by Monteverdi's code, never by the scoping session: each needs its own worktree and must be resumable on its own for the fix loop, which a subagent (living inside its parent) can't do.
- **A task's files** (`files`, decided 2026-11-18; was `touches`): the files and glob patterns a task expects to create or edit. Plain, and what the plan file, the prompts and the code-change annotations already called it. Not `paths`, which rules use for the files a rule concerns: code compares the two, so they need different names.

## Launch: to verify

Things about Claude Code's behaviour that the agent designs assume and that need checking against the real CLI when the code that starts sessions is written (noted 2026-11-18):

- **CLAUDE.md and auto memory.** They may arrive as context in the first message rather than in the system prompt, in which case `--system-prompt-file` doesn't remove them. Find the flag or setting that turns them off for scoping (Dialogue keeps CLAUDE.md), and confirm from a transcript.
- **The user's hooks and settings.** Hooks in `~/.claude/settings.json` (and the project's) would run inside our sessions. Test whether `--setting-sources` or a Monteverdi-supplied `--settings` file keeps them out.
- **`--exclude-dynamic-system-prompt-sections`.** Probably moot once Claude Code's prompt is replaced; confirm from the first real request, and check whether Claude Code still adds environment details anywhere.
- **Permissions.** Confirm that `Read`, `Grep` and `Glob` work without prompting in the working folder and `--add-dir` folders, and that `--allowedTools` with `mcp__monteverdi__*` lets our tools run headless.
- **`${VAR}` in a `--mcp-config` file.** Claude Code expands `${VAR}` in `.mcp.json` from the environment; confirm it does the same in a file passed with `--mcp-config`, so secrets can stay in the session's environment (from the project's `.env`) rather than be written into the run folder. If it doesn't, code substitutes them into the run's config file, which is outside the repo.
- **A `tools:` key in a skill's frontmatter.** Confirm Claude Code ignores a key it doesn't know, so adding one for Monteverdi doesn't break the skill in your own sessions.
- **User-scope MCP servers.** A personal rule may name one of your own servers rather than one in `.mcp.json`. They live in Claude Code's own config; find a stable way to read one's definition (`claude mcp get <name>`, say) or fall back to `.mcp.json` only.
- **Build sessions** (noted 2026-11-19):
  - **Our settings file.** That `--settings <run folder>/settings.json` loads the edit-rule hook, and that `--setting-sources` keeps your own hooks and settings out while still applying ours.
  - **The hook's feedback.** That a PostToolUse hook exiting 2 shows its stderr to the model after `Edit` and `Write`, as the edit-rule design assumes. Claude Code's hooks docs (read 2026-11-19) confirm exit 2 "shows stderr to Claude", and cap plain **stdout** at 10,000 characters (longer output goes to a file with a 2,000-character preview, and the model isn't told to read it; no setting raises it). They state no cap for stderr: check whether one applies, since edit-rule output passes through untrimmed.
  - **The hook's timeout.** The docs give a default of 600 seconds for a command hook, set per hook in seconds with `timeout`, and state no maximum. Confirm a very large value (a day, say) is accepted, so ours never cuts an edit rule off.
  - **Background shells on exit.** Whether a dev server the build session started with Bash is killed when its process exits; code frees `$PORT` before review either way.
  - **Turning compaction off** in a headless run: find the setting or environment variable, and confirm none happens.
  - **Context full.** What a refused call looks like in `stream-json` output, so code can tell it apart from other errors and start the fresh session.
  - **The MCP timeout.** That a tool call can wait as long as `submit`'s checks take; if not, raise Claude Code's MCP timeout for build sessions.
  - **Resuming headless.** That `claude -p --resume <id> "<message>"` with the same flags continues the session with its cache intact, and that `--max-turns` counts per run.
- **The MCP schema check.** Confirm what a shape error (missing field, wrong type) looks like to the model, so our own errors can match its tone.
- **Any agent** (noted 2026-11-19, from the consolidation):
  - **Resuming with the stored system text.** That `--resume` with the same `--system-prompt-file` bytes hits the cache, and what happens if the file differs (rules changed since the session started).
  - **The cache's lifetime.** One hour on a subscription, five minutes on an API key unless `ENABLE_PROMPT_CACHING_1H=1` is set. The ~55-minute warm threshold assumes an hour; find how code can tell which applies.
  - **Usage limits.** What a subscription's usage limit looks like in `stream-json`, so code can tell it from a crash (retrying at once would fail again).
  - **Stopping a run.** That killing a headless process (Discard, Stop) leaves a transcript `--resume` can still continue.
- **Legislator** (noted 2026-11-19):
  - **Scratch worktree setup time.** How long `try_rule`'s `prompting` checkout and setup take on a real project, first time and again; if it's long, keep one scratch worktree per legislator session instead of one per run.
  - **The MCP timeout** for `try_rule`, which has no time limit: as for `submit`, raise Claude Code's MCP timeout for this role.

## Open

- **Vocabulary pass** across all agents, together (in progress; see [Vocabulary](#vocabulary)).
- **Publish:** designed as a mechanical step (see [Publish](#publish)). Still to do: draft publish rules into the legislator's fixed text and `write_rule` (`steps`); decide what a step's environment holds and where steps run; and design fix tasks at sign-off (their ID, brief, and what one from Request fix gets).
