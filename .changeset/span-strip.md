---
"@weasel-js/ui": minor
---

`SpanStrip` shows spans of time end to end on one track, filled in each span's color up to a playhead.

```tsx
<SpanStrip
  aria-label="Round 42"
  at={elapsedMs}
  spans={[
    { id: 'review', label: 'review', ms: 300_000, state: 'done', color: 'var(--wzl-swatch-violet)' },
    { id: 'fix', label: 'fix', ms: 1_080_000, state: 'active' },
  ]}
/>
```

Each span is as wide as its share of the whole, labeled, and marked off from the next by a dotted seam. Without `onSeek` it is a `meter`; with `onSeek(ms, held)` it is a slider that a press or drag seeks with `held` true and letting go seeks with it false, and the arrows, Home and End step it. `valueText` sets what a screen reader says of the playhead.

<!-- entry: rank=5 new api -->
