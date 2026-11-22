# Findings: apps.site.demos.part5

## StreamingDemo asks the stream for a fixed 640×400 window, so cells past it never load after the stage is resized
- where: apps/site/demos/StreamingDemo.tsx:14,46,59 (StreamingDemo: `DIMS`, `stream.update(START, DIMS)`, `onViewChange`)
- scenario: `DemoStage` lets the reader drag the stage bigger (DemoStage.tsx:9-12), and the `SceneCanvas` grows with it. Every `stream.update` call still passes the constant `DIMS = { width: 640, height: 400 }`. Widen the stage to 1000 px and the strip from x 640 to 1000 never gets its cells requested, so it stays empty until a pan brings that world area inside the first 640×400 px. It should pass the canvas's real size, the way SceneScrollerDemo keeps `dims` in a ref through `onResize` (SceneScrollerDemo.tsx:89,294), and call `update` again when the canvas resizes. The world is endless, so the empty strip is all wrong output.
- evidence: read
- severity: medium

## StreamingDemo's load leaves its abort listener in place and never checks an already-aborted signal
- where: apps/site/demos/StreamingDemo.tsx:24-37 (WORLD.load)
- scenario: When the 80 ms `after` timer fires and resolves, the `abort` listener stays on the signal; it is added without `{ once: true }` and never removed. If the stream hands over a signal that is already aborted (a cell is dropped before `load` runs), `addEventListener('abort')` never fires. The 80 ms timer then runs anyway and builds 36 node specs for a cell nobody wants. The load should check `signal.aborted` first and remove the listener once it resolves. This is the reference demo for a `SceneSource`, so consumers will copy the pattern.
- evidence: read
- severity: low

## Files read
apps/site/demos/SceneDemo.tsx
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
apps/site/demos/StreamingDemo.module.css
apps/site/demos/StreamingDemo.tsx
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

<!-- done: 2 findings, files read: 48 -->
