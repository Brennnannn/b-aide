# Token usage

Reference notes, researched 2026-11-10, so we don't have to research this again. Figures from Anthropic's docs are marked as such; most others are third-party and unverified. Our own measurement is in [usage-test](usage-test/README.md).

## How a request is priced

Every API call re-sends the whole context, in a fixed order: tool definitions, then the system prompt, then the conversation ([Anthropic][maximize]). One user turn is usually several calls, one per tool use (4–5 in our test).

| Token type | Price vs. base input ([Anthropic][maximize]) |
|---|---|
| Uncached input | 1× |
| Cache write | 1.25× (5-minute cache) or 2× (1-hour cache) |
| Cache read | 0.1× |
| Output | ~5× |

- The cache lasts **one hour on a subscription, five minutes on an API key** (`ENABLE_PROMPT_CACHING_1H=1` gives an API key the hour) ([Anthropic][maximize]).
- The cache is a prefix: anything that changes early in the context invalidates everything after it. **Changing model, effort or fast mode mid-session breaks it** ([Anthropic][maximize]).
- Appending to the end of the conversation is the cache-friendly case.

## The two parts of the context

- **S, startup context:** system prompt, tool definitions, MCP and skill listings, CLAUDE.md, auto memory. It's the same in every session, so it's mostly served from cache. We measured 53k (subagent) and 73k (new session); ~34k of the session's was already cached from other sessions.
- **H, history:** everything this session has said and read. It grows with every call, and only this session can reuse it.

**Starting a new chat never avoids S**; every session pays it on every call. A new chat drops **H**. "Start new chats" really means: stop paying 0.1× on every call for history that no longer matters.

### Rough break-even

A new session cost ~81k input-token equivalents to start in our test (39k written at 2× plus 33k read at 0.1×).

- With **150k** of history that no longer matters, each call costs ~15k extra. A fresh session pays for itself after ~6 calls, plus the cost of re-reading what it needs.
- With **20k** of still-relevant history, starting fresh almost never pays.

Start fresh when the history is large *and* mostly irrelevant to what comes next, which usually means a change of task, not the middle of one.

## Long context also lowers quality

Chroma's [Context Rot][chroma] study tested 18 models: **performance drops as input grows, unevenly and often unpredictably**, even on simple tasks. It drops more when the context holds similar-but-wrong material. On one memory benchmark, a focused ~300-token prompt scored much better than the full ~113k-token one. Claude models hallucinated least under misleading context but abstained more.

## What loads at startup

