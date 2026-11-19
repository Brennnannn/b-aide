# Monteverdi rules

Draft, 2026-11-10; rule types revised 2026-11-17. Rules are how a project tells Monteverdi's agents how to design, plan and build, and what to check. Terms are defined in [language.md](language.md); agents in [agents.md](agents.md).

## The principle: compute what can be computed

Most of the value of rules is in deciding, for each concern, **what code can check and what needs an agent's judgment**:

| | Mechanical (code) | Agent (judgment) |
|---|---|---|
| Good for | Anything precise and checkable from text, syntax trees or command output: types, tests, lint, "colors come from theme tokens", "every migration has a down step" | Intent and quality: does the change do what the Answer says, is the UI right, is the code clear |
| Cost | ~0 tokens; seconds | Startup context plus everything it reads; minutes |
| Reliability | Same answer every time | Can miss things or judge inconsistently |

In order of preference:

1. **Code checks it.** A script decides pass or fail.
2. **Code narrows, an agent judges.** A script finds the candidates (lines using raw colors, endpoints without auth checks) and the agent rule judges only those, instead of exploring the whole change.
3. **An agent judges from scratch.** Only for what can't be narrowed.

And over time, push concerns up this list: when an agent rule keeps finding the same kind of problem, that's a sign it can become a script (see [Improving rules](#improving-rules)).

## Six types of rule

Each type is named after its step, and the agent that runs the step shares the name (the Dialogue step and Dialogue session read Dialogue rules). **Each type belongs to exactly one agent or step**, so where a rule applies follows from its folder alone: no agent or setting decides it.

