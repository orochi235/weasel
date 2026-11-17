---
'@weasel-js/core': major
---

Region exports moved out of core into `@weasel-js/export`: the format registry, `exportRegions`, `exportPages` and the rest.

`exportFormatRegistry`, `exportFormats`, `exportRegions`, `registerExportFormat`, `exportPages`, `pageRegion`, `pageRegionSource`, `pageRegionsSource`, `exportRegionPng`, `selectionRegion`, `regionRenderArgs`, `captureExport`, `exportRegionsOf`, `regionsOfOne`, `EXPORT_CAPTURE_ATTEMPTS`, `ExportRevisionError`, `exportReporter`, `ExportIncompleteError` and their types (`ExportFormat`, `ExportOptions`, `ExportRegion`, `ExportRegionSource`, `ExportRegions`, `ExportScene`, `ExportDiagnostic`, `ExportReporter`, `ExportCaptureSteps`, `ExportRegionPngOptions`, `PngExportOptions`, `RegionRenderArgs`, `RegionRenderArgsOptions`) are no longer exported from core. Import them from `@weasel-js/export`, unchanged. `RenderDiagnostic`, `rasterToPng`, `warmRender` and `renderSceneToPixels` stay in core.

```ts
// before
import { exportPages, exportRegions, placedPagesOf, selectionRegion } from '@weasel-js/core';
// after
import { placedPagesOf } from '@weasel-js/core';
import { exportPages, exportRegions, selectionRegion } from '@weasel-js/export';
```

<!-- entry: rank=10 breaking api -->