Per [Anthropic's context-window page][ctx], before you type anything: the system prompt, built-in tool definitions, CLAUDE.md (or AGENTS.md), auto memory, MCP tool names and server instructions, skill descriptions, and any output style or appended system prompt.

- Third-party figures: 25–35k is typical ([morphllm][morph-limit]); one breakdown was 3.1k system prompt, 19.8k built-in tools, 26.5k MCP tools ([edenai][edenai]).
- **Tool search** now defers full MCP tool definitions until a tool is used; names and server instructions still load at startup ([claudelog][claudelog]).
- CLAUDE.md is re-sent on every call, so keep it short ([mindstudio][mindstudio]).
- Run `/context` in a session for the real breakdown of your own setup.

## Controlling startup for sessions Monteverdi starts

Monteverdi runs `claude` itself, so each session's startup is set by flags, not by whatever is connected in the user's chat app ([CLI reference][cli]):

| Flag | Effect |
|---|---|
| `--mcp-config <file>` + `--strict-mcp-config` | Load only the MCP servers in that file, ignoring every other MCP configuration |
| `--tools "Read,Edit,Bash"` | Restrict the built-in tools (`""` disables all). Doesn't affect MCP tools |
| `--disallowedTools "mcp__*"` | Remove matching tools from context entirely |
| `--disable-slash-commands` | Disable all skills and commands for the session |
| `--setting-sources user,project,local` | Choose which settings files load |
| `--bare` | Skip hooks, skills, plugins, MCP servers, auto memory and CLAUDE.md; only Bash, Read and Edit |
| `--plugin-dir <dir>` | Load a specific plugin (with its skills) for this session only |
| `--append-system-prompt-file <file>` | Add Monteverdi's role instructions to the default system prompt |
| `--system-prompt-file <file>` | Replace the default system prompt entirely |
| `--model`, `--effort` | Set per role; never change them mid-session |
| `--max-turns <n>` | Cap agentic turns (print mode only) |
| `--resume <id>` / `--fork-session` / `--session-id <uuid>` | Resume a session, fork it into a new ID, or choose the ID up front |
| `--exclude-dynamic-system-prompt-sections` | Move per-user details out of the system prompt so the cached prefix is shared across machines |

Settings files can also gate what loads: `enabledPlugins`, `skillOverrides`, `disableBundledSkills`, `syncClaudeAiSkills`, `syncClaudeAiPlugins`, `disableClaudeAiConnectors`, and the `.mcp.json` approval keys.

## Compaction

Per [Anthropic][ctx]:

- `/compact` (and automatic compaction near the context limit) **replaces the conversation in the model's context with a structured summary**. `/compact <focus>` steers what the summary keeps.
- After compaction: the system prompt, CLAUDE.md, auto memory and skill descriptions reload from disk; up to five recently modified files Claude read or edited are re-read (files over 5k tokens come back as a path only); invoked skill bodies are re-injected up to 5k each and 25k total.
- The summarization request uses the session's thinking setting.
- `/rewind` → "Summarize from here" or "Summarize up to here" compacts only part of the conversation.
- `/autocompact <tokens>` sets how full the context gets before automatic compaction.
- Compaction rewrites the whole conversation, so it always costs something; it's cheaper while the conversation is still cached, so do it before a break, not after ([Anthropic][maximize]).

**The transcript keeps everything.** Compaction changes what the model sees, not the session's transcript file (`~/.claude/projects/<project>/<session>.jsonl`). A compacted transcript we checked had its compaction marker at line 551 of 740: everything before it is still in the file, and the UI can still show it.

### Idle compaction

Claude Code can compact a long conversation you've left idle **before the cache expires**, so resuming sends a summary instead of re-sending the whole history at cache-write prices ([dsebastien][idle]; setting `idleCompaction` in the [settings reference][settings]). Reported conditions: interactive session, one-hour cache, context of at least 200k tokens (the default threshold), and the computer awake ~54 minutes after the last request. The tradeoff: Claude continues from a lossy summary, which can drop rejected approaches, exact errors or early constraints.

### What compaction costs, loses and saves

Researched 2026-11-10 because compaction isn't yet decided as a standard Monteverdi feature.

**One measured compaction on this machine** (an automatic one in another project, read from its transcript's compaction marker):

| | Tokens |
|---|---:|
| Context before | 169,458 |
| Conversation after (summary + 4 kept messages) | 12,592 |
| Summary text | ~3.9k (estimated from its length) |
| First call after: total context | ~45.8k (29.8k read from cache, 16.0k newly written) |
| Time taken | 162 seconds |

**A. Cost of running it.** The summarizing call itself isn't logged in the transcript ([dev.to trace][trace]), so this is an estimate. It reads the whole context once (warm cache: 169k × 0.1 ≈ 17k equivalents; cold: up to 169k × 2), writes the summary (output at 5×; a few thousand tokens, ≈ 20k+ equivalents), then the next call writes the new, smaller context to cache (16k × 2 ≈ 32k). **Total ≈ 70k input-token equivalents with a warm cache, about four ordinary calls at that context size.** The dev.to trace measured summaries of 10.6k–18.8k tokens in one session, larger than ours. Steve Kinney's [cost model][kinney] (assumptions, not measurements) puts the warm-cache break-even at ~31 more turns for a 50k context, ~18 at 100k, ~13 at 200k, and finds that **with an expired cache, compacting pays off immediately at every size**.

**B. Drift.** No study measures the same Claude Code session's quality compacted vs. not, so this is partly evidence and partly user experience:
- **Factory's [probe evaluation][factory]** (36,000+ messages from real engineering sessions, an LLM judge scoring 0–5) gave Anthropic's built-in compression **3.44 overall**: accuracy 3.74, context 3.56, artifact tracking **2.33**, completeness 4.37, continuity 3.67, instruction-following 4.95. Factory's own summarizer scored 3.70 and OpenAI's 3.35. **Tracking artifacts (which files were touched and how) was the weakest area for every method**, at ~98–99% compression. No uncompressed baseline was scored.
- **User reports** consistently describe losing exact error messages, rejected approaches, early constraints and file-level detail; the gist survives, the precision doesn't ([morphllm][morph-compact], [dev.to][devto-compact], [issue #29890][issue-29890]). These are anecdotes, not measurements.
- **Long conversations degrade anyway.** "[LLMs Get Lost in Multi-Turn Conversation][lost]" (ICLR 2026) found an average **39% drop** when a task unfolds over several turns instead of one prompt; models commit to early assumptions and don't recover, and recap-style fixes didn't solve it. Together with [Context Rot][chroma], that means the uncompacted original isn't a perfect baseline either: a focused summary can beat a long, noisy history.

**C. Savings on a cold restart.** For the session above, resuming after the cache expired would rewrite everything:
- **Uncompacted:** ~169k × 2 (one-hour cache rate) ≈ **340k equivalents** for the first call.
- **Compacted:** ~46k × 2 ≈ **92k** at worst; less when the startup context is already cached from other sessions, as it usually is.
- **Saving ≈ 250k per cold restart**, or ~180k after paying ~70k for the compaction. Every later call is also cheaper, by ~12k each (0.1 × the ~123k difference).

The smaller the session, the smaller the saving: at 30k of history, compaction costs about as much as it saves.

Those figures assume compacting just before the cache expires. Compacting **after** it has expired, at the moment the session is reactivated, has to read the old context uncached (~169k × 1), so it costs more (~220k equivalents in total for this session), but it's still cheaper than the ~340k plain cold resume, and it never spends anything on a session nobody comes back to.

**Decided for Monteverdi: no compaction.** Compaction pays only when a session is large and resumed cold. Build sessions run continuously, so the only such case is a Dialogue reactivated after its cache expired, and a Dialogue's conversation already lives in its dialogue file. So a cold Dialogue starts a **fresh session that reads the breadcrumb and the dialogue file** instead (see [agents.md](agents.md#dialogue-session)). That costs the startup context (usually cached) plus the file plus whatever code it re-reads, which is cheaper than either a cold resume or a compaction, and it starts from the exact record rather than a lossy summary.

## Common advice

1. One task per session; `/clear` between unrelated tasks ([Anthropic][maximize], [summary][hallie]).
2. Within a task, keep going: S is already paid and H is relevant.
3. Don't resume a large session cold; compact before the break if you'll want it later.
4. Set model, effort and fast mode at the start, not midway.
5. Shrink S: disconnect MCP servers a project doesn't use, keep CLAUDE.md short.
6. Send big reads that end in a short answer to a subagent; its context is discarded and only the summary stays ([Zivtech][zivtech]).

**Gaps:** no published, measured comparison of starting fresh vs. continuing, and no official break-even point. Figures like "60–70% savings" come from single blog posts ([composio][composio], [kdnuggets][kdnuggets]).

[maximize]: https://claude.com/resources/articles/maximizing-the-value-of-your-claude-code-sessions
[hallie]: https://aiweekly.co/alerts/anthropics-hallie-claude-code-bills-hinge-on-session-habits
[ctx]: https://code.claude.com/docs/en/context-window
[cli]: https://code.claude.com/docs/en/cli-reference
[settings]: https://code.claude.com/docs/en/settings-reference
[chroma]: https://www.trychroma.com/research/context-rot
[morph-limit]: https://www.morphllm.com/claude-code-token-limit
[edenai]: https://www.edenai.co/post/claude-code-vs-opencode-the-33k-token-overhead-gap
[claudelog]: https://claudelog.com/faqs/do-mcp-servers-use-claude-code-context/
[mindstudio]: https://www.mindstudio.ai/blog/how-to-stop-burning-through-claude-code-tokens-context-management-guide-beginners
[idle]: https://www.dsebastien.net/2026-10-16-claude-code-idle-compaction-cheaper-to-resume-but-from-a-summary/
[zivtech]: https://www.zivtech.com/blog/economics-of-claude-code-part-2-agent-tradeoff
[trace]: https://dev.to/slima4/where-do-your-claude-code-tokens-actually-go-we-traced-every-single-one-423e
[kinney]: https://stevekinney.com/experiments/compact-or-clear
[factory]: https://factory.com/news/evaluating-compression
[morph-compact]: https://www.morphllm.com/claude-code-auto-compact
[devto-compact]: https://dev.to/mikeadolan/claude-code-compaction-kept-destroying-my-work-i-built-hooks-that-fixed-it-2dgp
[issue-29890]: https://claudeissues.com/issue/29890-bug-context-compaction-loses-critical-working-knowledge-mid-session
[lost]: https://arxiv.org/abs/2505.06120
[composio]: https://composio.dev/content/ways-to-cut-token-consumption-in-claude-code
[kdnuggets]: https://kdnuggets.com/7-practical-ways-to-reduce-claude-code-token-usage
