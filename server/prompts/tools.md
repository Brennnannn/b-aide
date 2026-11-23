<!--
B-aide's MCP tools as every agent sees them: each tool's description and its parameters' descriptions (the model reads these), what
code checks, and the wording of what comes back. The system text says when and why to use
each tool; this says what it takes.

Roles and their tools:
- dialogue: breadcrumb, reopen, reply, history, finalize_answer, create_child, update_child,
  delete_child, finalize_sections
- scoping: breadcrumb, reopen, submit_plan
- build: breadcrumb, reopen, reply, submit
- legislator: breadcrumb, reopen, reply, write_rule, write_rule_file, delete_rule, try_rule
- review: breadcrumb, reopen, verdict

The server is started with the session's role and lists only that role's tools; it also
words descriptions and results per role where noted.

Claude Code doesn't check a call against a tool's schema (verified 2026-11-19), so the server
checks every call's shape too (a missing required field, a wrong type, an unknown field) and
returns those problems with the others, all at once, in the same plain wording:
`submit_plan: tasks[2].files is missing. List the files and globs the task works in.`
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
becomes the Dialogue's first turn. Build adds: or, with your task's ID, opens your task's
Dialogue to ask the user for help when you're stuck. For the legislator, reopening pauses
nothing: the rule change carries on.

| Parameter | Type | Description |
|---|---|---|
| `id` | string, required | The node to reopen. Build adds: or your task's ID, to ask for help. |
| `reason` | string, required | What you found, where (with file paths), and why it matters, so the user can settle it without investigating again. Markdown. |

**Checks:** the node exists; `reason` isn't empty. For build, a task ID is the session's
own task.

**Does:** writes `reason` as the opening turn of the node's Dialogue, or as a new turn if one
is open. For scoping, cancels this build: no plan is kept, and `submit_plan` is refused for
the rest of the run. For build, with a node: pauses the task (its work stays in the worktree;
tasks waiting on it wait too) and records the commit its Answers came from, so it comes back
with their diffs once every node it reopened is solved again. With its task's ID: opens
`<task-id>.dialogue.md`. Either way `submit` is refused for the rest of the run.

**Result (scoping):** `Reopened checkout.4f1a2.b7d05; this build is cancelled. Reopen any
other nodes you've found, then end your turn.`

**Result (build, a node):** `Reopened checkout.4f1a2.b7d05.1c2e3; this task is paused until
its Dialogue settles, and your work stays in the worktree. Reopen any other nodes you've
found, then end your turn.`

**Result (legislator):** `Reopened checkout.4f1a2.b7d05; the user will settle it in its
Dialogue. Carry on with the rule change.`

**Result (review):** `Reopened checkout.4f1a2.b7d05.1c2e3; this task is paused until its
Dialogue settles, and the verdicts you've given are kept. Reopen any other nodes you've
found, then end your turn.`

**Result (build, its task):** `Opened this task's Dialogue with your reason. End your turn;
B-aide will bring you back with the user's reply.`

**Errors:**
- `No node checkout.4f1a2.zzzzz. Its nearest existing ancestor is checkout.4f1a2.`
- `reason is empty. Say what you found and why it matters.`
- (build) `checkout.4f1a2.b7d05.build.2 isn't your task. To ask for help, use your own task's
  ID, checkout.4f1a2.b7d05.build.1.`

# submit_plan

Scoping only.

**Description:** Submits the build plan. B-aide checks the whole plan and returns every
problem at once; fix them and submit the whole plan again. On success B-aide writes the
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
| `response` | string | Only when revising after feedback: what you changed in reply and, for any point you didn't follow, why. B-aide shows it under the feedback. |

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

# reply

Dialogue, build and legislator; the description, parameters and result are worded per role.

**Description (dialogue):** Posts your turn in this Dialogue. Call it once, at the end of your
turn, with your whole answer, then end your turn. B-aide writes it into the Dialogue file
under your name.

**Description (build):** Posts your turn in your task's Dialogue with the user. Only while your
task's Dialogue is open. Call it once, at the end of your turn, then end your turn.

