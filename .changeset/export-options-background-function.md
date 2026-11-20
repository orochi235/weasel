---
'@weasel-js/export': minor
---

`exportRegions` and `exportPages` take `background` as a function of the document drawn, as every format's own export already does.

```ts
await exportPages(scene, pages, 'pdf', { background: (doc) => pageColorOf(doc) });
```

<!-- entry: api -->
