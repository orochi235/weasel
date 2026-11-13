---
'@weasel-js/guides': major
---

`guideSnapSource` takes an options bag like its sibling snap sources, with `id` and `reachPx` beside `getGuides`.

```ts
// Before
guideSnapSource(() => guides);

// After
guideSnapSource({ getGuides: () => guides });
```

<!-- entry: breaking api -->
