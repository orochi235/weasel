---
'@weasel-js/export': minor
---

New package `@weasel-js/export` writes a page, a selection or any rect of a scene as PNG, or in a format another package registers.

It holds what core exported before: `exportRegions(scene, regions, formatId, opts)`, `exportPages`, `exportRegionPng`, the format registry (`registerExportFormat`, `exportFormats`, `exportFormatRegistry`), `captureExport` for a format of your own, and the diagnostics `onDiagnostic` and `strict` report through. `@weasel-js/core` is a peer.

<!-- entry: new api -->
