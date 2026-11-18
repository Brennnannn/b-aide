<!--
The first message of a scoping session. Monteverdi's code assembles it from the parts below,
in order, and fills each {placeholder}. Paths are relative to the endeavor worktree.

Fresh session (Plan build, no unfinished earlier plan): parts 1, 2, 3, 5a.
Fresh revision (an earlier plan exists; the old session is cold or large): parts 1-4, 5b.
Warm resume (the old session is warm or small): part 4 with only what's new since the
session last saw anything, then 5b.
-->

<!-- 1. Always (fresh). The breadcrumb holds the target's ancestors, root first; the target
     itself is the top of the subtree. -->
Plan the build of "{title}" ({id}). You're in the endeavor's worktree at {worktree_path};
paths in this message are relative to it.

<breadcrumb>
{ancestors}
</breadcrumb>

<!-- 2. Always (fresh). The subtree as one tree, everything about a node under its heading.
     Headings keep their {#id}. Per node, by status:
       sectioned:          explanation only, no status line
       to build (new):     status, Depends on, explanation, Answer in full
       to build (stale):   status, Depends on, files from its earlier build, explanation,
                           the Answer's diff since its build commit
       built:              status, summary, files from its build
     Depends on, one line each: inside this subtree; or outside, with built or not and, if
     built, the files from its build. -->
<subtree>
{subtree}
</subtree>

<!-- 3. Always (fresh). Build rules as frontmatter only, then the repo's and the user's
     skills as name and description (tools from allowed-tools or tools:), left out if there
     are none. A skill shadowed by a build rule of the same name isn't listed. -->
<build_rules>
{- name: description. paths: ...; tools: ...}
</build_rules>

<skills>
{- name: description. tools: ...}
</skills>

<!-- 4. When an earlier plan exists. Each sub-part only if it has something in it.
     earlier_plan: fresh only (a warm session has its own submit_plan call); the plan file
       parsed back into submit_plan's shape (as JSON), so it can be edited and resubmitted.
     built_since: tasks whose nodes have been built since; they drop out.
     feedback: fresh: every round (feedback, then response), then this round's.
       Warm: this round only.
     answer_changes: per node, the Answer's diff since the commit the earlier plan was based on.
     code_changes: git diff --name-only <that commit>..HEAD, leaving out monteverdi/. Marked
       files first, all of them; unmarked ones up to 25, then a count and the path of the
       full list in the run folder. -->
<earlier_plan>
{plan_json}
</earlier_plan>

<built_since>
{Task 1 (checkout.4f1a2.build.1): its nodes are built and no longer to build.}
</built_since>

<feedback>
{earlier_rounds}
**{name}:** {feedback}
</feedback>

<answer_changes>
{per node: heading with {#id}, then the diff}
</answer_changes>

<code_changes since="{commit}">
{path}: in task {n}'s files | in task {n}'s reuse | no task; changed by {task_id} ({node title})
{… and {count} other files. The full list is in {run_dir}/changed-files.txt.}
</code_changes>

<!-- 5. The instruction, always last: exactly one. -->
<!-- 5a. Fresh. -->
Plan the build of this subtree.
<!-- 5b. Revision, fresh or warm. -->
Revise the earlier plan for what's new above.
