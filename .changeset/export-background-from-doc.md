---
'@weasel-js/export': minor
'@weasel-js/svg': minor
'@weasel-js/pdf': minor
---

A region export's `background` may be a function of the document drawn, so a color read from it matches the revision of the shapes.

```ts
exportRegionSvg(scene, region, { background: (doc) => pageColorOf(doc) });
```

<!-- entry: api -->
