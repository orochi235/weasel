---
'@weasel-js/ui': minor
---

A `SegmentedBar` takes its segments from a `Sweep` through `steps`, one segment per step, labeled by the sweep.

`steps` stands in for `items` in the `'single'`, `'multiple'`, and `'momentary'` modes, and is walked by `stepsOf`, as `Sequence` walks its `sweep`.

```tsx
<SegmentedBar aria-label="Gap" steps={range({ from: 0, to: 16, step: 4 })} value={gap} onChange={setGap} />
```

<!-- entry: new api -->
