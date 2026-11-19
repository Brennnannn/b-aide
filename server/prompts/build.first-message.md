<!--
The first message of a build session. Monteverdi's code assembles it from the parts below,
in order, and fills each {placeholder}. Paths are relative to the task worktree.

Every way a build session comes back goes through one path: resumed with a message if the
session is warm or small, otherwise a fresh session from the worktree.

Fresh, new task: parts 1, 2, 3, 6a.
Fresh, coming back (cold or large, or out of context): parts 1, 2, 3, 4, then 5 if
  anything is new, then the matching instruction from 6.
Warm resume: part 5, then the matching instruction from 6. A Retry after the turn limit
  sends 6e alone.
The station's mechanical failures never come here: they're `submit`'s result.
-->

<!-- 1. Always (fresh). -->
Build task {n} of the {plan_title} build plan ({task_id}). You're in its worktree at
{worktree_path}, on branch {task_branch}, which branched from {endeavor_branch} at {base}.
Paths in this message are relative to the worktree.

<!-- 2. Always (fresh). The task's entry, verbatim from <id>.build.md: heading, Builds,
     Files, Rules, Tools, After, Goal, Reuse, Done, Other tasks build. -->
<task>
{task_entry}
</task>

<!-- 3. Always (fresh). The task's nodes as one tree. Ancestors once each, explanation
     only. Each node the task builds in full: a status line (to build (new) | to build
     (stale)), its explanation and its Answer. A stale node adds the files its earlier
     build changed and its Answer's diff since that build. Under a node, each Depends on
     outside the task, once: title, ID, built, summary, files its build changed. Siblings
     other tasks build are left out. -->
<nodes>
{tree}
</nodes>

<!-- 4. Fresh, coming back. The work already in the worktree: files changed since the base
     commit (committed or not), as `git diff --stat {base}`. -->
A previous session worked on this task{reason: " and ran out of context" | ""}. Its work is in
the worktree; its reasoning is gone, so re-read what you need.

<work_so_far since="{base}">
{diff_stat}
</work_so_far>

<!-- 5. What's new. Each sub-part only if it has something in it.
     review: the revision session's notes, per failed rule, from the latest submit.
     answer_changes: per node (heading with {#id}), the Answer's diff since the commit the
       task's Answers came from. Only after a reopen on a node.
     dialogue: the task's Dialogue. Fresh: all of it. Warm: turns since the session last
       saw it. -->
<review>
{rule}: {notes}
</review>

<answer_changes>
{per node: heading with {#id}, then the diff}
</answer_changes>

<dialogue>
{dialogue}
</dialogue>

<!-- 6. The instruction, always last: exactly one. -->
<!-- 6a. New task. -->
Build this task, then submit it.
<!-- 6b. Review found problems. -->
Fix what review found, then submit again.
<!-- 6c. Answers changed while the task was paused. -->
Rework what the changed Answers affect, keep the rest, then submit.
<!-- 6d. The task's Dialogue has a new turn from the user. -->
Reply to {name}'s last turn with `reply`, and act on what they've decided.
<!-- 6e. Ran out of context, or a Retry after the turn limit. -->
Carry on with this task from where the work stands, then submit it.
