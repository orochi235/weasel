---
'@weasel-js/ui': major
---

`GradientEditor` reports the stop selected through `onSelectionChange`, where it was `onSelectedStopChange`.

```tsx
// before
<GradientEditor value={g} onChange={setG} selectedStop={i} onSelectedStopChange={setI} />
// after
<GradientEditor value={g} onChange={setG} selectedStop={i} onSelectionChange={setI} />
```

<!-- entry: breaking api -->
