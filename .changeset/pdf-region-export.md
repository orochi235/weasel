---
'@weasel-js/pdf': minor
---

`exportRegionsPdf` writes regions of a scene as the pages of one PDF, and `registerPdfExport()` makes it core's `pdf` export format.

Each region is a page at 0.75 points per world unit, labeled with the region's `name`. `@weasel-js/pdf` now takes `@weasel-js/core` as a peer dependency.

```ts
registerPdfExport();
const blob = await exportPages(scene, placedPagesOf(scene), 'pdf', { title: 'Drawing' });
```

<!-- entry: rank=5 new api -->
