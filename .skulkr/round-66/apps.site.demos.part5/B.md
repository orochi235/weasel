# Findings: apps.site.demos.part5

## ScoreDemo starts the score on an engine already disposed when it unmounts during `unlock()`
- where: apps/site/demos/ScoreDemo.tsx:83 (toggle), with the unmount cleanup at :58
- scenario: press play (engine and score built, `engine.unlock()` pending), then navigate away before the unlock resolves → the cleanup disposes the engine and nulls `kit.current`, then the pending `.then(() => score.start())` still runs, booking bars on a disposed engine (and calling `setHeard` from `onBar` on an unmounted component). The continuation should check that this kit is still `kit.current` before starting.
- evidence: read
- severity: low

## StrokeAndFillDemo's pencil factory builds a closed polygon, so every pressure stroke gets an edge back to its start
- where: apps/site/demos/StrokeAndFillDemo.tsx:124 (insertNodeFactories.pencil)
- scenario: draw a freehand "C" with the pencil → the factory calls `polygonFromPoints(samples)`, which ends with `b.close()` (packages/geom/src/paths/builder.ts:226), so the committed stroke has a straight closing segment from the last sample back to the first, stroked with the width of… whichever end, and the path is a closed region. The comment beside it even names one anchor per sample, which `polylineFromPoints` (the open variant the ribbon on :100 uses) gives without the closing edge.
- evidence: read
- severity: medium

## SvgDemo serializes the last good import under the default viewBox while the source fails to parse
- where: apps/site/demos/SvgDemo.tsx:125 (export effect)
- scenario: load a source with `viewBox="0 0 800 600"`, then type a character that makes it unparseable → `imported` becomes `{ error }`, the scene keeps the 800×600 content (the load effect returns early), but the export effect reruns and falls back to `VIEW` (0 0 420 320), so the `serializeSvg` pane shows the old nodes cropped to a viewBox they were never in. The viewBox should stay the one the scene's content was imported with.
- evidence: read
- severity: low

## Files read
apps/site/demos/SceneLabDemo.tsx
apps/site/demos/SceneScrollerDemo.module.css
apps/site/demos/SceneScrollerDemo.tsx
apps/site/demos/ScopedGridDemo.tsx
apps/site/demos/ScoreDemo.module.css
apps/site/demos/ScoreDemo.tsx
apps/site/demos/ScrollingGridDemo.tsx
apps/site/demos/SegmentTypeLabDemo.tsx
apps/site/demos/SelectDemo.module.css
apps/site/demos/SelectDemo.tsx
apps/site/demos/SelectionPanelDemo.tsx
apps/site/demos/SequenceDiagramDemo.tsx
apps/site/demos/ShapeBuilderLabDemo.tsx
apps/site/demos/ShapeToolsDemo.tsx
apps/site/demos/SharedBrushSizeDemo.tsx
apps/site/demos/SkinDemo.tsx
apps/site/demos/SliceDemo.tsx
apps/site/demos/SlideNavigationDemo.tsx
apps/site/demos/SmallCapsDemo.tsx
apps/site/demos/SnipLabDemo.tsx
apps/site/demos/SpacingHintsLabDemo.tsx
apps/site/demos/SpiroLabDemo.tsx
apps/site/demos/StickyNotesDemo.tsx
apps/site/demos/StorageDemo.module.css
apps/site/demos/StorageDemo.tsx
apps/site/demos/StrokeAndFillDemo.tsx
apps/site/demos/StrokeMarkersDemo.tsx
apps/site/demos/StrokeTrimLabDemo.module.css
apps/site/demos/StrokeTrimLabDemo.tsx
apps/site/demos/StrokeWidthLabDemo.tsx
apps/site/demos/SvgDemo.module.css
apps/site/demos/SvgDemo.tsx
apps/site/demos/SwapDemo.tsx
apps/site/demos/SymmetryLabDemo.tsx
apps/site/demos/TextDemo.tsx
apps/site/demos/TextDomDemo.module.css
apps/site/demos/TextDomDemo.tsx
apps/site/demos/TextOutlinesDemo.module.css
apps/site/demos/TextOutlinesDemo.tsx
apps/site/demos/TextScriptDemo.module.css
apps/site/demos/TextScriptDemo.tsx
apps/site/demos/TextShapingDemo.module.css
apps/site/demos/TextShapingDemo.tsx
apps/site/demos/ThemeDemo.module.css
apps/site/demos/ThemeDemo.tsx
apps/site/demos/TiledSurfaceDemo.tsx
apps/site/demos/TimelineDemo.tsx
apps/site/demos/TimelineFramesDemo.tsx

<!-- done: 3 findings, files read: 48 -->

