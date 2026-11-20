# Monteverdi planning language

Draft, 2026-11-10. This is how Monteverdi stores a design as a tree of markdown files. Once Monteverdi exists it will have its own place for plans; until then, they live in `planning/`.

## Concepts

There is one kind of node, the **Endeavor**: a title and an explanation. The first sentence of the explanation is its summary (keep it under ~25 words); it's copied into the parent wherever the endeavor is listed.

Every endeavor has exactly one response:

- **Solution**: a leaf; how the endeavor gets done. It holds an **Answer** (the decided result), a **Dialogue** (a conversation working toward one), or both. See [Solutions](#solutions).
- **Sections**: a list of child endeavors, each of which gets its own response.

Status is worked out from the files and git, not stored:

| State | Meaning |
|---|---|
| open | no response yet |
| sectioned | has Sections |
| discussing | has a Dialogue, no Answer (including a sectioned node whose children are being rearranged) |
| solved | has an Answer only |
| reopened | has an Answer and a Dialogue |
| built | solved, and a build commit for it is on the endeavor branch |
| stale | built, but the Answer changed after the build commit |

A design is **fully designed** when every leaf endeavor is solved.

The root endeavor also has a lifecycle that is stored: `planned` or `working`. It's the one state the tree's structure can't show.

Runtime state that the structure can't show either (which agent is working on a node, whether it's blocked) belongs in Monteverdi's own task state, not in these files.

## Where files live

```
<project>/
  monteverdi/
    rules/                # see rules.md
      dialogue/
      scoping/
      build/
      edit/
      review/
      publish/
    endeavors/
      checkout/
        checkout.md
        checkout.4f1a2.md
        checkout.4f1a2.b7d05.md
        checkout.e81d4.md
```

- **In the project repo**, under a plain (not hidden) `monteverdi/` folder that Monteverdi scaffolds. The design is versioned and reviewed with the code. Hidden folders are skipped by ripgrep and most editor search by default, so agents would miss them.
- **One flat folder per root endeavor.** Folder depth doesn't cost anything on modern filesystems; flat wins because one listing shows the whole endeavor, sorting by name keeps each subtree together (children share their parent's prefix), and paths stay well under Windows' 260-character MAX_PATH.
- `~/.monteverdi/` stays for app config (recent folders and so on), not design content.

## IDs

- A node's ID is its parent's ID plus a segment of 5 random lowercase hex characters: `checkout.4f1a2.b7d05`.
- **Segments are random, not sequential.** Two agents on separate git branches can each create a child of the same node without coordinating. A segment only has to be unique among its siblings (1,048,576 possibilities), so collisions are very rare. The validator rejects a duplicate sibling segment if one ever appears, for example after a merge.
- **Segments are stable IDs, not positions.** Sibling order lives in the parent's Sections list, so reordering edits only the parent and never renames a file.
- The root segment (`checkout`) is a slug chosen when the endeavor is created and never renamed, because every file name starts with it.
- An ID addresses a node whether it's inline or in its own file. The resolver looks for `<id>.md` first, then for a heading tagged `{#<id>}` in the nearest ancestor's file.
- Moving a node to a different parent changes its ID and its descendants' IDs. Monteverdi does this as one operation and updates every reference.

## File format

```markdown
---
id: checkout.4f1a2
---
↑ [Checkout redesign](checkout.md)

# Stripe backend update {#checkout.4f1a2}
Move payment capture to Stripe's Payment Intents API. ...

## Webhook router {#checkout.4f1a2.0c93e}
Receives and verifies Stripe events. ...

### Solution
...

## Refunds {#checkout.4f1a2.b7d05}
→ [checkout.4f1a2.b7d05](checkout.4f1a2.b7d05.md): Partial and full refunds against captured payments.
```