**Description (legislator):** Your turn in the conversation about this rule change: what you
changed and why, what the runs showed, what you assumed. Call it once, at the end of your
turn, then end your turn. Your last reply before the user accepts becomes the commit's body.

| Parameter | Type | Description |
|---|---|---|
| `message` | string, required | Your turn, in Markdown. Bold and lists for structure; no headings (they're reserved for the design's nodes). |
| `findings` | string | Dialogue and build only. What you learned exploring that bears on the decision and that someone starting from the file alone would need: file paths, constraints, approaches you ruled out and why. Shown collapsed under your turn. |

The legislator's `reply` has no `findings`: its conversation is kept in B-aide's state,
and the commit is the lasting record. Build sessions get `reply` from the start (adding a
tool mid-session would break the cache) and it's refused until the task's Dialogue is open.

**Does:** writes `**Claude:**`, the message and, if given, a collapsed `<details>` Findings
block as the next turn of the node's or task's Dialogue file (for the legislator, the next
turn of its conversation).

**Fixed silently:** headings in `message` or `findings` become bold lines; trailing
whitespace; a leading `**Claude:**` the session wrote itself.

**Checks and errors:**

| Check | Error |
|---|---|
| `message` isn't empty | `message is empty. Write your turn.` |
| One reply per turn | `You've already replied this turn. End your turn; the user will answer.` |
| (build) The task's Dialogue is open | `reply is for your task's Dialogue, and none is open. To ask the user for help, call reopen with your task's ID, checkout.4f1a2.b7d05.build.1.` |

**Result:** `Posted. End your turn.`

# history

Dialogue only.

**Description:** Returns how a node's Answer or Sections were reached: the full Dialogue as it
stood just before it was condensed. Use it when the reasons behind a decision matter to the
one in front of you.

| Parameter | Type | Description |
|---|---|---|
| `id` | string, required | The node. |
| `back` | integer, default 1 | Which condensed Dialogue: 1 is the most recent, 2 the one before, and so on. |

**Does:** finds the node's pre-writeup commits (newest first) and returns the Dialogue file
from the `back`-th, headed with its date and what it ended in (an Answer, or Sections).

**Errors:**
- `No node checkout.4f1a2.zzzzz. Its nearest existing ancestor is checkout.4f1a2.`
- `checkout.4f1a2.b7d05 has never had a Dialogue condensed.`
- `checkout.4f1a2.b7d05 has 2 condensed Dialogues; back: 3 is too far.`

**Result:** `Dialogue 1 of 2 on Refunds (checkout.4f1a2.b7d05), condensed 2026-11-14 into an
Answer:` then the file.

# finalize_answer

Dialogue only.

**Description:** Condenses this Dialogue into the node's Answer and closes it. B-aide
commits the Dialogue as it stands, writes the Answer into the node, deletes the Dialogue file
and commits again.

| Parameter | Type | Description |
|---|---|---|
| `answer` | string, required | The decided result, written for someone who never saw this Dialogue to build from: what to build, each decision, and the reason wherever a builder could otherwise go wrong. Markdown, no headings. Replaces any earlier Answer. |
| `explanation` | string | Only if the Dialogue changed what the endeavor is: its new explanation, whose first sentence is its summary. Leave out to keep the current one. |
| `depends_on` | string[] | IDs of nodes that must be built before this one. Replaces the node's current list; pass `[]` to clear it. Leave out to keep it. |

**Fixed silently:** headings in `answer` become bold lines; duplicate or self-repeated IDs in
`depends_on`; trailing whitespace.

**Checks and errors.** Every problem at once, headed `Nothing was finalized; N problems:`

| Check | Error |
|---|---|
| `answer` isn't empty | `answer is empty. Write the decided result.` |
| The node has no Sections | `Refunds has Sections, so it can't have an Answer too. To replace them with an Answer, delete its children with delete_child first; to keep them, call finalize_sections.` |
| `depends_on` IDs exist | `depends_on: no node checkout.4f1a2.zzzzz.` |
| Not itself, an ancestor or a descendant | `depends_on: checkout.4f1a2 is an ancestor of this node; a node is built as part of its ancestors.` |
| No cycle | `depends_on: Ledger already depends on Refunds (through Ledger entries), so this would be a cycle.` |
| The summary fits | `explanation: the first sentence is 41 words; the summary is copied wherever the node is listed, so keep it under about 25.` |

