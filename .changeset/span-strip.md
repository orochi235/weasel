---
"@weasel-js/ui": minor
---

`SpanStrip` shows spans of time on one track, each filled in its own color up to a playhead, and `SpanStrips` stacks them on one clock.

```tsx
<SpanStrips
  aria-label="Round 42"
  window={{ from: roundStart, to: now + 20 * 60_000 }}
  at={now}
  ruler={{ steps: [5, 10, 15, 30].map((m) => m * 60_000), format: (ms) => clock.format(ms) }}
  rows={[{ id: 'core.ops', 'aria-label': 'core.ops', lead: 'core.ops', spans: [
    { id: 'review', label: '5+2 found', start: reviewStart, ms: 300_000, state: 'done', color: 'var(--wzl-swatch-violet)' },
    { id: 'fix', label: 'studio · 12m', ms: 720_000, state: 'active' },
  ] }]}
/>
```

A span sits at its `start`, or end to end after the one before it, inside the strip's `window` (by default, 0 to where the last ends); `fill` (0 to 1) shows progress inside one span apart from the playhead, and a span not begun is dimmed. Without `onSeek` a strip is a `meter`; with `onSeek(ms, held)` it is a slider that a press or drag seeks with `held` true and letting go seeks with it false, and the arrows, Home and End step it. `SpanStrips` lays its rows flush with one border between neighbors, a column of leads before them, one playhead down the stack (none when `at` is left out), and a ruler at round `steps` labeled by `format`. `--span-strip-height` and `--span-strip-text` on any ancestor size the strips; the text takes its container's font family.

<!-- entry: rank=5 new api -->