- Each file starts at `#` for its own node. When the UI joins files together, it shifts each file's headings down by that file's depth.
- **Child endeavors are the next heading level down and carry a full `{#id}`.** A Solution is the next heading level down, titled `Solution`, with no ID. A full ID on every heading means a grep for `checkout.4f1a2.b7d05` finds the node wherever it lives. GitHub shows `{#id}` as literal text; that's accepted, since agents and Monteverdi read these files far more than GitHub does, and a visible ID is easy to point at.
- A child that lives in its own file keeps its heading in the parent, followed by one stub line: a link plus its summary.
- Every file except the root's starts with a link to its parent. The ID already implies the parent; Monteverdi writes this link and checks it so plain markdown viewers can navigate up.
- Root frontmatter also holds `lifecycle: planned | working` and `publish: <rule>`, the kind of change you picked when creating it (see [agents.md](agents.md#publish)).

## Splitting

Code decides where to split files, not an agent.

- **Budget:** each file's own content (its node plus inline descendants, not counting split-out files) stays under a token budget. ~3k to start. **A program constant, not a setting** (decided 2026-11-19): it decides how the repo's files are laid out, so everyone on a project must use the same value, or each person's Monteverdi would re-split what another's merged back. Monteverdi's developers tune it from real endeavors; a new value re-splits each repo once, in one commit, and hysteresis keeps it from flipping after.
- **Split:** over budget → move the largest inline child subtree into its own file. Repeat until the file fits.
- **Depth:** headings stop at H6, so an inline node that would need H6 or deeper is split out regardless of size.
- **Hysteresis:** merge a child back inline only when everything fits under ~¼ of the budget, so nodes near the line don't flip on every edit.
- **Timing:** run between agent tasks or on commit, never while an agent is editing.
- **Dialogue files don't count** toward the budget (see [Solutions](#solutions)).

## Reading and traversal

- **Down:** the Sections headings and stubs.
- **Up:** the parent link, or drop the last ID segment.
- **Sideways:** through the parent.
- **Breadcrumb read:** one tool call returns the target node in full plus only the bodies of its ancestors up to the root. Agents start there and open full parent files only when they need sibling detail.
- Because of the budget, each step up costs at most one budget's worth of tokens, so climbing past where the user guessed is cheap.

## References and dependencies

Markdown can link into a file (`file.md#heading-slug`), but renderers build those anchors from the heading text: they break on rename and get `-1` suffixes for duplicates. They'd also break when a node is split out to its own file.

So references use the **node ID** and Monteverdi resolves them:

```markdown
Depends on: [Ledger](checkout.e81d4.31af0)
```

That works whether the Ledger is inline or in its own file, and it survives splits and merges. Monteverdi reads `Depends on:` lines to order builds (see [Build](#build)).

## Solutions

A Solution has an **Answer**, a **Dialogue**, or both.

```markdown
## Refunds {#checkout.4f1a2.b7d05}
Partial and full refunds against captured payments. ...

### Solution
Refunds go through Stripe's Refund API, keyed by the original PaymentIntent. ...
```

- **The Answer** is the Solution heading's body: the decided result, written to be built from.
- **The Dialogue** is where you and the session work toward an Answer inside the files, instead of in chat. Each turn starts with the speaker in bold (`**Claude:**`, `**Brennan:**`); headings stay reserved for endeavors and Solutions.
- **Findings:** a Claude turn can end with a collapsed `<details>` block of what the session learned that bears on the decision (file paths, constraints, approaches ruled out and why). You read the message; a fresh session after a cold start reads both, so nothing it learned lives only in its context. Markdown viewers, GitHub included, show `<details>` collapsed. Condensing uses the findings when writing the Answer.

  ```markdown
  **Claude:** Partial refunds only need a new caller. Should they
  be allowed on disputed payments?

  <details><summary>Findings</summary>

  - `server/api.ts` `validateRefund` already checks amounts
  - Disputed payments are flagged by `dispute_status`

  </details>
  ```
- **The Dialogue lives in its own file**, `<id>.dialogue.md`, next to the node; the UI shows it inline. It doesn't count toward the split budget and isn't included in breadcrumb reads, so a long conversation neither pushes siblings out into their own files nor leaks into other agents' context.
- **Condensing ("finalize"):** the session finalizes once you've agreed to the decisions (you say "let's do A" and nothing is left open), or when you tell it to. It calls `finalize_answer` or `finalize_sections`, and Monteverdi makes two commits:
  1. **Pre-writeup:** commits the dialogue file as it stands, the full conversation.
  2. **Writeup:** the session condenses the Dialogue into the Answer and deletes the dialogue file; Monteverdi commits that. You review it like any other change.

  The full conversation is always the version just before the writeup commit, so the `history` tool (see [Agent tools](#agent-tools)) can return it when a session wants to know how a decision was reached.
- **Who commits:** Dialogue sessions never commit. They share the endeavor worktree, so Monteverdi makes every planning commit there. Between condensings the dialogue file is simply uncommitted on disk. (Build sessions don't commit either: Monteverdi commits each task on `submit`; see [agents.md](agents.md#build-session-git-and-tools).)
- **Solution → Sections:** when a Dialogue shows the endeavor has several parts, the session shapes the children with three tools, `create_child`, `update_child` and `delete_child`, which write immediately (uncommitted, like the dialogue file). Then `finalize_sections` condenses what was decided for the whole into the endeavor's explanation and closes the Dialogue with the same two commits. What was decided about one child goes in that child's explanation. What's still open about one child becomes its **seed**: an opening Claude turn in that child's new Dialogue that sets out where the discussion stands, so the open question turns up where you'll pick it up. A seed summarizes; it never moves your turns, which code couldn't verify, and the full parent conversation stays reachable with `history`. A node has a Solution *or* Sections, so the parent's Dialogue is always condensed before the switch.
- **Rearranging Sections:** a Dialogue can also open on a sectioned node, about the split itself; replying after `finalize_sections` opens one. Merging, re-scoping, deleting or adding children is judgment, so there's no mechanism per case: the session uses the same three child tools and finalizes with `finalize_sections`. Deleting a built child removes the node, not its code; what happens to that code is part of the parent's judgment, written into a child's explanation (e.g. a replacement that removes it). A child whose Answer a change invalidates gets `reopen`. Purely mechanical changes (reorder, rename, add an empty child) are UI actions with no session.
- **Reopening:** adding a Dialogue to a solved Solution reopens it. The session stays open after finalizing, so if you object ("wait a second!") it simply replies, which reopens the node. Solved and reopened are never flags; they follow from whether the node has an Answer and a dialogue file.

## Sessions

- **One session per Solution's Dialogue, resumed while its cache is warm.** Its line of reasoning lives in the dialogue file, so when a Dialogue is reactivated after the prompt cache has expired, Monteverdi starts a fresh session that reads the breadcrumb and the dialogue file instead of resuming, unless the old session is small enough that resuming costs no more (see [agents.md](agents.md#dialogue-session)).
- **Builds get a fresh session** per build task, working from the condensed Answers rather than the planning conversation, to keep its context lean.
- **Monteverdi starts every session itself**, as a separate process. Sessions don't spawn subagents to do Monteverdi's work, so results land in files and git instead of piling up in a parent session's context.
- **Claude speaks into the files.** Design conversation happens in Dialogues, not chat. Operational output is still open (see [Open](#open)).

## Agent tools

Monteverdi runs an MCP server, a thin layer over its local `/api`, and attaches it to every session it starts. It's the agent's single way into Monteverdi. **Every change a session makes to Monteverdi's files goes through these tools** (dialogue turns, Answers, new nodes, build plans): the session passes structured data, and code validates it and writes the files. Sessions that only design or plan therefore get no file-writing tools.

| Tool | Does |
|---|---|
| `breadcrumb` | The target node in full plus its ancestors' bodies up to the root |
| `submit` | Build session only: commit and apply the task in its worktree, run the mechanical rules while the session waits, then hand it to the review session and merge if all pass (see [Merging a task](#merging-a-task)) |
| `reopen` | Open a Dialogue on a node and pause; with a task's ID, a build session asks for help in the task's Dialogue |
| `submit_plan` | Scoping session only: validate a build plan and, if valid, render `<id>.build.md` (see [agents.md](agents.md#scoping-session)) |
| `history` | A node's full Dialogue from its last pre-writeup commit |
| `reply` | Post a turn (message, Findings) in a Dialogue; code writes it into the dialogue file. Dialogue sessions, and build sessions in their task's Dialogue |
| `finalize_answer` | Dialogue session only, on finalize: the Answer; code writes it into the node and deletes the dialogue file |
| `create_child` | Dialogue session only: a new child (title, explanation, optional `depends_on` and seed); code assigns the ID and writes it |
| `update_child` | Dialogue session only: change a child's title, explanation or `depends_on`; its ID stays |
| `delete_child` | Dialogue session only: delete a child and its subtree, with a reason |
| `finalize_sections` | Dialogue session only, on finalize: the endeavor's revised explanation and optional `depends_on`; code writes it, deletes the dialogue file and makes the two commits |
| `verdict` | Review session only: pass or fail for one review rule, with the problems found and an optional rule suggestion (see [agents.md](agents.md#review-session-verdict)) |
| `write_rule` | Legislator only: a rule's frontmatter as fields plus its body; code checks it all and writes `SKILL.md` (see [agents.md](agents.md#legislator)) |
| `write_rule_file` | Legislator only: a script in a rule's folder, nowhere else |
| `delete_rule` | Legislator only: remove a rule or one of its files |
| `try_rule` | Legislator only: run a rule's command on the current code, sample files or the prompting commit, as the hook or `submit` would |

Full descriptions, checks and error wording for every tool are in `server/prompts/tools.md`.

A terminal command can sit on the same API for people to use; agents use the MCP tools.

## Git

```
complete                          ← you sign off on merges into this branch
└─ monteverdi/checkout            ← one branch per root endeavor
   ├─ monteverdi/checkout/4f1a2   ← one branch + worktree per build task
   └─ monteverdi/checkout/e81d4
```

- **`complete`** is the branch you point Monteverdi at when setting up a repo: a role, not a branch name (decided 2026-11-19). You pick an existing branch, by default the project folder's current one; it may be `main`, or `dev` where `dev` holds the latest working build and a publish rule carries it on to `prod`. A root endeavor merges into it only when you sign off. See [Setting up a repo](#setting-up-a-repo) for what follows when your own folder has it checked out.
- **Endeavor branch:** created when the root endeavor is created, so planning commits have a home that isn't `complete`. Dialogue sessions run in that branch's worktree.
- **Task branches:** one per build task, branched from the endeavor branch, each in its own worktree under a short path (for example `~/.monteverdi/wt/<id>`, for MAX_PATH).
- **Authorship** (order decided 2026-11-19): every commit Monteverdi makes, planning and build alike, is authored by you (the repo's configured git identity) and pushed with your credentials. Co-author trailers follow, in order: the agent that did the work (the model, such as Claude Opus 5.5, or whichever agent is attached in future), then Monteverdi. A commit code makes with no agent's work in it (a sign-off, `Instantiate Monteverdi`, bringing a publish step's commits into `complete`) names Monteverdi alone.

  ```
  Monteverdi-Task: checkout.4f1a2.build.1
  Monteverdi-Node: checkout.4f1a2.b7d05
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Co-Authored-By: Monteverdi <monteverdi@users.noreply.github.com>
  ```

  `git log --grep "Co-Authored-By: Monteverdi"` lists everything made through Monteverdi. The email is a placeholder: GitHub shows a co-author's avatar only when the email belongs to a GitHub account, and otherwise shows the name alone.
- **Trailers** (gathered 2026-11-19), all written by code:

  | Trailer | On | Names |
  |---|---|---|
  | `Monteverdi-Task: <task-id>` | Every task's commit, build or fix | The task that made the commit |
  | `Monteverdi-Node: <id>` | A build task's commit, one per node | A node it built; the stale check reads these. Never on a fix task |
  | `Monteverdi-Override: <rule> (<reason>)` | A task's commit, when you granted an override | The overridden rule and your reason |
  | `Monteverdi-Prompted-By: <task-id>` | A rule change's commit, when a task prompted it | The escalated or reviewed task |
  | `Monteverdi-Endeavor: <root id>` | A sign-off merge | The root endeavor signed off |
- **Worktree setup:** <a id="worktree-setup"></a>every worktree Monteverdi creates (endeavor, task, the sign-off worktree, and the publish worktree) gets the project's dependencies installed, so edit rules can use the project's tools after each edit. The project sets a **setup command** when the repo is set up; Monteverdi suggests one from the lockfile (see [Setting up a repo](#setting-up-a-repo)). With pnpm, packages are hard-linked from its global store, so an unchanged lockfile installs in seconds and uses little disk. When a task edits the manifest or lockfile, Monteverdi re-runs setup in that worktree before the next edit check. **Env files** (decided 2026-11-19): every worktree also gets a copy of every env file git ignores in the project folder, the files `git ls-files --others --ignored --exclude-standard` lists whose name starts with `.env` (skipping `node_modules`), so `.env.local` and a monorepo's `apps/web/.env` come along; tracked ones arrive through git. They're re-copied into every worktree when they change. The root `.env` is still what agent sessions' `${VAR}` values come from. `$PORT` is set in the process's environment, and dotenv-style loaders don't override a variable already set, so a hard-coded `PORT` in `.env` doesn't defeat per-worktree ports.
- **Rule changes** (decided 2026-11-19) are one of two kinds of commit that reach `complete` without an endeavor sign-off (the other is what a publish step brings back from a remote, which may not touch `monteverdi/rules/`; see [agents.md](agents.md#publish)): the [legislator](agents.md#legislator) works on a branch off `complete`, your Accept moves `complete` forward, and code cherry-picks the commit onto every endeavor branch, so every branch checks against the same rules. They reach the remote like anything else on `complete`, through a [publish](agents.md#publish) procedure.
- **Rebase short-lived branches, merge long-lived ones.** A finished task rebases onto the endeavor branch's tip. The endeavor branch takes in `complete` by merging, never rebasing, so task branches built on it keep a valid base.

### Setting up a repo

Decided 2026-11-19. The `/setup` page has your Claude account, the project folder, **Complete branch** (a dropdown of local branches, defaulting to the folder's current one), **Setup command** (suggested, editable), the env files found, and the checks below. **Set up** saves the settings and makes the scaffolding commit.

- **Checks**, each shown on the page with what to do: the folder is a git repository with at least one commit (Monteverdi doesn't run `git init`: committing your existing files is your call); git is 2.38 or later; no branches named `monteverdi/*` exist yet.
- **No import.** Existing code isn't described by nodes, and nothing tries to work out endeavors from it retroactively. Endeavors refer to existing code through Reuse and scoping's reading; CLAUDE.md, `.claude/skills/` and `.mcp.json` are picked up as decided.
- **Scaffolding writes only what has content**, as one commit on `complete` titled `Instantiate Monteverdi`, made like a sign-off (no checkout needed): `monteverdi/rules/publish/feature/SKILL.md` (the default rule; see [rules.md](rules.md#publish-rules)), `monteverdi/settings.json` only if you edited the setup command (below), and a short `monteverdi/README.md` saying what the folder is and that it changes through Monteverdi. No empty folders (git doesn't track them; `endeavors/` and the other rule types appear when first used). Anything already there is left alone, so re-running setup, or setting up a clone of a repo that already has it, writes nothing new.
- **Monteverdi's settings live in Monteverdi's state, not the repo** (decided 2026-11-19): agent models, effort and turn limits, the coming-back thresholds and `escalateAfter` are one set for every project, in `~/.monteverdi/config.json`, dialled in by you (see [agents.md](agents.md#measuring-and-tuning)). They describe how Monteverdi's agents behave and what your account pays, not the project. The split budget is a program constant (see [Splitting](#splitting)).
- **The one project setting is an edited setup command**, in `monteverdi/settings.json`. Code works the command out from the lockfiles every time (table below), so the file exists only when you've changed it (adding a step that creates a database per worktree, say): that's about the project, and a collaborator's worktrees need it too. A file in the repo has a copy on every branch, so **code reads it only from `complete`** (`git show <complete>:monteverdi/settings.json`), never from a worktree, and **writes it only as a commit on `complete`** when you change the command in the UI, made like `Instantiate Monteverdi`. Endeavor branches never change it (`submit` refuses changes under `monteverdi/`, and the legislator touches only rules), so their copies merge cleanly whenever they take in `complete`. It's versioned and travels with a clone. Per project but outside the repo, in `~/.monteverdi/config.json`, because they're about this machine: the project folder, and which branch is `complete` (code needs it to find the file).
- **When a folder has `complete` checked out** (likely: your own folder on `main` or `dev`), code moves `complete` by fast-forwarding that folder (`git merge --ff-only <new>`, after checking its HEAD is still the old tip) instead of `update-ref`, which would move the branch under your files and leave `git status` showing the reverse of the new commits. Every move of `complete` builds on its tip, so it's always a fast-forward. Your uncommitted changes stay; if they touch a file the move changes, git refuses and the move fails: *"Your uncommitted changes in D:\shop touch server/routes.ts, which this sign-off changes. Commit or stash them, then sign off again."*
- **Your own commits on `complete`** are allowed: they're outside Monteverdi's checks, and every endeavor takes them in the next time it prepares sign-off, where its checks run on the combination. **A hand edit to `monteverdi/rules/`** would break the rules-identical invariant, so when code finds `complete` moved by a commit it didn't make, it applies just the `monteverdi/rules/` part onto every endeavor branch, each under its merge lock, as Accept does. Rules are yours to decide, so a hand edit counts as yours.
- **The setup command** is suggested from one table, which also says which edited files re-run setup in a worktree:

  | Lockfile | Suggested command | Re-run when edited |
  |---|---|---|
  | `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` | it, any `package.json` |
  | `package-lock.json` | `npm ci` | it, any `package.json` |
  | `yarn.lock` | `yarn install --immutable` (Yarn 2+) or `--frozen-lockfile` (1.x, from `packageManager`) | it, any `package.json` |
  | `bun.lock` / `bun.lockb` | `bun install --frozen-lockfile` | it, `package.json` |
  | `uv.lock` | `uv sync --frozen` | it, `pyproject.toml` |
  | `poetry.lock` | `poetry install --no-root` | it, `pyproject.toml` |
  | `Gemfile.lock` | `bundle install` | it, `Gemfile` |
  | `Cargo.lock` / `go.sum` | `cargo fetch` / `go mod download` | it, `Cargo.toml` / `go.mod` |

  Several lockfiles (a monorepo) join their commands with `&&`; none means no setup. A hand-written command re-runs when any lockfile in the table changes. **Later:** the table becomes per-stack extensions you load (Node, Python, …), so Monteverdi doesn't assume a stack; it covers the common ones until then.

### Merging a task

Decided 2026-11-19 (replaces the test station; full design in [agents.md](agents.md#review-where-a-task-is-checked)). A task is checked in its own worktree, which has the project's dependencies, copies of the project folder's ignored env files (git doesn't track them, so no worktree gets them on its own; see [Worktree setup](#worktree-setup)) and its own port. Nothing reaches the endeavor branch until every check has passed.

1. The build session finishes and calls `submit`. Monteverdi commits the worktree and applies the task onto the endeavor branch's tip as one commit, in the worktree; on a conflict it leaves the markers for the build session to resolve (it knows what its changes are for), and the session submits again.
2. The mechanical [rules](#rules) run in the worktree, at that commit, while the build session waits. Tasks are checked in parallel, each in its own worktree.
3. If any agent review rules are selected, a fresh review session reviews the change in the same worktree.
4. A rule fails → back to the build session in its worktree with the failure, then repeat from step 1. If the loop doesn't converge, it escalates to a Dialogue attached to the task, between you and the build session (see [rules.md](rules.md#when-review-fails)).
5. Every rule passes → the task merges under the endeavor's **merge lock**: if the endeavor branch hasn't moved since step 1, it fast-forwards to the commit; if it has, code re-applies the task onto the new tip and re-runs the mechanical rules first. There's no per-task human review; your sign-off happens once, on the root's merge into `complete`.

### Rules

Review runs the project's **edit and review rules** (in `monteverdi/rules/edit/` and `monteverdi/rules/review/`). All selected rules must pass to merge. The full design, including the other three rule types, is in [rules.md](rules.md); in short:

1. Code selects rules by the files the change touched; no model decides which run.
2. **Edit rules** run first. The build session already ran them after each edit; `submit` runs them again, because the build step is never trusted.
3. **Review commands** run next, because they're cheap: `tsc`, lint, tests, or the project's own scripts. `submit` runs these two steps while the build session waits, and returns their failures to it directly.
4. **Agent review rules** run last: a fresh **review session** carries them out and must return a verdict for each rule by name.

On failure:
- A mechanical rule sends the command output back to the build session.
- An agent rule sends the review session's problems back.
- If the review session decides **the Answer** is wrong, not the code, it opens a Dialogue on the node (the same path as a build that finds an Answer wrong).

**Conflict prevention:** the build plan records the files each task expects to touch (`files`). Monteverdi's code runs tasks whose `files` overlap one after the other, never in parallel.

## Build

- **Plan build** is available on any fully designed endeavor, not just the root, so parts can be built while siblings are still being planned.
- It starts a **scoping session** that sizes the work, decides the build order, and splits it into tasks (often just one), recording the files each task works in (its `files`), the existing code it should reuse, and the design nodes it needs. Build tasks don't have to match Sections one-to-one. Monteverdi then starts one fresh build session per task, each in its own worktree. Detailed design: [agents.md](agents.md#scoping-session).
- **The plan is a file**, `<id>.build.md`, rendered by Monteverdi from what the scoping session submits: tasks, order, the node IDs each task builds, and its `files`. You can review it before any code is written. "Plan" always means this file.
- **Task IDs** are `<id>.build.<n>` (e.g. `checkout.4f1a2.build.1`); "build" has non-hex letters, so it never clashes with a node segment.
- **Dependencies:** see [Dependencies](#dependencies).
- **Build commits carry a trailer**, `Monteverdi-Node: <id>`, one per node built, written by Monteverdi when it commits the task (step 1 above). A node is **built** when such a commit is on the endeavor branch, which in this flow means it passed review. It's **stale** when its Answer changed after that commit.
- **When building shows an Answer is wrong**, the build session doesn't improvise: it opens a Dialogue on that node (making it reopened) and pauses until the Answer is updated.

### Dependencies

**Agents decide dependencies; Monteverdi enforces them.** Recognizing that Refunds needs the Ledger is a judgment call, made in Refunds' Dialogue (by the session or by you). The result is a line in the node's body:

```markdown
## Refunds {#checkout.4f1a2.b7d05}
Partial and full refunds against captured payments.
Depends on: [Ledger](checkout.e81d4.31af0)
```

Everything after that is mechanical. On **Plan build** for an endeavor:

1. Collect every `Depends on:` line in its subtree.
2. Drop the ones pointing inside the subtree; those only affect build order, which the scoping session sets and code checks.
3. Each one pointing outside the subtree must be **solved** for Plan build to be available. Otherwise the UI says why, for example "Blocked: Ledger is discussing."
4. A task that builds a node runs only once each of that node's dependencies is **built**. Until then it waits.

Sessions never write `Depends on:` lines themselves: they pass the IDs as a `depends_on` parameter (on `finalize_answer` and the child tools), and code checks each ID exists and writes the lines in one format. The validator rejects cycles, including a node depending on its own ancestor. Depending on a sectioned endeavor means depending on its whole subtree.

**Across root endeavors** (rare; mostly when two roots must happen in sequence): a node in another root endeavor counts as **built** only once that root has been signed off into `complete`. The waiting task then picks it up when `complete` is merged into its endeavor branch. Endeavor branches are never merged into each other, so no endeavor ever carries code you haven't approved.

## Open

- **Operational output.** Design conversation lives in the files, but sessions still produce operational output: permission prompts, errors, "blocked on X", progress while carrying out a Solution. These need a home in Monteverdi's UI (permission prompts need a real control, not a reply in a file). Decide when we build the UI.
