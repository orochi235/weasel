---
'@weasel-js/export': minor
---

`selectionRegionsSource(ids)` reads a selection's box from the revision an export draws, so an edit mid-export cannot crop it.

`selectionRegionSource(ids)` is the single-region form.

```ts
await exportRegions(scene, selectionRegionsSource(selection.get(), { scale: 2 }), 'png', { scale: 2 });
```

<!-- entry: api -->
