# Audit round 78 — apps.site.demos.part2

## Connecting the same two ports twice adds a second edge with the same id
- where: apps/site/demos/DiagramNodesDemo.tsx:39 (DiagramNodesDemo, onConnect)
- scenario: drag a wire from `scale.out` to `load`'s port, then drag the same wire again. `onConnect` appends unconditionally, and `edgeIdOf` (packages/diagram/src/edgeId.ts:11) derives the same `edge:scale.out->load.…` id for both, so `diagramScene` is handed two edges sharing one scene id; the demo should drop (or refuse via `canConnect`) an edge whose id is already present, as the effect editor's handler does by returning null when no new wire results. What the scene does with the duplicate id was not traced (inferred: a collision or a silently doubled edge).
- evidence: read
- severity: medium

## The preview demo leaks a full set of ImageBitmaps per frame under StrictMode
- where: apps/site/demos/EffectChartDemo.tsx:139 (EffectChartPreviewDemo, `useMemo(() => withPreviews(...))`)
- scenario: the site mounts under `<StrictMode>` (apps/site/main.tsx). In development React calls a `useMemo` factory twice whenever its deps change and keeps one result; `t` changes every frame, and each call runs `paint()`, which mints fresh bitmaps with `transferToImageBitmap()` (effectChartPictures.ts:144). The discarded call's bitmaps never reach `useClosePreviews`, so they are never closed — the exact leak that hook's comment says it exists to prevent. Creating resources belongs in an effect (or a ref-held producer) rather than in a memo factory.
- evidence: read
- severity: low

## A failed export keeps the previous image under a caption describing the new settings
- where: apps/site/demos/DitherDemo.tsx:166 (DitherDemo, export effect `.catch`)
- scenario: change the grid or method so `exportPage` rejects; the catch only sets `exported` to null, leaving the last successful export drawn in the `<canvas>` while the figcaption now reads "Export at {new resolution}, {new method}". The canvas should be cleared (or the caption kept to what is shown) on failure.
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

<!-- done: 3 findings, files read: 48 -->