**Result:** `Refunds now has its Answer; the Dialogue is committed and closed. End your turn.
If the user objects, reply as usual: that reopens the node.`

# create_child

Dialogue only.

**Description:** Adds a child endeavor to this node, for when the Dialogue shows the endeavor
has several parts. Written at once; the split takes effect when you call finalize_sections.

| Parameter | Type | Description |
|---|---|---|
| `title` | string, required | Short, unique among its siblings. |
| `explanation` | string, required | What this part is and what was decided about it alone. The first sentence is its summary. |
| `depends_on` | string[] | IDs of nodes this child needs built first. A sibling created earlier in this turn can be named by its ID from that call's result. |
| `seed` | string | What's still open about this child: where the discussion stands, as the opening turn of the child's own Dialogue. Leave out when nothing is open. |
| `after` | string | ID of the sibling to place it after. Leave out to add it at the end. |

**Does:** assigns a random segment, writes the child under this node's Sections (inline or
in its own file, as the split budget decides), and, with `seed`, opens its Dialogue file
with that turn. Nothing is committed until finalize_sections.

**Fixed silently:** headings in text fields become bold lines; trailing whitespace.

**Checks and errors** (every problem at once, headed `The child wasn't created; N problems:`):
empty `title` or `explanation`; a sibling with the same title (`Refunds already has a child
"Refund API" (checkout.4f1a2.b7d05.1c2e3); use update_child to change it.`); `depends_on` as
for finalize_answer; `after` not a child of this node.

**Result:** `Created Refund API (checkout.4f1a2.b7d05.1c2e3), with a seed.`

# update_child

Dialogue only.

**Description:** Changes one of this node's children: its title, explanation, dependencies or
place. Its ID stays. Pass only what changes.

| Parameter | Type | Description |
|---|---|---|
| `id` | string, required | The child. |
| `title` | string | New title. |
| `explanation` | string | New explanation, whole. |
| `depends_on` | string[] | Replaces its list; `[]` clears it. |
| `after` | string | ID of the sibling to move it after; `""` moves it first. |

If the change makes a child's Answer wrong, call `reopen` on it with why; `update_child` doesn't
touch Answers or Dialogues.

**Checks and errors:** the ID is a child of this node (`checkout.e81d4 isn't a child of
Refunds. Its children: Refund API (…1c2e3), Ledger entries (…7a9f0).`); at least one field
given; the same checks as create_child for what's given.

**Result:** `Updated Refund API: title, depends_on.`

# delete_child

Dialogue only.

**Description:** Deletes one of this node's children and everything under it. Built code stays
where it is: say in another child's explanation what happens to it.

| Parameter | Type | Description |
|---|---|---|
| `id` | string, required | The child. |
| `reason` | string, required | Why it goes. Kept in the commit, so the user sees it in review. |

**Checks and errors:**

| Check | Error |
|---|---|
| A child of this node | as update_child |
| Not being scoped or built | `Refund API is being built (task checkout.4f1a2.b7d05.build.1). It can't be deleted until that build finishes or is cancelled.` |
| `reason` isn't empty | `reason is empty. Say why this child goes.` |

**Result:** `Deleted Refund API and 2 nodes under it.` For a built node, adds: `Its code is
still in server/refunds/ (from its build); say in a child's explanation what happens to it.`

# finalize_sections

Dialogue only.

**Description:** Closes this Dialogue with the node split into its children. B-aide
commits the Dialogue as it stands, writes the explanation, deletes the Dialogue file and
commits again, children and their seeds included.

| Parameter | Type | Description |
|---|---|---|
| `explanation` | string, required | The endeavor's explanation, keeping what was decided for the whole. What's about one child belongs in that child. The first sentence is its summary. |
| `depends_on` | string[] | As for finalize_answer. |

