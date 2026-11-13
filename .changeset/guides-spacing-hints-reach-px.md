---
'@weasel-js/guides': major
---

`createSpacingHintsPreset`'s snap distance is `reachPx`, the name its snap sources take it under.

```ts
// Before
createSpacingHintsPreset({ tolerance: 8 });

// After
createSpacingHintsPreset({ reachPx: 8 });
```

<!-- entry: breaking api -->
