<!--
The first message of a review session. B-aide's code assembles it from the parts below,
in order, and fills each {placeholder}. Paths are relative to the task worktree.

A review session is always fresh: parts 1-4, then 5 if it has anything, then 6a.
For a fix task at sign-off (<root>.fix.<n>), part 2 is the fix's <fix> block exactly as the
build session got it, and part 3 is left out: the tasks it lists name the nodes, and
`breadcrumb` gives their Answers.
The one resume: if the session ended without a verdict for every rule, code resumes it at
once (it's warm) with 6b alone. Rules still without a verdict then count as failed.
-->

<!-- 1. Always. -->
Review task {n} of the {plan_title} build plan ({task_id}). You're in its worktree at
{worktree_path}, at {commit}: the task applied onto {endeavor_branch} at {base}. The dev
server's port is {port} (`$PORT`). Paths in this message are relative to the worktree.

<!-- 2. Always. The task's entry, verbatim from <id>.build.md. -->
<task>
{task_entry}
</task>

<!-- 3. Always. The task's nodes as one tree, exactly as the build session got them:
     ancestors once each (explanation only), each node it builds in full with its status
     line, and under each node its outside dependencies with their summaries. -->
<nodes>
{tree}
</nodes>

<!-- 4. Always. git diff {base}..{commit}, in full up to about 1,500 lines. Beyond that, the
     --stat summary and the path of the full diff in the run folder. -->
<change since="{base}">
{diff | stat}
</change>
{The full diff is in {run_dir}/change.diff.}

<!-- 5. If this task was reviewed before: each earlier round, oldest first, with each rule's
     verdict and, for a fail, its problems. Suggestions are left out. -->
<earlier_reviews>
Round {k} ({commit}):
- {rule}: passed
- {rule}: failed
  - {file}:{line}: {what} Fix: {fix}
</earlier_reviews>

<!-- 6. The instruction, always last: exactly one. -->
<!-- 6a. Always (fresh). -->
Review this change against each of your rules, and give a verdict on every one.
<!-- 6b. The resume for missing verdicts. -->
You ended without a verdict on {rules}. Give one for each, then end your turn.
