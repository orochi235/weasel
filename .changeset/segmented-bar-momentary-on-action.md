---
'@weasel-js/ui': minor
---

A momentary `SegmentedBar` takes an `onAction(value)` of its own, called for any segment that has no `onAction`.

```tsx
<SegmentedBar mode="momentary" aria-label="Zoom" steps={values([50, 100, 200])} onAction={setZoom} />
```

<!-- entry: api -->
