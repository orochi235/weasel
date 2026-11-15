---
'@weasel-js/core': major
'@weasel-js/svg': major
'@weasel-js/pdf': major
'@weasel-js/diagram-formats': major
---

Every export reports what it drew without, a PNG's included, to `onDiagnostic`, and `strict: true` writes nothing then.

`onWarn(message)` is gone from `ExportOptions`, `exportRegionSvg` and the diagram page exports. `onDiagnostic` hears each loss once as an `ExportDiagnostic`, `{ kind, subject, message }`: a picture or face that failed to load, a paint kind nothing registered, a shader with no GLSL, or what the format cannot hold. With `strict: true` the export rejects with `ExportIncompleteError`, whose `diagnostics` lists them.

```ts
// before
await exportRegions(scene, regions, 'svg', { onWarn: (m) => said.push(m) });
// after
await exportRegions(scene, regions, 'svg', { onDiagnostic: (d) => said.push(d.message) });
```

<!-- entry: rank=5 breaking api fix -->