**Does:** if the node had an Answer, removes it (a node has an Answer or Sections, not both);
the pre-writeup commit keeps it in history.

**Checks and errors** (every problem at once, headed `Nothing was finalized; N problems:`):
empty `explanation`; the node has no children (`Refunds has no children yet. Create them with
create_child, or call finalize_answer for an Answer.`); `depends_on` and the summary as for
finalize_answer.

**Result:** `Refunds now has 3 Sections; 2 have seeds waiting in their Dialogues. The Dialogue
is committed and closed. End your turn.`

# submit

Build only.

**Description:** Hands in your task. B-aide commits your worktree, applies it onto the
endeavor branch, and runs the project's checks while you wait. If any fail, the result says
which and why; fix them and submit again. Once they pass, the task goes on to the review session and you
end your turn.

| Parameter | Type | Description |
|---|---|---|
| `message` | string, required | The commit message for the task: a subject line, then optionally a blank line and a body for what a later reader needs that the Answers don't say. Follow the project's conventions for commit messages if it has any. B-aide adds the trailers. |

**Does,** in order, stopping at the first step that fails:
1. Checks the worktree (below).
2. Commits it on the task branch and applies the task onto the endeavor branch's tip as one
   commit, with `message` and the trailers (`B-aide-Task:`, `B-aide-Node:` per node, co-authors). On a
   conflict, leaves the markers in the worktree.
3. Runs the edit rules and review commands selected by the changed files, in the worktree,
   at that commit. No time limit; the user can stop a check from the UI, which counts as it
   failing.
4. Hands the task to a review session (in the same worktree) if any agent review
   rules are selected; otherwise merges it under the endeavor's merge lock, re-applying it
   and re-running step 3 first if the endeavor branch moved.

**Fixed silently:** trailing whitespace in `message`; trailers the session wrote itself
(code writes its own).

**Checks and errors:**

| Check | Error |
|---|---|
| `message` has a subject | `message is empty. Write a commit message for the task.` |
| Something changed | `Nothing has changed since this task started (3f9c2a1). Build the task, then submit.` |
| Nothing under `b-aide/` changed | `You changed files under b-aide/: b-aide/endeavors/checkout/checkout.4f1a2.md. B-aide's files change only through its tools, so restore them (git checkout -- <path>). If the design is wrong, call reopen on its node.` |
| No conflict markers left | `server/routes.ts still has conflict markers (lines 40-52). Resolve them, then submit again.` |
| No `reopen` earlier this run | `This task is paused by your reopen, so there's nothing to submit. End your turn.` |
| Not already in review | `This task is already in review. End your turn.` |

**Result on a conflict:** `Your changes conflict with the endeavor branch in server/routes.ts,
changed by task 2 (Refund emails), which merged after your task started. The conflict
markers are in your worktree; resolve them so both changes work, then submit again.`

**Result on failed checks:** a numbered list headed `2 of 6 checks failed; fix them and submit
again:`, each item the rule's name and type, its output trimmed to about 40 lines, and the
path of the full output in the run folder; then `Passed: color-tokens, lint, format, unit.`

```
1. typecheck (review command):
   server/refunds/create.ts(14,7): error TS2322: Type 'string' is not assignable to type 'number'.
   Full output: {run_dir}/submit-2/typecheck.txt
```

A stopped check's item ends `Stopped by the user after 14m03s.`

**Result on success:** `All 6 checks passed; the task goes on to the review session. End your turn;
B-aide will bring you back if review finds anything.` With no agent rules selected:
`All 6 checks passed and the task merged. End your turn.`

**Note, on any result after the checks ran,** when the task changed files outside its `files`
(the UI shows the same list; nothing enforces it): `Changed outside this
task's files: server/db/schema.ts (also in task 3's files, still in flight). Change only what
the work needs there.`

# write_rule

Legislator only.

**Description:** Writes a rule's `SKILL.md`, creating the rule if it's new. Pass the whole
frontmatter and body: they replace what's there. B-aide checks it and returns every
problem at once; fix them and call again. Notes in the result are written anyway; mention
them to the user if they matter.

