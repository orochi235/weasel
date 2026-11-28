# export: findings

No defects found. Checked and cleared:

- `selectionRegion`'s `shownIds`: `nodeGates({ get })` climbs ancestors' own `hidden` flag (`hiddenAbove`), so a selected child of a hidden group is dropped; the layer gate uses the layered `nodeGates(doc)`.
- `exportFormats()` ordering and caching: png is pushed first by `ensureBuiltIns` and never disposed, so it stays first in Map order; `entries()` is the same array per revision.
- `captureExport`: fixed regions are copied synchronously before the first await (the `exportRegionPng` → `capturePngRegion` path is synchronous up to `warm`); diagnostics from discarded attempts never reach `report`.
- `exportRegions`: the count check runs inside the wrapper for function regions, so it rejects through `captureExport`; synchronous throws become rejections.

## Files read
packages/export/src/captureExport.ts
packages/export/src/exportDiagnostics.ts
packages/export/src/exportFormats.ts
packages/export/src/exportPages.ts
packages/export/src/exportTypes.ts
packages/export/src/index.ts
packages/export/src/placedRects.fixture.ts
packages/export/src/regionPng.ts
packages/export/src/regionRenderArgs.ts
packages/export/src/selectionRegion.ts
packages/export/src/testing/parallaxScene.ts
packages/export/src/testing/plainScene.ts

<!-- done: 0 findings, files read: 12 -->
