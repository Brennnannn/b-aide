# Monteverdi agents

Draft, 2026-11-10. These are first sketches of each agent Monteverdi runs. Each one gets a detailed design later, where we'll tighten the vocabulary and write its rules together. Terms (endeavor, Solution, Answer, Dialogue, Sections, test station, ...) are defined in [language.md](language.md).

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

## Dialogue session

- **Purpose:** works toward a Solution with you, inside the node's dialogue file.
- **Starts:** when you write in a Dialogue. A Dialogue can be opened by you, by another session calling `reopen`, or seeded by `finalize_sections`; code writes the opening turn (the reopen reason, the seed), and no session starts until you reply, so nothing is spent on a Dialogue nobody comes back to, possibly for a long time.
- **Runs in:** the endeavor worktree.
- **Lifetime:** one session per Solution, resumed while its prompt cache is warm; a fresh session from the file once it's cold (below).
- **Reads:** the node's breadcrumb, its dialogue file, and whatever code it needs to explore to answer well.
- **Writes:** nothing directly; it has no file-writing tools. Each turn goes through `reply`, and code writes it into the dialogue file. On finalize (once you've agreed to the decisions, or when you say so): `finalize_answer` with the Answer, or, if the Dialogue showed the endeavor has several parts, the child tools (`create_child`, `update_child`, `delete_child`) and then `finalize_sections` with the endeavor's revised explanation. Code assigns IDs and writes the files (see [language.md](language.md#solutions)).
- **Warm or fresh, one rule:** if the node's session is warm (last call under ~55 minutes ago) or its history is small (under ~30k tokens, where a cold resume costs about what a fresh start does), code resumes it and sends only what's new: any turns added to the file since the session last saw it (another agent's `reopen`, say), then your message or "Finalize now". Otherwise code starts a fresh session whose first message is one template with optional parts: the breadcrumb (always), the dialogue so far (if the file has turns), and the trigger. A brand-new Dialogue is just that template with no dialogue yet; reopening and finalizing need no variants of their own. A hand edit to earlier turns forces a fresh session.
- **Never:** commits (Monteverdi makes the pre-writeup and writeup commits), or edits nodes other than its own and its new children.
- **Cold start = fresh session from the file.** Build sessions run continuously, so their caches stay warm; Dialogues are what sit idle. When a Dialogue is reactivated after its prompt cache has expired (one hour on a subscription), Monteverdi doesn't resume or compact the old session. It starts a fresh one that reads the node's breadcrumb and the dialogue file, then answers your reply. The conversation is already in the file, so a summary of the old session would only repeat it. What the old session held beyond the file was mostly code it had read and its thinking; the fresh session re-reads only the code it needs. Monteverdi never compacts.
- **Writes down what it learns.** Because a cold start keeps only the files, a Dialogue session puts anything it found exploring that matters to the decision (file paths, constraints, an approach it ruled out and why) into the collapsed **Findings** block of its turn (see [language.md](language.md#solutions)), not just into its own context. You read the message; a fresh session reads the findings too.
- **Instructions:** every [Dialogue rule](rules.md#dialogue-rules), injected in full.
- **Starts lean:** planning needs no build tools. Monteverdi's MCP server and read-only code tools are usually enough. It does load the project's CLAUDE.md, since project context helps design. Built-in tools: `Read`, `Grep`, `Glob`, plus `WebSearch` and `WebFetch` for questions about external APIs (their definitions are small and cached, and adding tools mid-session would break the cache, so they're loaded from the start).
- **Turn limit:** `--max-turns 30` per run, i.e. up to 30 model calls to produce one reply; it resets with each message. A backstop for a headless run nobody is watching, not a budget. Common practice puts 20–30 at the top end, for complex tasks. Code logs the calls each run uses so the limit can be tuned, and a run that hits it shows in the UI with a Retry button.

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

**Configuration:**

| | |
|---|---|
Decided 2026-11-18.

| | |
|---|---|
| System text | `--system-prompt-file`: the shared block, `scoping.md`, then every [scoping rule](rules.md#scoping-rules) in full |
| Working folder | The endeavor worktree, as the process's working directory, so `Read`, `Grep` and `Glob` reach the repo without prompting |
| Built-in tools | `--tools "Read,Grep,Glob"`: read-only by construction; no Bash, no Agent |
| Web tools | None. Outside APIs are settled in Dialogue and written into the Answers; a gap that needs the web is a design gap, so `reopen` |
| CLAUDE.md, auto memory | Left out. CLAUDE.md is written for interactive coding and re-sent on every call; scoping rules are the channel for what exists and where. A project that wants it adds a scoping rule embedding it (`` !`cat CLAUDE.md` ``) |
| MCP | `--mcp-config` naming only Monteverdi's server, `--strict-mcp-config`. Our server is started with the session's role and lists only that role's tools (`breadcrumb`, `submit_plan`, `reopen`); the same knowledge lets a tool's result wording differ per role |
| Permissions | `--allowedTools "Read,Grep,Glob,mcp__monteverdi__*"`: a headless run can't answer a prompt, so a tool needing one would just fail. Listing the read-only tools too costs nothing and doesn't depend on defaults |
| Run folder | `~/.monteverdi/runs/<session-id>/`, outside the repo and separate from worktrees: the assembled system text, the MCP config, the full changed-files list. `--add-dir` it so `Read` can open the list |
| Skills, commands | None (`--disable-slash-commands`) |
| Model | Opus 5.5, effort `high` to start. A plan runs once per build and a weak one costs every task after it; effort mostly buys thinking, billed as output, small next to the builds it shapes. Build sessions, whose choices are local and guided by build rules, run at `medium` |
| Session ID | `--session-id <uuid>` chosen by code, so a warm revision can be resumed |
| Output | `--output-format stream-json`, so code logs token use per call and the UI shows progress |
| Turn limit | `10 + 3 × nodes to build`, capped at 60 (reached at 17 nodes): the base covers orienting, `submit_plan`, one fix and the final call; 3 per node covers reading for its Reuse and files. The cap stops a runaway run long before the context gets unworkable. Per run, so a warm revision gets a fresh count. The session isn't told its limit. A backstop, tuned from logged usage |

**Failure:**

| What happens | Then |
|---|---|
| Turn limit reached without a valid plan | The run fails; the UI shows its last output and a Retry button |
| It calls `reopen` | The build is cancelled; that node is reopened |
| Process crash or API error | One automatic retry, then it fails as above |

No partial plan is ever kept.

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

In progress, 2026-11-19. Settled so far:

| | |
|---|---|
| Working folder | The task worktree |
| Built-in tools | `--tools "Bash,Read,Edit,Write,Grep,Glob"`: it writes code and runs commands. No Agent, no web tools (a rule can declare `WebFetch`), no to-do tool (the task entry is its plan) |
| Permissions | All of Bash allowed (`--allowedTools "Bash,Read,Edit,Write,Grep,Glob,mcp__monteverdi__*"` plus its rules' servers). A headless run can't answer a prompt, and patterns can't list every command a build needs. No deny list or sandbox: a session told to build just builds. **Backstop in code:** before and after each run, code records the endeavor branch and every other task branch, and fails the run if any of them moved (worktrees share the main repo's `.git`, so a session could move one) |
| CLAUDE.md | Loaded. It's written for exactly this kind of work, and leaving it out would need a new mechanism to bring it back. The fixed text's closing line says Monteverdi's instructions win where it conflicts |
| MCP | Monteverdi's server (role `build`: `breadcrumb`, `submit`, `reopen`, `reply`) plus its rules' servers, `--strict-mcp-config` |
| Skills, commands | None (`--disable-slash-commands`); chosen skills are injected as rules |
| Model | Opus 5.5, effort `medium`. Building is where most tokens go, so it's the first place to measure whether a smaller model does as well |
| Run folder | `~/.monteverdi/runs/<session-id>/`, `--add-dir`ed: system text, MCP config, settings, and long station output for the session to `Read` |
| Session ID, output | `--session-id` chosen by code (the fix loop resumes it), `--output-format stream-json` |
| Turn limit | `40 + 20 × nodes`, capped at 150, per run; a fix-loop resume gets 40. A backstop, tuned from logged usage |
| Compaction | Off. Claude Code's automatic compaction summarizes the conversation near the context limit, and summaries are weakest at what a build session leans on: which files it touched and how. The worktree is an exact record instead (below) |
| Closing line | "Build this task, then submit it." `submit` succeeding is the end; revisit if code takes over git |

**Running out.** A session doesn't see its own token count or turn count, so it can't wind down before a limit; the run just ends, and code decides what follows. Its edits are on disk in the worktree either way, committed or not.

| Limit | Then |
|---|---|
| Context full (the API refuses the next call) | Code starts one fresh session automatically: the same first message plus an optional part saying a previous session ran out of context, with the commits on the branch and the uncommitted changes since the base commit. It loses the old session's reasoning and what it had verified, not its work. If that one runs out too, the run fails to the UI |
| Turn limit | The run fails to the UI with a Retry button, which resumes the same session (its context is still usable) with a fresh count |

**Edit rules attach through one hook** (decided 2026-11-19). Claude Code runs hooks itself, outside the model, so they cost no context; the model sees only what a failing one prints. Code writes a `settings.json` into the run folder (passed with `--settings`; your own hooks are kept out with `--setting-sources`, to verify) holding one PostToolUse hook on `Edit|Write` that calls Monteverdi. Monteverdi reads which file was edited, picks the edit rules whose `paths` match (hook matchers can filter only by tool name, not by file), runs them with the [command contract](rules.md#command-contract)'s environment, and on any failure prints their combined output and exits 2, which Claude Code shows to the model. Rule scripts stay identical at both places they run, and path matching lives in code. The same hook re-runs the setup command when the edited file is the manifest or lockfile. Edits made through Bash don't trigger it; the station re-runs every edit rule anyway.

### Build session: git and tools

Decided 2026-11-19. Full descriptions, checks and error wording in `server/prompts/tools.md`.

**Code does a task's git.** The build session edits files and leaves git to Monteverdi; it may still run `git diff` or `git log` to look. Every step of a task's git is mechanical, so code does it and no trailer can be forgotten. On `submit`, code commits the worktree on the task branch and puts the task's changes onto the endeavor branch's tip as **one commit per task**, with a `Monteverdi-Node:` trailer per node and the co-author trailers. One commit per task keeps the node history clean and makes a task easy to revert or cherry-pick. If that conflicts (rare, since tasks with overlapping `files` run one after another), code leaves the conflict markers in the worktree and `submit`'s result names the files and the task that changed them; the session resolves them and submits again. Git that needs judgment about how a project ships (release cuts, hotfixes, pushing) belongs to the publish agent, whose design is still to come.

**The session writes the commit message**, as `submit`'s `message`: a subject and an optional body, following whatever conventions CLAUDE.md or its build rules set, since code can't know them and publishing may read history. Code appends the trailers.

**Its tools:** `submit`, `reopen`, `reply`, `breadcrumb`. No `check` (dropped 2026-11-19): `submit` runs the mechanical checks itself, and mid-build the session runs quick commands (a typecheck, one test file) in Bash, since its worktree has the project's environment (see [Running the app](#build-session-running-the-app)).

**`submit` runs the mechanical checks first**, so the second wave (build toward the outcome, then fix what the checks find) happens without the fixed text asking for it. Code commits, applies the task onto the endeavor branch's tip, and the station runs the edit rules and revision commands selected by the changed files while the call waits, queue included. Failures come back as the tool's result: the passing rules named in one line, each failure's rule, kind and trimmed output, with the full output in the run folder and its path. The session keeps working in the same run and submits again. Once they pass, the task is queued for the agent revision rules and the session ends its turn. Errors: nothing changed since the base commit; files under `monteverdi/` changed (revert them, and `reopen` if the design is wrong); conflict markers left in a file; a conflict; a `reopen` earlier in the run; already queued.

**One way back in.** A build session is brought back later in several situations: the revision session's notes after `submit`, your turns in an escalation Dialogue, Answers settled after its `reopen`, a Retry after the turn limit. All of them go through one path: code resumes the session with a message (`claude -p --resume <id>`) if it's warm or small, and otherwise starts a fresh session from the worktree, with the first message plus an optional part for what's new. Running out of context always takes the fresh route. So `submit` doesn't wait for the agent revision rules: that wait can be long (the queue, then a whole revision session), and blocking through it would need a raised MCP timeout, a live process per waiting task, and recovery when Monteverdi restarts mid-wait, which would use the resume path anyway. The mechanical checks are quick enough to wait for.

**`reopen` on a node pauses the task.** Its work stays in the worktree, tasks waiting on it wait too, and `submit` is refused for the rest of the run. Code records the commit the task's Answers came from. Once every node it reopened is solved again, code compares, mechanically:

- **Only Answers changed** (its nodes' or their dependencies'): the task comes back with each changed Answer's diff and the files changed so far, and reworks what they affect.
- **The structure changed** (a node of the task was deleted or gained children): the task no longer matches its plan, so code cancels it and the subtree goes back to Plan build, which revises a plan whose build was cancelled.

The session needn't anticipate rework while building; it's told exactly what changed when it comes back.

**Asking for help is `reopen` with the task's ID.** `reopen("checkout.4f1a2.b7d05.build.1", reason)` opens the task's Dialogue (`<task-id>.dialogue.md`), just as a node's ID opens the node's: one tool for "this needs the user", where a node ID means the design is wrong and the task's ID means the build is stuck (a rule that seems wrong for this case, a revision note it disagrees with, a check failing for reasons outside its code, a conflict it can't resolve). Code also escalates on its own when the same rule fails 3 times (see [rules.md](rules.md#when-revision-fails)).

**`reply` is listed from the start**, refused unless the task's Dialogue is open: tools can't be added mid-session without breaking the cache. In the escalation Dialogue the session posts its turns with `reply`, and each of your turns comes back through the one path. Once you've given guidance, it builds and submits again.

### Build session: running the app

Decided 2026-11-19. **Task worktrees get the project's environment**, like the station: a copy of the project folder's `.env` (re-copied when it changes) and a port of their own in `$PORT`. A build session can then run the project's commands and start the dev server itself (a build rule says how), and look at its page with a browser its rules bring, while it builds. Otherwise it would build UI blind and every visual mistake would cost a trip through the station: the queue, a whole revision session and a resume. Resources the worktrees share, such as one dev database that a migration in one task and tests in another both touch, are the project's to handle (a build rule, or a setup command that creates a database per worktree); Monteverdi can't know how a project's data works.

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
- **The MCP schema check.** Confirm what a shape error (missing field, wrong type) looks like to the model, so our own errors can match its tone.

## Open

- **Vocabulary pass** across all agents, together (in progress; see [Vocabulary](#vocabulary)).
- **Rules for each agent:** what each brief must contain, its tool allowlist, model and turn limit.
- **Process or subagent:** decided for the scoping session and build sessions (own processes). Still to confirm for the revision session and Dialogue sessions.
- **Station check of `files`** (idea, 2026-11-18). Code could compare a submitted task's changed files with its `files` and flag edits outside them, since tasks were allowed to run in parallel on the promise that they don't overlap. Mechanical, so it belongs to the station rather than to any brief. Decide with the station's design.
