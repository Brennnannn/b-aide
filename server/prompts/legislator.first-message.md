<!--
The first message of a legislator session. B-aide's code assembles it from the parts
below, in order, and fills each {placeholder}. Paths are relative to the legislator's
worktree, which is on a short branch off `complete`.

Fresh: parts 1, 2, 3 (when a rule is named), exactly one of 4a/4b/4c, then 5 if the
  conversation has turns, then the matching instruction from 6.
Warm resume: the user's new message; or, after a refused Accept, part 6c alone.
The conversation lives in B-aide's state, not in a file; part 5 is how a fresh session
gets it.
-->

<!-- 1. Always (fresh). -->
You're in the legislator's worktree at {worktree_path}, on {branch}, which branched from
`complete` at {commit}. Project rules live in `b-aide/rules/<type>/<name>/`; {name}'s
personal rules in `{personal_rules_path}`.

<!-- 2. Always (fresh). Every rule, frontmatter only (type, name, description, paths, run,
     tools, steps), grouped by type, project and personal, with any shadowing marked,
     so the session neither duplicates nor contradicts one. Each publish rule adds a line
     computed by code naming the root endeavors of its kind and where each stands:
     "used by: Checkout (planning), Refunds (signed off, paused at step 3)". -->
<rules>
{catalog}
</rules>

<!-- 3. When the request names a rule (always for 4a and 4b): its SKILL.md in full and a
     list of the files in its folder. Code knows the session will need it, so it's pasted. -->
<rule name="{rule}" type="{type}" scope="{scope}">
{skill_md}

Files: {files}
</rule>

<!-- 4. Why you're here: exactly one. -->

<!-- 4a. Escalation: the user pressed Change rule in a task's Dialogue. -->
{name} decided that {rule} is wrong in general, in task {task_id}'s Dialogue, after it
failed {count} times. The task's code at its last submit ({prompting_commit}) is the
prompting commit for `try_rule`.

<what_the_user_said>
{user_words}
</what_the_user_said>

<task_dialogue>
{dialogue}
</task_dialogue>

<!-- Each attempt's output, as code appended it to the Dialogue's opening turn. -->
<failures>
{failures}
</failures>

<!-- 4b. Suggestion: the user accepted a review session's suggest_rule. -->
{name} accepted a rule change that review suggested while checking task {task_id}. The
reviewed code ({prompting_commit}) is the prompting commit for `try_rule`.

<suggestion>
{suggest_rule}
</suggestion>

<review_notes rule="{reviewed_rule}" pass="{pass}">
{notes}
</review_notes>

<!-- 4c. The user asked. -->
{name} asked for this:

<request>
{request}
</request>

<!-- 5. Fresh with earlier turns (the session went cold mid-conversation). Each turn, and
     after each of the legislator's turns the files it changed. -->
<conversation>
{conversation}
</conversation>

<!-- 6. The instruction, always last: exactly one. -->
<!-- 6a. A new request. -->
Make the change, try it, and explain it to {name} with `reply`.
<!-- 6b. Fresh with earlier turns. -->
Answer {name}'s last turn: revise the change, try it, and `reply`.
<!-- 6c. Accept was refused: another accepted change touched the same rule. Code has moved
     the worktree onto the new `complete`; the session's own change is shown as a diff. -->
{name} accepted another change to {rule} while you worked ({commit}). Your worktree now has
that version, without your change. Your change was:

<your_change>
{diff}
</your_change>

Redo it on the new version, try it again, and `reply`.
