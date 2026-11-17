# Usage test: subagent vs. new session

Does the same task cost more as a subagent than as a prompt pasted into a new session?

## Method

The same task ([task.md](task.md)) runs two ways, on the same model:

- **Agent:** started from a planning session with the Agent tool (general-purpose subagent). It writes `out-agent.md`.
- **Session:** pasted into a new Claude Code session in this folder. It writes `out-session.md`.

[measure.mjs](measure.mjs) reads each run's transcript and sums the usage the API reported:

```bash
node planning/usage-test/measure.mjs <agent transcript.jsonl> <session transcript.jsonl>
```

Transcripts are in `~/.claude/projects/<project>/`. A session's is `<session-id>.jsonl`; a subagent's is the `.output` file Claude Code reports when the agent starts.

**What the rows mean:**
- **Startup context:** the size of the first request, i.e. everything the run carried before doing any work (system prompt, tools, CLAUDE.md, the task).
- **Cache read:** context re-sent on every call. It's cheap per token but grows with every tool call.
- **Cost-weighted:** all tokens weighted by price relative to uncached input (cache write 1.25× for 5m or 2× for 1h, cache read 0.1×, output 5×). This is the fairest single number for comparing cost.

The agent's report back into the planning session (the "tax") isn't counted; with a one-line reply, it's negligible.

## Results (2026-11-10, Opus 5.5, medium effort)

| | Agent | Session |
|---|---:|---:|
| API calls | 5 | 4 |
| Startup context | 52,765 | 72,534 |
| Uncached input | 10 | 8 |
| Cache write (5m) | 64,373 | 0 |
| Cache write (1h) | 0 | 38,962 |
| Cache read | 233,957 | 275,112 |
| Output | 1,307 | 1,369 |
| All tokens | 299,647 | 315,451 |
| **Cost-weighted** | **110,407** | **112,288** |

Both produced a comparable summary (267 and 241 words).

**Findings:**
- **Same task, same cost.** Within 2%. Running work as a subagent doesn't in itself cost more than pasting the prompt into a new session.
- **Startup context dominates both.** 53k (agent) and 73k (session) before any work, against a ~150-token task. A new session carries the full Claude Code system prompt plus the listings of every tool, MCP server and skill; a subagent's system prompt is lighter. This is the biggest lever for either way of running work.
- **Different caching, same price.** The session found ~34k of its startup context already cached (shared with other sessions) and wrote the rest at the 1-hour rate (2×). The agent found nothing cached and wrote everything at the 5-minute rate (1.25×). The two balance out here.
- **The counter shown when an agent finishes is its final context size** (64.5k here, matching its cache writes), not the total processed (~300k). Comparing that number with a session's context counter compares different meters, which likely explains the 5k-vs-30–40k impression.

**Implication for Monteverdi:** choose between process and subagent per agent on other grounds (visibility, resuming, worktrees). For cost, cut startup context: tool allowlists, only Monteverdi's MCP server, no CLAUDE.md where it doesn't help.
