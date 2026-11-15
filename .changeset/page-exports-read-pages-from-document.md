---
'@weasel-js/core': minor
'@weasel-js/diagram-formats': minor
---

The diagram page exports take pages read from the document, so a page moved during an export is written where it now is.

Pass `pageRegionOf(page)` or `pageRegionsOf(pages)`, new in core, which find each page by its id in the revision the export draws and fail for one it removed. A fixed rect still works and is drawn where it was given.

```ts
await exportPagesPdf(scene, pageRegionsOf(placedPagesOf(scene)));
```

<!-- entry: api fix -->
