---
'@weasel-js/ui': minor
---

`useValueChanges(on)` gives the values each report of a sweeping multiple selection turns on or off.

It is for a consumer that writes those values one at a time, and is also at `@weasel-js/ui/value-changes`.

A sweep or an Alt-drag reports each step from its own copy, so a handler that diffs against the render it closed over rewrites or misses values. `useValueChanges` measures each report from the last one until the component renders again.

```tsx
const changesOf = useValueChanges(on);
<SegmentedBar mode="multiple" sweep value={on} items={items}
  onChange={(next) => { for (const [value, to] of changesOf(next)) write(value, to); }} />
```

<!-- entry: api -->
