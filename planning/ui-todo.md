# B-aide UI to-do

Draft, 2026-11-23. The UI still to design before the dummy data comes out and the logic goes in. Gathered from [agents.md](agents.md), [rules.md](rules.md), [language.md](language.md) and [settings.md](settings.md), checked against what's built.

**Order:** 1 to 5 first, because they shape the endeavor state types the logic will produce. The rest can be filled in while the logic is built.

## 0. Review the notification design

Built 2026-11-23, still needs your review. It's in `src/components/notifications/notifications.tsx`, with the card as `Endeavor mode="notification"`. To try it: Settings > Notifications > **Send test notifications** (temporary).

- **One cause:** a node moving to awaiting action. There's no history. A card is gone once it's dismissed, clicked through, or its 20 seconds run out.
- **The card** is the endeavor card with no progress border and an X where the status pill goes. It keeps the stage-coloured gradient. Clicking anywhere else opens the node.
- **The tray** sits bottom right. Newest is in front, and up to three show as a stack, each one behind peeking out 12px and 5% smaller. Hovering spreads them into a column.
- **Calls to check:**
  - Hovering the tray, or the window being hidden, pauses every card's 20 seconds, so you don't come back to an empty tray.
  - A Windows notification shows only when B-aide isn't the focused window; otherwise the in-app card already covers it. Clicking it focuses B-aide and opens the node. Not yet tried in the Electron build.
  - A node notified again replaces its card rather than stacking a second one.
  - `dismiss(id)` exists so the logic can take a card away once the node stops awaiting (you acted on it elsewhere).
- **When the logic lands:** fire `notify` when a node's progress moves to awaiting action, call `dismiss` when it leaves, and remove the test button.

## 1. Setup, reworked

Make it a minimal subset of Settings, in this order:

1. **Add at least one project.**
2. **Connect an account.**
3. **Connect git** (optional).

**To reconcile first:** [language.md](language.md#setting-up-a-repo) puts more on `/setup` than a folder: the **Complete branch**, the **Setup command** (suggested from lockfiles), the env files found, and the repo checks (a git repo with at least one commit, git ≥ 2.38, no `b-aide/*` branches). Its **Set up** button also makes the `Instantiate B-aide` commit. Settings > Projects has none of this (path, display name, default branch, ignored paths). Make "add a project" one shared flow, with checks and scaffolding, used by both Setup step 1 and Settings > Projects. Then update both docs.

## 2. Sign-off page

[agents.md](agents.md#publish-the-sign-off-page). Top to bottom:

1. What pressing does: title, summary, publish kind and its steps, the "also ships" warning, and why Sign off is unavailable when it is ("Preparing: running checks (3 of 7)").
2. Checks, collapsed to one line when all passed. Overridden failures show the reason and output.
3. What was built: the design tree, each node linking to its Answer; `b-aide/` changes listed apart from code.
4. Tasks: subject, files, diff; flagged for edits outside a task's files and for escalations.
5. The whole change: the full diff against `complete`.
6. What came in from `complete`.

Controls: **Sign off**, **Fix instead** (on an overridden failure), **Request fix**.

## 3. Rule-change page

The legislator's page ([agents.md](agents.md#legislator)): the rule folder's diff, the legislator's latest reply, every `try_rule` run (where it ran, exit code, output) with **Stop** on a running one, and an "untried since last change" marker. Controls: **Accept**, a reply box, **Discard**. A note goes beside Accept when a check fails on the current code. After a failed run it shows only **Retry**. Publish rules show their steps with no runs.

## 4. Run states on the endeavor card

- **Failed** (turn limit, or a crash after its automatic retry): the last output and **Retry**.
- **Waiting on the usage limit:** not a failure; shows when it resets.
- **Queued:** waiting for a slot under `limits.maxConcurrentSessions`.
- **Running check:** each review command with its elapsed time and **Stop**.

## 5. Publish steps

The procedure's step list with progress. A running `run` step shows elapsed time and **Stop**. A failed step shows its last ~40 lines, a link to the full output, and **Retry step** / **Skip step** / **Abort**. Only the `confirm` step (**Continue**) has a sample now.

## 6. Build plan detail

The plan's **Approach**, then each task with its nodes, files and `after` order, and the Versions block with your feedback rounds and the session's response. The sample only lists task titles.

## 7. `suggest_rule` in the review log

A suggestion from a review session with **Accept** (starts the legislator) and **Dismiss** (logged as declined).

## 8. Creating a root endeavor

No "new endeavor" flow exists yet. It's where the **Publish kind** is picked (one of the project's publish rules), editable on the root until sign-off.

## 9. Usage view and endeavor stats

[agents.md](agents.md#measuring-and-tuning). One row per agent, each setting beside its evidence (turns against the limit, cost, coming-back paths, cache hits), with flagged settings and editing in place. Each endeavor gets cost by agent and by task. Settings > Limits only has placeholder figures.

## Docs and code that disagree

- **Rule editing.** `src/pages/rules/rule-form-page.tsx` edits and saves rules directly. The docs say rules change only through the legislator: **New rule** starts it, and changes land through **Accept** on the rule-change page. Either the docs add a direct-edit path, or the form becomes the request that starts the legislator.
- **The setup route.** The README says setup happens at `/settings`; the code and language.md use `/setup`.
