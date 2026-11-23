## EffectChartPreviewDemo mints preview bitmaps inside useMemo, so a render React discards leaks them
- where: apps/site/demos/EffectChartDemo.tsx:149 (EffectChartPreviewDemo), with useClosePreviews at :140
- scenario: `withPreviews` paints fresh ImageBitmaps during render (inside `useMemo`). `useClosePreviews` closes a run's bitmaps only in the cleanup of an effect that committed with that run. A render that never commits (StrictMode's second render, or a concurrent render interrupted by the next `useElapsed` tick) still calls `paint` and produces bitmaps that no effect ever sees, so they are never `close()`d. Each frame can then leak a set of 64×36 bitmaps whose backing memory the GC does not track. Bitmaps should be minted where their release is guaranteed: in an effect, or in a store that closes the previous set.
- evidence: read (inference about uncommitted renders)
- severity: medium

## DiagramOverlaysDemo never clears its hover, so the "+" overlay stays stuck on the last edge hovered
- where: apps/site/demos/DiagramOverlaysDemo.tsx:62 (onHover)
- scenario: hover an edge, then move the pointer onto empty canvas or a node. `onHover(null)` is ignored, so `hovered` keeps the edge's id and the "+" button stays on that edge indefinitely. It goes away only after a click on it or after another edge is hovered. If the intent is to keep the button reachable while the pointer travels to it, the demo needs a grace period or an overlay-hover check. As written, the button never goes away on its own.
- evidence: read
- severity: low

## DiagramNodesDemo appends every connect, so connecting the same two ports twice gives two edges with one id
- where: apps/site/demos/DiagramNodesDemo.tsx:39 (onConnect)
- scenario: drag a wire from `scale.out` to `load` and then make the same connection again. `setEdges((es) => [...es, edge])` adds a second identical DataEdge. `edgeIdOf` derives the id from from/port/to/label (packages/diagram/src/edgeId.ts:11), so both edges get the same id in `diagramScene`. The scene then holds two nodes under one id (a collision or a silent overwrite), and deleting or selecting one cannot tell them apart. The demo, as a reference for data-owned connects, should skip an edge whose `edgeIdOf` is already present.
- evidence: read (did not confirm what diagramScene does on the collision)
- severity: low

## GesturesDemo starts the drag controllers on any mouse button but feeds them moves only for the primary button
- where: apps/site/demos/GesturesDemo.tsx:307 (onPointerDown) vs :336 (onPointerMove)
- scenario: in the drag, rect, radial or click mode, press the right or middle button and drag. `onPointerDown` calls `drag.start`/`rect.start`/… and captures the pointer, but `onPointerMove` returns early because `e.buttons & 1` is 0. The gesture sits started with no moves until the release ends it. In click mode a right-drag of any length reports CLICK (`wasSubThreshold`), which misrepresents what the primitive does. The `e.button !== 0` guard belongs in `onPointerDown` as well.
- evidence: read
- severity: low

## DitherDemo's export pane keeps the previous export's pixels when an export fails
- where: apps/site/demos/DitherDemo.tsx:172 (export effect catch)
- scenario: change the method or grid so that `exportPage` rejects. The catch only clears the size caption (`setExported(null)`), and the canvas keeps showing the previous export. The caption above it now reads "Export at 300 dpi, Atkinson" with a picture made at another setting. The catch should clear the canvas or mark it stale.
- evidence: read
- severity: low

## Files read
apps/site/demos/DiagramLiveDemo.tsx
apps/site/demos/DiagramNodesDemo.tsx
apps/site/demos/DiagramOverlaysDemo.tsx
apps/site/demos/DiagramReorderDemo.tsx
apps/site/demos/DitherDemo.module.css
apps/site/demos/DitherDemo.tsx
apps/site/demos/DownloadLink.module.css
apps/site/demos/DownloadLink.tsx
apps/site/demos/DrapeLabDemo.tsx
apps/site/demos/EasingsDemo.module.css
apps/site/demos/EasingsDemo.tsx
apps/site/demos/EditingDemo.module.css
apps/site/demos/EditingDemo.tsx
apps/site/demos/EditingSessionsDemo.module.css
apps/site/demos/EditingSessionsDemo.tsx
apps/site/demos/EffectChartDemo.tsx
apps/site/demos/EffectsDemo.tsx
apps/site/demos/ExportDemo.module.css
apps/site/demos/ExportDemo.tsx
apps/site/demos/FairingLabDemo.module.css
apps/site/demos/FairingLabDemo.tsx
apps/site/demos/FilletLabDemo.module.css
apps/site/demos/FilletLabDemo.tsx
apps/site/demos/FilletPanel.tsx
apps/site/demos/FontFallbackDemo.module.css
apps/site/demos/FontFallbackDemo.tsx
apps/site/demos/ForceGraphDemo.module.css
apps/site/demos/ForceGraphDemo.tsx
apps/site/demos/GeomDemo.module.css
apps/site/demos/GeomDemo.tsx
apps/site/demos/GestureGrammarDemo.module.css
apps/site/demos/GestureGrammarDemo.tsx
apps/site/demos/GesturesDemo.tsx
apps/site/demos/HandleLockLabDemo.module.css
apps/site/demos/HandleLockLabDemo.tsx
apps/site/demos/HandleSnapLabDemo.tsx
apps/site/demos/HistoryDemo.module.css
apps/site/demos/HistoryDemo.tsx
apps/site/demos/HudContextMenuDemo.tsx
apps/site/demos/HudDemo.tsx
apps/site/demos/HudGalleryDemo.tsx
apps/site/demos/IconsDemo.module.css
apps/site/demos/IconsDemo.tsx
apps/site/demos/ImageDemo.tsx
apps/site/demos/IngestionDemo.tsx
apps/site/demos/InsertDemo.tsx
apps/site/demos/Kernel3dDemo.module.css
apps/site/demos/Kernel3dDemo.tsx

<!-- done: 5 findings, files read: 48 -->
