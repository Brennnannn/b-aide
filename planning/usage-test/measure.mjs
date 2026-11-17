// Sums token usage from Claude Code transcript files (.jsonl).
// Usage: node measure.mjs <transcript.jsonl> [more.jsonl ...]
//
// Each API response can appear on several transcript lines (one per content block),
// so usage is counted once per message id.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

// Relative to the base input price, matching Anthropic's published multipliers.
const WEIGHT = { input: 1, write5m: 1.25, write1h: 2, read: 0.1, output: 5 }

function measure(path) {
  const seen = new Set()
  const t = { calls: 0, input: 0, write5m: 0, write1h: 0, read: 0, output: 0, startup: null }

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    let entry
    try { entry = JSON.parse(line) } catch { continue }
    const msg = entry.message
    if (entry.type !== 'assistant' || !msg?.usage || !msg.id || seen.has(msg.id)) continue
    seen.add(msg.id)

    const u = msg.usage
    const write = u.cache_creation_input_tokens ?? 0
    const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0
    const write5m = u.cache_creation?.ephemeral_5m_input_tokens ?? write - write1h

    t.calls++
    t.input += u.input_tokens ?? 0
    t.write5m += write5m
    t.write1h += write1h
    t.read += u.cache_read_input_tokens ?? 0
    t.output += u.output_tokens ?? 0
    // Context size of the first request: what the agent carried before doing any work
    if (t.startup === null) t.startup = (u.input_tokens ?? 0) + write + (u.cache_read_input_tokens ?? 0)
  }

  t.total = t.input + t.write5m + t.write1h + t.read + t.output
  t.weighted = Math.round(
    t.input * WEIGHT.input + t.write5m * WEIGHT.write5m + t.write1h * WEIGHT.write1h +
    t.read * WEIGHT.read + t.output * WEIGHT.output,
  )
  return t
}

const rows = process.argv.slice(2).map((p) => [basename(p), measure(p)])
if (rows.length === 0) {
  console.error('Usage: node measure.mjs <transcript.jsonl> [more.jsonl ...]')
  process.exit(1)
}

const fmt = (n) => (n ?? 0).toLocaleString('en-US')
const fields = [
  ['API calls', 'calls'],
  ['Startup context', 'startup'],
  ['Uncached input', 'input'],
  ['Cache write (5m)', 'write5m'],
  ['Cache write (1h)', 'write1h'],
  ['Cache read', 'read'],
  ['Output', 'output'],
  ['All tokens', 'total'],
  ['Cost-weighted (input-token equivalents)', 'weighted'],
]

console.log(`| | ${rows.map(([name]) => name).join(' | ')} |`)
console.log(`|---|${rows.map(() => '---:').join('|')}|`)
for (const [label, key] of fields) console.log(`| ${label} | ${rows.map(([, t]) => fmt(t[key])).join(' | ')} |`)
