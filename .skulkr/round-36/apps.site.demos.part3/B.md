# Audit round 36 — apps.site.demos.part3

## ParallaxDemo's intro tween keeps writing the per-plane-zoom setting it captured at click, undoing a toggle made mid-intro
- where: apps/site/demos/ParallaxDemo.tsx:147 (playIntro) and :178 (Checkbox onChange)
- scenario: click "play intro" with per-plane zoom off, then tick "per-plane zoom" during the 1.4 s tween. The checkbox calls `apply(true, 0)`, but every later `onTick` runs `apply(zoomParallax /* false, closed over at click */, x)`, so all four planes go back to `zoom: 1` and stay there after the tween ends, while the checkbox shows on. The reverse (on → off mid-intro) leaves zoom parallax active under an unticked box. The tick should read the current setting (a ref / `useLatest`), or the toggle should cancel the `'intro'` tween.
- evidence: read
- severity: low

## PlotKindsDemo keys the chart by kind but not its data panel, so the panel's edit error and row state carry over to the next chart kind
- where: apps/site/demos/PlotKindsDemo.tsx:44 (PlotKindsDemo, the `PlotDataPanel` element; `PlotView` at :39 has `key={kind}`)
- scenario: on "gantt", enter a value the field's `set` rejects, so `PlotDataPanel` shows its `PropertyNote` error (`useState` in packages/ui-canvas/src/components/PlotDataPanel/PlotDataPanel.tsx:24, cleared only by a later successful edit). Switch to "pie": the same panel instance re-renders with pie's data and still shows gantt's error under pie's fields. Likewise each `PlotTableView`'s `useRowIds` ref and the `DataGrid`'s open detail rows survive a switch wherever two kinds share a table key, so a row held open in one chart stays open on a different item in the next. The panel should take `key={kind}` like the view does.
- evidence: read
- severity: low

## Files read
apps/site/demos/Lines3dDemo.module.css
apps/site/demos/Lines3dDemo.tsx
apps/site/demos/LoupeDemo.module.css
apps/site/demos/LoupeDemo.tsx
apps/site/demos/LoupeModelDemo.module.css
apps/site/demos/LoupeModelDemo.tsx
apps/site/demos/MeasureLabDemo.module.css
apps/site/demos/MeasureLabDemo.tsx
apps/site/demos/MermaidKindsDemo.tsx
apps/site/demos/MinimapDemo.module.css
apps/site/demos/MinimapDemo.tsx
apps/site/demos/ModesDemo.module.css
apps/site/demos/ModesDemo.tsx
apps/site/demos/MoveSnapDemo.tsx
apps/site/demos/MultiSelectDemo.tsx
apps/site/demos/PTouchLabelDemo.module.css
apps/site/demos/PTouchLabelDemo.tsx
apps/site/demos/PageGridDemo.module.css
apps/site/demos/PageGridDemo.tsx
apps/site/demos/PaintDemo.module.css
apps/site/demos/PaintDemo.tsx
apps/site/demos/PanZoomDemo.tsx
apps/site/demos/ParallaxDemo.tsx
apps/site/demos/PathAnchorEditDemo.tsx
apps/site/demos/PathConstraintsLabDemo.module.css
apps/site/demos/PathConstraintsLabDemo.tsx
apps/site/demos/PathDirectionLabDemo.tsx
apps/site/demos/PathMotionDemo.tsx
apps/site/demos/PathPoseDemo.tsx
apps/site/demos/PathSnapLabDemo.tsx
apps/site/demos/PerAxisZoomDemo.module.css
apps/site/demos/PerAxisZoomDemo.tsx
apps/site/demos/PerceptualColorSlidersDemo.module.css
apps/site/demos/PerceptualColorSlidersDemo.tsx
apps/site/demos/PinWarpLabDemo.tsx
apps/site/demos/PinWarpSolverLabDemo.tsx
apps/site/demos/PlaneWarpLabDemo.tsx
apps/site/demos/PlotKindsDemo.tsx
apps/site/demos/PlotXyChartDemo.tsx
apps/site/demos/PoiseLabDemo.tsx
apps/site/demos/PoseBlendDemo.tsx
apps/site/demos/PrefConditionDiagramDemo.module.css
apps/site/demos/PrefConditionDiagramDemo.tsx
apps/site/demos/PrefsDemo.module.css
apps/site/demos/PrefsDemo.tsx
apps/site/demos/PresentationDemo.css
apps/site/demos/PresentationDemo.tsx
apps/site/demos/QuadtreeDemo.tsx
apps/site/demos/QuantityDemo.module.css

<!-- done: 2 findings, files read: 49 -->
