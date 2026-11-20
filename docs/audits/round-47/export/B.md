# Audit round 47 — area `export`

Note: the brief names frozen commit 44e73a944bea29d4d56fc7883fa302daec48ecf1, which this checkout does not hold
(`git cat-file` reports a bad object). The tree read is HEAD 782733b19c; `packages/export` has no working-tree
changes against it.

## selectionRegion frames hidden nodes, nodes on hidden layers and annotation-layer nodes that no export draws
- where: packages/export/src/selectionRegion.ts:13 (selectionRegion)
- scenario: select a node hidden with `scene.setHidden(id, true)` (still selectable from a layers panel), a node on a
  hidden layer, or plainScene's `n` on the annotation layer `notes`, and export the selection. `selectionRegion`
  unions `drawnAabbOf` for every id without asking `nodeGates(doc).hidden` or whether the layer is an annotation
  layer, so the region grows to cover them, while `planPixelRender` (`drawnLayers`) leaves annotation layers out and
  the render walk skips hidden nodes. Selecting only such a node gives a non-null region, so draw's
  `exportSelectionFile` (apps/draw/src/exportPage.ts:61, which skips when the region is null) writes a blank file
  instead of doing nothing. Core answers the same question the other way: `sceneContentBounds`
  (packages/core/src/canvas/contentBounds.ts:27-32) prunes hidden nodes and hidden layers. The doc promises "the
  world box `ids` cover as the document draws them".
- evidence: read
- severity: medium

## The registry path's `background` cannot be the revision-read function the region exports take
- where: packages/export/src/exportTypes.ts:42 (ExportOptions.background)
- scenario: commit 31c843e24d made `background` a function of the document drawn (`ExportBackground`) so a page color
  that comes from the document or theme is read in the revision drawn. `exportRegionPng`
  (`ExportRegionPngOptions.background`) and `regionRenderArgs` take it, and every format's `export`
  (png, svg's regionSvg.ts:49, pdf's regionsPdf.ts:74) resolves it with `exportBackgroundOf`. But `ExportOptions.background`,
  the type `exportRegions`, `exportPages` and `ExportFormat.export` take, is still `string | null`. A caller of the
  registry (draw's `writeExport`, apps/draw/src/exportPage.ts:35) has to resolve the color once before the export
  waits on fonts and paint kinds, which is the race that commit fixed for the page exports; passing a function is a
  type error although every built-in format would honor it. The two option types answer one option two ways.
- evidence: read
- severity: medium

## regionRenderArgs draws the document but reads the background function from the shown scene
- where: packages/export/src/regionRenderArgs.ts:25 (regionRenderArgs)
- scenario: a caller passes the live scene with `background: (doc) => …` reading page data or a pose. `scene` is
  returned as `documentOf(scene)` (line 27), but `exportBackgroundOf(opts.background, scene)` hands the function the
  scene itself, overrides included. With a data override open on the page (say a live color preview), the background
  comes from what the override shows while the content comes from the document. `ExportBackground`'s doc says the
  function reads "the document the export draws". Through `captureExport` the scene handed is already a document
  view, so only direct callers hit this, including the headless raster host its doc points at.
- evidence: read
- severity: low

## exportRegions throws synchronously when a registered format's export does
- where: packages/export/src/exportFormats.ts:80,82 (exportRegions)
- scenario: `exportRegions` turns its own failures (unknown id, bad region count) into rejections, so callers write
  `exportRegions(...).catch(...)` or `await` without a surrounding sync try. A format registered through
  `registerExportFormat` whose `export` is a plain function returning a promise, which validates its options or
  regions and throws before building it, makes `exportRegions` (and `exportPages`) throw synchronously. A
  `.catch` handler never sees it, and the error escapes, for example out of an event handler. `format.export(...)` is
  not wrapped (`Promise.resolve().then(...)` or try/catch → reject), although the `ExportFormat` interface only types
  the return as `Promise<Blob>`.
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

<!-- done: 4 findings, files read: 12 -->
