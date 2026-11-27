---
"@weasel-js/ui": minor
---

`StatRow` shows a row of headline figures, each a big value over its word.

```tsx
<StatRow
  aria-label="At a glance"
  justify="between"
  stats={[
    { label: 'fixed', value: '30', accent: 'var(--wzl-success)' },
    { label: 'left', value: '7', tone: 'estimate', tip: 'Estimated from the depletion fit.' },
    { label: 'elapsed', value: '9:41', tone: 'clock' },
  ]}
/>
```

It is a `<dl>` with each word before its value for a screen reader, the value shown above it, right-aligned in tabular figures, and the row wraps. `tone` sets a figure as an `estimate` (italic, muted), `light`, or a `clock` held to a fixed width so changing digits never move what follows. `tip` puts a note in a tooltip over the word, `accent` draws a bar of that color over the figure, and `justify` packs the row from the `start` (the default) or spreads it end to end (`between`).

<!-- entry: rank=3 new api -->