| Parameter | Type | Description |
|---|---|---|
| `scope` | `"project"` or `"personal"`, default `"project"` | Personal only when the user asks for a rule of their own. Publish rules are always the project's. |
| `type` | `"dialogue"`, `"scoping"`, `"build"`, `"edit"`, `"review"` or `"publish"`, required | Which agent or step the rule is for. |
| `name` | string, required | The rule's folder name: lowercase letters, digits and hyphens. |
| `description` | string, required | When the rule applies, in one sentence. Build rules are chosen by it; for a check, it says what passing means; for a publish rule, it's the kind of change, as the user picks it. |
| `steps` | array of `{run}` or `{confirm}` | Publish rules only: the procedure, in order. `run` is a shell command, run from the repository root at the signed-off commit; `confirm` is the text shown while it waits for the user. `[]` for a kind that ships nothing on its own. |
| `paths` | string[] | Build, edit and review rules: glob patterns, relative to the repository root, for the files the rule concerns. Without it a check runs on every change, and a build rule is chosen only by its description. |
| `run` | string | Edit rules and review commands: the command, run from the repository root. A review rule with `run` is a command; one without is an agent rule, and its `body` is what the review session carries out. A script in the rule's folder is named by its path from the root, e.g. `node b-aide/rules/edit/color-tokens/check.mjs`. |
| `tools` | string[] | Rules an agent reads: MCP servers from the project's `.mcp.json`, or `WebFetch`, `WebSearch`. |
| `body` | string | Markdown. For guidance and agent rules, what the agent reads, with any `` !`command` `` whose output it should get. Optional for commands. |

**Does:** writes `SKILL.md` in the rule's folder in the legislator's worktree (or its worktree
of the personal rules repo). Frontmatter keys this tool doesn't take, already in the
file, are kept. Runs each embedded `` !`command` `` once, as it would run when the rule is
injected.

**Fixed silently:** a leading `./` in `paths`; duplicate entries; a full MCP tool name in
`tools` (`mcp__playwright__browser_navigate` → `playwright`); a step given as a plain string
(it becomes `{run: "<string>"}`); trailing whitespace.

**Checks and errors.** Every problem at once, as a numbered list headed `The rule has N
problems; fix them and call write_rule again:`

