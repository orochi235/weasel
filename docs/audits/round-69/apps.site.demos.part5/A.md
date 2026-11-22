## StreamingDemo asks the stream for cells over a fixed 640×400 viewport, so a stage the reader enlarged shows empty world past that box
- where: apps/site/demos/StreamingDemo.tsx:14 (DIMS), :46 and :59 (`stream.update(view, DIMS)`)
- scenario: `DemoStage` is reader-resizable (DemoStage.tsx:8-11: "plus however far the reader has dragged the resize handles"), and the canvas fills it. Drag the stage to 1000×700: the canvas now shows world out to 1000×700 / scale, but every `stream.update` still passes `{ width: 640, height: 400 }`, so cells under the right and bottom of the canvas are never requested and stay blank however the view moves (and the 64-cell eviction is computed against the wrong visible area). It should pass the canvas's actual size, as SceneScrollerDemo does through `onResize` into a ref.
- evidence: read
- severity: medium

## StrokeWidthLab strips the nib from every selected stroke when the nib angle or ratio slider moves while the panel shows "Nib" off
- where: apps/site/demos/StrokeWidthLabDemo.tsx:96-99 (fieldsFor), :135-148 (useStyleControls config change)
- scenario: Shift-select the plain top wave (no nib) first and the handwriting (nib 30°/0.15) second. The panel shows the first selected stroke, so `nib` reads false. Drag "Nib angle" (it has no `showIf`, so it stays visible): `changed = ['nibAngle']`, `fieldsFor('nibAngle', config)` returns `{ nib: undefined }` because `style.nib` is false, and the loop then `delete next.nib` on every selected mark, so the handwriting loses its nib. Moving an angle should never remove a nib. A change to `nibAngle`/`nibRatio` while `nib` is false should write nothing, or only set the angle or ratio on strokes that already have a nib.
- evidence: read
- severity: low

## Files read
apps/site/demos/SceneDemo.tsx
apps/site/demos/SceneLabDemo.tsx
apps/site/demos/SceneScrollerDemo.tsx
apps/site/demos/ScopedGridDemo.tsx
apps/site/demos/ScoreDemo.tsx
apps/site/demos/ScrollingGridDemo.tsx
apps/site/demos/SegmentTypeLabDemo.tsx
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
apps/site/demos/StorageDemo.tsx
apps/site/demos/StreamingDemo.tsx
apps/site/demos/StrokeAndFillDemo.tsx
apps/site/demos/StrokeMarkersDemo.tsx
apps/site/demos/StrokeTrimLabDemo.tsx
apps/site/demos/StrokeWidthLabDemo.tsx
apps/site/demos/SvgDemo.tsx
apps/site/demos/SwapDemo.tsx
apps/site/demos/SymmetryLabDemo.tsx
apps/site/demos/TextDemo.tsx
apps/site/demos/TextDomDemo.tsx
apps/site/demos/TextOutlinesDemo.tsx
apps/site/demos/TextScriptDemo.tsx
apps/site/demos/TextShapingDemo.tsx
apps/site/demos/ThemeDemo.tsx

<!-- done: 2 findings, files read: 36 -->
