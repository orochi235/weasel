---
'@weasel-js/ui': minor
---

`CycleButton` given a `value` outside its `options` shows no option as current. A click chooses the first option.

A shift-click chooses the last. It warns unless passed the new `allowUnlistedValue`, for a value meant to be outside the rotation, such as a mixed selection:

```tsx
<CycleButton value={shape} options={SHAPES} onChange={setShape} aria-label="Shape" allowUnlistedValue />
```

<!-- entry: fix api -->