| Check | Error |
|---|---|
| `name` is a slug | `name "Color Tokens" isn't valid: use lowercase letters, digits and hyphens, e.g. color-tokens.` |
| `description` isn't empty | `description is empty. Say when this rule applies.` |
| Edit rules have `run` | `edit rules run a command, so they need run.` |
| Review rules have `run` or a body | `A review rule needs run (a command) or a body (instructions for the review session).` |
| `run` only on commands | `run is for edit rules and review commands; a build rule is read, not run.` |
| `paths` only where something selects by it | `paths is for build, edit and review rules; every Dialogue rule reaches every Dialogue session.` |
| `tools` only where an agent reads the rule | `tools is for rules an agent reads; a command can't use MCP servers.` |
| A body where an agent reads it | `A build rule's body is what the build session reads; it's empty.` |
| `paths` are valid, relative, inside the repo | `paths: "src/[pages" isn't a valid pattern.` · `paths: "../shared/**" is outside the repository.` |
| `tools` exist | `tools: no server "playwrite" in .mcp.json. Servers: playwright, postgres.` |
| A file `run` names in the rule's folder exists | `run names b-aide/rules/edit/color-tokens/check.mjs, which doesn't exist. Write it with write_rule_file.` |
| Embedded commands run | The command and its exit code, `It runs whenever this rule is injected, so it has to work:`, then its output. |
| Publish rules have `steps` | `publish rules need steps; pass [] for a kind that ships nothing on its own.` |
| `steps` only on publish | `steps is for publish rules.` |
| Each step is one thing | `steps[3] has both run and confirm; a step is one or the other.` |
| Steps aren't empty | `steps[2].run is empty.` |
| No check or agent fields on publish | `paths, run and tools aren't for publish rules: no agent reads them and no file selects them.` |
| Publish rules are the project's | `Publish rules belong to the project: everyone who signs off uses them. Leave out scope.` |
| `B_AIDE_` variables exist | `steps[2] uses $B_AIDE_TITEL; the variables are B_AIDE_BASE, B_AIDE_CHANGED_FILES, B_AIDE_NODES, B_AIDE_SIGNOFF, B_AIDE_ENDEAVOR, B_AIDE_TITLE, B_AIDE_SUMMARY, B_AIDE_COMPLETE.` |
| A file in the rule's folder that a step names exists | `steps[1] names b-aide/rules/publish/hotfix/sync.sh, which doesn't exist. Write it with write_rule_file.` |

**Notes** (written anyway, listed after the result):
- For a publish rule with no `run` steps: `This kind ships nothing on its own; its endeavors
  wait for the next procedure that pushes.`
- For a review rule with both `run` and a body: `This rule has run, so it's a command; its
  body is for people reading the rule, and no session sees it.`
- `paths: "src/legacy/**" matches no file today.`
- `A personal build rule "ui" exists too; this project rule takes its place in this project.`
  (or, for a personal rule, the reverse)
- For a rule with embedded commands: what each printed, so the user sees what the agent will
  get.

**Result:** `Wrote b-aide/rules/edit/color-tokens/SKILL.md.` Then any notes.

# write_rule_file

Legislator only.

**Description:** Writes a file in a rule's folder: a script its command runs, or an example
its body points to. Pass the whole content. The rule must exist; write its `SKILL.md` with
`write_rule` first.

| Parameter | Type | Description |
|---|---|---|
| `scope` | `"project"` or `"personal"`, default `"project"` | |
| `type` | rule type, required | |
| `name` | string, required | The rule. |
| `path` | string, required | Relative to the rule's folder, e.g. `check.mjs`. |
| `content` | string, required | The whole file. |

**Checks and errors:**

| Check | Error |
|---|---|
| The rule exists | `No edit rule "color-tokens". Create it with write_rule first.` |
| Inside the rule's folder | `path "../ui/x.mjs" is outside the rule's folder.` |
| Not `SKILL.md` | `SKILL.md is written with write_rule.` |

**Result:** `Wrote b-aide/rules/edit/color-tokens/check.mjs.` If the rule's command
names this file: `Not tried since this change.`

# delete_rule

Legislator only.

**Description:** Deletes a rule, or one file in its folder. Rules can't be renamed (build
plans name them), so a rename is a delete and a new rule.

| Parameter | Type | Description |
|---|---|---|
| `scope` | `"project"` or `"personal"`, default `"project"` | |
| `type` | rule type, required | |
| `name` | string, required | The rule. |
| `file` | string | A file in its folder, relative to it. Without it, the whole rule goes. |

**Errors:**
- `No edit rule "color-token". Edit rules: color-tokens, no-console.`
- (publish) `Checkout and Refunds are endeavors of kind feature. The user has to change their kind first.`
- `color-tokens has no file chek.mjs. Its files: SKILL.md, check.mjs.`
- `To delete SKILL.md, delete the rule (leave out file).`

**Result:** `Deleted the edit rule color-tokens.` If its command named the deleted file:
`Its run still names check.mjs; change run with write_rule.`

# try_rule

Legislator only.

**Description:** Runs a check's command the way B-aide will, with your current version of
the rule, and returns its exit code and output. Run it on the current code, on sample files
you pass, and on the prompting commit when there is one. The user sees every run.

| Parameter | Type | Description |
|---|---|---|
| `scope` | `"project"` or `"personal"`, default `"project"` | |
| `type` | `"edit"` or `"review"`, required | |
| `name` | string, required | The rule. |
| `on` | `"current"`, `"sample"` or `"prompting"`, required | `current`: your worktree, the project's signed-off code. `sample`: your worktree plus the files in `files`, removed again afterwards. `prompting`: the commit your first message names, the way `submit` ran it. |
| `files` | array of `{path, content}` | With `on: "sample"`: files to write for this run, relative to the repository root. They're the changed files the command sees. |
| `changed` | string[] | With `on: "current"`: the changed files to give the command, as paths or globs. Defaults to every tracked file the rule's `paths` match, or every tracked file if it has none, as if all the code had just changed. |

