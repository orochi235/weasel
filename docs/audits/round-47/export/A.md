# Audit round 47 — area `export`

Note: the tree is at 782733b19c (the brief's 44e73a94… is not an object in this repo); findings cite this tree.

## selectionRegion boxes hidden nodes and annotation-layer nodes, which no export draws
- where: packages/export/src/selectionRegion.ts:13 (selectionRegion)
- scenario: the selection holds a node on an annotation layer (e.g. `n` on `notes` in plainScene), or a node that is `hidden` / on a hidden layer. Every format leaves annotation layers out (planPixelRender's `drawnLayers`, the SVG export) and draws no hidden node, but `selectionRegion` filters only page structure. So the box grows to cover those nodes, and a selection made only of them returns a non-null region instead of the documented `null` ("`null` when none of them draws anything"). The export then writes a blank or oversized image. It should drop ids for which `doc.isHidden(id)` is true or that sit on an annotation layer.
- evidence: read
- severity: medium

## selectionRegion measures `{ px }` strokes at scale 1, so an export at scale < 1 crops them
- where: packages/export/src/selectionRegion.ts:16 (selectionRegion → drawnAabbOf without `scale`)
- scenario: a node with a 10px screen-pixel stroke, exported through `exportRegions(scene, [selectionRegion(scene, ids)!], 'png', { scale: 0.5 })`. drawnAabbOf resolves the px width at its default scale 1, a half-width of 5 world units. The PNG draws that stroke at 10 output px, which is 20 world units wide (half-width 10). So the outer 5 world units of the stroke fall outside the region and are cut. selectionRegion takes no scale, so the caller has no way to ask for the box the export will actually draw.
- evidence: read
- severity: low

## No selection region source: the README's selection export reads its bounds outside the revision it draws
- where: packages/export/src/selectionRegion.ts:9 (selectionRegion); README example `exportRegions(scene, [selectionRegion(scene, selection.get())!], 'svg')`
- scenario: exportTypes.ts:18-21 and the 2026-11-14 ruling promise that a selection's bounds, read through a region function, belong to the revision drawn. exportPages has `pageRegionsSource` for this. selectionRegion only returns a fixed rect, and the package has no `(doc) => …` form for a selection. The documented call measures the selection before `captureExport` warms. An edit that moves or resizes the selected nodes during the warm restarts the capture, and the capture then draws the new content inside the old bounds (cropped, or with a blank margin). The contract describes a `selectionRegionSource(ids, name)` that re-reads the bounds on each attempt.
- evidence: read
- severity: low

## The registry's `background` is typed `string | null`, so exportRegions/exportPages cannot take the revision-read function every format accepts
- where: packages/export/src/exportTypes.ts:42 (ExportOptions.background); packages/export/src/exportFormats.ts:66, packages/export/src/exportPages.ts:42
- scenario: 31c843e24d made `background` a function of the document (`ExportBackground`) so that a theme's page color is read from the revision drawn. PNG_EXPORT, SVG_EXPORT and PDF_EXPORT all forward one: `exportRegionPng`, `exportRegionSvg` and `exportRegionsPdf` take `ExportBackground`. But `ExportOptions.background` is `string | null`, and the `opts` of `exportRegions` and `exportPages` is `ExportOptions & Record<string, unknown>`. So `exportPages(scene, pages, 'pdf', { background: (doc) => pageColor(doc) })` fails to typecheck. A typed caller of the registry has to resolve the color before the call, which reopens the race that commit fixed. The format-generic path and the per-format path answer the same option two ways.
- evidence: read
- severity: low

## exportRegions throws synchronously when a format's `export` throws, though every other failure rejects
- where: packages/export/src/exportFormats.ts:80,82 (exportRegions)
- scenario: a format registered through `registerExportFormat` whose `export` is a plain function that throws before returning a promise (e.g. while validating its own options). An unknown id and a bad region count both become `Promise.reject`, but `return format.export(...)` is not guarded. The throw escapes `exportRegions`/`exportPages` synchronously, so a caller doing `exportRegions(...).catch(show)` never reaches its handler. Wrapping the call (`try { return Promise.resolve(format.export(...)) } catch (e) { return Promise.reject(e) }`) keeps a single failure channel.
- evidence: read
- severity: low

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

<!-- done: 5 findings, files read: 12 -->
