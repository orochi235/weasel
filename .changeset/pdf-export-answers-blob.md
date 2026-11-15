---
'@weasel-js/pdf': major
'@weasel-js/diagram-formats': major
---

`exportRegionsPdf` and `exportPagesPdf` answer the PDF's `Blob`; what they left out goes to `onDiagnostic`.

```ts
// before
const { blob, skipped } = await exportRegionsPdf(scene, regions);
// after
const blob = await exportRegionsPdf(scene, regions, { onDiagnostic: (d) => said.push(d.message) });
```

<!-- entry: breaking api -->