| Type | Read or run by | When | Holds |
|---|---|---|---|
| [Dialogue](#dialogue-rules) | Dialogue sessions | While you design an endeavor together | How this project likes designs worked out |
| [Scoping](#scoping-rules) | Scoping session | Once per build, with the whole endeavor in view | What already exists and where to find it; how work is split |
| [Build](#build-rules) | Build session | Injected at the head of its instructions | How code is written here |
| [Edit](#edit-rules) | Build session's hook, then `submit` | After each matching edit, and again at `submit` | Fast mechanical checks |
| [Revision](#revision-rules) | `submit`, then the revision session | At `submit` (commands and agent rules) and sign-off (commands) | Whether the result holds up: slower checks and judgment |
| [Publish](#publish-rules) | Code (no agent) | After sign-off, the one rule the root endeavor's kind names | How the project ships: a procedure of commands and pauses |

Dialogue, scoping and build rules are **guidance**: an agent reads them and follows them at its discretion. Edit and revision rules are **checks**: they run, and they decide. **What must happen can't be guidance**, so anything required belongs in edit or revision rules. Publish rules are neither: they're **procedures**, commands code runs in order (decided 2026-11-19).

At `submit`, edit rules run before revision rules: they're cheap, and a revision session shouldn't spend tokens judging code that doesn't typecheck.

## Layout

Rules live in the repo, versioned with the code. Each rule is a standard skill folder: a `SKILL.md` with frontmatter, plus any scripts or examples it needs.

```
monteverdi/
  endeavors/
  rules/
    dialogue/
      ui-design/
        SKILL.md
    scoping/
      ui-reuse/
        SKILL.md
    build/
      ui/
        SKILL.md
        list-tokens.mjs
    edit/
      color-tokens/
        SKILL.md
        check.mjs
    revision/
      typecheck/
        SKILL.md
      ui-check/
        SKILL.md
        flag.mjs
```

Being skills, the same rules also work as ordinary skills in your own Claude Code sessions.

**How many rules is up to you.** Dialogue and scoping rules are all injected, and every injected rule costs context on every call; edit rules all run after matching edits. Monteverdi doesn't limit them. If sessions get slow or expensive, remove or shorten rules.

**Personal rules** live in `~/.monteverdi/rules/<type>/` (same folders, same format) and apply to every project. Monteverdi reads both locations; when a personal rule and a project rule of the same type share a name, the project's wins. Personal rules aren't in the repo, so anyone else on the project doesn't get them; to keep history honest, each verdict records the rule's source (`project` or `personal`). The UI shows where a personal rule is shadowed by a project rule of the same name, so a collision is never silent.

**Your working style is a personal rule.** There's no separate editable base prompt: each agent's instructions are Monteverdi's fixed layer (code) followed by its rules, and how you like to work goes in a personal rule of that step's type, e.g. `~/.monteverdi/rules/dialogue/my-style/`. Only Dialogue and scoping take a style; build sessions follow build rules once you press Build plan, and revision is checks, not style.

## Injected, not invoked

Dialogue, scoping, build and agent revision rules all reach their agent the same way:

- **Injected:** Monteverdi puts the rule's full text into the agent's instructions (after its fixed text, in the file passed with `--system-prompt-file`; see [agents.md](agents.md#configuring-any-agent)), rather than loading it as a skill. A skill's body only loads if the model decides to invoke it, and models sometimes don't; injected text is always in context, and cached.
- **Embedded commands:** a skill can contain `` !`command` ``, which Claude Code runs when the skill loads, pasting the output in. Injection bypasses that, so **Monteverdi runs those commands itself** when it starts the agent and injects their output. The agent gets current facts (the token list, the database schema) without having to fetch them.

## Tools

Decided 2026-11-18. A session gets tools (things it calls while it works, like a browser or a database) only through its rules. Any rule an agent reads (Dialogue, scoping, build, agent revision) can declare them:

```markdown
---
name: ui
description: Building or changing React pages and components, and checking them in a browser.
paths: ["src/**/*.tsx"]
tools: [playwright]
---
The dev server's port is in `$PORT`. Check each changed page at 375px and 1280px wide. ...
```

- **What `tools:` names:** MCP servers from the project's `.mcp.json` (Claude Code's standard file at the repo root, the one your own sessions load), and Claude Code's built-in tools by name (`WebFetch`, `WebSearch`). A personal rule may also name one of your user-scope servers. Monteverdi keeps no list of its own: the repo already says what servers it has and how to start them.
- **A session loads the union of its rules' tools.** For a build session, the rules in its task; for a revision session, its selected agent rules (`ui-check` needs the browser); for Dialogue and scoping, all of theirs, since they're all injected. Code copies each named server's definition from `.mcp.json` into the run's MCP config (with Monteverdi's own server, under `--strict-mcp-config`), adds `mcp__<server>__*` to `--allowedTools` so a headless run never waits on a prompt, and adds built-in names to `--tools`.
- **Rules, not a catalog, because a server has no description.** `.mcp.json` says how to start a server, not when a task needs it. The rule says when (its description) and how to use it here (its body); the server's own tool descriptions say what each tool takes. A project that wants builds to use a browser writes one short build rule for it.
- **A skill's tools.** A skill chosen as a build rule brings the servers its own `allowed-tools` names (Claude Code's field; `mcp__playwright__browser_navigate` can only mean the `playwright` server), plus any `tools:` key added to its frontmatter. A skill that already pre-approves a server's tools needs no edit.
- **Checked before a step starts.** A rule naming a server that isn't in `.mcp.json` (or your user scope, for a personal rule), or a built-in that doesn't exist, keeps that step from starting, and the UI names the rule and the tool. For build rules that means Plan build isn't available, since the scoping session couldn't fix it.
- **Plugins aren't loaded.** `--plugin-dir` would bring a plugin's hooks and subagents along with its servers and skills. Put a plugin's server in `.mcp.json`; use its skills as rules.
- **Secrets** stay as `${VAR}` in `.mcp.json`; the session's environment carries the values from the project's `.env` (see [agents.md](agents.md#launch-to-verify)).

## Dialogue rules

How this project likes designs worked out. **Monteverdi injects every Dialogue rule into every Dialogue session; nothing selects them.**

```markdown
---
name: ui-design
description: Designing anything with a user interface.
---
When an endeavor has UI, settle the layout at phone width as well as desktop
before writing the Answer. Name the existing @ui components it will use.
```

- **Typical content:** questions every design should answer, what a good Answer contains here, conventions for splitting an endeavor into Sections, constraints that always apply (accessibility, supported platforms).
- **Not for how to write code.** That's a build rule. Dialogue shapes the decision, not the implementation.
- **Design Dialogues only.** An escalation Dialogue on a build task (see [When revision fails](#when-revision-fails)) is about fixing code, not designing, so it doesn't get Dialogue rules.
- **Few and short.** A Dialogue has no file list to select by, so every Dialogue rule is in every Dialogue session's context.

## Scoping rules

Where to look before deciding how to build. **Monteverdi injects every scoping rule into the scoping session; nothing selects them.** The scoping session acts on what they point to and writes the result into each task's **Reuse** field, so the build session gets the findings, not the search.

```markdown
---
name: ui-reuse
description: Finding existing UI components to reuse.
---
Before planning UI work, read the summary file for each `packages/ui/` folder relevant
to the task and list the components the task should reuse, with their paths.

!`node scripts/ui-summaries.mjs`
```

- **Nothing to select by.** The scoping session can't know a task's files before it plans, so scoping rules should stay few and short.
- **Typical content:** indexes and summaries to consult, where shared helpers live, how the project likes work split into tasks.
- **Not for how to write code.** That's a build rule, which the scoping session only chooses.

## Build rules

Guidance for building. **The scoping session chooses them (code adds those whose `paths` match a task's `files`); Monteverdi injects them into the build session.**

```markdown
---
name: ui
description: Building or changing React pages and components. Covers layout, @ui components, theming, and checking the result in a browser.
paths: ["src/**/*.tsx"]
---
Use theme tokens from `src/index.css`, never raw colors. ...

Current tokens:
!`node monteverdi/rules/build/ui/list-tokens.mjs`
```

- **Choosing:** the scoping session reads only the frontmatter of every build rule. `description` says when the rule applies; `paths` says which files it concerns, and code adds a rule automatically when its `paths` match a task's `files`. The chosen rules go in each task's entry in `<id>.build.md`, next to the tools that task needs.
- **Tools:** a build rule can declare `tools:` (see [Tools](#tools)); choosing the rule brings them into the build session. The scoping session chooses rules, never tools directly.
- **Skills are offered too** (decided 2026-11-18). Code lists the repo's skills (`.claude/skills/*/SKILL.md`, Claude Code's project skills folder) and your personal ones (`~/.claude/skills/`) next to the build rules, by name and description, and the scoping session can choose them for a task like any build rule. A chosen skill is injected like a build rule (not loaded as a Claude Code skill, which the model might not invoke), with one line saying where its folder is so its relative paths still work. Skills have no `paths`, so one is never added automatically: a "deploy to staging" skill is simply never chosen. On a name clash, a build rule (project, then personal) wins over a skill (repo, then personal): the rule is the version written for Monteverdi. **Skills reach build sessions only**, as the scoping session chooses: no other agent has one choosing guidance by description, and an agent revision rule owes a verdict, so which ones run must be deliberate, not every skill in the repo. A project that wants a skill's text in another step writes a rule of that type that embeds it (`` !`cat .claude/skills/code-review/SKILL.md` ``), with no new mechanism.
- **Pure guidance.** An instruction like "run tsc after editing" is followed at the model's discretion. Anything required becomes an edit or revision rule.

## Edit rules

Fast mechanical checks that run **while the build session works**, and again at revision. **Monteverdi's code attaches every edit rule to every build session; the scoping session doesn't choose them.**

```markdown
---
name: color-tokens
description: Colors in changed UI code come from theme tokens, and the theme doesn't redefine Tailwind defaults.
run: node monteverdi/rules/edit/color-tokens/check.mjs
paths: ["src/**/*.tsx", "src/**/*.css"]
---
```

- **Commands only.** An edit rule is a program that follows the [command contract](#command-contract). Starting an agent after every edit would be slow and expensive, so judgment belongs in revision.
- **After each edit:** a hook runs the rule when the edited file matches its `paths` (a rule without `paths` runs after every edit). `MONTEVERDI_CHANGED_FILES` holds just the edited file.
- **A failure is feedback, not a stop.** The check's output goes straight back to the session, which keeps working and usually fixes the problem next, while the file is still in front of it. Catching it early also saves a round of `submit`.
- **Any nonzero exit is a failure** (decided 2026-11-19), whether the check found something or the script itself crashed: code doesn't try to tell them apart. Its output goes to the session either way, after an edit and at `submit`; a session that sees a failure outside its code asks for help, and repeated failures escalate as usual (see [When revision fails](#when-revision-fails)).
- **No time limit** (decided 2026-11-19). A rule runs as long as it takes; how fast it is stays the project's call. A slow rule slows every matching edit, since the session waits for the hook, and a hanging one stalls the session; both show in the session's progress, and the fix is in the rule. Monteverdi sets the hook's own Claude Code timeout high enough that it never cuts a rule off.
- **Output passes through untrimmed** (decided 2026-11-19). An edit rule checks one file, so its output is normally a few lines; a rule that prints far more is a bug in the rule, which its author sees in the session's progress. (`submit` trims each failure to about 40 lines because whole-project revision commands can print thousands.)
- **Edits made through Bash** don't trigger the hook (decided 2026-11-19): `submit` checks them in the same run, so what's lost is only the timing. To find out whether that matters, code logs which tracked files each Bash call changed (`git status` before and after; nothing runs and the session isn't told). If build sessions turn out to edit code through Bash often, the same hook can cover it then.
- **Again at `submit`:** code runs every edit rule that matches the change, with the full list of changed files, on the commit it made. **The build step is never trusted**; passing during the build means it should pass here, but only the run code makes at `submit` counts.
- **Fast, and ideally per file.** Each one runs after every matching edit. A whole-project check like `tsc` is too slow for that, so it's a revision rule.
- **Dependencies are there.** Edit scripts can use the project's tools (Tailwind's config, the TypeScript compiler API, linters), because every task worktree gets the project's [setup command](language.md#worktree-setup) when it's created.

## Revision rules

Checks a change must pass before it merges, run in the task's worktree (see [agents.md](agents.md#revision-where-a-task-is-checked)). **Code decides which run; no model is involved in that choice.**

```markdown
---
name: typecheck
description: The project typechecks.
kind: command
run: pnpm tsc --noEmit
---
```

```markdown
---
name: ui-check
description: Changed pages render and behave correctly.
kind: agent
paths: ["src/**/*.tsx"]
---
Start the dev server on `$PORT` and open each changed page. ...

Lines flagged for review:
!`node monteverdi/rules/revision/ui-check/flag.mjs`
```

- **`kind: command`** runs a program and reads its exit code, for checks too slow or too broad to run per edit: typecheck, the test suite, lint across the project. **`kind: agent`** is instructions the revision session carries out.
- **Your own code is a command.** Any script works, as long as it follows the [command contract](#command-contract). Put it in the rule's folder, so it's versioned with the rule.
- **Selection, by code:** on `submit`, code lists the files the task changed (its commit against the endeavor branch's tip it was applied on), then selects every edit and revision rule with no `paths` plus every one whose `paths` match a changed file. A UI check runs whenever pages change, even if the scoping session didn't foresee UI work.
- **Order:** edit rules, then revision commands (both cheap), then agent revision rules only once every command has passed.
- **No time limit; a Stop button** (decided 2026-11-19). Like edit rules and `try_rule`, a revision command runs as long as it takes. The UI shows each running check with its elapsed time and a Stop control; stopping counts as that rule failing, with the output so far and `Stopped by the user after 14m03s.` A hang is a bug in the rule or the environment, so it goes to you rather than to a number we'd have to guess.

### How agent rules are enforced

- Code starts a fresh **revision session** in the task's worktree whose whole task is the selected agent revision rules, each one injected (see [Injected, not invoked](#injected-not-invoked)).
- The revision session must return a **verdict per rule, by name**, through Monteverdi's MCP server: `verdict(rule, pass, problems?, suggest_rule?)`, with each problem as `{file, line?, what, fix}` (see [agents.md](agents.md#revision-session-verdict)).
- Code checks it received a verdict for every rule it assigned. If any are missing, code resumes the session once to ask for them; **a verdict still missing counts as a failure**, so a skipped rule is caught rather than silently passed.
- Agent rules run on each task's change only, not at sign-off (decided 2026-11-19).
- Starting one revision session per agent rule would focus each one further at a higher cost; start with one revision session and per-rule verdicts.

### Command contract

What Monteverdi gives a command (an edit rule, or a revision rule with `kind: command`), and what it expects back:

| | |
|---|---|
| Working directory | The task worktree: after an edit, as it stands; at `submit` and at merge, at the commit under test. At sign-off, a clean worktree at the merged commit |
| `MONTEVERDI_BASE` | The commit the task branched from, so a script can diff against it |
| `MONTEVERDI_CHANGED_FILES` | Changed file paths, one per line, so a script can examine only what changed. After an edit, just the edited file |
| `MONTEVERDI_NODES` | The node IDs the task builds |
| Exit code | `0` passes; anything else fails |
| Output | Shown to the build session on failure. Keep it actionable: file, line, what's wrong, what to do instead |

An edit script has to work in both places: one file after an edit, every changed file at `submit`.

## Publish rules

Decided 2026-11-19 (design in progress; see [agents.md](agents.md#publish)). How the project ships. **One rule is one procedure, one kind of change**; you pick the kind when you create a root endeavor, from the rules' descriptions, and code runs that rule's steps after sign-off. No agent reads them.

```markdown
---
name: feature
description: A new feature, shipped through dev to prod.
steps:
  - run: git push origin complete:dev
  - run: gh pr create --base prod --head dev --title "$MONTEVERDI_TITLE" --body "$MONTEVERDI_SUMMARY"
  - confirm: Get the PR approved and merged.
  - run: ./scripts/wait-for-propagation.sh
  - run: git fetch origin && git merge --no-ff origin/prod
---
```

- **`run`** is a command under the [command contract](#command-contract): exit 0 continues, anything else stops the procedure with its output, and you choose Retry step, Skip step or Abort. No time limit; a Stop control. A step that waits (CI, a deploy propagating) is a slow `run`.
- **`confirm`** pauses with its text until you press Continue: for what a person does elsewhere. Sign off runs the procedure straight away, so a project that wants to sign off now and ship later starts with a `confirm` step.
- **The procedure is the project's.** What each kind does is written here, not designed into Monteverdi; a kind with no steps just signs off, and the next procedure that pushes carries it.
- **Scaffolded default:** one rule, `feature`, that pushes `complete`.
- **Runs as you,** so git and `gh` use your own credentials. Never tried by the legislator: a trial would push.
- To design: what the environment holds beyond the command contract (`MONTEVERDI_TITLE` and `MONTEVERDI_SUMMARY` above are placeholders), and where steps run.

## When rules run

| Event | What runs |
|---|---|
| Dialogue session starts | Dialogue rules, injected |
| Scoping session starts | Scoping rules, injected |
| Build session starts | Its chosen build rules, injected |
| An edit in a build session | Edit rules whose `paths` match the edited file |
| `submit` (task → endeavor branch) | **Every selected edit and revision rule.** This is where code stops being built and has to work, because other tasks build on the endeavor branch. |
| Merge (task → endeavor branch, under the merge lock) | If the branch moved since `submit`: the task's edit rules and revision commands again, on the re-applied commit |
| Sign-off (endeavor → `complete`) | Every edit rule and revision command again, on the merged result in a clean worktree, before you approve. Not agent rules |
| Publish | After sign-off: the steps of the publish rule the root endeavor's kind names |

## When revision fails

1. **Fix loop (automatic).** A failed rule's output or the revision session's notes go back to the same build session, resumed with its context. It fixes the problem and submits again. Most failures end here.
2. **The Answer is wrong.** If the revision session or the build session concludes the Answer itself is wrong, it calls `reopen` and the problem goes to a Dialogue on the design node.
3. **Escalation.** When the loop isn't converging (the same rule fails 3 times, a setting, or the build session says it's stuck), Monteverdi opens a **Dialogue attached to the build task**: `<task-id>.dialogue.md` (task IDs are `<id>.build.<n>`), with the same turns, Findings block, and warm-resume / cold-fresh rules as any Dialogue. The participants are you and the build session itself, resumed, since it knows what it tried. When code escalates, the build session writes the opening turn (what keeps failing, what it tried, what it needs), with every attempt's verdicts and command output appended; see [agents.md](agents.md#build-session-escalation).

Typical causes for escalation: the build and revision sessions disagree, a rule seems wrong for this case, a flaky test, a broken environment, a conflict the session can't resolve.

| Outcome | What happens |
|---|---|
| Guidance | "Do it this way." The build session continues and resubmits. |
| One-time override | You accept the failure for this change. A control in the task's Dialogue; code records it as a commit trailer: `Monteverdi-Override: color-tokens (reason)`. **Only you can grant this, never an agent.** |
| Rule change | The rule is wrong in general. You start the [legislator](agents.md#legislator) from the Dialogue; it changes the rule with you. |
| Design change | It's a design problem: `reopen` on the node. |
| Environment fix | The environment or flaky test gets fixed and you say so in the Dialogue; the build session submits its work unchanged. |

**At sign-off**, a failure on the merged result is usually an integration problem no single task owns. Monteverdi creates a small fix task on the endeavor branch (an ordinary build session, briefed with the failure); if that fails too, it escalates the same way.

## Improving rules

- The revision session's `verdict` can include `suggest_rule`: a proposed change to a build rule (so the problem isn't built in the first place), or a proposal to turn a recurring agent finding into a command (an edit rule if it's fast and per file, otherwise a revision command).
- Monteverdi logs failures per rule, so a rule that keeps failing for the same reason is visible.
- The UI shows suggested rule changes with an accept button; accepting starts the [legislator](agents.md#legislator), which changes the rule with you.
- `suggest_rule` is part of the `verdict` tool from the start; the log and UI come with the UI work.

## Open

- **Escalation threshold.** 3 failures of the same rule is a starting guess.
