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

## Five types of rule

Each type is named after its step, and the agent that runs the step shares the name (the Dialogue step and Dialogue session read Dialogue rules). **Each type belongs to exactly one agent or step**, so where a rule applies follows from its folder alone: no agent or setting decides it.

| Type | Read or run by | When | Holds |
|---|---|---|---|
| [Dialogue](#dialogue-rules) | Dialogue sessions | While you design an endeavor together | How this project likes designs worked out |
| [Scoping](#scoping-rules) | Scoping session | Once per build, with the whole endeavor in view | What already exists and where to find it; how work is split |
| [Build](#build-rules) | Build session | Injected at the head of its instructions | How code is written here |
| [Edit](#edit-rules) | Build session's hooks, then the test station | After each matching edit, and again at revision | Fast mechanical checks |
| [Revision](#revision-rules) | Test station and revision session | At `submit` and sign-off | Whether the result holds up: slower checks and judgment |

Dialogue, scoping and build rules are **guidance**: an agent reads them and follows them at its discretion. Edit and revision rules are **checks**: they run, and they decide. **What must happen can't be guidance**, so anything required belongs in edit or revision rules.

At the station, edit rules run before revision rules: they're cheap, and a revision session shouldn't spend tokens judging code that doesn't typecheck.

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

**Personal rules** live in `~/.monteverdi/rules/<type>/` (same five folders, same format) and apply to every project. Monteverdi reads both locations; when a personal rule and a project rule of the same type share a name, the project's wins. Personal rules aren't in the repo, so anyone else on the project doesn't get them; to keep history honest, each verdict records the rule's source (`project` or `personal`).

## Injected, not invoked

Dialogue, scoping, build and agent revision rules all reach their agent the same way:

- **Injected:** Monteverdi puts the rule's full text into the agent's instructions (`--append-system-prompt-file`), rather than loading it as a skill. A skill's body only loads if the model decides to invoke it, and models sometimes don't; injected text is always in context, and cached.
- **Embedded commands:** a skill can contain `` !`command` ``, which Claude Code runs when the skill loads, pasting the output in. Injection bypasses that, so **Monteverdi runs those commands itself** when it starts the agent and injects their output. The agent gets current facts (the token list, the database schema) without having to fetch them.

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

Guidance for building. **The scoping session chooses them (code adds those whose `paths` match a task's `touches`); Monteverdi injects them into the build session.**

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

- **Choosing:** the scoping session reads only the frontmatter of every build rule. `description` says when the rule applies; `paths` says which files it concerns, and code adds a rule automatically when its `paths` match a task's `touches`. The chosen rules go in each task's entry in `<id>.build.md`, next to the tools that task needs.
- **Tools:** a rule can declare `tools: [browser]`, naming tool catalog entries (see [agents.md](agents.md#scoping-session)); choosing the rule brings them into the build session.
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
- **A failure is feedback, not a stop.** The check's output goes straight back to the session, which keeps working and usually fixes the problem next, while the file is still in front of it. Catching it early also keeps failures out of the station's queue, which every task shares.
- **Again at revision:** the station runs every edit rule that matches the change, with the full list of changed files. **The build step is never trusted**; passing during the build means it should pass here, but only the station's run counts.
- **Fast, and ideally per file.** Each one runs after every matching edit. A whole-project check like `tsc` is too slow for that, so it's a revision rule.
- **Dependencies are there.** Edit scripts can use the project's tools (Tailwind's config, the TypeScript compiler API, linters), because every task worktree gets the project's [setup command](language.md#worktree-setup) when it's created.

## Revision rules

Checks a change must pass at the test station. **Code decides which run; no model is involved in that choice.**

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
Open each changed page on the station's dev server. ...

Lines flagged for review:
!`node monteverdi/rules/revision/ui-check/flag.mjs`
```

- **`kind: command`** runs a program and reads its exit code, for checks too slow or too broad to run per edit: typecheck, the test suite, lint across the project. **`kind: agent`** is instructions the revision session carries out.
- **Your own code is a command.** Any script works, as long as it follows the [command contract](#command-contract). Put it in the rule's folder, so it's versioned with the rule.
- **Selection, by the station's code:** on `submit`, the station lists the files the task changed (git diff of the task branch against the endeavor branch), then selects every edit and revision rule with no `paths` plus every one whose `paths` match a changed file. A UI check runs whenever pages change, even if the scoping session didn't foresee UI work.
- **Order:** edit rules, then revision commands (both cheap), then agent revision rules only once every command has passed.

### How agent rules are enforced

- The station starts a fresh **revision session** whose whole task is the selected agent revision rules, each one injected (see [Injected, not invoked](#injected-not-invoked)).
- The revision session must return a **verdict per rule, by name**, through Monteverdi's MCP server: `verdict(rule, pass, notes, suggest_rule?)`.
- The station checks it received a verdict for every rule it assigned. **A missing verdict counts as a failure** and that rule is re-run, so a skipped rule is caught rather than silently passed.
- Starting one revision session per agent rule would focus each one further at a higher cost; start with one revision session and per-rule verdicts.

### Command contract

What Monteverdi gives a command (an edit rule, or a revision rule with `kind: command`), and what it expects back:

| | |
|---|---|
| Working directory | After an edit: the task worktree. At the station: the station worktree, at the commit under test |
| `MONTEVERDI_BASE` | The commit the task branched from, so a script can diff against it |
| `MONTEVERDI_CHANGED_FILES` | Changed file paths, one per line, so a script can examine only what changed. After an edit, just the edited file |
| `MONTEVERDI_NODES` | The node IDs the task builds |
| Exit code | `0` passes; anything else fails |
| Output | Shown to the build session on failure. Keep it actionable: file, line, what's wrong, what to do instead |

An edit script has to work in both places: one file after an edit, every changed file at the station.

## When rules run

| Event | What runs |
|---|---|
| Dialogue session starts | Dialogue rules, injected |
| Scoping session starts | Scoping rules, injected |
| Build session starts | Its chosen build rules, injected |
| An edit in a build session | Edit rules whose `paths` match the edited file |
| add / commit on a task branch | Nothing (optionally a formatter, if it takes seconds). Commits are the build session's private checkpoints. |
| `check` (on demand) | Edit rules and revision commands, at the station |
| `submit` (task → endeavor branch) | **Every selected edit and revision rule.** This is where code stops being built and has to work, because other tasks build on the endeavor branch. |
| Sign-off (endeavor → `complete`) | Every edit and revision rule again, on the merged result, before you approve |
| Push | After sign-off |

## When revision fails

1. **Fix loop (automatic).** A failed rule's output or the revision session's notes go back to the same build session, resumed with its context. It fixes the problem and submits again. Most failures end here.
2. **The Answer is wrong.** If the revision session or the build session concludes the Answer itself is wrong, it calls `reopen` and the problem goes to a Dialogue on the design node.
3. **Escalation.** When the loop isn't converging (the same rule fails 3 times, a setting, or the build session says it's stuck), Monteverdi opens a **Dialogue attached to the build task**: `<task-id>.dialogue.md` (task IDs are `<id>.build.<n>`), with the same turns, Findings block, and warm-resume / cold-fresh rules as any Dialogue. The participants are you and the build session itself, resumed, since it knows what it tried. Monteverdi seeds it with every attempt's verdicts and command output.

Typical causes for escalation: the build and revision sessions disagree, a rule seems wrong for this case, a flaky test, a broken test station, a conflict the session can't resolve.

| Outcome | What happens |
|---|---|
| Guidance | "Do it this way." The build session continues and resubmits. |
| One-time override | You accept the failure for this change. Recorded as a commit trailer: `Monteverdi-Override: color-tokens (reason)`. **Only you can grant this, never an agent.** |
| Rule change | The rule is wrong in general. A short session edits it; you review the change. |
| Design change | It's a design problem: `reopen` on the node. |
| Environment fix | The station or flaky test gets fixed; the task resubmits unchanged. |

**At sign-off**, a failure on the merged result is usually an integration problem no single task owns. Monteverdi creates a small fix task on the endeavor branch (an ordinary build session, briefed with the failure); if that fails too, it escalates the same way.

## Improving rules

- The revision session's `verdict` can include `suggest_rule`: a proposed change to a build rule (so the problem isn't built in the first place), or a proposal to turn a recurring agent finding into a command (an edit rule if it's fast and per file, otherwise a revision command).
- Monteverdi logs failures per rule, so a rule that keeps failing for the same reason is visible.
- The UI shows suggested rule changes with an accept button; accepting starts a short session that edits the rule, and you review that change like any other.
- `suggest_rule` is part of the `verdict` tool from the start; the log and UI come with the UI work.

## Open

- **Escalation threshold.** 3 failures of the same rule is a starting guess.