**Does:** runs the command under the command contract, using the rule's folder from your
worktree wherever it runs. With `prompting`, code checks the commit out into a scratch
worktree (setting it up first, which can take a while the first time), and the changed
files are the ones that commit changed since its base, as at `submit`. No time limit.
Code records every run for the user's review.

**Checks and errors:**

| Check | Error |
|---|---|
| The rule is a command | `ui-check is an agent rule: it can't be run. Read it as the review session will.` |
| `files` with `sample` | `on: "sample" needs files.` |
| A prompting commit exists | `Your first message names no prompting commit. Use current or sample.` |
| `changed` matches something | `changed: "src/legacy/**" matches no tracked file.` |

**Result:** `Exit 1 after 2.4s, with 214 changed files.` Then the output trimmed to about 40
lines, and the path of the full output in the run folder. If the user stopped it:
`Stopped by the user after 4m12s.` and the output so far. Note, when it failed and printed
nothing: `It failed without saying why. Print each problem: file, line, what's wrong, what to
do instead.`

# verdict

Review only.

**Description:** Gives your verdict on one review rule. Call it once for every rule in your
instructions, by name. A rule you give no verdict counts as failed. Calling it again for the
same rule replaces your earlier verdict.

| Parameter | Type | Description |
|---|---|---|
| `rule` | string, required | The rule's name, as in your instructions. |
| `pass` | boolean, required | Whether the change meets the rule. |
| `problems` | array, required when `pass` is false | What the build session has to fix, one entry per problem. Only problems the rule covers. |
| `problems[].file` | string, required | A file in the change, relative to the repository root. |
| `problems[].line` | integer | The line, if the problem is at one place. |
| `problems[].what` | string, required | What's wrong, and how you saw it (for a page: what you did and what happened). |
| `problems[].fix` | string, required | What to do instead. |
| `suggest_rule` | object | Optional, on a pass or a fail: a rule change that would stop this kind of problem being built, or catch it with a command instead of review. The user decides whether to act on it. |
| `suggest_rule.type` | `"build"`, `"edit"` or `"review"`, required | Build to prevent it, edit for a fast per-file check, review for a slower command. |
| `suggest_rule.name` | string | An existing rule to change. Leave out to suggest a new one. |
| `suggest_rule.proposal` | string, required | What the rule should say or check, in a sentence or two. B-aide attaches this commit and your verdict as the evidence. |

**Does:** records the verdict against the task's commit. Once every rule has one, code sends
the failures (each problem as `file:line: what. Fix: fix`) back to the build session, or
merges the task if all pass. A suggestion goes to the user's review log with its evidence.

**Fixed silently:** trailing whitespace; a leading `./` in `file`; `problems` given on a pass
(dropped, with a note in the result); a full rule path in `suggest_rule.name`
(`b-aide/rules/build/ui` → `ui`).

**Checks and errors** (every problem at once, headed `The verdict wasn't recorded; N
problems:`):

| Check | Error |
|---|---|
| The rule is one of yours | `No rule "ui-chek" in your instructions. Your rules: ui-check, refund-correctness.` |
| A fail has problems | `ui-check failed with no problems. List what the build session has to fix.` |
| Each file is in the change | `problems[2].file: server/payments/capture.ts isn't in this change. Problems are about the change; if code outside it is wrong, say so in a problem on the file in the change that relies on it.` |
| The line exists | `problems[1].line: src/components/RefundDialog.tsx has 88 lines.` |
| Text fields aren't empty | `problems[1].fix is empty. Say what to do instead.` |
| A named rule exists | `suggest_rule.name: no build rule "uii". Build rules: ui, api, db. Leave out name to suggest a new rule.` |
| No `reopen` earlier this run | `This task is paused by your reopen. End your turn.` |

**Result:** `Recorded: ui-check failed (2 problems). Still to give: refund-correctness.` Once
the last one is in: `All verdicts recorded. End your turn.`
