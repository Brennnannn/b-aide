<!--
Monteverdi's MCP tools as the scoping session sees them: each tool's description and its
parameters' descriptions (the model reads these), what code checks, and the wording of what
comes back. The system text says when and why to use each tool; this says what it takes.
Dialogue's tools (reply, finalize_answer, the child tools, finalize_sections, history) are
still to draft here.

The server is started with the session's role and lists only that role's tools; it also
words results per role where noted.
-->

# breadcrumb

Shared by every agent.

**Description:** Returns a node in full, with its explanation and its Answer or Sections, plus
the explanations of its ancestors up to the root.

| Parameter | Type | Description |
|---|---|---|
| `id` | string, required | The node's ID, e.g. `checkout.4f1a2.b7d05`. |

**Checks:** the ID is well formed and the node exists.

**Returns:** the node, with a status line under its heading (`Status: to build (new)`, `to build
(stale)`, `built`; none for a sectioned node), then its ancestors, nearest first.

**Errors:**
- `No node checkout.4f1a2.zzzzz. Its nearest existing ancestor is checkout.4f1a2.`
- `"checkout.4f1a2.zz" isn't a node ID. IDs look like checkout.4f1a2.b7d05.`

# reopen

Shared by every agent; the result is worded per role.

**Description:** Opens a Dialogue on a node whose Answer is wrong, contradicts the code, or
leaves open a decision your work needs, and pauses the work that waits on it. `reason`
becomes the Dialogue's first turn.

| Parameter | Type | Description |
|---|---|---|
| `id` | string, required | The node to reopen. |
| `reason` | string, required | What you found, where (with file paths), and why it matters, so the user can settle it without investigating again. Markdown. |

**Checks:** the node exists; `reason` isn't empty.

**Does:** writes `reason` as the opening turn of the node's Dialogue, or as a new turn if one
is open. For scoping, cancels this build: no plan is kept, and `submit_plan` is refused for
the rest of the run.

**Result (scoping):** `Reopened checkout.4f1a2.b7d05; this build is cancelled. Reopen any
other nodes you've found, then end your turn.`

**Errors:**
- `No node checkout.4f1a2.zzzzz. Its nearest existing ancestor is checkout.4f1a2.`
- `reason is empty. Say what you found and why it matters.`

# submit_plan

Scoping only.

**Description:** Submits the build plan. Monteverdi checks the whole plan and returns every
problem at once; fix them and submit the whole plan again. On success Monteverdi writes the
plan file for the user to approve.

| Parameter | Type | Description |
|---|---|---|
| `approach` | string, required | One to three sentences for the user: how you split the work and why. |
| `tasks` | array, required, at least 1 | The tasks, in a sensible reading order. Other fields refer to a task by its position, starting at 1. |
| `tasks[].nodes` | string[], required, at least 1 | IDs of the nodes this task builds. Every node marked to build goes in exactly one task. |
| `tasks[].after` | integer[] | Positions of tasks this one waits for, beyond what its nodes' dependencies already require: when the code shows it needs something another task creates. |
| `tasks[].files` | string[], required, at least 1 | Files and glob patterns, relative to the repository root, that this task will create or edit. As narrow as you can name them. |
| `tasks[].rules` | string[] | Names of build rules and skills that fit this task beyond those its files bring. |
| `tasks[].goal` | string, required | How this task fits the plan: what it takes from earlier tasks and what later tasks will use from it, such as a function name or a data shape. The Answers say what to build, so leave that to them. If nearby code should be left alone, say so here. |
| `tasks[].reuse` | array of `{path, use}` | Existing code the task should use. |
| `tasks[].reuse[].path` | string, required | A file or folder that exists now, relative to the repository root. |
| `tasks[].reuse[].use` | string, required | What to use from it and for what, naming functions, components or types. |
| `tasks[].done` | string, required | What to check before submitting the task: observable results, including what later tasks rely on. |
| `response` | string | Only when revising after feedback: what you changed in reply and, for any point you didn't follow, why. Monteverdi shows it under the feedback. |

**Fixed silently** (one possible meaning): a rule the task's `files` would bring anyway; a
leading `./`; duplicate entries.

**Checks and errors.** Every problem is returned at once, as a numbered list headed `The plan
has N problems; fix them and submit the whole plan again:`

| Check | Error |
|---|---|
| Every node to build is in a task | `checkout.4f1a2.e9a07 (Refund emails) is to build but in no task. Add it to a task.` |
| …in only one | `checkout.4f1a2.e9a07 is in tasks 1 and 3. Put it in one.` |
| Only nodes to build | `checkout.e81d4 (Ledger) is built and current, so it isn't work. Remove it from task 2; if task 2 uses its code, name that in reuse.` |
| IDs are in the subtree | `Task 2: no node checkout.4f1a2.zzzzz in this subtree.` |
| `after` positions exist | `Task 2, after: there's no task 5; the plan has 3 tasks.` |
| No task waits on itself | `Task 2, after: a task can't wait for itself.` |
| No cycles, across dependencies and `after` | `Tasks 1 and 2 wait on each other: task 1 builds Refunds, which depends on Ledger in task 2, and task 2's after names task 1.` |
| Rules exist | `Task 1, rules: no build rule or skill "uii". Build rules: ui, api, db. Skills: testing, migrations.` |
| `files` are relative and inside the repo | `Task 1, files: "../shared/x.ts" is outside the repository.` |
| `files` don't cover everything | `Task 1, files: "**" covers every file, so this task would run alone and load every rule. Name the folders it works in.` |
| `files` are valid globs | `Task 1, files: "src/[pages" isn't a valid pattern.` |
| `reuse` paths exist | `Task 2, reuse: packages/ui/Buton.tsx doesn't exist.` |
| Text fields aren't empty | `Task 3: done is empty.` |
| No earlier `reopen` this run | `This build was cancelled by reopen, so there's no plan to submit. End your turn.` |
| Not already submitted | `The plan is already submitted. End your turn.` |

**Result on success:** `Plan submitted. End your turn.`
