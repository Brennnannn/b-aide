<!--
The first message of a build session. Monteverdi's code assembles it from the parts below,
in order, and fills each {placeholder}. Paths are relative to the task worktree.

Every way a build session comes back goes through one path: resumed with a message if the
session is warm or small, otherwise a fresh session from the worktree.

Fresh, new task: parts 1, 2, 3, 6a.
Fix task at sign-off (ID <root>.fix.<n>): part 1f in place of 1, and 2f in place of 2 and 3;
  otherwise the same parts. A trigger while it's open arrives as 5f. A fix task that starts
  escalated (sign-off preparation reached the threshold) has no session until the user
  replies to the opening turn code wrote; then parts 1f, 2f, 5 (dialogue), 6d.
Fresh, coming back (cold or large, or out of context): parts 1, 2, 3, 4, then 5 if
  anything is new, then the matching instruction from 6.
Warm resume: part 5, then the matching instruction from 6. A Retry after the turn limit
  sends 6e alone.
Mechanical check failures never come here: they're `submit`'s result.
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

<!-- 1f. Fix task (fresh), in place of 1. -->
Fix {root_title} ({root_id}) for sign-off ({task_id}). You're in the fix's worktree at
{worktree_path}, on branch {task_branch}, which branched from {endeavor_branch} at {base}.
{merge: "Monteverdi has started merging {complete} into it; the conflicts are left as
markers." | ""} Paths in this message are relative to the worktree.

<!-- 2f. Fix task (fresh), in place of 2 and 3. All computed by code. One what's-wrong
     sub-part per trigger that has joined, in order:
       check: rule, type (edit rule or review command), output trimmed to about 40 lines, path of the full output;
         for Fix instead, also the task and reason of its override.
       conflict: the conflicted files, and the commits on {complete} that changed them.
       request: the user's words, with the file and line they started from, if any.
     files: git's conflicted files; for a check, every tracked path in its output; for a
       request, its file; if none, the files the endeavor changed.
     tasks: for each file, the tasks that changed it, from Monteverdi-Task trailers:
       ID, subject, nodes (title, ID, summary).
     done: computed. -->
<fix>
<wrong>
{per trigger}
</wrong>

<files>
{path}: changed by {task_id} ({subject}), building {node title} ({node id}): {summary}
</files>

Done: {request: "{words}, and" | ""} every check passes on the merged result.
</fix>

<!-- 4. Fresh, coming back. The work already in the worktree: files changed since the base
     commit (committed or not), as `git diff --stat {base}`. -->
A previous session worked on this task{reason: " and ran out of context" | ""}. Its work is in
the worktree; its reasoning is gone, so re-read what you need.

<work_so_far since="{base}">
{diff_stat}
</work_so_far>

<!-- 5. What's new. Each sub-part only if it has something in it.
     review: the review session's problems, per failed rule, from the latest submit,
       rendered as `file:line: what. Fix: fix`.
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

<!-- 5f. Fix task: another trigger joined while it was open, as in 2f. -->
<also_wrong>
{per trigger}
</also_wrong>

<!-- 6. The instruction, always last: exactly one. -->
<!-- 6a. New task. -->
Build this task, then submit it.
<!-- 6a-fix. New fix task. -->
Fix what's wrong, then submit it.
<!-- 6h. Another trigger joined (5f). -->
Fix this too, then submit again.
<!-- 6b. Review found problems. -->
Fix what review found, then submit again.
<!-- 6c. Answers changed while the task was paused. -->
Rework what the changed Answers affect, keep the rest, then submit.
<!-- 6d. The task's Dialogue has a new turn from the user. -->
Reply to {name}'s last turn with `reply`, and act on what they've decided.
<!-- 6e. Ran out of context, or a Retry after the turn limit. -->
Carry on with this task from where the work stands, then submit it.
<!-- 6f. Code escalated: a rule reached escalateAfter failures (3 by default), or failed
     again after that; counts never reset. Usually warm: the session just submitted.
     Code appends each attempt's output since the last escalation to the turn it writes. -->
{rule} has failed {count} times, so Monteverdi has {first: "opened this task's Dialogue" |
again: "brought it back to this task's Dialogue"} with {name}. Write a turn with `reply`:
what keeps failing, what you've tried, what you think the cause is, and what you need from
{name}. Then end your turn.
<!-- 6g. The user granted an override in the task's Dialogue (with 6d if they also wrote). -->
{name} overrode {rule} for this task: {reason}. Submit again; that rule now counts as passed.
